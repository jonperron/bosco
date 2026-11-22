import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    // NestJS relies on decorator metadata; the default esbuild transform cannot emit it.
    swc.vite({ module: { type: 'es6' } }),
  ],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
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
  resolve: {
    alias: {
      '@': path.resolve(here, 'src'),
    },
  },
});
