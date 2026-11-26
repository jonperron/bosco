import { defineConfig } from 'vitest/config';

// Unit tests only: they run without a database. The coverage gate of this workspace is the
// integration run (vitest.integration.config.ts): database code is never tested on a mock.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.integration.test.ts'],
  },
});
