---
type: architecture
title: Monorepo architecture
description: Layout of the Bosco pnpm + Turborepo monorepo, its three current workspaces, how they depend on each other at build and run time, and the Turborepo task graph.
tags: [architecture, monorepo, pnpm, turborepo, typescript]
verified:
  - by: openwiki/0.4.3
    at: 2026-11-26T18:56:03.534Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5f5698afcf9a6a239ca065c8
    resource: repo://apps/api/src/app.factory.ts
  - id: openwiki-source-99de51df25f29bfc72caf823
    resource: repo://apps/web/package.json
  - id: openwiki-source-03f6dd3375679341910a29c1
    resource: repo://apps/web/vite.config.ts
  - id: openwiki-source-2fda883e9b76745f69f487f7
    resource: repo://eslint.config.mjs
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
  - id: openwiki-source-df1e4d0dc0a35c64fd0e652b
    resource: repo://tsconfig.base.json
  - id: openwiki-source-440ae1e215cb02721dda855c
    resource: repo://turbo.json
generated: { by: "claude-code", at: "2026-11-26T18:56:03.534Z" }
---

# Monorepo architecture

Bosco is a self-hosted, Apache-2.0 tool for engineering managers. The code
on `main` is the start of the socle v0, which delivers identity, access
control, the module framework, GDPR export/deletion and packaging (no
management feature). Those socle capabilities land lot by lot; today the
repository holds an API, a web
app and the typed client that joins them. Project principles (team-level
metrics only, encrypted private notes, modules talking only through the
core contract API) are listed in `AGENTS.md`.

## Workspaces

`pnpm-workspace.yaml` declares `apps/*` and `packages/*`.

| Workspace | Package | What it is | Page |
| --- | --- | --- | --- |
| `apps/api` | `@bosco/api` | NestJS backend; owns the OpenAPI contract and serves the built web app | [API application](api.md) |
| `apps/web` | `@bosco/web` | React + Vite frontend, French and English | [Web application](web.md) |
| `packages/api-client` | `@bosco/api-client` | Typed `openapi-fetch` client generated from the contract | [OpenAPI contract flow](openapi-contract.md) |

The target layout in `AGENTS.md` (database schema, modules, guides) is
created lot by lot; only what exists on `main` is described here.

## How the pieces connect

```text
apps/api ──writes──▶ apps/api/openapi.json ──generate──▶ packages/api-client
   ▲                                                         │ workspace:*
   │ serves apps/web/dist (prod)                             ▼
   └──────────── /api/* (same origin) ◀──────────────── apps/web
```

- **Build time:** the web app depends on `@bosco/api-client`
  (`workspace:*`), whose types are generated from the committed contract.
- **Run time (production):** one Node process. The API serves the built
  frontend and its own routes under `/api` on a single port, so the browser
  calls stay same-origin.
- **Run time (development):** `vite` serves the frontend and proxies
  `/api` to the API on port 3000.

## Tooling

- Node.js 24 or newer (`engines`), pnpm pinned through `packageManager`.
- Root scripts delegate to Turborepo: `build`, `lint`, `typecheck`, `test`,
  `test:e2e`; `format:check` runs Prettier on the whole tree;
  `openapi:check` and `i18n:check` target one workspace each.
- Every workspace provides `build`, `lint`, `test`, `typecheck`.
- Shared TypeScript settings in `tsconfig.base.json`: strict mode,
  `noUncheckedIndexedAccess`, `NodeNext` modules, no unused locals or
  parameters. ESLint (`eslint.config.mjs`) forbids `any` and non-null
  assertions and ignores generated code and the wiki.

## Turborepo task graph

From `turbo.json`:

- `generate` (cached): input `apps/api/openapi.json`, output `src/gen/**`.
  Only `@bosco/api-client` defines it.
- `build`: depends on upstream `^build` and `generate`; outputs `dist/**`.
- `typecheck`, `test`: depend on `^build` and `generate`.
- `test:e2e` (never cached): depends on the workspace `build` and on
  `@bosco/api#build`, and passes `CI`, `E2E_PORT`, `WEB_DIST` through.

See [Development workflow](../workflows/development.md) for the gate built
on top of these tasks.
