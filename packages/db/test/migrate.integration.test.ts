import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../src/client.js';
import { migrationsFolder, runMigrations } from '../src/migrate.js';
import { closeDatabase, createThrowawayDatabase } from './throwaway-database.js';

const journal = JSON.parse(readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf8')) as {
  entries: unknown[];
};
const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function emptyDatabase(): Promise<string> {
  const { url, drop } = await createThrowawayDatabase();
  cleanups.push(drop);
  return url;
}

function connect(url: string): Database {
  const db = createDatabase(url);
  cleanups.push(() => closeDatabase(db));
  return db;
}

describe('runMigrations', () => {
  // Several API instances starting at once all migrate the same database.
  it.each([1, 2, 3])(
    'lets concurrent runs on an empty database all succeed (round %i)',
    async () => {
      const url = await emptyDatabase();
      const first = connect(url);
      const instances = [first, connect(url), connect(url)];

      await Promise.all(instances.map((db) => runMigrations(db)));

      const { rows } = await first.execute<{ total: number }>(
        sql`select count(*)::int as total from drizzle.__drizzle_migrations`,
      );
      expect(rows[0]?.total).toBe(journal.entries.length);
    },
  );

  it('releases the lock when a run fails, so the next run can proceed', async () => {
    const url = await emptyDatabase();
    const db = connect(url);
    // A table the first migration creates already exists, so that migration fails.
    await db.execute(sql`create schema core`);
    await db.execute(sql`create table core.organisation (id int)`);
    await expect(runMigrations(db)).rejects.toThrow();

    await db.execute(sql`drop schema core cascade`);
    await expect(runMigrations(db)).resolves.toBeUndefined();
  });
});
