import { createRequire } from 'node:module';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import type { NextFunction, Request, Response } from 'express';

import { registerAppModule } from './app.module.js';
import { resolveWebDist } from './config/web-dist.js';
import { buildOpenapiDocument } from './openapi.js';

const API_PATH = /^\/api(\/|$)/i;

export interface CreateAppOptions {
  /** Directory of the built frontend to serve; null keeps the API only. */
  webDist?: string | null;
  /** API version reported by the health route; defaults to 0.0.0. */
  version?: string;
  /** Serve the Swagger UI of the contract at /api/docs; false by default. */
  apiDocs?: boolean;
  /** OIDC issuer; Google unless a test points it at a local stub. */
  oidcIssuer?: string;
}

/**
 * Creates, but does not listen on, the fully wired application.
 * Testable entry point shared by main.ts and the OpenAPI generation script.
 */
export async function createApp(options: CreateAppOptions = {}): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    registerAppModule(options.version ?? '0.0.0', options.oidcIssuer),
    {
      logger: ['error', 'warn', 'log'],
    },
  );

  // Helmet's default CSP fits both the Vite build and the Swagger UI: only
  // same-origin external scripts, inline styles allowed. upgrade-insecure-requests
  // is dropped: on a plain-HTTP LAN install it would break the SPA's own scripts.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
      // The app does not own its subdomains; leave their HSTS policy to the operator.
      strictTransportSecurity: { includeSubDomains: false },
    }),
  );
  const webDist = resolveWebDist(options.webDist ?? null);
  if (webDist !== null) {
    serveWebDist(app, webDist);
  }
  app.setGlobalPrefix('api');
  // Unknown body fields are a 400, never silently dropped or mass-assigned.
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  if (options.apiDocs === true) {
    SwaggerModule.setup('api/docs', app, buildOpenapiDocument(app));
  }
  app.enableShutdownHooks();
  await app.init();

  return app;
}

/**
 * Serves the built frontend (production layout: one process, one port) and
 * falls back to index.html for client-side routes, never for /api.
 */
function serveWebDist(app: NestExpressApplication, webDist: string): void {
  app.useStaticAssets(webDist);
  app.use((request: Request, response: Response, next: NextFunction) => {
    if ((request.method !== 'GET' && request.method !== 'HEAD') || API_PATH.test(request.path)) {
      next();
      return;
    }
    // With root, send checks dotfiles only below webDist: a dot segment above it
    // (~/.local/...) would otherwise turn every deep link into a 404.
    response.sendFile('index.html', { root: webDist }, (error?: Error) => {
      if (error !== undefined) {
        next(error);
      }
    });
  });
}

/**
 * Reads the version from this package, without dragging package.json into
 * the compiled module tree (the composition root calls it once).
 */
export function readPackageVersion(entryFile: string): string {
  const requireFromHere = createRequire(entryFile);
  return (requireFromHere('../package.json') as { version?: string }).version ?? '0.0.0';
}
