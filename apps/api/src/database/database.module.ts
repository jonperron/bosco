import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createDatabase, type Database } from '@bosco/db';

import type { Env } from '../config/env.js';

/** Injection token of the shared Drizzle client (`@bosco/db`). */
export const DATABASE = Symbol('DATABASE');

/** One connection pool per process; it connects on first query and closes with the app. */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createDatabase(config.get('DATABASE_URL', { infer: true })),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.$client.end();
  }
}
