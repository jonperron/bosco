import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './client.js';

// Same relative path from src/ (tsx) and dist/ (built package).
export const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

/**
 * Applies every pending migration; already applied ones are skipped, so it is safe to rerun.
 * Concurrent runs (several API instances starting at once) queue on a Postgres advisory lock.
 */
export async function runMigrations(db: Database): Promise<void> {
  // A session lock is held by one connection, so the whole run uses that connection.
  const client = await db.$client.connect();
  try {
    const locked = drizzle({ client });
    // shortcut: no wait limit, an instance hung on the lock blocks the others' startup; add a
    // lock_timeout if deployments ever run instances that can hang mid-migration.
    await locked.execute(sql`select pg_advisory_lock(hashtext('bosco.migrations'))`);
    await migrate(locked, { migrationsFolder });
  } finally {
    // Destroying the connection releases the lock, even after a failed migration.
    client.release(true);
  }
}
