import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '@/app.factory.js';
import type * as AppModuleFile from '@/app.module.js';
import type { INestApplication } from '@nestjs/common';

// Mount a test-only controller next to the real ones, so the global pipe
// that createApp installs is exercised exactly as production wires it.
vi.mock('@/app.module.js', async (importOriginal) => {
  const original = await importOriginal<typeof AppModuleFile>();
  const { EchoController } = await import('./fixtures/echo.controller.js');
  return {
    ...original,
    registerAppModule: (...args: Parameters<typeof original.registerAppModule>) => {
      const dynamicModule = original.registerAppModule(...args);
      return {
        ...dynamicModule,
        controllers: [...(dynamicModule.controllers ?? []), EchoController],
      };
    },
  };
});

let runningApp: INestApplication | null = null;

afterEach(async () => {
  if (runningApp !== null) {
    await runningApp.close();
    runningApp = null;
  }
});

describe('global ValidationPipe', () => {
  it('accepts a body carrying only known fields', async () => {
    runningApp = await createApp({ version: '9.9.9-test' });

    const response = await request(runningApp.getHttpServer())
      .post('/api/test-echo')
      .send({ name: 'Ada' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: 'Ada' });
  });

  it('rejects an unknown field with 400', async () => {
    runningApp = await createApp({ version: '9.9.9-test' });

    const response = await request(runningApp.getHttpServer())
      .post('/api/test-echo')
      .send({ name: 'Ada', isAdmin: true });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toContain('isAdmin');
  });
});
