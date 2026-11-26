import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

/** A Drizzle client over a `pg` pool; close it with `db.$client.end()`. */
export function createDatabase(connectionString: string) {
  return drizzle({ connection: { connectionString }, schema });
}

export type Database = ReturnType<typeof createDatabase>;
