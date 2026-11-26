---
type: application
title: Web application (React + Vite) and i18n
description: How apps/web boots, calls the API only through the typed client, handles French and English with a persisted language choice, and keeps both locale files in sync.
tags: [web, react, vite, i18n, frontend]
verified:
  - by: openwiki/0.4.3
    at: 2026-11-26T18:56:03.534Z
sources:
  - id: openwiki-source-b3f97d6cb262c4910a4638b7
    resource: repo://apps/web/scripts/i18n-check.mjs
  - id: openwiki-source-36c627bb09b26171706b3959
    resource: repo://apps/web/src/home-page.tsx
  - id: openwiki-source-723e1217c42eee91c77b2b34
    resource: repo://apps/web/src/i18n/index.ts
  - id: openwiki-source-8e8b395281c4996e784ae3b5
    resource: repo://apps/web/src/main.tsx
  - id: openwiki-source-03f6dd3375679341910a29c1
    resource: repo://apps/web/vite.config.ts
  - id: openwiki-source-6fe10cfb5ec054ca681eb262
    resource: repo://apps/web/vitest.config.ts
generated: { by: "claude-code", at: "2026-11-26T18:56:03.534Z" }
---

# Web application (React + Vite) and i18n

`apps/web` (`@bosco/web`) is the React 19 + Vite frontend. For now it is a
single home page that shows the tagline, a language switch and the API
health. In production it is built to `apps/web/dist` and served by the API
(see [API application](api.md)).

## Entry and rendering

- `index.html` loads `src/main.tsx`, which imports `./i18n` (initialising
  translations before the first render) and renders `HomePage` inside
  `StrictMode` into `#root`; a missing `#root` throws.
- Scripts: `dev` (Vite), `build` (`tsc --noEmit` then `vite build`),
  `test` (Vitest, jsdom), `test:e2e` (Playwright), `i18n:check`.

## Talking to the API

`src/home-page.tsx` creates one module-level client with
`createApiClient(import.meta.env.VITE_API_BASE_URL ?? '')` from
`@bosco/api-client`. Every HTTP call must go through it, so requests stay
typed against the committed contract (see
[OpenAPI contract flow](openapi-contract.md)).

- `loadHealth()` calls `GET /api/health`; a typed error, missing data or a
  transport rejection all map to the `error` state.
- The effect that loads health ignores a superseded answer, so React
  StrictMode's double effect in dev cannot race.
- With `VITE_API_BASE_URL` empty, calls are same-origin: in production the
  API serves the page, in dev `vite.config.ts` proxies `/api` to
  `http://localhost:3000`.

## Internationalisation

`src/i18n/index.ts` sets up `i18next` + `react-i18next`:

- Supported languages are exactly `fr` and `en`; `fr` is the default and
  the fallback.
- Resources are bundled JSON (`src/i18n/locales/fr.json`, `en.json`) and
  initialised synchronously (`initAsync: false`), so the first render is
  already translated.
- The choice is persisted in `localStorage` under `bosco.language`. An
  unsupported stored value, or a storage that throws (private browsing),
  falls back to `fr`; a failed write logs a warning but the switch still
  happens.
- `changeLanguage` also sets `<html lang>` for screen readers and spell
  check. The language buttons expose `aria-pressed`.
- "Bosco" and the autonyms "Français" / "English" are deliberately not
  translated.

### Key parity: `pnpm i18n:check`

`apps/web/scripts/i18n-check.mjs` flattens each locale file into dotted keys
and fails if either file misses a key present in the other. Neither locale
is the reference: both must be complete. It runs in the CI `quality` job.
Adding a string means adding the key to both files.

## Tests

- Unit and component tests (Vitest, jsdom, 80 % coverage floor on `src/**`
  except `main.tsx`): `test/home.test.tsx` (default French, typed health
  path, language switch and persistence, error states) and
  `test/i18n.test.ts` (sync init, fallbacks, persistence).
- Browser smoke tests in `e2e/home.spec.ts`, run against the built API
  serving the built app; see
  [Development workflow](../workflows/development.md).
