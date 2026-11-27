import { createHash, randomBytes } from 'node:crypto';
import { and, eq, getTableColumns, gt, lte, sql } from 'drizzle-orm';
import type { Account } from './accounts.js';
import type { Database } from './client.js';
import { account, session } from './schema.js';

export interface FoundSession {
  readonly account: Account;
  readonly expiresAt: Date;
}

// The token carries 256 random bits, so a fast hash is enough: there is nothing to brute-force.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Opens a session for the account, expiring `lifetimeSeconds` from now (database clock). Returns
 * the raw token, which is never stored: this is the only time it can be read.
 */
export async function createSession(
  db: Database,
  accountId: string,
  lifetimeSeconds: number,
): Promise<{ token: string; expiresAt: Date }> {
  // Whole seconds, at most 2^31 - 1, so the expiry always fits a Postgres timestamp.
  if (!Number.isInteger(lifetimeSeconds) || lifetimeSeconds < 1 || lifetimeSeconds >= 2 ** 31) {
    throw new RangeError('A session lifetime is a whole number of seconds, from 1 to 2^31 - 1.');
  }
  const token = randomBytes(32).toString('base64url');
  const [row] = await db
    .insert(session)
    .values({
      tokenHash: hashToken(token),
      accountId,
      expiresAt: sql`now() + make_interval(secs => ${lifetimeSeconds})`,
    })
    .returning({ expiresAt: session.expiresAt });
  if (!row) throw new Error('The session insert returned no row.');
  return { token, expiresAt: row.expiresAt };
}

/** The session's account and expiry, or null if the token is unknown or expired. */
export async function findSession(db: Database, token: string): Promise<FoundSession | null> {
  const [row] = await db
    .select({ account: getTableColumns(account), expiresAt: session.expiresAt })
    .from(session)
    .innerJoin(account, eq(account.id, session.accountId))
    .where(and(eq(session.tokenHash, hashToken(token)), gt(session.expiresAt, sql`now()`)));
  return row ?? null;
}

/** Logout: deletes the session; false if the token matched none. */
export async function deleteSession(db: Database, token: string): Promise<boolean> {
  const result = await db.delete(session).where(eq(session.tokenHash, hashToken(token)));
  return (result.rowCount ?? 0) > 0;
}

/** Deletes every expired session and returns how many. */
export async function deleteExpiredSessions(db: Database): Promise<number> {
  // The driver's row count: a large backlog is never loaded into memory.
  const result = await db.delete(session).where(lte(session.expiresAt, sql`now()`));
  return result.rowCount ?? 0;
}
