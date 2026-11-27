# Files

- [API application (NestJS)](api.md) - How apps/api boots, validates its environment, exposes the typed health route, applies security headers and request validation, and serves the built web app on the same port.
- [Core data model (@bosco/db)](data-model.md) - The core Postgres schema in packages/db (organisation, person, team, team membership and manager attachment history), the rules the database enforces, migrations, the demo seed, the people CSV import and the integration tests.
- [OpenAPI contract flow](openapi-contract.md) - How the NestJS routes become the committed apps/api/openapi.json, how CI guards it, and how packages/api-client turns it into a typed openapi-fetch client used by the web app.
- [Monorepo architecture](overview.md) - Layout of the Bosco pnpm + Turborepo monorepo, its four current workspaces, how they depend on each other at build and run time, and the Turborepo task graph.
- [Web application (React + Vite) and i18n](web.md) - How apps/web boots, calls the API only through the typed client, handles French and English with a persisted language choice, and keeps both locale files in sync.
