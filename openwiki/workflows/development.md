---
type: workflow
title: Development workflow, CI and releases
description: The local quality gate, the two GitHub Actions CI jobs (quality checks and the Playwright end-to-end smoke test), coverage floors, and how release-please turns Conventional Commits into versions.
tags: [workflow, ci, testing, e2e, release]
verified:
  - by: openwiki/0.4.3
    at: 2026-11-26T18:56:03.534Z
sources:
  - id: openwiki-source-164e2da859b5277df81c7d94
    resource: repo://.github/workflows/ci.yml
  - id: openwiki-source-46fa34397e41ebf7491c7359
    resource: repo://.github/workflows/release-please.yml
  - id: openwiki-source-2a434185cb848d848729822b
    resource: repo://.vibe/factory/project.md
  - id: openwiki-source-c686fe0cfe191d5316bf9e65
    resource: repo://apps/api/vitest.config.ts
  - id: openwiki-source-026e6bf45864745641babf67
    resource: repo://apps/web/e2e/home.spec.ts
  - id: openwiki-source-b718d27c389d0cfab47c5b2a
    resource: repo://apps/web/playwright.config.ts
  - id: openwiki-source-6fe10cfb5ec054ca681eb262
    resource: repo://apps/web/vitest.config.ts
  - id: openwiki-source-482fa4ca84f42b04ba025fc1
    resource: repo://release-please-config.json
  - id: openwiki-source-440ae1e215cb02721dda855c
    resource: repo://turbo.json
generated: { by: "claude-code", at: "2026-11-26T18:56:03.534Z" }
---

# Development workflow, CI and releases

## Setup

Node.js 24+, pnpm through corepack. In a fresh clone or worktree:

```bash
corepack pnpm install
```

The API reads optional settings from `apps/api/.env` (see
`apps/api/.env.example` and [API application](../architecture/api.md)).
`pnpm --filter @bosco/api dev` and `pnpm --filter @bosco/web dev` run the
two apps with the Vite proxy in between.

## The quality gate

Run from the repository root; CI runs the same commands
(`.vibe/factory/project.md`, Quality gate, is the reference list):

| Command | Checks |
| --- | --- |
| `pnpm install --frozen-lockfile` | lockfile parses and is current |
| `pnpm lint` | ESLint in every workspace (turbo) |
| `pnpm format:check` | Prettier on the whole tree (`.prettierignore` skips generated files and `openwiki/`) |
| `pnpm typecheck` | `tsc --noEmit` per workspace, after client generation |
| `pnpm test` | Vitest in every workspace, with coverage |
| `pnpm openapi:check` | committed `apps/api/openapi.json` matches the routes ([contract flow](../architecture/openapi-contract.md)) |
| `pnpm i18n:check` | `fr.json` and `en.json` have the same keys ([web app](../architecture/web.md)) |
| `pnpm test:e2e` | Playwright smoke test in Chromium |

Coverage: `apps/api` and `apps/web` enforce 80 % lines, functions, branches
and statements in their `vitest.config.ts`. Floors are not edited inside an
unrelated change.

## End-to-end smoke test

`pnpm test:e2e` makes turbo build the web app and the API, then Playwright
(`apps/web/playwright.config.ts`) starts `node ../api/dist/main.js` on port
4310 (override with `E2E_PORT`), waits for `/api/health`, and drives
Chromium against the app exactly as it ships: one process, real security
headers. `apps/web/e2e/home.spec.ts` checks that:

- the home page loads in French and shows the API version from health;
- switching to English updates the page and survives a reload;
- a deep link (`/people/42`) is served by the SPA at its own URL.

An auto fixture fails any test whose page logs a console error or throws,
which catches a CSP that blocks the app. Install Chromium once per machine
with `pnpm --filter @bosco/web exec playwright install chromium`.

## CI (`.github/workflows/ci.yml`)

Runs on every pull request and on pushes to `main`, with read-only
permissions and in-progress runs cancelled per ref. Both jobs use Node 24
and the pnpm version from `packageManager`.

- **`quality`** (Lint, format, typecheck, tests): frozen install, then
  `lint`, `format:check`, `typecheck`, `test`, `openapi:check`,
  `i18n:check`.
- **`e2e`** (End-to-end smoke): frozen install, Chromium with system deps,
  `pnpm test:e2e`; on failure it uploads the Playwright report and traces
  for seven days.

## Releases

`.github/workflows/release-please.yml` runs release-please on each push to
`main`. It reads the Conventional Commits merged since the last release and
keeps a release PR open that bumps the version and updates `CHANGELOG.md`;
merging that PR tags the release.

- `fix` → patch, `feat` → minor, `!` / `BREAKING CHANGE:` → major, except
  that breaking changes bump the minor while below 1.0.0
  (`bump-minor-pre-major`).
- One version for the whole repo (`.release-please-manifest.json`), also
  written into `apps/api`, `apps/web` and `packages/api-client`
  `package.json` files. The API reports that version on `/api/health`.

Commit rules are summarised in
[Conventions](../conventions/factory.md#commits-and-prs).
