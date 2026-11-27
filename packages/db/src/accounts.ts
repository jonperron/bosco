import { sql } from 'drizzle-orm';
import type { Database } from './client.js';
import { account } from './schema.js';

export type Account = typeof account.$inferSelect;

/** Claims of an ID token the caller has already verified (signature, issuer, domain, email). */
export interface OidcIdentity {
  readonly subject: string;
  readonly email: string;
  readonly displayName: string;
}

/** The email belongs to an account with another OIDC subject; accounts are never merged. */
export class AccountEmailConflictError extends Error {
  constructor() {
    super('This email already belongs to another account.');
    this.name = 'AccountEmailConflictError';
  }
}

/**
 * Creates the account at first login, or updates the email and display name of the account with
 * this subject. Refuses, with AccountEmailConflictError, an email (case-insensitive) held by an
 * account with another subject.
 */
export async function upsertAccountFromOidc(
  db: Database,
  identity: OidcIdentity,
): Promise<Account> {
  const { subject, email, displayName } = identity;
  try {
    const [row] = await db
      .insert(account)
      .values({ oidcSubject: subject, email, displayName })
      // updated_at moves at every login: $onUpdate does not run on an upsert.
      .onConflictDoUpdate({
        target: account.oidcSubject,
        set: { email, displayName, updatedAt: sql`now()` },
      })
      .returning();
    if (!row) throw new Error('The account upsert returned no row.');
    return row;
  } catch (error) {
    // Drizzle wraps the driver error; the constraint name sits on the pg error.
    const cause: unknown = error instanceof Error ? error.cause : undefined;
    if (cause instanceof Object && 'constraint' in cause) {
      if (cause.constraint === 'account_email_lower_unique') {
        // No cause: the driver error's detail quotes the email, which must not reach logs.
        throw new AccountEmailConflictError();
      }
    }
    throw error;
  }
}
