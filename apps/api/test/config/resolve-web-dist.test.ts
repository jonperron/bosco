import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveWebDist } from '@/config/web-dist.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function fakeAppsTree(withWebDist: boolean): string {
  const apps = mkdtempSync(path.join(tmpdir(), 'bosco-apps-'));
  tempDirs.push(apps);
  mkdirSync(path.join(apps, 'api'), { recursive: true });
  if (withWebDist) {
    mkdirSync(path.join(apps, 'web', 'dist'), { recursive: true });
  }
  return apps;
}

describe('resolveWebDist', () => {
  it('keeps an explicitly configured directory even if absent yet', () => {
    expect(resolveWebDist('/srv/bosco/web', null)).toBe('/srv/bosco/web');
  });

  it('resolves the sibling web/dist under the given apps directory', () => {
    const apps = fakeAppsTree(true);
    expect(resolveWebDist(null, apps)).toBe(path.join(apps, 'web', 'dist'));
  });

  it('returns null when the apps tree carries no web distribution', () => {
    const apps = fakeAppsTree(false);
    expect(resolveWebDist(null, apps)).toBeNull();
  });

  it('defaults to the real sibling apps/web/dist, or null without one', () => {
    // here = apps/api/test/config; up three levels is the apps directory.
    const sibling = path.resolve(here, '../../../web/dist');
    expect(resolveWebDist(null)).toBe(existsSync(sibling) ? sibling : null);
  });
});
