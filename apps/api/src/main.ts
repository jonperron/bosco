import { createRequire } from 'node:module';

import 'reflect-metadata';

import { Logger } from '@nestjs/common';

import { createApp } from './app.factory.js';
import { validateEnv } from './config/env.js';

/** Reads this package version, next to the compiled entry point. */
function readPackageVersion(entryFile: string): string {
  const requireFromHere = createRequire(entryFile);
  return (requireFromHere('../package.json') as { version?: string }).version ?? '0.0.0';
}

/** Composition root: validates the environment once, then listens. */
async function bootstrap(): Promise<void> {
  const env = validateEnv(process.env);
  const version = readPackageVersion(__filename);
  const app = await createApp({ version, webDist: env.WEB_DIST });
  const logger = new Logger('main');
  await app.listen(env.PORT);
  logger.log(`Bosco API listening on http://localhost:${env.PORT}/api`);
}

void bootstrap();
