# Contributing guide — bosco

English · [Français](CONTRIBUTING.fr.md)

Thank you for your interest in bosco, an open-source (Apache-2.0),
self-hosted tool that gathers an engineering manager's daily work.

## Environment

- Node.js 24 or newer, pnpm through corepack (`corepack pnpm`);
- clone, then install: `pnpm install`;
- full check (lint, format, types, tests):

  ```bash
  pnpm lint
  pnpm format:check
  pnpm typecheck
  pnpm test
  ```

- end-to-end smoke test in a real browser (builds the app, the API serves
  it): install Chromium once with
  `pnpm --filter @bosco/web exec playwright install chromium`, then run
  `pnpm test:e2e`;

- database (Docker): `docker compose up -d postgres`, `cp .env.example .env`
  (if port 5432 is taken, change `POSTGRES_PORT` and `DATABASE_URL`
  together), then `pnpm db:migrate` and, for demo data, `pnpm db:seed`;
  `pnpm test:integration` runs the schema tests against it (`pnpm test`
  needs no database). See the [database guide](docs/database.en.md);

- every new workspace provides the same set of scripts (`build`, `lint`,
  `test`, `typecheck`), orchestrated by Turborepo.

## Versioning

Versions are managed with [release-please](https://github.com/googleapis/release-please):
it reads the Conventional Commits merged into `main` and opens a release PR
that bumps the version and updates `CHANGELOG.md` (`fix` → patch, `feat` →
minor, `!` → major, or minor while below 1.0.0). Merging that PR tags the release.

## Commits

- Conventional Commits: `type(scope): summary`, types `feat`, `fix`, `chore`,
  `refactor`, `test`, `docs`;
- every new dependency must be compatible with the Apache-2.0 licence: no
  GPL, AGPL or SSPL.

## Working on a change

- one branch per contributor, opened against `main`;
- always work in your own worktree or clone, never on someone else's
  current branch;
- do not merge your own PR: review goes through the maintainers first.

## Data collection charter

Every contribution that touches personal data must respect the
[data collection charter](docs/data-collection-charter.en.md).
