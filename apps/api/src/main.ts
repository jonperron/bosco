import { createRequire } from 'node:module';
import path from 'node:path';

import 'reflect-metadata';

import { Logger } from '@nestjs/common';

import { createApp, readPackageVersion } from './app.factory.js';
import { EnvValidationError, loadEnv } from './config/env.js';

const logger = new Logger('main');

/** Composition root: loads the env once, then listens on the validated port. */
async function bootstrap(): Promise<void> {
  // The optional .env file lives next to package.json. src/ and dist/ are
  // both one level below the package root, so '../package.json' fits both;
  // a bare './package.json' would not, and resolve() never walks up.
  const packageDir = path.dirname(createRequire(__filename).resolve('../package.json'));
  const env = loadEnv(path.join(packageDir, '.env'));
  const version = readPackageVersion(__filename);
  const app = await createApp({
    version,
    webDist: env.WEB_DIST,
    apiDocs: env.API_DOCS_ENABLED,
  });
  await app.listen(env.PORT);
  logger.log(`Bosco API listening on http://localhost:${env.PORT}/api`);
}

bootstrap().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    for (const issue of error.issues) {
      logger.error(issue);
    }
  } else {
    logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  }
  process.exitCode = 1;
});
