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

// The required variables, with placeholder values.
const REQUIRED = {
  DATABASE_URL: 'postgres://user:secret@db.invalid:5432/bosco',
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.invalid',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_WORKSPACE_DOMAIN: 'Example.TEST',
  PUBLIC_URL: 'https://bosco.example.test/',
};

const REQUIRED_PARSED = {
  DATABASE_URL: REQUIRED.DATABASE_URL,
  GOOGLE_CLIENT_ID: REQUIRED.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: REQUIRED.GOOGLE_CLIENT_SECRET,
  GOOGLE_WORKSPACE_DOMAIN: 'example.test',
  PUBLIC_URL: 'https://bosco.example.test',
};

describe('validateEnv', () => {
  it('defaults PORT to 3000 and Swagger UI to off when absent', () => {
    expect(validateEnv({ ...REQUIRED })).toEqual({
      PORT: 3000,
      WEB_DIST: null,
      API_DOCS_ENABLED: false,
      ...REQUIRED_PARSED,
    });
  });

  it('normalises a valid environment', () => {
    expect(
      validateEnv({
        ...REQUIRED,
        PORT: '4000',
        WEB_DIST: '/srv/bosco/web',
        API_DOCS_ENABLED: 'TRUE',
      }),
    ).toEqual({
      PORT: 4000,
      WEB_DIST: '/srv/bosco/web',
      API_DOCS_ENABLED: true,
      ...REQUIRED_PARSED,
    });
  });

  it.each(Object.keys(REQUIRED))('fails fast when %s is missing or blank', (key) => {
    expect(() => validateEnv({ ...REQUIRED, [key]: undefined })).toThrowError(
      new RegExp(`${key} is required`),
    );
    expect(() => validateEnv({ ...REQUIRED, [key]: '  ' })).toThrowError(
      new RegExp(`${key} is required`),
    );
  });

  it('lists every missing variable at once', () => {
    expect(() => validateEnv({})).toThrowError(/DATABASE_URL.*GOOGLE_CLIENT_ID/);
  });

  it.each([
    ['http://bosco.example.test', 'https'],
    ['not a url', 'URL'],
    ['https://bosco.example.test/app', 'origin'],
    ['https://user:pw@bosco.example.test', 'origin'],
  ])('rejects PUBLIC_URL %s', (value, message) => {
    expect(() => validateEnv({ ...REQUIRED, PUBLIC_URL: value })).toThrowError(
      new RegExp(`PUBLIC_URL.*${message}`),
    );
  });

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000'])(
    'accepts plain HTTP on the loopback host %s',
    (value) => {
      expect(validateEnv({ ...REQUIRED, PUBLIC_URL: value }).PUBLIC_URL).toBe(value);
    },
  );

  it('rejects a GOOGLE_WORKSPACE_DOMAIN that is not a bare domain', () => {
    expect(() =>
      validateEnv({ ...REQUIRED, GOOGLE_WORKSPACE_DOMAIN: '@example.test' }),
    ).toThrowError(/GOOGLE_WORKSPACE_DOMAIN/);
  });

  it('rejects a malformed PORT naming the variable', () => {
    expect(() => validateEnv({ ...REQUIRED, PORT: 'not-a-port' })).toThrowError(EnvValidationError);
    expect(() => validateEnv({ ...REQUIRED, PORT: '3000abc' })).toThrowError(/PORT/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ ...REQUIRED, PORT: '70000' })).toThrowError(EnvValidationError);
    expect(() => validateEnv({ ...REQUIRED, PORT: '0' })).toThrowError(EnvValidationError);
  });

  it('rejects a malformed API_DOCS_ENABLED naming the variable', () => {
    expect(() => validateEnv({ ...REQUIRED, API_DOCS_ENABLED: 'maybe' })).toThrowError(
      /API_DOCS_ENABLED/,
    );
  });

  it('normalises a WEB_DIST with surrounding whitespace', () => {
    expect(validateEnv({ ...REQUIRED, WEB_DIST: '  /srv/bosco/web  ' }).WEB_DIST).toBe(
      '/srv/bosco/web',
    );
  });

  it('normalises a blank WEB_DIST to null', () => {
    expect(validateEnv({ ...REQUIRED, WEB_DIST: '   ' }).WEB_DIST).toBeNull();
  });
});

describe('loadEnv', () => {
  // The beforeEach/afterEach at the top level already snapshot and restore
  // environment values, so we don't need to do anything here.
  // The original values are preserved across tests.

  it('reads a .env file and validates the merged environment', () => {
    const envFile = writeTempEnvFile('PORT=4567\nAPI_DOCS_ENABLED=true\n');

    expect(loadEnv(envFile)).toMatchObject({
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
