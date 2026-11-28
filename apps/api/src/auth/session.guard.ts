import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type { Account } from '@bosco/db';
import type { Request } from 'express';

import { AuthService } from './auth.service.js';

// __Host-: Secure, path /, no Domain, so a sibling subdomain cannot plant or overwrite them.
export const SESSION_COOKIE = '__Host-bosco_session';
export const TRANSACTION_COOKIE = '__Host-bosco_oidc';

export interface AuthenticatedRequest extends Request {
  account: Account;
}

/** The value of one cookie of the request, or null if absent or malformed. */
export function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator !== -1 && part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Resolves the session cookie to its account (`request.account`); 401 otherwise. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request, SESSION_COOKIE);
    const account = token === null ? null : await this.auth.findAccount(token);
    if (account === null) throw new UnauthorizedException();
    request.account = account;
    return true;
  }
}
