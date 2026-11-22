import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { resolveWebDist } from '@/app.module.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Tests run from apps/api/test/config; the sibling is apps/web/dist. */
const siblingDefault = path.resolve(here, '../../../web/dist');

describe('resolveWebDist', () => {
  it('keeps an explicitly configured directory even if absent yet', () => {
    expect(resolveWebDist('/srv/bosco/web')).toBe('/srv/bosco/web');
  });

  it('resolves the sibling apps/web/dist by default, or null without one', () => {
    const expected = existsSync(siblingDefault) ? siblingDefault : null;
    expect(resolveWebDist(null)).toBe(expected);
  });
});
