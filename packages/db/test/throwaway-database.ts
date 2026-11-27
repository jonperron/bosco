import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { Database } from '../src/client.js';

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  throw new Error('DATABASE_URL is required by the integration suite (see .env.example).');
}

/** Creates an empty database for one test file; `drop()` removes it at the end. */
export async function createThrowawayDatabase(): Promise<{
  url: string;
  drop: () => Promise<void>;
}> {
  const name = `bosco_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(baseUrl ?? '');
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    drop: async () => {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    },
  };
}

/** Ends the pool and waits until every socket is closed, so a forced DROP cannot kill one. */
export async function closeDatabase(db: Database): Promise<void> {
  const pool = db.$client;
  let open = pool.totalCount;
  const closed = new Promise<void>((resolve) => {
    if (open === 0) resolve();
    pool.on('remove', () => --open === 0 && resolve());
  });
  await pool.end();
  await closed;
}
