import { account, session, upsertAccountFromOidc, type Database } from '@bosco/db';
import type { INestApplication } from '@nestjs/common';
import type { JWTPayload } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '@/app.factory.js';

import { startStubIssuer, type StubGrant, type StubIssuer } from './stub-issuer.js';
import { createMigratedDatabase } from './throwaway-database.js';

// PUBLIC_URL and GOOGLE_WORKSPACE_DOMAIN come from TEST_ENV (vitest.config.ts).
const WEB_APP = 'http://localhost:3000/';
const DENIED = 'http://localhost:3000/?auth_error=denied';
const FAILED = 'http://localhost:3000/?auth_error=failed';
const ORIGIN = 'http://localhost:3000';

let stub: StubIssuer;
let app: INestApplication;
let db: Database;
let drop: () => Promise<void>;
let codes = 0;

beforeAll(async () => {
  stub = await startStubIssuer();
  const database = await createMigratedDatabase();
  db = database.db;
  drop = database.drop;
  process.env['DATABASE_URL'] = database.url;
  app = await createApp({ oidcIssuer: stub.issuer });
});

afterAll(async () => {
  await app?.close();
  await drop?.();
  await stub?.close();
});

beforeEach(async () => {
  await db.delete(session);
  await db.delete(account);
});

function cookiePairs(response: request.Response): string[] {
  const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
  return raw ?? [];
}

function cookieNamed(response: request.Response, prefix: string): string | undefined {
  return cookiePairs(response).find((cookie) => cookie.startsWith(prefix));
}

/** A valid Google-like identity of the company domain; override any claim. */
function identity(overrides: JWTPayload = {}): JWTPayload {
  return {
    sub: 'google-subject-1',
    email: 'manager.one@example.test',
    email_verified: true,
    hd: 'example.test',
    name: 'Manager One',
    ...overrides,
  };
}

/** Runs the whole flow: login redirect, then the callback with what the stub issued. */
async function signIn(
  claims: JWTPayload,
  options: Omit<StubGrant, 'claims'> & { nonce?: string; state?: string; cookie?: string } = {},
) {
  const login = await request(app.getHttpServer()).get('/api/auth/login');
  expect(login.status).toBe(302);
  const location = new URL(login.headers['location'] as string);
  const transaction = cookieNamed(login, '__Host-bosco_oidc=')?.split(';')[0] ?? '';
  const code = `code-${++codes}`;
  stub.grant(code, location.searchParams.get('code_challenge') ?? '', {
    ...options,
    claims: { nonce: options.nonce ?? location.searchParams.get('nonce'), ...claims },
  });
  const state = options.state ?? location.searchParams.get('state') ?? '';
  const callback = await request(app.getHttpServer())
    .get(`/api/auth/callback?code=${code}&state=${encodeURIComponent(state)}`)
    .set('Cookie', [transaction, options.cookie ?? ''].filter((pair) => pair !== '').join('; '));
  return { login, location, callback };
}

function sessionCookie(response: request.Response): string {
  return cookieNamed(response, '__Host-bosco_session=')?.split(';')[0] ?? '';
}

