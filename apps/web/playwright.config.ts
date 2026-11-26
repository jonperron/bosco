import { defineConfig, devices } from '@playwright/test';

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
    env: { PORT: String(port) },
    reuseExistingServer: false,
  },
});
