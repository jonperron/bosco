import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Placeholders for the required variables: unit tests never reach Google or the database. */
export const TEST_ENV = {
  DATABASE_URL: 'postgres://bosco:bosco@db.invalid:5432/bosco',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_WORKSPACE_DOMAIN: 'example.test',
  PUBLIC_URL: 'http://localhost:3000',
};

export const plugins = [
  // NestJS relies on decorator metadata; the default esbuild transform cannot emit it.
  swc.vite({ module: { type: 'es6' } }),
];

export const resolve = { alias: { '@': path.resolve(here, 'src') } };

// Unit tests only: they run without a database. The coverage gate of this workspace is the
// integration run (vitest.integration.config.ts): sign-in is never tested on a mocked database.
export default defineConfig({
  plugins,
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['test/**/*.integration.test.ts'],
    env: TEST_ENV,
  },
  resolve,
});
