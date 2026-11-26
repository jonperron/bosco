import { createDatabase } from '../src/client.js';
import { runMigrations } from '../src/migrate.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set: copy .env.example to .env at the repository root.');
  process.exit(1);
}

const db = createDatabase(databaseUrl);
try {
  await runMigrations(db);
  console.log('Migrations applied.');
} finally {
  await db.$client.end();
}
