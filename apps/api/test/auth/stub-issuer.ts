import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';

/** What the token endpoint puts in the ID token for one authorization code. */
export interface StubGrant {
  readonly claims: JWTPayload;
  /** Sign with a key the issuer does not publish (forged token). */
  readonly foreignKey?: boolean;
  /** Override the audience (another client's token). */
  readonly audience?: string;
  /** Seconds from now; negative for an expired token. */
  readonly expiresIn?: number;
}

/**
 * A local OpenID provider: discovery, JWKS and token endpoints, enough for the authorization
 * code flow with PKCE. The authorization endpoint is never called: tests read the state, nonce
 * and challenge from the login redirect and register a code with `grant`.
 */
export interface StubIssuer {
  readonly issuer: string;
  grant(code: string, codeChallenge: string, grant: StubGrant): void;
  close(): Promise<void>;
}

export const STUB_CLIENT_ID = 'test-client-id';

export async function startStubIssuer(): Promise<StubIssuer> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const foreign = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'stub', alg: 'RS256', use: 'sig' };
  const grants = new Map<string, { challenge: string; grant: StubGrant }>();
  let issuer = '';

  async function token(form: URLSearchParams): Promise<[number, unknown]> {
    const pending = grants.get(form.get('code') ?? '');
    grants.delete(form.get('code') ?? '');
    const verifier = form.get('code_verifier') ?? '';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    if (pending === undefined || pending.challenge !== challenge) {
      return [400, { error: 'invalid_grant' }];
    }
    const { grant } = pending;
    const now = Math.floor(Date.now() / 1000);
    const idToken = await new SignJWT({ ...grant.claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'stub' })
      .setIssuer(issuer)
      .setAudience(grant.audience ?? STUB_CLIENT_ID)
      .setIssuedAt(now - 5)
      .setExpirationTime(now + (grant.expiresIn ?? 300))
      .sign(grant.foreignKey === true ? foreign.privateKey : privateKey);
    return [200, { access_token: 'stub-access', token_type: 'Bearer', id_token: idToken }];
  }

  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const reply = ([status, body]: [number, unknown]) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      };
      const path = new URL(request.url ?? '/', issuer).pathname;
      if (path === '/.well-known/openid-configuration') {
        reply([
          200,
          {
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            jwks_uri: `${issuer}/jwks`,
            response_types_supported: ['code'],
            subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: ['RS256'],
            code_challenge_methods_supported: ['S256'],
          },
        ]);
      } else if (path === '/jwks') {
        reply([200, { keys: [jwk] }]);
      } else if (path === '/token' && request.method === 'POST') {
        token(new URLSearchParams(Buffer.concat(chunks).toString())).then(reply, () =>
          reply([500, { error: 'server_error' }]),
        );
      } else {
        reply([404, { error: 'not_found' }]);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    issuer,
    grant: (code, codeChallenge, grant) => grants.set(code, { challenge: codeChallenge, grant }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
