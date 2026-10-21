# Phase templates

Fill-in shapes for the `refactor` phases. Copy a shape into the evidence folder (`.litgravity/evidence/<slug>/`), fill it from observed facts and leave no placeholder behind. The brackets below mark what to replace.

## Operating modes

Pick the mode after the transformation is classified. The mode sets how much proof each step needs.

| Mode | Trigger | Required behavior |
| --- | --- | --- |
| Local mechanical | one symbol or one file, complete references known | baseline, preview, apply, narrow check, scenario |
| Cross-file mechanical | rename, signature change, import move, repetitive structural edit | build the consumer map, batch by ownership, verify every batch |
| Structural | extraction, module split, dependency inversion, state-machine reshaping | freeze behavior, plan seams, migrate incrementally |
| Public migration | exported API, persisted schema, config, protocol, CLI or package surface | inventory consumers, define compatibility and rollback, obtain explicit user authority |
| Cleanup request | vague simplify, modernize or clean up | identify concrete smells and recommend a bounded target before editing |
| Capability degraded | a requested semantic tool is unavailable | use the documented fallback and disclose its weaker proof |

## Intent-gate question

Used in Phase 1 through `ask_question` (one question, two or three options, a recommendation first):

```text
I want to make sure I understand the refactoring goal correctly.

What I understood: [interpretation]
What is unclear: [specific ambiguity]

Options:
1. [Option A] - [implications]
2. [Option B] - [implications]

Recommendation: [suggestion with reasoning]. Proceed with it?
```

Headless default: the narrower scope and the more conservative option, logged as a `decision` ledger line with the sentence "nobody could answer; took the recommended default".

## Coverage question

Used in Phase 4 when coverage is LOW or NONE:

```text
Test coverage for [TARGET] is [LEVEL].
Refactoring without adequate tests risks silent behavior change.

Options:
1. Add characterization tests first, then refactor (recommended)
2. Proceed with extra caution; manual verification required
3. Abort the refactoring
```

## Phase 2 inspection checklist

For the target and its neighbors, collect:

- declaration and ownership;
- exports and public entry points;
- direct callers and callback registration;
- dynamic loading, reflection, dependency injection, registries and plugin manifests;
- serialization, database, wire, CLI, environment and configuration names;
- tests, examples, documentation, templates and generated inputs;
- package, build, lint, formatter and release inclusion rules.

Write the false-positive match categories next to the search commands: strings, comments, fixtures, snapshot files and unrelated symbols with the same spelling.

## Codemap

````text
CODEMAP: [TARGET]

### Core files (direct impact)
- `path/to/file:L10-L50` - primary definition
- `path/to/other:L25` - key usage

### Dependency graph
[TARGET]
|- imports from:
|    |- module-a (types)
|    `- module-b (utils)
|- imported by:
|    |- consumer-1
|    `- consumer-2
`- used by:
     |- handler (direct call)
     `- service (dependency injection)

### Impact zones
| Zone | Risk level | Files affected | Test coverage |
| --- | --- | --- | --- |
| Core | HIGH | [n] files | [pct] covered |
| Consumers | MEDIUM | [n] files | [pct] covered |
| Edge | LOW | [n] files | [pct] covered |

### Established patterns
- Pattern A: [description] - used in [n] places
- Pattern B: [description] - established convention

### Public contract
- exported names and signatures, file paths other tools read, CLI flags, serialized formats, package exports

### Constraints
- Must follow: [patterns]
- Must keep intact: [dependencies and public contract]
- Safe to change: [isolated zones]
- Requires migration: [places a breaking change would touch]
````

## Verification plan

````text
VERIFICATION PLAN

### Test commands
- Unit: [npm test | pytest | go test ./... | cargo test]
- Integration: [command, when one exists]
- Type check: [tsc --noEmit | pyright | go vet ./... | cargo check]

### Checkpoints after every step
1. diagnostics: zero new errors against the Phase 2 baseline
2. test command: all pass
3. type check: clean

### Regression indicators
- [specific test that must pass]
- [behavior that must be preserved]
- [API contract that stays unchanged]
````

## Step record

One block per step in `steps.md`:

```text
Step:
Files:
Precondition:
Command or preview:
Observed result:
Behavioral check:
Rollback:
Cleanup:
```

"Observed result" holds what the command printed or returned, summarised with the exit status. A block with a blank field means the step is unverified.

## Plan rows for the executor

When the plan lands in `plans/<slug>.md`, write each step as one column-zero row (`- [ ] N. <title>`) with its files, line ranges, verification command and rollback action in the sub-bullets under it. Pair every implementation row with a verification row only when the repo keeps them apart; one row that carries its own verification is the default.

## Final summary

```markdown
Refactoring complete

### What changed
- [list of changes]

### Files modified
- `path/to/file` - [what changed]

### Verification results
- Tests: [PASSED (X/Y), baseline X/Y]
- Type check: [CLEAN]
- Lint: [CLEAN]
- Build: [SUCCESS]
- Real surface: [scenario and result]
- Dispatch path: [sequential | parallel batches, children per batch, verification lanes]

### Regressions
None observed on the surfaces above. Not covered: [list].
```

The reader-facing reply is shorter than this block: result, material risk and required action. The block itself goes to the evidence folder.
