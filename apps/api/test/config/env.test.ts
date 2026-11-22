import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ENV_KEYS, EnvValidationError, loadEnv, validateEnv } from '@/config/env.js';

const tempDirs: string[] = [];

// Snapshot of original environment values to restore after tests
let originalEnvValues: Record<string, string | undefined> = {};

beforeEach(() => {
  // Snapshot current environment values before each test
  originalEnvValues = {};
  for (const key of ENV_KEYS) {
    originalEnvValues[key] = process.env[key];
  }
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  // Restore original environment values after each test
  for (const key of ENV_KEYS) {
    if (originalEnvValues[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnvValues[key];
    }
  }
});

function writeTempEnvFile(content: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'bosco-env-'));
  tempDirs.push(dir);
  const envFile = path.join(dir, '.env');
  writeFileSync(envFile, content);
  return envFile;
}

describe('validateEnv', () => {
  it('defaults PORT to 3000 and Swagger UI to off when absent', () => {
    expect(validateEnv({})).toEqual({
      PORT: 3000,
      WEB_DIST: null,
      API_DOCS_ENABLED: false,
    });
  });

  it('normalises a valid environment', () => {
    expect(
      validateEnv({ PORT: '4000', WEB_DIST: '/srv/bosco/web', API_DOCS_ENABLED: 'TRUE' }),
    ).toEqual({
      PORT: 4000,
      WEB_DIST: '/srv/bosco/web',
      API_DOCS_ENABLED: true,
    });
  });

  it('rejects a malformed PORT naming the variable', () => {
    expect(() => validateEnv({ PORT: 'not-a-port' })).toThrowError(EnvValidationError);
    expect(() => validateEnv({ PORT: '3000abc' })).toThrowError(/PORT/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ PORT: '70000' })).toThrowError(EnvValidationError);
    expect(() => validateEnv({ PORT: '0' })).toThrowError(EnvValidationError);
  });

  it('rejects a malformed API_DOCS_ENABLED naming the variable', () => {
    expect(() => validateEnv({ API_DOCS_ENABLED: 'maybe' })).toThrowError(/API_DOCS_ENABLED/);
  });

  it('normalises a WEB_DIST with surrounding whitespace', () => {
    expect(validateEnv({ WEB_DIST: '  /srv/bosco/web  ' }).WEB_DIST).toBe('/srv/bosco/web');
  });

  it('normalises a blank WEB_DIST to null', () => {
    expect(validateEnv({ WEB_DIST: '   ' }).WEB_DIST).toBeNull();
  });
});

describe('loadEnv', () => {
  // The beforeEach/afterEach at the top level already snapshot and restore
  // environment values, so we don't need to do anything here.
  // The original values are preserved across tests.

  it('reads a .env file and validates the merged environment', () => {
    const envFile = writeTempEnvFile('PORT=4567\nAPI_DOCS_ENABLED=true\n');

    expect(loadEnv(envFile)).toEqual({
      PORT: 4567,
      WEB_DIST: null,
      API_DOCS_ENABLED: true,
    });
  });

  it('tolerates a missing .env file and falls back to the shell env', () => {
    delete process.env['PORT'];
    expect(loadEnv(path.join(tempDirs[0] ?? tmpdir(), 'nonexistent.env'))).toMatchObject({
      PORT: 3000,
    });
  });

  it('fails on a malformed .env value instead of booting silently', () => {
    const envFile = writeTempEnvFile('PORT=70000\n');

    expect(() => loadEnv(envFile)).toThrowError(EnvValidationError);
  });
});