describe('GET /api/auth/login', () => {
  it('redirects to the issuer with PKCE S256, state, nonce and the domain hint', async () => {
    const login = await request(app.getHttpServer()).get('/api/auth/login');

    expect(login.status).toBe(302);
    const location = new URL(login.headers['location'] as string);
    expect(`${location.origin}${location.pathname}`).toBe(`${stub.issuer}/authorize`);
    const params = Object.fromEntries(location.searchParams);
    expect(params).toMatchObject({
      response_type: 'code',
      client_id: 'test-client-id',
      redirect_uri: 'http://localhost:3000/api/auth/callback',
      scope: 'openid email profile',
      code_challenge_method: 'S256',
      hd: 'example.test',
    });
    expect(params['code_challenge']).toMatch(/^[\w-]{43}$/);
    expect(params['state']).toMatch(/^[\w-]{20,}$/);
    expect(params['nonce']).toMatch(/^[\w-]{20,}$/);
    const transaction = cookieNamed(login, '__Host-bosco_oidc=') ?? '';
    expect(transaction).toMatch(/HttpOnly/);
    expect(transaction).toMatch(/Secure/);
    expect(transaction).toMatch(/SameSite=Lax/);
    expect(transaction).toMatch(/Path=\//);
  });
});

describe('GET /api/auth/callback', () => {
  it('signs a company manager in: account, session cookie, back to the web app', async () => {
    const { callback } = await signIn(identity());

    expect(callback.status).toBe(302);
    expect(callback.headers['location']).toBe(WEB_APP);
    const cookie = cookieNamed(callback, '__Host-bosco_session=') ?? '';
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=604800/);
    // The one-time transaction cookie is cleared.
    expect(cookieNamed(callback, '__Host-bosco_oidc=')).toMatch(/Expires=Thu, 01 Jan 1970/);
    const accounts = await db.select().from(account);
    expect(accounts).toEqual([
      expect.objectContaining({
        oidcSubject: 'google-subject-1',
        email: 'manager.one@example.test',
        displayName: 'Manager One',
      }),
    ]);
    expect(await db.select().from(session)).toHaveLength(1);
  });

  it('falls back to the email when the token has no name', async () => {
    await signIn(identity({ name: undefined }));

    const [row] = await db.select().from(account);
    expect(row?.displayName).toBe('manager.one@example.test');
  });

  it('accepts the domain whatever its case in the token', async () => {
    const { callback } = await signIn(identity({ hd: 'Example.TEST' }));

    expect(callback.headers['location']).toBe(WEB_APP);
  });

  it.each<[string, JWTPayload]>([
    ['another Workspace domain', { hd: 'other.test' }],
    ['a consumer account (no hd), even with a company-looking email', { hd: undefined }],
    ['a company email suffix with another hd', { hd: 'evil.test' }],
    ['an unverified email', { email_verified: false }],
    ['an email_verified given as a string', { email_verified: 'true' }],
    ['a missing email', { email: undefined }],
  ])('refuses %s: no account, no session', async (_case, overrides) => {
    const { callback } = await signIn(identity(overrides));

    expect(callback.status).toBe(302);
    expect(callback.headers['location']).toBe(DENIED);
    expect(sessionCookie(callback)).toBe('');
    expect(await db.select().from(account)).toEqual([]);
    expect(await db.select().from(session)).toEqual([]);
  });

  it('refuses an email held by another subject with the same non-revealing code', async () => {
    await upsertAccountFromOidc(db, {
      subject: 'google-subject-2',
      email: 'Manager.One@example.test',
      displayName: 'Earlier holder',
    });

    const { callback } = await signIn(identity());

    expect(callback.headers['location']).toBe(DENIED);
    expect(sessionCookie(callback)).toBe('');
    expect(await db.select().from(account)).toHaveLength(1);
    expect(await db.select().from(session)).toEqual([]);
  });

  it.each<[string, Omit<StubGrant, 'claims'> & { nonce?: string; state?: string }]>([
    ['a token signed by an unknown key', { foreignKey: true }],
    ['a token for another client', { audience: 'another-client' }],
    ['an expired token', { expiresIn: -120 }],
    ['a replayed or foreign nonce', { nonce: 'not-the-nonce-we-sent' }],
    ['a state that does not match', { state: 'not-the-state-we-sent' }],
  ])('fails on %s: no account, no session', async (_case, options) => {
    const { callback } = await signIn(identity(), options);

    expect(callback.headers['location']).toBe(FAILED);
    expect(sessionCookie(callback)).toBe('');
    expect(await db.select().from(account)).toEqual([]);
  });

  it('fails without the transaction cookie (callback not started here)', async () => {
    const callback = await request(app.getHttpServer()).get(
      '/api/auth/callback?code=whatever&state=whatever',
    );

    expect(callback.headers['location']).toBe(FAILED);
  });

  it.each(['not-base64-json', Buffer.from('{"state":1}').toString('base64url')])(
    'fails on a tampered transaction cookie %s',
    async (value) => {
      const callback = await request(app.getHttpServer())
        .get('/api/auth/callback?code=whatever&state=whatever')
        .set('Cookie', `__Host-bosco_oidc=${value}`);

      expect(callback.headers['location']).toBe(FAILED);
    },
  );

  it('sends the browser back with failed when the issuer is unreachable', async () => {
    // A closed port: discovery fails at login and again at callback (never cached).
    const unreachable = await createApp({ oidcIssuer: 'http://127.0.0.1:9' });
    try {
      const login = await request(unreachable.getHttpServer()).get('/api/auth/login');
      expect(login.headers['location']).toBe(FAILED);
      const transaction = Buffer.from(
        JSON.stringify({ state: 's', nonce: 'n', codeVerifier: 'v' }),
      ).toString('base64url');
      const callback = await request(unreachable.getHttpServer())
        .get('/api/auth/callback?code=c&state=s')
        .set('Cookie', `__Host-bosco_oidc=${transaction}`);
      expect(callback.headers['location']).toBe(FAILED);
    } finally {
      await unreachable.close();
    }
  });

  it('fails when the issuer reports an error instead of a code', async () => {
    const login = await request(app.getHttpServer()).get('/api/auth/login');
    const state = new URL(login.headers['location'] as string).searchParams.get('state');
    const transaction = cookieNamed(login, '__Host-bosco_oidc=')?.split(';')[0] ?? '';

    const callback = await request(app.getHttpServer())
      .get(`/api/auth/callback?error=access_denied&state=${state}`)
      .set('Cookie', transaction);

    expect(callback.headers['location']).toBe(FAILED);
  });

  it('ends the session the browser already had when someone signs in again', async () => {
    const first = await signIn(identity());

    const second = await signIn(identity({ sub: 'google-subject-4', email: 'b@example.test' }), {
      cookie: sessionCookie(first.callback),
    });

    expect(second.callback.headers['location']).toBe(WEB_APP);
    expect(await db.select().from(session)).toHaveLength(1);
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', sessionCookie(first.callback));
    expect(me.status).toBe(401);
  });

  it('purges expired sessions at login', async () => {
    const holder = await upsertAccountFromOidc(db, {
      subject: 'google-subject-3',
      email: 'manager.three@example.test',
      displayName: 'Manager Three',
    });
    const hour = 3_600_000;
    await db.insert(session).values({
      tokenHash: 'a'.repeat(64),
      accountId: holder.id,
      createdAt: new Date(Date.now() - 2 * hour),
      expiresAt: new Date(Date.now() - hour),
    });

    await signIn(identity());

    const rows = await db.select().from(session);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).not.toBe('a'.repeat(64));
  });
});

