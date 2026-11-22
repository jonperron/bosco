import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Resolves the web distribution directory: the explicit WEB_DIST env value
 * first, then the sibling apps/web/dist. Returns null when nothing exists,
 * so the API boots without a built frontend (unit tests, API-only deploys).
 *
 * The sibling default tries the compiled layout (apps/api/dist → ../..) and
 * the source layout (apps/api/src → ../../..) so dev and prod agree.
 */
export function resolveWebDist(
  webDist: string | null,
  appsDirectory: null | string = null,
): string | null {
  if (webDist !== null) {
    // Convert explicit relative paths to absolute, while preserving absolute paths
    return path.isAbsolute(webDist) ? webDist : path.resolve(webDist);
  }

  const candidates =
    appsDirectory === null
      ? [path.resolve(__dirname, '../..'), path.resolve(__dirname, '../../..')]
      : [appsDirectory];

  for (const apps of candidates) {
    const sibling = path.join(apps, 'web', 'dist');
    if (existsSync(sibling)) {
      return sibling;
    }
  }
  return null;
}
