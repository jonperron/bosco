import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';

import { resolveWebDist } from './config/web-dist.js';
import { validateEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';

/**
 * Builds the root module. The API serves the built frontend when its
 * directory exists (production layout: one process, one port); in dev,
 * Vite serves the frontend.
 */
export function registerAppModule(version: string, webDist: string | null): DynamicModule {
  const webDistDirectory = resolveWebDist(webDist);

  return {
    module: AppModule,
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        validate: validateEnv,
      }),
      // path-to-regexp v8 syntax (Express 5): exclude the whole /api prefix
      // so only frontend routes fall back to index.html.
      ...(webDistDirectory === null
        ? []
        : [
            ServeStaticModule.forRoot({
              rootPath: webDistDirectory,
              exclude: ['/api', '/api/{*splat}'],
            }),
          ]),
      HealthModule.register(version),
    ],
  };
}

@Module({})
export class AppModule {}
