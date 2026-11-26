import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '@/app.factory.js';
import type { INestApplication } from '@nestjs/common';

let runningApp: INestApplication | null = null;
let webDist: string;

beforeEach(() => {
  webDist = mkdtempSync(path.join(tmpdir(), 'bosco-web-dist-'));
  writeFileSync(
    path.join(webDist, 'index.html'),
    '<!doctype html><html><head><title>Bosco</title></head><body><div id="root"></div></body></html>',
  );
});

afterEach(async () => {
  if (runningApp !== null) {
    await runningApp.close();
    runningApp = null;
  }
  rmSync(webDist, { recursive: true, force: true });
});

describe('security headers', () => {
  it.each(['/api/health', '/'])('are sent on %s, without x-powered-by', async (pathName) => {
    runningApp = await createApp({ webDist, version: '9.9.9-test' });

    const response = await request(runningApp.getHttpServer()).get(pathName);

    expect(response.status).toBe(200);
    expect(response.headers).not.toHaveProperty('x-powered-by');
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBe('max-age=31536000');
    // Self-hosted installs may serve plain HTTP on a LAN address, where this
    // directive would upgrade the SPA's own scripts to an https URL that fails.
    expect(response.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });

  it('keep the Swagger UI on same-origin scripts when the docs are enabled', async () => {
    runningApp = await createApp({ version: '9.9.9-test', apiDocs: true });

    const response = await request(runningApp.getHttpServer()).get('/api/docs');

    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    // Every script of the page is an external same-origin file, so the CSP lets it run.
    const scriptTags = response.text.match(/<script\b[^>]*>/g) ?? [];
    expect(scriptTags.length).toBeGreaterThan(0);
    for (const tag of scriptTags) {
      // A src without a scheme or a leading // stays on the page's origin.
      expect(tag).toMatch(/\ssrc=["'](?![a-z][a-z0-9+.-]*:|\/\/)[^"']+["']/i);
    }
    expect(response.text).toMatch(/<script src="[^"]*swagger-ui-init\.js">/);
  });
});
