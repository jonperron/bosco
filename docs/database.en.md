# Database

English · [Français](database.fr.md)

bosco stores everything in PostgreSQL, its only external dependency. The
`@bosco/db` package (`packages/db`) holds the Drizzle schema, the replayable
migrations and the demo seed.

## Running Postgres locally

```bash
docker compose up -d postgres   # postgres:19, bound to 127.0.0.1 only
cp .env.example .env            # sets DATABASE_URL
pnpm db:migrate                 # applies the migrations; safe to rerun
pnpm db:seed                    # fictitious demo data (example.com)
```

The host port is `${POSTGRES_PORT:-5432}`; if 5432 is taken, change
`POSTGRES_PORT` and `DATABASE_URL` together in `.env`.

The seed is idempotent and refuses to run when the database already holds
an organisation, people or teams that are not demo data.

## Tests

- `pnpm test` needs no database;
- `pnpm test:integration` runs the schema tests against a real Postgres. It
  needs `DATABASE_URL` and a role allowed to `CREATE DATABASE`: it creates a
  throwaway database and drops it at the end.

## New migrations

Change `packages/db/src/schema.ts`, then generate the migration with
`pnpm --filter @bosco/db db:generate` (drizzle-kit). The constraints that
forbid overlapping periods are `EXCLUDE` constraints, which drizzle-kit
cannot express: they live in a hand-written migration
(`0001_period_overlap.sql`).

## The `core` data model

- `organisation`: exactly one row — one organisation per install;
- `person`: a display name and an email, unique case-insensitively. A person
  is a record, with no link to any login account;
- `team`;
- `team_membership` and `manager_attachment`: history with a start and an
  optional end (`[started_at, ended_at)`, open while the end is empty).
  Periods never overlap: a person is in a given team at most once, and has
  at most one manager, at any instant; nobody is their own manager;
- foreign keys restrict deletes: a person or team still referenced cannot be
  deleted.

bosco is for managers only, for their own use: a manager creates records for
people who never log in, and no collaborator accounts are planned. People
are entered by hand or imported from CSV; both come in later lots, with
authentication.
