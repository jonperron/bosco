/**
 * Environment configuration, validated once at boot.
 *
 * Every deployment-provided variable is declared here; an unknown or
 * malformed value must stop the application instead of being silently
 * ignored. The socle reads no secret in lot 2, this stays deliberately
 * small.
 */
export const ENV_KEYS = ['PORT', 'WEB_DIST'] as const;

export type EnvKey = (typeof ENV_KEYS)[number];

export interface Env {
  PORT: number;
  WEB_DIST: string | null;
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
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    issues.push('PORT must be an integer between 1 and 65535');
    return null;
  }
  return port;
}

function parseWebDist(raw: string | undefined): string | null {
  if (raw === undefined || raw.trim() === '') {
    return null;
  }
  return raw;
}

/** Validates and normalises a raw environment (defaults included by Nest config). */
export function validateEnv(config: Record<string, unknown>): Env {
  const issues: string[] = [];
  const port = parsePort(config['PORT'] as string | undefined, issues);
  if (port === null) {
    throw new EnvValidationError(issues);
  }

  return {
    PORT: port,
    WEB_DIST: parseWebDist(config['WEB_DIST'] as string | undefined),
  };
}
