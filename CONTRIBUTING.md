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

- every new workspace provides the same set of scripts (`build`, `lint`,
  `test`, `typecheck`), orchestrated by Turborepo.

## Versioning

Versions are managed with [Changesets](https://github.com/changesets/changesets):
for any user-visible change, add an entry with `pnpm changeset`.

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
