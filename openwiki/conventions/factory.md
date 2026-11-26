---
type: convention
title: "Conventions: factory loop, worktrees and merging"
description: Summary of how changes are made in Bosco by humans and agents, with links to the authoritative files for subagents, the quality loop, worktrees, commit messages, reviewer routing and merge rules.
tags: [conventions, workflow, agents, git, review]
verified:
  - by: openwiki/0.4.3
    at: 2026-11-26T19:08:05.094Z
sources:
  - id: openwiki-source-dec1f45c1688b7bbf05c2ef6
    resource: repo://.vibe/factory/loop.md
  - id: openwiki-source-2a434185cb848d848729822b
    resource: repo://.vibe/factory/project.md
  - id: openwiki-source-9f5904d84f31f0d95d244347
    resource: repo://.vibe/rules/commit-messages.md
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
generated: { by: "claude-code", at: "2026-11-26T18:56:03.534Z" }
---

# Conventions: factory loop, worktrees and merging

This page is a map, not the rulebook. The authoritative texts are:

| File | Covers |
| --- | --- |
| `AGENTS.md` | Project overview, principles, subagents to run per task |
| `.vibe/factory/loop.md` | The shared quality loop, the after-push phase, reports |
| `.vibe/factory/project.md` | Repo profile: gate, worktree setup, routing, bot reviewer, merging, baseline |
| `.vibe/rules/coding-style.md`, `testing.md`, `commit-messages.md` | Code, test and commit rules |
| `.vibe/agents/*.toml` | Definitions of the reviewer and factory subagents |
| `CONTRIBUTING.md` / `CONTRIBUTING.fr.md` | The same essentials for human contributors |

When a rule here and one of those files disagree, the file wins.

## Subagents per task

`AGENTS.md` asks every task to run, in order: the routed reviewer
(`backend-reviewer` for backend files, `frontend-reviewer` for frontend
files), then `build`, `linter` and `test` once the reviewer has no CRITICAL
or MAJOR finding. Crypto, OIDC, rights or dependency changes add
`security`; behaviour or API changes end with `docs-sync`. For multi-issue
work, factory agents (`issue-driver`, `pr-consolidator`, `pr-rebaser`,
`bot-review-responder`, `behaviour-differ`) take over. The reviewer routing
table in `project.md` maps changed paths to reviewers; docs-only changes need
none.

## The quality loop (summary)

From `loop.md`: change, run the gate, run the routed reviewers, fix
CRITICAL/MAJOR findings (or disprove them with evidence), and repeat, at
most five rounds. Bug fixes and behaviour changes start with a test seen
failing on the old code. After the push: watch every CI check to the end,
handle the automated reviewer in exactly one round, and stop to ask on
CRITICAL findings, requests for a human, or anything that would break the
contract or the project rules. The gate commands are on
[Development workflow](../workflows/development.md).

## Worktrees and branches

- Every writer works in its own git worktree on its own branch; nobody
  edits the primary checkout, `main`, or another agent's worktree.
- `main` only moves through merged pull requests: never commit on it or
  merge into it locally.
- Fetch `origin` before using any `origin/...` ref, and again before a
  push. Rewritten branches are pushed with `--force-with-lease`, never
  plain `--force`.
- One owner per PR; branch names follow the worktree name.
- Each worktree needs its own `pnpm install`.

## Commits and PRs

- Conventional Commits in English: `type(scope): summary`, lowercase,
  imperative, at most 72 characters; types `feat`, `fix`, `chore`,
  `refactor`, `test`, `docs`. The type drives release-please versioning.
- One commit per logical change, each one building; one PR per step
  (component or feature slice), stacked when steps depend on each other.
- A new dependency states its licence; GPL, AGPL and SSPL are refused.
- Test fixtures stay anonymous.

## Automated review

Sourcery (`sourcery-ai[bot]`) reviews each new PR within minutes. Every
comment is verified against the code, real findings are fixed in one pass,
and each comment gets a reply (`project.md`, Automated PR reviewer).

## Merging

- Merge only when every check on the head finished with SUCCESS, SKIPPED or
  NEUTRAL, no review thread is unanswered, the branch contains
  `origin/main` (fetched right before), and `mergeStateStatus` is neither
  `DIRTY` nor `BLOCKED`. The merge runs as its own command,
  never chained after a wait script.
- Method: always `gh pr merge --rebase` (the `main` ruleset requires a
  linear history).
- Never auto-merged, always left to the user: PRs touching the "guardians"
  (`.github/` workflows, hooks, `.vibe/factory/`, `.vibe/rules/`, root
  manifests with runtime dependency changes, Docker base image), open security or architecture findings,
  destructive migrations, changes that break existing installs, or PRs
  that would settle an open planning decision.

## Behaviour baseline

To prove what a change did, the factory compares the sorted OpenAPI
contract (and, once a database exists, the replayed schema) between two
refs, with the read-only `behaviour-differ` agent. See
[OpenAPI contract flow](../architecture/openapi-contract.md).
