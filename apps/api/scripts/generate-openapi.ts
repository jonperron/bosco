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

async function main(): Promise<void> {
  const app = await createApp({ apiDocs: true });
  const document = buildOpenapiDocument(app);
  await app.close();

  const serialised = `${JSON.stringify(sortDeep(document), null, 2)}\n`;
  writeFileSync(target, serialised);

  const digest = createHash('sha256').update(serialised).digest('hex').slice(0, 12);
  console.log(`openapi.json written (${digest})`);
}

void main();
