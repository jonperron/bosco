import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module.js';
import { GOOGLE_ISSUER } from './auth/auth.service.js';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';

/** Builds the root module; the built frontend is served by createApp. */
export function registerAppModule(version: string, oidcIssuer = GOOGLE_ISSUER): DynamicModule {
  return {
    module: AppModule,
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        validate: validateEnv,
      }),
      DatabaseModule,
      HealthModule.register(version),
      AuthModule.register(oidcIssuer),
    ],
  };
}

@Module({})
export class AppModule {}
