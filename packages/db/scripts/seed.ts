import { createDatabase } from '../src/client.js';
import { seedDemoData } from '../src/seed.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set: copy .env.example to .env at the repository root.');
  process.exit(1);
}

const db = createDatabase(databaseUrl);
try {
  await seedDemoData(db);
  console.log('Demo data seeded.');
} finally {
  await db.$client.end();
}
