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
an organisation, people or teams that are not demo data, or any account
(a manager has signed in).

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

The API applies pending migrations at startup, before it listens;
`pnpm db:migrate` does the same by hand. Both take a Postgres advisory
lock, so several API instances starting at once migrate safely: they wait
their turn. There is no wait limit yet.

## The `core` data model

- `organisation`: exactly one row — one organisation per install;
- `person`: a display name and an email, unique case-insensitively. A person
  is a record, with no link to any login account;
- `team`;
- `team_membership` and `manager_attachment`: history with a start and an
  optional end (`[started_at, ended_at)`, open while the end is empty).
  Periods never overlap: a person is in a given team at most once, and has
  at most one manager, at any instant; nobody is their own manager;
- `account`: a manager's login account (see below);
- `session`: an open session of an account;
- foreign keys restrict deletes: a person or team still referenced cannot be
  deleted. Sessions are the exception: they are deleted with their account.

bosco is for managers only, for their own use: a manager creates records for
people who never log in, and no collaborator accounts are planned. People
are entered by hand or imported from CSV; the screens and routes for both
come in later lots, with authentication.

## Accounts and sessions

Any verified Google account of the company domain signs in as a manager,
and its account is created at its first login: no administrator, no
invitation, no role. An account holds the OIDC subject (the stable
identity, unique), an email (unique ignoring case) and a display name. It
is not linked to a `person` record: whether a manager's account maps to a
person is an open question.

Sessions live in the database, so logging out revokes them. A session
stores only the SHA-256 hash of a random 256-bit token; the database
refuses anything that is not a SHA-256 hex digest, so a raw token cannot be
stored by mistake. Its expiry is computed on the database clock.

`@bosco/db` exports the functions; the sign-in routes of the API use them
(see the [authentication guide](authentication.en.md)):

- `upsertAccountFromOidc(db, { subject, email, displayName })`: the caller
  must have verified the ID token. Matches on the subject, follows email and
  name changes. An email held by another subject raises
  `AccountEmailConflictError` (with no cause: the driver error quotes the
  email): accounts are never merged;
- `createSession(db, accountId, lifetimeSeconds)` returns the raw token,
  readable only this once, and its expiry. A lifetime that is not a whole
  number of seconds from 1 to 2^31 - 1 raises a `RangeError`;
- `findSession(db, token)` returns the account and expiry, or `null` if the
  token is unknown or expired;
- `deleteSession(db, token)` logs out, and says whether a session matched;
- `deleteExpiredSessions(db)` deletes expired sessions and returns how many.

## Importing people from CSV

`importPeopleCsv(db, csvText)` in `@bosco/db` imports people from a CSV
file. No route or screen calls it yet.

```csv
display_name,email,manager_email
Ada Alpha,ada@example.com,
Bo Beta,bo@example.com,ada@example.com
```

- RFC 4180 CSV: comma-separated, fields optionally in double quotes, a
  doubled quote for a quote, CRLF, LF or CR line ends. Blank lines are skipped.
- The header row is required. `display_name` and `email` are required
  columns, `manager_email` is optional; columns are matched in any order and
  case. Any other column, or a repeated one, rejects the file. Every line has
  as many fields as the header; spaces around a value are ignored.
- Emails are printable ASCII with one `@` and a dot in the domain; nothing
  checks that they are deliverable.
  Display names cannot hold control characters (tabs, NUL...). An email
  repeated in the file, or a person named as their own manager, is an error.
- All or nothing: one invalid line rejects the whole file and nothing is
  written. The error lists each problem by line and column, never a value
  from the file; the message shows the first 20.
- People are matched on email, ignoring case: a known email updates the
  display name, a new one creates a person. The import returns how many
  people it created, renamed, and gave a new manager.
- A non-empty `manager_email` must name someone in the file or already in
  the database. When it names a new manager, the open attachment ends and a
  new one starts at the same instant; the history is kept. An empty
  `manager_email` leaves the current manager as it is.
- Imports run one at a time (a Postgres advisory lock). Other writers to
  `core.person` do not take that lock.

Not supported yet: teams, removing a manager, `;`-separated files, emails
outside ASCII, a size limit or a lock wait limit (both for the route that
will call the import), and manager cycles (A manages B, B manages A), which
the rights lot will prevent. A file holds at most about 20,000 rows
(Postgres' limit on query parameters). Email matching assumes a database
locale whose `lower()` maps `I` to `i`: a Turkish locale would not.
