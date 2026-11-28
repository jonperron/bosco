import { DynamicModule, Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService, OIDC_ISSUER } from './auth.service.js';
import { SessionGuard } from './session.guard.js';

@Module({})
export class AuthModule {
  /** Sign-in with Google; `SessionGuard` is exported for every route that needs a manager. */
  static register(issuer: string): DynamicModule {
    return {
      module: AuthModule,
      providers: [AuthService, SessionGuard, { provide: OIDC_ISSUER, useValue: issuer }],
      controllers: [AuthController],
      exports: [AuthService, SessionGuard],
    };
  }
}
