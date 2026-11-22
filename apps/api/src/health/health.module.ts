import { DynamicModule, Module } from '@nestjs/common';

import { APP_VERSION } from './app-version';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({})
export class HealthModule {
  /** Registers the health feature; the version comes from the composition root. */
  static register(version: string): DynamicModule {
    return {
      global: true,
      module: HealthModule,
      providers: [HealthService, { provide: APP_VERSION, useValue: version }],
      controllers: [HealthController],
      exports: [HealthService],
    };
  }
}
