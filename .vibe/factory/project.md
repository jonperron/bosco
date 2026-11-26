# Factory project profile — bosco

The factory subagents (`issue-driver`, `pr-consolidator`, `pr-rebaser`,
`bot-review-responder`, `behaviour-differ`) are repo-agnostic: everything
specific to this repository lives here. To reuse them elsewhere, copy
`.vibe/agents/{issue-driver,pr-consolidator,pr-rebaser,bot-review-responder,behaviour-differ}.toml`
and write a new copy of this file with the same headings.

Status: the repository is greenfield. Lots 1–9 of the socle v0 (see
`local/Plan socle v0.md`) have not started; every command marked
**[provisional]** below is a best-effort statement of the tooling decided in
the plan, to be confirmed and updated by lot 1 (dépôt et outillage). Updated
rules override the [provisional] wording.

## Repository

- GitHub: `jonperron/bosco` (confirmed by the user, 2026-11-21).
- Planning docs — `local/Résumé Bosco.md`, `local/Plan socle v0.md` — are
  local-only: `local/` is git-ignored, so worktrees do not have it. Read them
  in the primary checkout (first line of `git worktree list`) and report if
  the file is missing. Never copy them into the repo or into a PR.
- Base branch: `main` (never commit on it, never merge into it locally)
- Conventions: `AGENTS.md`, `.vibe/rules/*.md`
- Commit messages: `.vibe/rules/commit-messages.md`
- Commit trailer: Vibe attribution lines (see `.vibe/rules/commit-messages.md`).
  PR body footer: the same source.

## Stack

- **Runtime: Node.js ≥24** (current LTS; also covers vitest 5.x, which needs ≥22.12).
- Monorepo: pnpm + Turborepo; npm scripts only through pnpm
- Backend: NestJS (`apps/api`), OpenAPI generated from routes, typed client
- Frontend: React + Vite (`apps/web`), i18n fr/en
- Data: PostgreSQL only, Drizzle ORM, migrations replayable
- Modules: manifest + one Postgres schema per module, contract API to the core
- Tests: Vitest at every level
- Release: release-please, driven by Conventional Commits; deploy: one Docker image, docker compose
- CI: GitHub Actions — tests, OpenAPI contract check, i18n fr/en

## Git quirks

- A branch checked out in another worktree cannot be checked out again. To
  update a PR whose branch lives elsewhere, work on a new local branch from
  `origin/<branch>` and push with
  `--force-with-lease=<branch>:origin/<branch> origin <local>:<branch>`.
- `gh` is on the normal PATH; use it bare.
- A `git fetch` can fail on a ref lock while another agent fetches in
  parallel: run it again.

## Shell quirks (Vibe)

- The plan must run with the PR flow, so `gh` and network access to GitHub are
  expected to be permitted for factory sessions; if a `gh` call is denied,
  report and stop rather than working around it.
- Foreground shell calls have a time cap. Never `sleep` in the foreground to
  wait for CI or the bot: write a small poll script with the Write tool to
  the scratchpad and run it as a background process; read its output when it
  finishes (loop.md, After the push, step 1).
- One repository checkout is the primary one (first line of `git worktree
  list`). Never build, test or push from it unless your caller explicitly
  assigned it to you.
- Parallel git calls that write state (fetch, commit, worktree) can collide:
  run them one at a time; independent read-only calls may run in parallel.

## Worktree setup

Run first in every fresh worktree, before you build or test. Commands are
[provisional] until lot 1 lands:

```bash
pnpm install
cp .env.example .env            # then fill the values the task needs
docker compose up -d postgres   # or: docker compose up -d db — service name per lot 3
pnpm db:migrate                 # drizzle migrations (lot 3 onwards)
```

The Postgres database is the only external dependency; tasks that touch
migrations, rights, encryption or modules need a real database, never a mock
of one. Keep generated files (`dist/`, generated OpenAPI client) uncommitted.

## Before every commit

