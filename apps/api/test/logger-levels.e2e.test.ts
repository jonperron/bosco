import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '@/app.factory.js';
import type { INestApplication } from '@nestjs/common';

let runningApp: INestApplication | null = null;

afterEach(async () => {
  if (runningApp !== null) {
    await runningApp.close();
    runningApp = null;
  }
});

describe('createApp logger levels', () => {
  it('keeps log enabled so main.ts prints its startup line', async () => {
    runningApp = await createApp({ version: '9.9.9-test' });

    expect(Logger.isLevelEnabled('log')).toBe(true);
    expect(Logger.isLevelEnabled('warn')).toBe(true);
    expect(Logger.isLevelEnabled('error')).toBe(true);
  });

  it('keeps debug and verbose off', async () => {
    runningApp = await createApp({ version: '9.9.9-test' });

    expect(Logger.isLevelEnabled('debug')).toBe(false);
    expect(Logger.isLevelEnabled('verbose')).toBe(false);
  });
});
