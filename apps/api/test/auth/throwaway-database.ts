import { randomUUID } from 'node:crypto';

import { createDatabase, runMigrations, type Database } from '@bosco/db';
import pg from 'pg';

/** A migrated, empty database for one test file; `drop()` closes `db` and removes it. */
export async function createMigratedDatabase(): Promise<{
  url: string;
  db: Database;
  drop: () => Promise<void>;
}> {
  const baseUrl = process.env['DATABASE_URL'];
  if (baseUrl === undefined || baseUrl === '') {
    throw new Error('DATABASE_URL is required by the integration suite (see .env.example).');
  }
  const name = `bosco_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  const db = createDatabase(url.toString());
  await runMigrations(db);
  return {
    url: url.toString(),
    db,
    drop: async () => {
      await db.$client.end();
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    },
  };
}
