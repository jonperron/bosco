import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { buildOpenapiDocument } from './openapi.js';

export interface CreateAppOptions {
  /** Directory of the built frontend to serve; null keeps the API only. */
  webDist?: string | null;
  /** API version reported by the health route; defaults to 0.0.0. */
  version?: string;
}

/**
 * Creates, but does not listen on, the fully wired application.
 * Testable entry point shared by main.ts and the OpenAPI generation script.
 */
export async function createApp(options: CreateAppOptions = {}): Promise<INestApplication> {
  const app = await NestFactory.create(
    AppModule.register(options.version ?? '0.0.0', options.webDist ?? null),
    {
      logger: ['error', 'warn'],
    },
  );

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  SwaggerModule.setup('api/docs', app, buildOpenapiDocument(app));
  app.enableShutdownHooks();
  await app.init();

  return app;
}
