import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../src/app.factory.js';
import { buildOpenapiDocument } from '../src/openapi.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, '../openapi.json');

/**
 * Regenerates the committed OpenAPI contract from the live routes.
 * The output is key-sorted (objects only, arrays keep their order) so a
 * diff only shows real contract changes.
 */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortDeep(source[key]);
    }
    return sorted;
  }
  return value;
}

// The contract does not depend on configuration: placeholders let the app boot without a .env.
// Nothing connects to them: the pool is lazy and OIDC discovery waits for the first login.
const PLACEHOLDER_ENV = {
  DATABASE_URL: 'postgres://openapi@db.invalid/openapi',
  GOOGLE_CLIENT_ID: 'openapi',
  GOOGLE_CLIENT_SECRET: 'openapi',
  GOOGLE_WORKSPACE_DOMAIN: 'example.com',
  PUBLIC_URL: 'http://localhost:3000',
};

async function main(): Promise<void> {
  Object.assign(process.env, PLACEHOLDER_ENV);
  const app = await createApp({ apiDocs: true });
  const document = buildOpenapiDocument(app);
  await app.close();

  const serialised = `${JSON.stringify(sortDeep(document), null, 2)}\n`;
  writeFileSync(target, serialised);

  const digest = createHash('sha256').update(serialised).digest('hex').slice(0, 12);
  console.log(`openapi.json written (${digest})`);
}

void main();
