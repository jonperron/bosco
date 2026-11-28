import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProperty,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { CookieOptions, Request, Response } from 'express';

import type { Env } from '../config/env.js';
import {
  AuthService,
  LOGIN_TRANSACTION_SECONDS,
  SESSION_LIFETIME_SECONDS,
  type LoginRefusal,
  type LoginTransaction,
} from './auth.service.js';
import {
  readCookie,
  SESSION_COOKIE,
  SessionGuard,
  TRANSACTION_COOKIE,
  type AuthenticatedRequest,
} from './session.guard.js';

/** The signed-in manager's account. */
export class MeResponse {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'manager@example.com' })
  email!: string;

  @ApiProperty({ type: String, example: 'Alex Martin' })
  displayName!: string;
}

const COOKIE_BASE: CookieOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };

function parseTransaction(raw: string | null): LoginTransaction | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString());
    if (typeof value !== 'object' || value === null) return null;
    const { state, nonce, codeVerifier } = value as Record<string, unknown>;
    if (typeof state !== 'string' || typeof nonce !== 'string') return null;
    if (typeof codeVerifier !== 'string') return null;
    return { state, nonce, codeVerifier };
  } catch {
    return null;
  }
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  private get publicUrl(): string {
    return this.config.get('PUBLIC_URL', { infer: true });
  }

  /** Back to the web app; the error code says nothing about which check failed. */
  private toWebApp(response: Response, refusal?: LoginRefusal): void {
    const query = refusal === undefined ? '' : `?auth_error=${refusal}`;
    response.redirect(302, `${this.publicUrl}/${query}`);
  }

  @Get('login')
  @ApiFoundResponse({ description: 'Redirect to Google, or back to the app on failure.' })
  async login(@Res() response: Response): Promise<void> {
    const started = await this.auth.startLogin();
    if (started === null) {
      this.toWebApp(response, 'failed');
      return;
    }
    const value = Buffer.from(JSON.stringify(started.transaction)).toString('base64url');
    response.cookie(TRANSACTION_COOKIE, value, {
      ...COOKIE_BASE,
      maxAge: LOGIN_TRANSACTION_SECONDS * 1000,
    });
    response.redirect(302, started.url);
  }

  @Get('callback')
  @ApiFoundResponse({ description: 'Back to the app, signed in or with ?auth_error=.' })
  async callback(@Req() request: Request, @Res() response: Response): Promise<void> {
    const transaction = parseTransaction(readCookie(request, TRANSACTION_COOKIE));
    response.clearCookie(TRANSACTION_COOKIE, COOKIE_BASE);
    if (transaction === null) {
      this.toWebApp(response, 'failed');
      return;
    }
    const outcome = await this.auth.finishLogin(
      new URL(request.originalUrl, this.publicUrl),
      transaction,
    );
    if (!outcome.ok) {
      this.toWebApp(response, outcome.reason);
      return;
    }
    // A new sign-in in this browser ends the session it replaces, so a copied cookie dies too.
    const previous = readCookie(request, SESSION_COOKIE);
    if (previous !== null) await this.auth.logout(previous);
    response.cookie(SESSION_COOKIE, outcome.token, {
      ...COOKIE_BASE,
      maxAge: SESSION_LIFETIME_SECONDS * 1000,
    });
    this.toWebApp(response);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: MeResponse })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  me(@Req() request: AuthenticatedRequest): MeResponse {
    const { id, email, displayName } = request.account;
    return { id, email, displayName };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Signed out; the session no longer exists.' })
  @ApiForbiddenResponse({ description: 'Not sent by the app itself (Origin check).' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    // CSRF: browsers always send Origin on a POST; only the app's own origin may sign out.
    if (request.headers.origin !== this.publicUrl) throw new ForbiddenException();
    const token = readCookie(request, SESSION_COOKIE);
    if (token !== null) await this.auth.logout(token);
    response.clearCookie(SESSION_COOKIE, COOKIE_BASE);
  }
}
