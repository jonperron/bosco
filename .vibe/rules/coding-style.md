description: "Use when writing TypeScript code (NestJS backend or React frontend). Covers naming conventions, error handling, and TypeScript-specific guidelines."
paths: "**/*.ts, **/*.tsx"
---
# Coding style

- Prefer block indent over visual indent
- In comma-separated lists of any kind, use a trailing comma when followed
  by a newline
- Separate items and statements by either zero or one blank lines
- Do not include trailing whitespace on the end of any line, including
  blank lines, comment lines, code lines, and string literals

## Indentation and line width

- Use spaces, not tabs.
- 2 spaces per indentation level (all indentation, outside of string
  literals and comments).
- The maximum width for a line is 100 characters.

# Code organization

- Many small files over few large files; high cohesion, low coupling
- 200-400 lines typical, 600 max per file
- No circular imports between workspaces; shared types go to a shared
  package, never `apps/api ↔ apps/web` directly
- NestJS: one module per feature folder; services carry the logic,
  controllers only translate HTTP

# Code style

- No emojis in code, comments, or documentation
- Immutability always — never mutate objects or arrays that cross a
  boundary
- Proper error handling: no empty `catch`, never swallow errors
- Use descriptive variable and function names that convey purpose and
  intent; avoid abbreviations unless they are widely known and unambiguous
- Naming: `camelCase` for variables and functions, `PascalCase` for types,
  classes and React components, `UPPER_SNAKE_CASE` for constants
- No `any` in new code, no `as any`; prefer `unknown` plus narrowing
- No non-null `!` assertions outside tests
- French and English user-visible strings always go through i18n resources

# Backend-specific guidelines

- Request DTOs are validated classes; never map a request body straight to
  an entity (mass assignment)
- Every route enforces rights server-side (lot 5), even when the UI also
  hides the action
- Transactions for multi-write flows; Drizzle query builder only — no
  hand-built SQL strings
- Errors propagate with context (Nest exceptions with meaningful statuses);
  no generic `Internal server error` for expected cases

# Frontend-specific guidelines

- Every API call uses the generated typed client; a hand-written fetch to
  it is a bug
- Loading, error and empty states handled for server data
- Real buttons and links for actions, keyboard reachable, labelled
