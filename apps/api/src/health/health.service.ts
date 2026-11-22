import { Inject, Injectable } from '@nestjs/common';

import { APP_VERSION } from './app-version';

@Injectable()
export class HealthService {
  constructor(@Inject(APP_VERSION) private readonly version: string) {}

  /** One HTTP health payload, built from process state and the package version. */
  getHealth(): { status: 'ok'; version: string; uptimeSeconds: number } {
    return {
      status: 'ok',
      version: this.version,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
