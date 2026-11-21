description: "Use when writing tests, implementing new features, or fixing bugs. Covers TDD workflow, coverage targets, and test types."
paths: "**/*.ts, **/*.tsx"
---
# Testing

- TDD: Write tests first, and run them on the old code to watch them fail
- 80% minimum coverage per workspace
- Every new rule from the plan needs at least: one passing case, one
  failing case

## TDD Workflow
1. Write a failing test (Red)
2. Implement the minimum code to pass (Green)
3. Refactor for clarity and maintainability (Refactor)

## Test types
- Unit tests: isolate individual functions or modules
- Integration tests: real routes against a real compose Postgres — for
  anything touching DB, rights, crypto or modules, a mocked database does
  not count
- Rights matrix: parameterised rows over role × attachment, so a flip is
  named in the report, not silent
