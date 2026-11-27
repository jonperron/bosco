import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oidc from 'openid-client';

import {
  AccountEmailConflictError,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  findSession,
  upsertAccountFromOidc,
  type Account,
  type Database,
} from '@bosco/db';

import type { Env } from '../config/env.js';
import { DATABASE } from '../database/database.module.js';

/** Injection token of the OIDC issuer; Google in production, a local stub in tests. */
export const OIDC_ISSUER = Symbol('OIDC_ISSUER');
export const GOOGLE_ISSUER = 'https://accounts.google.com';

/** Fixed on purpose (no knob): a signed-in manager stays signed in for a week. */
export const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
/** Time allowed between the redirect to Google and the callback. */
export const LOGIN_TRANSACTION_SECONDS = 10 * 60;

/** One-time secrets of a login in progress, kept in a short-lived cookie until the callback. */
export interface LoginTransaction {
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
}

/** `denied`: not allowed to sign in; `failed`: the exchange went wrong, try again. */
export type LoginRefusal = 'denied' | 'failed';

export type LoginOutcome =
  | { readonly ok: true; readonly token: string }
  | { readonly ok: false; readonly reason: LoginRefusal };

/** Name and code of an error, never its message: OIDC errors may quote tokens or claims. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? `${error.name} ${code}` : error.name;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private configuration: Promise<oidc.Configuration> | null = null;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(OIDC_ISSUER) private readonly issuer: string,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  get redirectUri(): string {
    return `${this.config.get('PUBLIC_URL', { infer: true })}/api/auth/callback`;
  }

  /** The URL to send the browser to, and the secrets to keep until the callback. */
  async startLogin(): Promise<{ url: string; transaction: LoginTransaction } | null> {
    const configuration = await this.discover();
    if (configuration === null) return null;
    const transaction = {
      state: oidc.randomState(),
      nonce: oidc.randomNonce(),
      codeVerifier: oidc.randomPKCECodeVerifier(),
    };
    const url = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri,
      scope: 'openid email profile',
      code_challenge: await oidc.calculatePKCECodeChallenge(transaction.codeVerifier),
      code_challenge_method: 'S256',
      state: transaction.state,
      nonce: transaction.nonce,
      // A hint for Google's account chooser only; the hd claim is what is enforced.
      hd: this.config.get('GOOGLE_WORKSPACE_DOMAIN', { infer: true }),
    });
    return { url: url.href, transaction };
  }

  /**
   * Exchanges the code, checks the ID token (signature, issuer, audience, expiry, nonce) and the
   * company domain, then opens a session. A refusal creates neither account nor session.
   */
  async finishLogin(callbackUrl: URL, transaction: LoginTransaction): Promise<LoginOutcome> {
    const configuration = await this.discover();
    if (configuration === null) return { ok: false, reason: 'failed' };
    let claims: oidc.IDToken | undefined;
    try {
      const tokens = await oidc.authorizationCodeGrant(
        configuration,
        callbackUrl,
        {
          pkceCodeVerifier: transaction.codeVerifier,
          expectedState: transaction.state,
          expectedNonce: transaction.nonce,
          idTokenExpected: true,
        },
        // The registered URI, not one rebuilt from the request path (case, trailing slash).
        { redirect_uri: this.redirectUri },
      );
      claims = tokens.claims();
    } catch (error) {
      this.logger.warn(`Sign-in failed: ${describe(error)}`);
      return { ok: false, reason: 'failed' };
    }
    const domain = this.config.get('GOOGLE_WORKSPACE_DOMAIN', { infer: true });
    // The email suffix proves nothing: only Google's hd claim says the account is the company's.
    if (
      claims === undefined ||
      claims.email_verified !== true ||
      typeof claims.email !== 'string' ||
      typeof claims.hd !== 'string' ||
      claims.hd.toLowerCase() !== domain
    ) {
      this.logger.log('Sign-in denied: not a verified account of the company domain');
      return { ok: false, reason: 'denied' };
    }
    const name = typeof claims['name'] === 'string' ? claims['name'].trim() : '';
    let account: Account;
    try {
      account = await upsertAccountFromOidc(this.db, {
        subject: claims.sub,
        email: claims.email,
        displayName: name === '' ? claims.email : name,
      });
    } catch (error) {
      if (!(error instanceof AccountEmailConflictError)) throw error;
      this.logger.log('Sign-in denied: the email belongs to another account');
      return { ok: false, reason: 'denied' };
    }
    // Opportunistic purge: logins are rare enough, and no scheduler exists yet.
    await deleteExpiredSessions(this.db);
    const { token } = await createSession(this.db, account.id, SESSION_LIFETIME_SECONDS);
    return { ok: true, token };
  }

  async findAccount(token: string): Promise<Account | null> {
    return (await findSession(this.db, token))?.account ?? null;
  }

  async logout(token: string): Promise<void> {
    await deleteSession(this.db, token);
  }

  /** Discovery is cached once it succeeds; a failure is retried at the next login. */
  private async discover(): Promise<oidc.Configuration | null> {
    this.configuration ??= this.runDiscovery();
    try {
      return await this.configuration;
    } catch (error) {
      this.configuration = null;
      this.logger.error(`OIDC discovery failed: ${describe(error)}`);
      return null;
    }
  }

  private async runDiscovery(): Promise<oidc.Configuration> {
    const issuer = new URL(this.issuer);
    const configuration = await oidc.discovery(
      issuer,
      this.config.get('GOOGLE_CLIENT_ID', { infer: true }),
      this.config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
      undefined,
      // Plain HTTP is only reachable through the test-only stub issuer; Google is https.
      issuer.protocol === 'http:' ? { execute: [oidc.allowInsecureRequests] } : undefined,
    );
    // Verify the ID token signature against the issuer's JWKS, not only TLS to its endpoint.
    oidc.enableNonRepudiationChecks(configuration);
    return configuration;
  }
}
