---
type: data-flow
title: OpenAPI contract flow
description: How the NestJS routes become the committed apps/api/openapi.json, how CI guards it, and how packages/api-client turns it into a typed openapi-fetch client used by the web app.
tags: [openapi, contract, api-client, codegen, ci]
sources:
  - id: openwiki-source-164e2da859b5277df81c7d94
    resource: repo://.github/workflows/ci.yml
  - id: openwiki-source-ea70eb6c045047448e446296
    resource: repo://.gitignore
  - id: openwiki-source-5d05d44cb0a8351599c0ff1c
    resource: repo://apps/api/scripts/generate-openapi.ts
  - id: openwiki-source-5f5698afcf9a6a239ca065c8
    resource: repo://apps/api/src/app.factory.ts
  - id: openwiki-source-038c41565c7f62c38c95c82e
    resource: repo://apps/api/src/openapi.ts
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-a01dbff3e81be145d175fe58
    resource: repo://packages/api-client/package.json
  - id: openwiki-source-3b7fd30a59dbab051f8e2355
    resource: repo://packages/api-client/src/client.ts
  - id: openwiki-source-440ae1e215cb02721dda855c
    resource: repo://turbo.json
generated: { by: "claude-code", at: "2026-11-26T18:56:03.534Z" }
verified:
  - by: openwiki/0.4.3
    at: 2026-11-26T19:14:34.660Z
---

# OpenAPI contract flow

The API's HTTP contract is generated from code, committed, checked in CI,
and consumed by a generated typed client. No hand-written `fetch` crosses
the boundary.

```text
NestJS routes + @ApiProperty DTOs   (apps/api/src)
        │  buildOpenapiDocument(app)
        ▼
apps/api/openapi.json               (committed, key-sorted)
        │  openapi-typescript         (turbo task "generate")
        ▼
packages/api-client/src/gen/schema.ts  (git-ignored)
        │  openapi-fetch createClient<paths>
        ▼
createApiClient(baseUrl)            (used by apps/web)
```

## One document builder

`buildOpenapiDocument` in `apps/api/src/openapi.ts` is the single place the
document is built (title, description, version, Apache-2.0 licence). Both
the live Swagger UI at `/api/docs` (when `API_DOCS_ENABLED=true`, see
[API application](api.md)) and the committed file go through it, so they
cannot drift apart.

## Generating the committed contract

`pnpm --filter @bosco/api generate:openapi` runs
`apps/api/scripts/generate-openapi.ts`: it creates the app with
`createApp({ apiDocs: true })`, builds the document, closes the app, and
writes `apps/api/openapi.json` with object keys sorted recursively (array
order preserved) so a diff only shows real contract changes. The file is
listed in `.prettierignore` because the generator owns its formatting.

## Guarding it: `pnpm openapi:check`

The root script regenerates the contract and runs
`git diff --exit-code -- apps/api/openapi.json`. If a route or DTO changed
without the contract being regenerated and committed, the check fails. It
runs in the CI `quality` job (see
[Development workflow](../workflows/development.md)).

## The typed client: `@bosco/api-client`

- `generate`: `openapi-typescript ../../apps/api/openapi.json -o
  src/gen/schema.ts`. The output is git-ignored and never committed.
- `src/client.ts`: `createApiClient(baseUrl)` returns
  `createClient<paths>({ baseUrl })` from `openapi-fetch`; it also exports
  the `ApiClient` and `ApiPaths` types.
- The package ships ESM from `dist/` (`exports` points at
  `dist/index.js`), so consumers need it built.

Turborepo wires the ordering (`turbo.json`): `generate` declares
`apps/api/openapi.json` as its input and `src/gen/**` as output, and
`build`, `typecheck` and `test` all depend on `generate` and on upstream
`^build`. A fresh checkout therefore gets its client types before any
typecheck. Outside turbo, run `generate` before `typecheck`
(`packages/api-client/README.md`).

## Changing an endpoint

1. Change the controller or DTO in `apps/api`.
2. `pnpm --filter @bosco/api generate:openapi` and commit
   `apps/api/openapi.json`.
3. Let turbo regenerate the client (or run
   `pnpm --filter @bosco/api-client generate`); TypeScript then flags any
   consumer in `apps/web` that no longer matches.

The contract is also the behaviour baseline the factory uses to prove what
an API change did (see [Conventions](../conventions/factory.md)).
