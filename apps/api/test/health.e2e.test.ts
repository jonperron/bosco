import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '@/app.factory.js';

describe('GET /api/health', () => {
  it('answers 200 with the typed health payload', async () => {
    const app = await createApp({ version: '9.9.9-test' });

    const response = await request(app.getHttpServer()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.version).toBe('9.9.9-test');
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('serves the OpenAPI document carrying the health path', async () => {
    const app = await createApp({ version: '9.9.9-test' });

    const response = await request(app.getHttpServer()).get('/api/docs-json');

    expect(response.status).toBe(200);
    expect(response.body.paths).toHaveProperty('/api/health');
  });
});
