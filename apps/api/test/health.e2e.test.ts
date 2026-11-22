import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '@/app.factory.js';
import type { INestApplication } from '@nestjs/common';

let runningApp: INestApplication | null = null;

async function startApp(options: Parameters<typeof createApp>[0]) {
  runningApp = await createApp(options);
  return runningApp;
}

afterEach(async () => {
  if (runningApp !== null) {
    await runningApp.close();
    runningApp = null;
  }
});

describe('GET /api/health', () => {
  it('answers 200 with the typed health payload', async () => {
    const app = await startApp({ version: '9.9.9-test' });

    const response = await request(app.getHttpServer()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.version).toBe('9.9.9-test');
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('has a clean start that can be closed gracefully', async () => {
    const app = await startApp({ version: '9.9.9-test' });
    const response = await request(app.getHttpServer()).get('/api/health');
    expect(response.status).toBe(200);
    await app.close();
    runningApp = null;
  });
});

describe('GET /api/docs-json', () => {
  it('is off by default', async () => {
    const app = await startApp({ version: '9.9.9-test' });

    const response = await request(app.getHttpServer()).get('/api/docs-json');

    expect(response.status).toBe(404);
  });

  it('serves the OpenAPI document carrying the health path when enabled', async () => {
    const app = await startApp({ version: '9.9.9-test', apiDocs: true });

    const response = await request(app.getHttpServer()).get('/api/docs-json');

    expect(response.status).toBe(200);
    expect(response.body.paths).toHaveProperty('/api/health');
  });
});
