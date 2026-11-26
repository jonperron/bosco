import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';

/** Builds the root module; the built frontend is served by createApp. */
export function registerAppModule(version: string): DynamicModule {
  return {
    module: AppModule,
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        validate: validateEnv,
      }),
      HealthModule.register(version),
    ],
  };
}

@Module({})
export class AppModule {}