describe('GET /api/auth/me', () => {
  it('returns the signed-in account', async () => {
    const { callback } = await signIn(identity());
    const [row] = await db.select().from(account);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', sessionCookie(callback));

    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      id: row?.id,
      email: 'manager.one@example.test',
      displayName: 'Manager One',
    });
  });

  it.each([
    ['no cookie', ''],
    ['an unknown token', '__Host-bosco_session=not-a-session'],
    ['a malformed cookie', '__Host-bosco_session=%E0%A4%A'],
  ])('answers 401 with %s', async (_case, cookie) => {
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie);

    expect(me.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('deletes the session and clears the cookie', async () => {
    const { callback } = await signIn(identity());
    const cookie = sessionCookie(callback);

    const logout = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie);

    expect(logout.status).toBe(204);
    expect(cookieNamed(logout, '__Host-bosco_session=')).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(await db.select().from(session)).toEqual([]);
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(401);
  });

  it.each([
    ['no Origin header', undefined],
    ['a cross-site Origin', 'https://evil.example'],
    ['an opaque Origin', 'null'],
  ])('refuses %s with 403 and keeps the session (CSRF)', async (_case, origin) => {
    const { callback } = await signIn(identity());
    const call = request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie(callback));

    const logout = await (origin === undefined ? call : call.set('Origin', origin));

    expect(logout.status).toBe(403);
    expect(await db.select().from(session)).toHaveLength(1);
  });

  it('answers 204 without a session', async () => {
    const logout = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', ORIGIN);

    expect(logout.status).toBe(204);
  });
});
