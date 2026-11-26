---
type: guide
title: Quickstart
description: What Bosco is on main today, how to install it and run the checks, and where in this wiki to look for each kind of task.
tags: [quickstart, onboarding, overview]
verified:
  - by: openwiki/0.4.3
    at: 2026-11-26T18:56:03.534Z
sources:
  - id: openwiki-source-80276df55c8da3940ca5955f
    resource: repo://apps/api/package.json
  - id: openwiki-source-99de51df25f29bfc72caf823
    resource: repo://apps/web/package.json
  - id: openwiki-source-f317ee207e1653d2033c81a4
    resource: repo://CONTRIBUTING.md
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "claude-code", at: "2026-11-26T18:56:03.534Z" }
---

# Quickstart

Bosco is a self-hosted, open-source (Apache-2.0) tool that gathers an
engineering manager's daily work: people, tasks, projects, team metrics.
The code on `main` is the socle v0 application skeleton: a NestJS API with
a typed health route and a CI-checked OpenAPI contract, a typed HTTP client
generated from that contract, and a bilingual (French / English) React +
Vite interface served by the API. There is no management feature yet.

## Get running

```bash
corepack pnpm install
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```

Then, in two separate terminals (each command stays in the foreground):

```bash
pnpm --filter @bosco/api dev     # API on http://localhost:3000/api
pnpm --filter @bosco/web dev     # Vite dev server, proxies /api
```

Full gate, CI jobs and the browser smoke test:
[Development workflow](workflows/development.md).

## Where to look

| I want to… | Read |
| --- | --- |
| Understand the repository layout and how the workspaces fit | [Monorepo architecture](architecture/overview.md) |
| Change server behaviour, env variables, security headers, SPA serving | [API application](architecture/api.md) |
| Add or change an endpoint and keep the client in sync | [OpenAPI contract flow](architecture/openapi-contract.md) |
| Change the UI or add a translated string | [Web application and i18n](architecture/web.md) |
| Know which checks must pass and what CI runs | [Development workflow](workflows/development.md) |
| Cut a release or pick a commit type | [Development workflow](workflows/development.md#releases) |
| Follow the agent and contributor rules (worktrees, reviews, merging) | [Conventions](conventions/factory.md) |

## Source of truth

Source code and tests are authoritative; this wiki summarises and links.
Contributor rules live in `AGENTS.md`, `.vibe/` and `CONTRIBUTING.md`; the
data collection charter is in `docs/data-collection-charter.en.md` (French:
`docs/data-collection-charter.fr.md`).
