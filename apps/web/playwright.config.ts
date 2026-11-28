import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

// The repository root .env (DATABASE_URL) is read when present; the environment wins.
const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

// shortcut: fixed port (override with E2E_PORT); the server fails fast if it is taken.
const port = Number(process.env['E2E_PORT'] ?? 4310);
const onCi = process.env['CI'] !== undefined;

/**
 * Smoke tests against the app as it ships: the built API process serves the
 * built frontend on one port, under its real security headers (CSP). Run
 * `pnpm test:e2e` from the repo root: turbo builds web and api first.
 */
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: onCi,
  reporter: onCi ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ../api/dist/main.js',
    url: `http://localhost:${port}/api/health`,
    // The API migrates DATABASE_URL at startup (root .env locally, a service database on CI);
    // the Google values are placeholders: discovery only happens at the first sign-in.
    env: {
      PORT: String(port),
      DATABASE_URL: process.env['DATABASE_URL'] ?? '',
      GOOGLE_CLIENT_ID: 'e2e-client-id',
      GOOGLE_CLIENT_SECRET: 'e2e-client-secret',
      GOOGLE_WORKSPACE_DOMAIN: 'example.com',
      PUBLIC_URL: `http://localhost:${port}`,
    },
    reuseExistingServer: false,
  },
});
