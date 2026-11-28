import path from 'node:path';

import { config as loadDotenv } from 'dotenv';

/** Every variable the socle declares in the environment. */
export const ENV_KEYS = [
  'PORT',
  'WEB_DIST',
  'API_DOCS_ENABLED',
  'DATABASE_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_WORKSPACE_DOMAIN',
  'PUBLIC_URL',
] as const;

export interface Env {
  PORT: number;
  /** Directory of the built frontend to serve; null keeps the API only. */
  WEB_DIST: string | null;
  /** Serve the Swagger UI of the contract at /api/docs; false by default. */
  API_DOCS_ENABLED: boolean;
  /** Postgres connection string; migrations run against it at startup. */
  DATABASE_URL: string;
  /** OAuth client of the Google Cloud project (Web application type). */
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** The company's Google Workspace domain, lowercase: only its accounts may sign in. */
  GOOGLE_WORKSPACE_DOMAIN: string;
  /** Public origin of the install, no trailing slash; the OIDC redirect URI derives from it. */
  PUBLIC_URL: string;
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

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_WORKSPACE_DOMAIN',
  'PUBLIC_URL',
] as const;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function parsePublicUrl(raw: string, issues: string[]): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    issues.push('PUBLIC_URL must be an absolute URL');
    return null;
  }
  // Session cookies are Secure: plain HTTP only works on the loopback host.
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))
  ) {
    issues.push('PUBLIC_URL must use https (plain http only on localhost)');
    return null;
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '' || url.username !== '') {
    issues.push('PUBLIC_URL must be an origin, without path, query or credentials');
    return null;
  }
  return url.origin;
}

function parseDomain(raw: string, issues: string[]): string | null {
  const domain = raw.toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
    issues.push('GOOGLE_WORKSPACE_DOMAIN must be a bare domain such as example.com');
    return null;
  }
  return domain;
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
  const required: Partial<Record<(typeof REQUIRED_KEYS)[number], string>> = {};
  for (const key of REQUIRED_KEYS) {
    const value = (config[key] as string | undefined)?.trim() ?? '';
    if (value === '') {
      issues.push(`${key} is required`);
    } else {
      required[key] = value;
    }
  }
  const publicUrl =
    required.PUBLIC_URL === undefined ? null : parsePublicUrl(required.PUBLIC_URL, issues);
  const domain =
    required.GOOGLE_WORKSPACE_DOMAIN === undefined
      ? null
      : parseDomain(required.GOOGLE_WORKSPACE_DOMAIN, issues);
  if (
    port === null ||
    apiDocs === null ||
    publicUrl === null ||
    domain === null ||
    required.DATABASE_URL === undefined ||
    required.GOOGLE_CLIENT_ID === undefined ||
    required.GOOGLE_CLIENT_SECRET === undefined
  ) {
    throw new EnvValidationError(issues);
  }

  return {
    PORT: port,
    WEB_DIST: parseWebDist(config['WEB_DIST'] as string | undefined),
    API_DOCS_ENABLED: apiDocs,
    DATABASE_URL: required.DATABASE_URL,
    GOOGLE_CLIENT_ID: required.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: required.GOOGLE_CLIENT_SECRET,
    GOOGLE_WORKSPACE_DOMAIN: domain,
    PUBLIC_URL: publicUrl,
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
