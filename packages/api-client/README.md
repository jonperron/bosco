# @bosco/api-client

Typed HTTP client for the Bosco API: `openapi-fetch` over the OpenAPI
schema generated from the NestJS routes.

## Type generation

The types in `src/gen/schema.d.ts` are **not committed** — they are
generated from the committed OpenAPI contract (`apps/api/openapi.json`):

```sh
pnpm --filter @bosco/api-client generate
```

Because of this, run `generate` **before** `typecheck` in a fresh
checkout (the turbo pipeline already orders them that way: generate →
build → typecheck). If the API routes change, regenerate the contract
(`pnpm --filter @bosco/api generate:openapi` from the repo root) and
then run `generate` again so the client types match the contract.
