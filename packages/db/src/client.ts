import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

/** A Drizzle client over a `pg` pool; close it with `db.$client.end()`. */
export function createDatabase(connectionString: string) {
  // A finite connect timeout: an unreachable host fails the command instead of hanging it.
  return drizzle({ connection: { connectionString, connectionTimeoutMillis: 10_000 }, schema });
}

export type Database = ReturnType<typeof createDatabase>;
