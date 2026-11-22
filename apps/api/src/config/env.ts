import path from 'node:path';

import { config as loadDotenv } from 'dotenv';

export interface Env {
  PORT: number;
  /** Directory of the built frontend to serve; null keeps the API only. */
  WEB_DIST: string | null;
  /** Serve the Swagger UI of the contract at /api/docs; false by default. */
  API_DOCS_ENABLED: boolean;
}

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment: ${issues.join('; ')}`);
    this.name = 'EnvValidationError';
  }
}

function parsePort(raw: string | undefined, issues: string[]): number | null {
  if (raw === undefined) {
    return 3000;
  }
  if (!/^\d+$/.test(raw)) {
    issues.push('PORT must be a decimal integer');
    return null;
  }
  const port = Number.parseInt(raw, 10);
  if (port < 1 || port > 65535) {
    issues.push('PORT must be between 1 and 65535');
    return null;
  }
  return port;
}

function parseWebDist(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

function parseApiDocs(raw: string | undefined, issues: string[]): boolean | null {
  if (raw === undefined || raw.trim() === '') {
    return false;
  }
  const normalised = raw.trim().toLowerCase();
  if (normalised === 'true') {
    return true;
  }
  if (normalised === 'false') {
    return false;
  }
  issues.push('API_DOCS_ENABLED must be true or false');
  return null;
}

/**
 * Validates and normalises the environment: every variable the socle
 * declares is checked, malformed values stop the application. Unknown
 * variables of the host environment are ignored on purpose.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const issues: string[] = [];
  const port = parsePort(config['PORT'] as string | undefined, issues);
  const apiDocs = parseApiDocs(config['API_DOCS_ENABLED'] as string | undefined, issues);
  if (port === null || apiDocs === null) {
    throw new EnvValidationError(issues);
  }

  return {
    PORT: port,
    WEB_DIST: parseWebDist(config['WEB_DIST'] as string | undefined),
    API_DOCS_ENABLED: apiDocs,
  };
}

/**
 * Loads the optional .env file (cwd-independent when a path is given), then
 * validates the whole environment. Used once in main.ts before any module
 * boots; the .env file is absent in most deployments and that is normal.
 */
export function loadEnv(dotEnvPath?: string): Env {
  const resolvedPath = dotEnvPath ?? path.join(process.cwd(), '.env');
  const result = loadDotenv({ path: resolvedPath });
  const notFound = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
  if (result.error !== undefined && !notFound) {
    throw new EnvValidationError([`could not read .env file: ${result.error.message}`]);
  }
  return validateEnv(process.env);
}
