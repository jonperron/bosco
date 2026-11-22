import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '@/app.factory.js';

describe('API serving the web distribution', () => {
  let webDist: string;

  beforeEach(() => {
    webDist = mkdtempSync(path.join(tmpdir(), 'bosco-web-dist-'));
    writeFileSync(
      path.join(webDist, 'index.html'),
      '<!doctype html><html><head><title>Bosco</title></head><body><div id="root"></div></body></html>',
    );
  });

  afterEach(() => {
    rmSync(webDist, { recursive: true, force: true });
  });

  it('serves index.html at / and falls back for client-side routes', async () => {
    const app = await createApp({ webDist, version: '9.9.9-test' });

    const root = await request(app.getHttpServer()).get('/');
    expect(root.status).toBe(200);
    expect(root.text).toContain('id="root"');

    const deep = await request(app.getHttpServer()).get('/some/client/route');
    expect(deep.status).toBe(200);
    expect(deep.text).toContain('id="root"');

    const apiRoute = await request(app.getHttpServer()).get('/api/health');
    expect(apiRoute.status).toBe(200);
    expect(JSON.parse(apiRoute.text)['status']).toBe('ok');
  });

  it('still serves the API prefix over the static files', async () => {
    mkdirSync(path.join(webDist, 'api'), { recursive: true });
    const app = await createApp({ webDist, version: '9.9.9-test' });

    const apiRoute = await request(app.getHttpServer()).get('/api/health');
    expect(apiRoute.status).toBe(200);
    expect(JSON.parse(apiRoute.text)['status']).toBe('ok');
  });
});
