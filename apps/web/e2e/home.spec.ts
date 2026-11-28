import { readFileSync } from 'node:fs';

import { expect, test as base } from '@playwright/test';

const apiVersion = (
  JSON.parse(readFileSync(new URL('../../api/package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

/**
 * Fails any test whose page logs a console error or throws: CSP violations
 * surface as console errors, so a policy that blocks the app is caught here.
 */
const test = base.extend<{ pageProblems: void }>({
  pageProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        // Signed out, /api/auth/me answers 401 by design; Chromium logs every non-2xx load.
        const signedOutCheck =
          message.location().url.endsWith('/api/auth/me') && message.text().includes('401');
        if (message.type() === 'error' && !signedOutCheck) {
          problems.push(`console: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      await use();
      expect(problems).toEqual([]);
    },
    { auto: true },
  ],
});

test('home page loads in French and shows the API health', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Le socle de votre outillage managérial')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByText(`Service en bonne santé (v${apiVersion},`)).toBeVisible();
});

test('switching to English updates the page and survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();

  await expect(page.getByText('The foundation of your management tooling')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.reload();

  await expect(page.getByText('The foundation of your management tooling')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText(`Service in good health (v${apiVersion},`)).toBeVisible();
});

test('signed out: the sign-in link points at the API login route', async ({ page }) => {
  await page.goto('/');

  const signIn = page.getByRole('link', { name: 'Se connecter avec Google' });
  await expect(signIn).toBeVisible();
  await expect(signIn).toHaveAttribute('href', '/api/auth/login');
});

test('a refused sign-in shows a short message and cleans the address bar', async ({ page }) => {
  await page.goto('/?auth_error=denied');

  await expect(page.getByRole('alert')).toHaveText(
    "Ce compte n'est pas autorisé à se connecter à cette installation.",
  );
  await expect(page).toHaveURL(/\/$/);
});

test('a deep link still serves the app', async ({ page }) => {
  const response = await page.goto('/people/42');

  expect(response?.status()).toBe(200);
  // A redirect to / would also end on a 200 home page.
  await expect(page).toHaveURL(/\/people\/42$/);
  await expect(page.getByText('Le socle de votre outillage managérial')).toBeVisible();
});
