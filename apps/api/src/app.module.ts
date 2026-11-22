import { existsSync } from 'node:fs';
import path from 'node:path';

import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';

import { validateEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';

/**
 * Resolves the web distribution directory: the explicit WEB_DIST env value
 * first, then the sibling apps/web/dist. Returns null when nothing exists,
 * so the API boots without a built frontend (unit tests, API-only deploys).
 */
export function resolveWebDist(webDist: string | null): string | null {
  if (webDist !== null) {
    return webDist;
  }
  const sibling = path.resolve(__dirname, '../../web/dist');
  return existsSync(sibling) ? sibling : null;
}

@Module({})
export class AppModule {
  /**
   * Builds the root module. The API serves the built frontend when its
   * directory exists (production layout: one process, one port); in dev,
   * Vite serves the frontend.
   */
  static register(version: string, webDist: string | null): DynamicModule {
    const webDistDirectory = resolveWebDist(webDist);

    return {
      global: true,
      module: AppModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validate: validateEnv,
        }),
        HealthModule.register(version),
        ...(webDistDirectory === null
          ? []
          : [
              ServeStaticModule.forRoot({
                rootPath: webDistDirectory,
                // path-to-regexp v8 syntax (Express 5): exclude the whole
                // /api prefix so only the frontend falls back to index.html.
                exclude: ['/api', '/api/{*splat}'],
              }),
            ]),
      ],
    };
  }
}
