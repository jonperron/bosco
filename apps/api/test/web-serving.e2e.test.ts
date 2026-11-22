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

describe('API serving the web distribution', () => {
  it('serves index.html at / and falls back for client-side routes', async () => {
    runningApp = await createApp({ webDist, version: '9.9.9-test' });

    const root = await request(runningApp.getHttpServer()).get('/');
    expect(root.status).toBe(200);
    expect(root.text).toContain('id="root"');

    const deep = await request(runningApp.getHttpServer()).get('/some/client/route');
    expect(deep.status).toBe(200);
    expect(deep.text).toContain('id="root"');
  });

  it('never falls back to the SPA for unregistered API routes', async () => {
    runningApp = await createApp({ webDist, version: '9.9.9-test' });

    for (const pathName of ['/api/nonexistent', '/api/a/b', '/api']) {
      const response = await request(runningApp.getHttpServer()).get(pathName);
      expect(response.status, `GET ${pathName}`).toBe(404);
      expect(response.text, `GET ${pathName}`).not.toContain('id="root"');
    }
  });

  it('keeps registered API routes ahead of the static files', async () => {
    runningApp = await createApp({ webDist, version: '9.9.9-test' });

    const apiRoute = await request(runningApp.getHttpServer()).get('/api/health');
    expect(apiRoute.status).toBe(200);
    expect(apiRoute.body['status']).toBe('ok');
  });
});
