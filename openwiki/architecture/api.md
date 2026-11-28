---
type: application
title: API application (NestJS)
description: How apps/api boots, validates its environment, exposes the typed health route, applies security headers and request validation, and serves the built web app on the same port.
tags: [api, nestjs, configuration, security, health]
verified:
  - by: openwiki/0.4.3
    at: 2026-11-26T18:56:03.534Z
sources:
  - id: openwiki-source-5df10578b47a3ab545818aba
    resource: repo://apps/api/.env.example
  - id: openwiki-source-5d05d44cb0a8351599c0ff1c
    resource: repo://apps/api/scripts/generate-openapi.ts
  - id: openwiki-source-5f5698afcf9a6a239ca065c8
    resource: repo://apps/api/src/app.factory.ts
  - id: openwiki-source-7c7a4c4b81e392d6121624b8
    resource: repo://apps/api/src/config/env.ts
  - id: openwiki-source-86aee1903912632eae66cff3
    resource: repo://apps/api/src/config/web-dist.ts
  - id: openwiki-source-21ae2b3d09bb360e3ca0d453
    resource: repo://apps/api/src/health/health.controller.ts
  - id: openwiki-source-ed46aa6fb1d96455559922f6
    resource: repo://apps/api/src/health/health.module.ts
  - id: openwiki-source-883fc4e70166c3b8c402802a
    resource: repo://apps/api/src/health/health.service.ts
  - id: openwiki-source-ac07cae48b06bdae0960d54e
    resource: repo://apps/api/src/main.ts
  - id: openwiki-source-bfa9a5acb3a076cd937f5f4b
    resource: repo://apps/api/test/health.e2e.test.ts
  - id: openwiki-source-141b10f6874921bf0f5db7d7
    resource: repo://apps/api/test/validation.e2e.test.ts
  - id: openwiki-source-b5c0c54a3f3a3b608c18533d
    resource: repo://apps/api/test/web-serving.e2e.test.ts
  - id: openwiki-source-c686fe0cfe191d5316bf9e65
    resource: repo://apps/api/vitest.config.ts
generated: { by: "claude-code", at: "2026-11-26T18:56:03.534Z" }
---

# API application (NestJS)

`apps/api` (`@bosco/api`) is the NestJS backend of the socle v0. Today it
carries no management feature: one typed health route, Google Workspace
sign-in (`src/auth`, see `docs/authentication.en.md`), the OpenAPI
contract, and the serving of the built frontend. See
[OpenAPI contract flow](openapi-contract.md) for how the routes become the
committed contract, and [Web application](web.md) for the client side.

## Entry points

| File | Role |
| --- | --- |
| `src/main.ts` | Composition root: loads `.env`, reads the package version, calls `createApp`, applies pending migrations, listens on `PORT`. |
| `src/app.factory.ts` | `createApp(options)`: builds the fully wired app without listening. Shared by `main.ts`, the tests and the OpenAPI generator. |
| `src/app.module.ts` | `registerAppModule(version)`: root dynamic module (global `ConfigModule`, `DatabaseModule`, `HealthModule`, `AuthModule`). |
| `scripts/generate-openapi.ts` | Regenerates `openapi.json` from a `createApp` instance. |

Scripts (`apps/api/package.json`): `dev` (tsx watch), `build` (tsc),
`start` (`node dist/main.js`), `generate:openapi`, `test` (Vitest).

## Boot sequence

1. `main.ts` resolves the package directory from `../package.json` (works
   from both `src/` and `dist/`) and calls `loadEnv(<package>/.env)`.
2. `loadEnv` loads the optional `.env` (a missing file is normal; any other
   read error is fatal) and runs `validateEnv` on `process.env`.
3. `readPackageVersion` reads the version once; it is injected into the
   health feature through the `APP_VERSION` DI token, so nothing else
   depends on `package.json`.
4. `createApp` wires middleware and pipes; `runMigrations` (advisory-locked)
   applies pending migrations, closing the app if it fails; then
   `app.listen(env.PORT)`.
5. Any startup failure logs each `EnvValidationError` issue (or the stack)
   and sets `process.exitCode = 1`.

## Configuration

Variables are declared in `ENV_KEYS` (`src/config/env.ts`, sample in
`apps/api/.env.example`). Required, the API refuses to start without them:
`DATABASE_URL`, `PUBLIC_URL` (https except on localhost),
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_WORKSPACE_DOMAIN` (see
`docs/authentication.en.md`). Optional:

| Variable | Default | Validation |
| --- | --- | --- |
| `PORT` | `3000` | decimal integer in 1–65535 |
| `API_DOCS_ENABLED` | `false` | `true` / `false` (case-insensitive), else error |
| `WEB_DIST` | sibling `apps/web/dist` if it exists | blank means unset |

Malformed values stop the app with an `EnvValidationError` naming the
variable; unknown host variables are ignored. `ConfigModule` is registered
with `ignoreEnvFile: true` and the same `validateEnv`, so the `.env` file is
read only once, in `main.ts`.

## Request pipeline

`createApp` applies, in order:

- **Helmet** with its default CSP, minus `upgrade-insecure-requests` (it
  would break a plain-HTTP LAN install) and with HSTS `includeSubDomains`
  off (the operator owns subdomains).
- **SPA serving** when a web distribution resolves (see below).
- Global prefix **`/api`**.
- A global **`ValidationPipe`** with `whitelist` and
  `forbidNonWhitelisted`: unknown body fields are a 400, never dropped or
  mass-assigned.
- **Swagger UI** at `/api/docs` only when `apiDocs` is true (off by default).
- Shutdown hooks, then `app.init()`.

Logger levels are `error`, `warn`, `log`; debug and verbose stay off.

## Serving the frontend

`resolveWebDist` (`src/config/web-dist.ts`) picks the explicit `WEB_DIST`
(made absolute) or the sibling `apps/web/dist`, or returns `null` so the API
boots alone (unit tests, API-only deploys). When a directory resolves, the
app serves its static files and falls back to `index.html` for any
`GET`/`HEAD` request that is not under `/api`, so client-side deep links
(for example `/people/42`) load the SPA while unknown API paths still 404.
The fallback uses `sendFile` with `root: webDist`, so a dot segment above
the distribution (such as `~/.local/...`) does not turn deep links into 404s,
while dotfiles inside it are still refused.

This is the production layout: one process, one port. In development, Vite
serves the frontend and proxies `/api` to this app instead.

## Health feature

`HealthModule.register(version)` provides `HealthService` and
`HealthController`. `GET /api/health` returns `HealthResponse`:
`status: 'ok'`, the package `version`, and `uptimeSeconds` (floored process
uptime). The `@ApiProperty` decorators on `HealthResponse` are what the
OpenAPI contract describes.

## Tests

Vitest with the SWC plugin (NestJS needs decorator metadata), coverage on
`src/**` except `main.ts`, 80 % floor on lines, functions, branches and
statements (`apps/api/vitest.config.ts`). Representative suites in
`apps/api/test/`:

- `config/env.test.ts`, `config/resolve-web-dist.test.ts`: env parsing and
  web-dist resolution.
- `health.e2e.test.ts`: the health payload, and `/api/docs-json` off by
  default.
- `security-headers.e2e.test.ts`, `validation.e2e.test.ts`,
  `logger-levels.e2e.test.ts`: the pipeline guarantees above.
- `web-serving.e2e.test.ts`: SPA fallback, `/api` never falling back, and
  the dot-segment path case.
