import { createHash } from 'node:crypto';
import { count, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AccountEmailConflictError,
  upsertAccountFromOidc,
  type OidcIdentity,
} from '../src/accounts.js';
import { createDatabase, type Database } from '../src/client.js';
import { runMigrations } from '../src/migrate.js';
import { account, session } from '../src/schema.js';
import {
  createSession,
  deleteExpiredSessions,
  deleteSession,
  findSession,
} from '../src/sessions.js';
import { closeDatabase, createThrowawayDatabase } from './throwaway-database.js';

let db: Database;
let drop: () => Promise<void>;

beforeAll(async () => {
  const created = await createThrowawayDatabase();
  drop = created.drop;
  db = createDatabase(created.url);
  await runMigrations(db);
});

afterAll(async () => {
  if (db) await closeDatabase(db);
  await drop?.();
});

beforeEach(async () => {
  await db.delete(account);
});

// Fictitious identities on the reserved example.com domain (RFC 2606).
const ada: OidcIdentity = {
  subject: 'sub-ada',
  email: 'ada@example.com',
  displayName: 'Ada Alpha',
};
const bo: OidcIdentity = { subject: 'sub-bo', email: 'bo@example.com', displayName: 'Bo Beta' };

/** Moves a session into the past: created two hours ago, expired one hour ago. */
async function expire(token: string): Promise<void> {
  const hash = createHash('sha256').update(token).digest('hex');
  await db
    .update(session)
    .set({
      createdAt: sql`now() - interval '2 hours'`,
      expiresAt: sql`now() - interval '1 hour'`,
    })
    .where(eq(session.tokenHash, hash));
}

async function sessionCount(): Promise<number> {
  const [row] = await db.select({ total: count() }).from(session);
  return row?.total ?? 0;
}

describe('upsertAccountFromOidc', () => {
  it('creates the account at first login', async () => {
    const created = await upsertAccountFromOidc(db, ada);
    expect(created).toMatchObject({
      oidcSubject: 'sub-ada',
      email: 'ada@example.com',
      displayName: 'Ada Alpha',
    });
    const [row] = await db.select({ total: count() }).from(account);
    expect(row?.total).toBe(1);
  });

  it('matches on the subject and follows an email and name change', async () => {
    const first = await upsertAccountFromOidc(db, ada);
    const renamed = await upsertAccountFromOidc(db, {
      subject: 'sub-ada',
      email: 'ada.alpha@example.com',
      displayName: 'Ada A.',
    });
    expect(renamed.id).toBe(first.id);
    expect(renamed).toMatchObject({ email: 'ada.alpha@example.com', displayName: 'Ada A.' });
  });

  it('refuses an email held by another subject, ignoring case, and changes nothing', async () => {
    const held = await upsertAccountFromOidc(db, ada);
    const intruder = { subject: 'sub-other', email: 'ADA@example.com', displayName: 'Other' };
    await expect(upsertAccountFromOidc(db, intruder)).rejects.toBeInstanceOf(
      AccountEmailConflictError,
    );
    const rows = await db.select().from(account);
    expect(rows).toEqual([held]);
  });

  it('refuses an email change onto another account', async () => {
    await upsertAccountFromOidc(db, ada);
    await upsertAccountFromOidc(db, bo);
    await expect(
      upsertAccountFromOidc(db, { ...bo, email: 'ada@example.com' }),
    ).rejects.toBeInstanceOf(AccountEmailConflictError);
  });

  it('passes on database errors other than an email conflict', async () => {
    // Postgres text cannot hold NUL: the insert fails, but not on the email index.
    const error: unknown = await upsertAccountFromOidc(db, { ...ada, displayName: 'A\u0000' }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AccountEmailConflictError);
  });

  it('creates one account when the same first login arrives twice at once', async () => {
    const [one, two] = await Promise.all([
      upsertAccountFromOidc(db, ada),
      upsertAccountFromOidc(db, ada),
    ]);
    expect(one.id).toBe(two.id);
  });
});

describe('sessions', () => {
  it('returns a random token once and stores only its SHA-256 hash', async () => {
    const { id } = await upsertAccountFromOidc(db, ada);
    const first = await createSession(db, id, 3600);
    const second = await createSession(db, id, 3600);
    expect(first.token).toMatch(/^[\w-]{43}$/);
    expect(second.token).not.toBe(first.token);

    const rows = await db.select().from(session).where(eq(session.accountId, id));
    const hashes = rows.map((row) => row.tokenHash).sort();
    const expected = [first.token, second.token]
      .map((token) => createHash('sha256').update(token).digest('hex'))
      .sort();
    expect(hashes).toEqual(expected);
  });

  it('finds a valid session with its account, and expires it after its lifetime', async () => {
    const created = await upsertAccountFromOidc(db, ada);
    const { token, expiresAt } = await createSession(db, created.id, 3600);
    const lifetime = expiresAt.getTime() - Date.now();
    // Database and test clocks may differ by a few seconds.
    expect(Math.abs(lifetime - 3600_000)).toBeLessThan(10_000);

    await expect(findSession(db, token)).resolves.toEqual({ account: created, expiresAt });
    await expect(findSession(db, 'not-a-token')).resolves.toBeNull();

    await expire(token);
    await expect(findSession(db, token)).resolves.toBeNull();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses a lifetime of %s seconds',
    async (lifetime) => {
      const { id } = await upsertAccountFromOidc(db, ada);
      await expect(createSession(db, id, lifetime)).rejects.toBeInstanceOf(RangeError);
      expect(await sessionCount()).toBe(0);
    },
  );

  it('enforces a positive lifetime in the database too', async () => {
    const { id } = await upsertAccountFromOidc(db, ada);
    const write = db
      .insert(session)
      .values({ tokenHash: 'h', accountId: id, expiresAt: new Date(0) });
    await expect(write).rejects.toMatchObject({
      cause: { constraint: 'session_expires_after_created' },
    });
  });

  it('deletes a session at logout', async () => {
    const { id } = await upsertAccountFromOidc(db, ada);
    const kept = await createSession(db, id, 3600);
    const { token } = await createSession(db, id, 3600);

    await expect(deleteSession(db, token)).resolves.toBe(true);
    await expect(findSession(db, token)).resolves.toBeNull();
    await expect(deleteSession(db, token)).resolves.toBe(false);
    await expect(findSession(db, kept.token)).resolves.not.toBeNull();
  });

  it('deletes only expired sessions', async () => {
    const { id } = await upsertAccountFromOidc(db, ada);
    const live = await createSession(db, id, 3600);
    const old = await createSession(db, id, 3600);
    await expire(old.token);

    await expect(deleteExpiredSessions(db)).resolves.toBe(1);
    expect(await sessionCount()).toBe(1);
    await expect(findSession(db, live.token)).resolves.not.toBeNull();
  });

  it('dies with its account', async () => {
    const { id } = await upsertAccountFromOidc(db, ada);
    await createSession(db, id, 3600);
    await db.delete(account).where(eq(account.id, id));
    expect(await sessionCount()).toBe(0);
  });
});
