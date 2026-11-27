# Bosco — guidelines (Vibe)

Adapted from fhir-linter's `CLAUDE.md` for Vibe. Vibe loads this file as
project instructions; the factory conventions live under `.vibe/`.

## Project overview

Bosco is a self-hosted, open-source (Apache-2.0) tool that gathers an
engineering manager's daily work: people, tasks, projects, team metrics.
It makes managers' lives simpler; it is not an HR system. Only managers
use it, each on their own, for their own work: the people they manage are
records the manager keeps, and never log in. Do not design accounts, roles,
screens or routes for them.
v0 has no administrator: one shared install per company, and any Google
account in the company domain (set in `.env` by whoever deploys) signs
itself in as a manager on first login. No admin role, no invitations; an
admin role will come later, with cloud hosting.
The socle v0 carries no management feature: it delivers identity, access
control, the module framework, GDPR export/deletion and packaging, and
every module plugs into it. See `local/Résumé Bosco.md` and
`local/Plan socle v0.md` — local, git-ignored files (read them in the
primary checkout; worktrees do not have them), in French — for the goal,
the nine lots and the decisions taken ("Décisions prises").
Always read the section of `local/Plan socle v0.md` for your lot before
working on it, and the `.vibe/rules/*.md` files before any commit.

## Tech stack

- TypeScript monorepo (pnpm + Turborepo)
- Backend: NestJS (`apps/api`), OpenAPI generated from routes, typed client
- Frontend: React + Vite (`apps/web`), i18n French and English
- PostgreSQL as the only external dependency; Drizzle ORM, replayable
  migrations
- Tests: Vitest at every level; releases: release-please (from Conventional Commits); deploy: one Docker
  image, docker compose
- CI: GitHub Actions — tests, OpenAPI contract check, i18n fr/en

## Principles (they are also code rules)

- Metrics are aggregated per team; nothing ranks an individual.
- Private notes are encrypted, one key per manager; each manager gets their
  own recovery key, and no one else can read their notes.
- Every number traces back to its source; one organisation per install.
- A module never reads another module's tables — only the core contract API.
- The rights matrix and the GDPR lifecycle are tested automatically.

## Architecture (target, per the plan)

```
apps/
  api/                  # NestJS backend, OpenAPI + typed client generation
  web/                  # React + Vite frontend, fr/en i18n
packages/               # shared packages (types, contract API, i18n resources)
  db/                   # @bosco/db: Drizzle schema, migrations, demo seed (core schema, lot 3)
docs/                   # guides, fr and en (lot 9)
modules/                # module manifests, one Postgres schema per module (lot 7)
```

All of this is [target] structure: it exists as soon as its lot creates it.

## Key files

| File | Purpose |
|------|---------|
| `local/Résumé Bosco.md` | What bosco is, the modules, the technical choices (local only) |
| `local/Plan socle v0.md` | The nine lots, done-criteria, dependencies, decisions taken (local only) |
| `.vibe/factory/loop.md` | The factory quality loop every agent follows |
| `.vibe/factory/project.md` | The repo profile: gate, worktree setup, routing, baseline |
| `.vibe/rules/*.md` | Coding style, testing, commit messages |

## Coding rules

Coding rules live in `.vibe/rules/` and are loaded because AGENTS.md names
them:

- [Coding style](.vibe/rules/coding-style.md): TypeScript conventions for
  backend and frontend.
- [Testing](.vibe/rules/testing.md): TDD workflow, coverage targets, test
  types.
- [Commit messages](.vibe/rules/commit-messages.md): Conventional Commits,
  attribution trailer.

## Subagents

When completing any task on a backend file, run the `backend-reviewer`
subagent before finishing. On a frontend file, run the `frontend-reviewer`.
Then run the `build`, `linter` and `test` subagents. Run the reviewer first;
run the others when it found no CRITICAL or MAJOR issue. Any task touching
crypto, OIDC, rights, or dependency changes also runs the `security`
subagent. Behaviour or API changes run the `docs-sync` subagent last:
specifications (here, docs and the Conventional Commit type that drives the release) must always be up to date at the
end of a task that adds, changes, or removes functionality.

## Factory subagents (multi-issue and PR work)

For work spanning several lots or PRs, delegate to these subagents instead
of general-purpose ones. They share `.vibe/factory/loop.md` (the quality
loop) and read every repo-specific detail from
`.vibe/factory/project.md`.

| Agent | Use it to |
| --- | --- |
| `issue-driver` | Take one issue from a failing test to a reviewed commit or PR |
| `pr-consolidator` | Merge several branches on the same component into one PR |
| `pr-rebaser` | Rebase a conflicting PR, keeping both sides' behaviour |
| `bot-review-responder` | Verify, fix and reply to every automated review comment |
| `behaviour-differ` | Compare the OpenAPI/schema baseline between two refs to prove what changed |

Group issues that touch the same component into one PR (`pr-consolidator`).
Run each agent in its own git worktree (see `loop.md`, Ground rules),
except `behaviour-differ`, which is read-only.
