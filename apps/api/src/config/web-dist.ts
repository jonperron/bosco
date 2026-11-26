import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Resolves the web distribution directory: the explicit WEB_DIST env value
 * first, then the sibling apps/web/dist. Returns null when nothing exists,
 * so the API boots without a built frontend (unit tests, API-only deploys).
 *
 * The sibling default walks up from this file: apps/api/src/config (tsx,
 * vitest) and apps/api/dist/config (compiled) both sit three levels below
 * apps/, so one candidate fits dev and prod.
 */
export function resolveWebDist(
  webDist: string | null,
  appsDirectory: null | string = null,
): string | null {
  if (webDist !== null) {
    // Convert explicit relative paths to absolute, while preserving absolute paths
    return path.isAbsolute(webDist) ? webDist : path.resolve(webDist);
  }

  const apps = appsDirectory ?? path.resolve(__dirname, '../../..');
  const sibling = path.join(apps, 'web', 'dist');
  return existsSync(sibling) ? sibling : null;
}