- `pnpm lockfile` (`pnpm-lock.yaml`) merges can be wrong without a conflict:
  two dependency PRs can each add the same package and git keeps both copies,
  and `main` goes red. Merge PRs that touch `pnpm-lock.yaml`
  (Dependabot's included) one at a time, each on CI that includes current
  `main`.
- `git status` must show no generated client, `.env`, `dist/` or local
  databases staged.
- A new dependency states its licence in the commit message, and the licence
  is Apache-2.0-compatible: no GPL, AGPL or SSPL anywhere. Refuse and report
  otherwise.
- Test fixtures stay anonymous: no real names, emails, or data that looks
  like an export of a real system (Lucca, Jira, annuaires). Replace anything
  close to personal data with generated records, and note it in the report.

## Quality gate

All must pass, from the worktree root ([provisional] wording):

```bash
pnpm install --frozen-lockfile  # pnpm-lock.yaml parses and is current
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test                       # vitest, all workspaces, via turbo
pnpm openapi:check              # contract: generated OpenAPI matches committed
pnpm i18n:check                 # fr and en keys in sync
pnpm test:e2e                   # Playwright smoke: builds, API serves the app, Chromium
```

`pnpm test:e2e` needs Chromium once per machine:
`pnpm --filter @bosco/web exec playwright install chromium`. If it cannot be
installed, say so in the report; the CI `e2e` job must then prove it.

If `pnpm install --frozen-lockfile` fails only because `pnpm-lock.yaml` on
`main` lags a release, say so in the report and go on; any other failure
blocks.

Tasks that touch DB, rights, crypto or modules also need the integration
suite against the compose database: `pnpm test:integration` [provisional].
Say so in the report if a toolchain (docker, pnpm version) is missing; do not
claim it passed.
Report the frontend and backend coverage numbers; the plan targets the same
coverage discipline as the source project: minimum 80 % per workspace.

## Reviewer routing

| Changed files | Reviewer subagent |
| --- | --- |
| `apps/api/**`, `packages/**` (server side) | `backend-reviewer` |
| `apps/web/**`, i18n, UI components | `frontend-reviewer` |
| `db/`, migrations, `*.sql`, Drizzle schema | `backend-reviewer` + `security` |
| crypto (lot 6), OIDC (lot 4), rights (lot 5), module contract API | `security` |
| `.github/**`, hooks, CI, Docker base image, dependency changes (root manifests, lockfile) | `security` (their merge is still a Merging-exception case for the user) |
| docs, guides, `*.md` only | none (docs sync only) |

Every task that changes a routed file also runs, after the reviewers, the
`build`, `linter` and `test` subagents. If one of them edits code or tests,
run the routed reviewers on that edit before you push.

Severity scale used by the loop: CRITICAL and MAJOR block; MINOR and NIT do
not.

## Docs sync

There is no openspec tree here; the serialisation points are the docs and the
changelog instead. Behaviour or API changes must update, through the
`docs-sync` subagent, never by hand:

- the relevant module doc or guide under `docs/` [provisional], fr and en;
- a Conventional Commit type that matches the change (`fix` → patch,
  `feat` → minor, `!` or `BREAKING CHANGE:` → major, or minor while the
  version is below 1.0.0): release-please builds the version and
  CHANGELOG from it;
- `local/Plan socle v0.md` checkboxes only when a lot's done-criteria are
  met, and say so in the report — the plan files stay in French, and stay in
  `local/` (read them in the primary checkout).

Open decisions from the plan (see "Décisions ouvertes"): work that lands
before a decision is taken implements the option its code needs with the
least commitment, and lists the open question in its report. Never decide an
open plan question (key loss handling, master key location, note ownership on
manager change, N+2 access) inside a PR.

Shared floors: do not edit coverage thresholds or the done-criteria list; a
PR that raises a floor does it alone, on final numbers measured after rebase.

## Automated PR reviewer

- Bot login: `sourcery-ai[bot]` (appears as `sourcery-ai` in some APIs) —
  confirmed on PR #1 (2026-11-21): the app is installed on the repo and
  posts even without a payable review budget.
- It reviews every new PR within a few minutes; it rarely re-reviews a
  force-push.
- Review comments: `gh api --paginate repos/<owner>/bosco/pulls/<N>/comments`
  (and `.../reviews`). Always pass `--paginate`; the default page holds 30.
- Reply: `gh api repos/<owner>/bosco/pulls/<N>/comments/<id>/replies -f body=...`
- Weekly diff budget may run out: on the free plan it is 250,000 diff
  characters per 7 days (exhausted on 2026-11-21, PR #1). A notice-only post
  is not a review, report it as such; your caller decides whether to wait.
  To re-request after the wait, comment `@sourcery-ai review` on the PR.

## Merging

- Standing caller instruction (2026-11-21), overriding `loop.md`, After the
  push, step 6 ("merge only when your caller asks"): once every step-6
  criterion holds — every check on the head finished, each conclusion
  SUCCESS, SKIPPED or NEUTRAL, no unanswered review thread, the branch
  contains `origin/<base>`, `mergeStateStatus` not DIRTY or BLOCKED —
  merge without asking again, and say so in the report.
- The merge command always runs on its own, never chained after a wait
  script; fetch again right before it.
- Auto-merge exceptions (2026-11-21). Do NOT merge, and report to the user,
  waiting for their explicit answer, when any of these holds:
  - a security finding stays open — anything real from the `security`
    subagent, or a bot/other review comment that is a security case. One
    you disproved with evidence (file:line, passing test) is not a real
    one: cite the evidence in the reply and carry on;
  - an architecture or design finding stays open — a change that moves a
    module boundary, the core contract API, the rights model, or the
    encryption design;
  - any reviewer (subagent or bot) states a human review is needed
    (same trigger as `loop.md`, After the push, step 3);
  - the PR settles an open decision of `local/Plan socle v0.md` (key loss,
    master key, note ownership on manager change, N+2 access): do not even
    implement the choice — pick nothing, report the options (see Docs sync,
    Open decisions);
  - a migration destroys or rewrites data: `DROP`, `ALTER` with possible
    loss, restructuring of the `core` schema or the manager-attachment
    history. A green gate does not prove an existing install's data
    survives; report the before/after shape and wait;
  - the PR touches the guardians: `.github/` workflows, hooks,
    `.vibe/factory/` or `.vibe/rules/`, the root manifests (runtime
    dependency changes), or the Docker base image. No verdict can
    make such a PR mergeable — the agent whose channel it edits would
    review itself. Always report and wait;
  - the change breaks existing installations: a new, removed or renamed
    `.env` variable, a migration required at upgrade, a breaking (`!`)
    commit. Report the upgrade path for every install and wait.
  In those cases the merge decision belongs to the user: report the
  finding, the candidates and the evidence, and merge only when they say
  so.
- **Guardians PRs shall NEVER be auto-merged**, even if all CI checks are green and reviewers pass. Always report and wait for an explicit user decision before merging any PR that touches guardians.
- Merge method: always `gh pr merge --rebase`, never `--merge` or
  `--squash`. The `main` ruleset requires a linear history, which rejects
  merge commits; rebasing also keeps every commit of the PR (user
  decision, 2026-11-25).

## Behaviour baseline

No validator corpus here; the equivalent baseline is the OpenAPI contract and
the data shape:

- Corpus: the test suite itself is not a baseline. The baseline is
  (1) the generated `openapi.json` for the API, sorted, one line per element;
  (2) the Drizzle migration list and the SQL schema dump (`pg_dump --schema-only`)
    against a database built by replaying all migrations from empty;
  (3) for later lots, the exported GDPR JSON for the demo person.
- Output to compare: one line per element, in definition order, with a set key
  of `path + method` (OpenAPI) or `table.column + constraint` (schema).
- Harness: a throwaway script in the scratchpad that checks out the ref,
  builds the app, replays migrations, dumps both outputs, and prints sorted
  lines. Build it once per ref. Never commit it.
- Secondary metric: workspace test pass rates printed by `pnpm test --
  --reporter=verbose` per workspace.
