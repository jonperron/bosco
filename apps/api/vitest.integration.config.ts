import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

import { plugins, resolve, TEST_ENV } from './vitest.config.js';

// Needs DATABASE_URL pointing at a Postgres where the role may create databases. The repository
// root .env is read when present; a variable already set in the environment wins.
const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

export default defineConfig({
  plugins,
  test: {
    environment: 'node',
    // The unit tests run here too: this run is the workspace's coverage gate.
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    env: { ...TEST_ENV, DATABASE_URL: process.env.DATABASE_URL ?? '' },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve,
});
