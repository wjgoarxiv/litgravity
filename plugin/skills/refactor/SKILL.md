---
name: refactor
description: "Restructure code with behavior unchanged: pin it with tests, move in small verified steps, keep public contracts."
---

# refactor

A refactor changes how code is arranged and leaves what it does exactly as it was. The proof is a set of tests that pass before the first move and after the last, plus the real surface behaving identically. When behavior changes on purpose, the work is a feature or a bug fix with its own failing test, its own acceptance criteria and its own diff.

The phase order is authoritative: characterize, gate the intent, analyze the codebase, draw the codemap, assess coverage, plan, execute one verified step at a time, sweep for regressions. A change that looks mechanical still passes every phase, because mechanical moves break import paths, load order and string-keyed registries. Unrelated cleanup, dependency upgrades, formatting churn, public API redesign, git publication and release work each need their own request.

## When this applies

- The user asks to split a large file, extract a function or module, rename across the codebase, flatten nesting, inline a needless abstraction, replace a pattern, move code between packages, simplify control flow, modernize syntax or remove dead code.
- The prompt is `lit refactor …`, `/litgravity:refactor`, or a request that names one of those operations.
- A row in `plans/<slug>.md` is labelled refactor, restructure, extract, simplify or cleanup.
- `lit-burnoff` or `review-work` flagged an oversized module or a needless abstraction and the user approved the fix.

A request that also changes behavior is split in two: refactor first under this skill, then change behavior under `litwork` or `debugging`. A mixed diff makes equivalence unprovable. A vague request ("improve", "clean up") with no named smell or target stops at the Phase 1 gate before any edit.

Arguments, accepted in prose or flag form:

| Argument | Meaning | Default |
| --- | --- | --- |
| `<refactoring-target>` | a path, a symbol ("the AuthService class"), a pattern ("every caller of the deprecated API") or a described outcome ("extract validation into its own module") | required |
| `--scope=<file\|module\|project>` | one file, one module or directory, or the whole codebase | `module` |
| `--strategy=<safe\|aggressive>` | `safe` demands full coverage before each step; `aggressive` allows broader steps only where coverage is adequate | `safe` |

## Inputs and state

- Target (files, symbols or a directory) and the intended end shape in one sentence.
- Slug for evidence: derive it from the target or the active goal. Evidence lives in `.litgravity/evidence/<slug>/`.
- The test runner and gates, found in `AGENTS.md`, package manifest scripts, `Makefile`, `Taskfile`, `go.mod`, `Cargo.toml` or `pyproject.toml`. Detect them from the repository and confirm a runner exists before relying on one.
- Repository authority: `AGENTS.md`, generated-code markers, package `files[]` allowlists, lint and format configs, and `git status --short` so unrelated dirty work stays untouched.
- Optional plan `plans/<slug>.md` (rows `- [ ] N.` flip to `- [x] N.` as steps land), goal `.litgravity/goals/<slug>.json` (attach the equivalence evidence to its criterion) and ledger `.litgravity/ledger/<conversation-id>.jsonl` (`decision` and `evidence` lines).
- Supporting files, read on demand with `read_file` (relative to this SKILL.md): `references/safe-change-playbook.md` (decision packet, dependency map, compatibility strategies, generated artifacts, error, ordering and performance preservation; open it before any multi-file, public-surface, generated-code or persistent-data refactor), `references/phase-templates.md` (fill-in shapes for the gate question, codemap, verification plan, step record and summary), `references/language-and-surface-checks.md` (per-ecosystem checks, documentation refactors, deprecated-API migration), `references/parallel-dispatch.md` (child lanes for file-independent steps) and `references/evidence-and-stops.md` (evidence files, review matrix, abort list, failure patterns).
- Companions: `structural-search` (syntactic call sites), `lsp` (diagnostics, definitions, references), `lit-code` (edit discipline), `lit-commit` (checkpoint commits).

Resolve these before acting, from the repository first and the user for the rest: the exact declaration, module, pattern or dependency boundary being changed; which observable inputs, outputs, errors, timing guarantees, persistence effects and public names stay stable; the scope; whether shims or a staged migration are allowed; the commands and real scenario that prove no regression.

## Tools in agy and what happens without them

- `read_file` and a search (`rg` through `run_command`, or `grep_search` / `list_dir` / `find_by_name` when the host offers them) build the codemap. Tool names differ between agy builds, so use whatever the tool list offers.
- `write_file` writes evidence files and characterization tests; the host's edit tool (`replace_file_content` or `multi_replace_file_content` on older builds) applies each step. There is no patch tool, so a multi-hunk change is a short series of bounded edits.
- `run_command` runs the gates, the checker CLIs, `git diff` and `git restore`. In a headless `agy -p` run a refused command ends the run with no output, so read first with `read_file`, ask for the permissions each phase needs up front, and treat a refusal as BLOCKED.
- agy has no language-server tool. Each semantic question maps to a checker CLI run through `run_command`:

| Question | Command |
| --- | --- |
| type errors, TypeScript | `tsc --noEmit` (add `-p <tsconfig>`) |
| Python types and lint | `pyright --outputjson`, `ruff check`, `mypy` |
| Go | `go vet ./...`, `gopls check <files>`, `go build ./...` |
| Rust | `cargo check --message-format=json` |
| references to a symbol | `rg -nw '<symbol>'` filtered by the impact map, or `structural-search` for syntactic matches |
| rename | the compiler-assisted tool for the language (`gopls rename`, a `ts-morph` script, `rope`) when present, else a structural rewrite with a dry run, else a reviewed series of edits |

  Record which tool produced which claim. A text search establishes candidates and leaves semantic completeness open.
- `ask_question` carries the intent-gate and low-coverage questions. Unanswerable headless: take the safest default (narrower scope, characterization tests first), log a `decision` ledger line and continue, or stop with BLOCKED when no safe default exists.
- `invoke_subagent` with `TypeName` set: read-only `lit-planner` (codemap and plan), `librarian-researcher` (official docs for a deprecated API), `quality-reviewer` (failure strategy), `lit-verifier` (PASS or FAIL on a finished step); `lit-executor` writes and takes edit lanes. An untyped child holds every tool, so every spawn names its type. Child reports are leads; replay the decisive commands yourself. Without the agents installed, map in the main conversation and say so once.
- No todo tool is known: keep the phase and step lists in `.litgravity/evidence/<slug>/steps.md` or the plan rows.
- Revert with `git restore -- <your files>` after confirming those files carry no unrelated user edits. Stash, reset and clean of the repository are outside this skill.

## Procedure

Seed the phase list right after the request is understood, then keep it current: 0 characterize, 1 intent gate, 2 codebase analysis, 3 codemap, 4 coverage and verification plan, 5 plan, 6 execute with per-step verification, 7 final regression sweep.

### Classify the transformation

Name the kind first. Each kind carries a primary risk and an inventory to complete before editing.

| Transformation | Primary risk | Required inventory |
| --- | --- | --- |
| rename | hidden string or external name | declaration, references, serialization, config, docs |
| extract function or type | changed ownership or evaluation order | inputs, outputs, effects, error and cancellation path |
| move module or file | import and runtime-loading changes | import graph, package exports, build and bundle rules |
| change signature | missed callers and default drift | direct and dynamic consumers, adapters, public declarations |
| split module | cycles and initialization order | dependency direction, side effects, public entry points |
| replace dependency | semantic and operational mismatch | used behavior, configuration, failure modes, resource model |
| remove dead code | reachability through loaders or config | loaders, registries, reflection, templates, generated references |
| simplify control flow | changed precedence or short-circuiting | branch table, side effects, error outcomes |
| data or schema migration | compatibility and rollback | readers, writers, stored versions, deploy order, recovery |

Then pick the operating mode (local mechanical, cross-file mechanical, structural, public migration, cleanup request, capability degraded). The mode table with triggers and required behavior is in `references/phase-templates.md`; a public migration always needs explicit user authority, and a degraded capability is disclosed with its weaker proof.

### Phase 0: characterize (mandatory)

A characterization test pins current behavior before any change. It asserts the contract and ignores incidental formatting and internal call order.

1. Run the full suite and save the output to `.litgravity/evidence/<slug>/00-baseline.log` with the exit status. A red baseline stops the refactor: report the pre-existing failures first and later show the refactor added none. Unrelated baseline repairs need their own authorization.
2. Measure coverage of the target when the runner supports it. For each public function, class, export, CLI flag or HTTP route in the target, confirm at least one test exercises it.
3. Write characterization tests for uncovered behavior: call the code with representative inputs (odd ones included) and assert today's outputs, even where they look wrong. Prove each new test can fail by breaking the named behavior briefly, then restore it. Save the run to `01-characterized.log`.
4. When a characterization test shows current behavior is broken, stop and ask whether the task became a bug fix. Fixing while refactoring mixes the two proofs.
5. State the contract before editing: the behavior that stays unchanged, the output or manifest shape captured, and the smallest cohesive unit to move, split, rename or simplify.

Pin the contract at the outward boundary: exit code and message of a CLI command, status and body shape of a route, JSON a hook emits, manifest exports, settings an installer preserves, install and safety guidance a document keeps.

### Phase 1: intent gate

Classify the request before any exploration. A specific file or symbol, or a clear "refactor X to Y", goes straight to codebase analysis. "Improve" or "clean up" is open-ended: ask which improvement. Ambiguous scope asks which modules or files. Missing context asks for the desired outcome.

Confirm four facts before moving on: the target is identified, the desired outcome is understood, the scope is defined and success criteria can be stated. When one is open, ask one precise question with `ask_question`, offering two or three options and a recommendation (shape in `references/phase-templates.md`). Facts the repository can supply are read, and the user is asked for the rest.

### Phase 2: codebase analysis

Search narrows and semantic tools confirm. Gather these in parallel when the questions are independent: every occurrence and definition of the target; everything that imports, uses or depends on it; similar patterns elsewhere that set conventions; every related test; the architectural layers and module boundaries around it.

Start with exact paths and symbols:

```sh
rg -n --hidden --glob '!node_modules' --glob '!dist' --glob '!target' '<symbol-or-key>' .
rg -n 'exports|bin|files|types|main|module' package.json 2>/dev/null
rg --files | rg '(^|/)(AGENTS\.md|README|CHANGELOG|Cargo\.toml|go\.mod|pyproject\.toml|tsconfig)'
```

Adapt the exclusions to the repository; the inspection checklist (ownership, entry points, dynamic loading, serialized names, docs, packaging rules) is in `references/phase-templates.md`. Record the false-positive match categories (strings, comments, fixtures, same-spelled symbols) before any mechanical edit.

When the impact zone is "every call site of X" or "every import of this shape", load `structural-search`: it matches syntax and says plainly when no engine is installed. Definitions, references and diagnostics come from the checker CLIs in the table above, with `lsp` for the diagnostics workflow.

Capture baseline diagnostics now with the repo's checker so a later "no new errors" claim compares against a stored number.

### Phase 3: codemap

Write the codemap to `.litgravity/evidence/<slug>/codemap.md` from Phase 2 evidence (template in `references/phase-templates.md`). The dependency graph carries direction, with package exports, generated inputs, configuration, persistence, docs and tests beside the node they constrain; cycles and import-time side effects are marked.

List the public contract (exported names and signatures, file paths other tools read, CLI flags, serialized formats, package `exports`). It stays byte-compatible unless the user approved a break. Derive four constraint sets: must follow, must keep intact, safe to change, needs migration. Rate each impact zone LOW, MEDIUM or HIGH and order steps from LOW to HIGH. A risky move answers five questions (invariant owner, layer direction, remaining public surface, initialization order, error and cancellation path across the new seam), listed in the playbook.

### Phase 4: coverage and verification plan

| Coverage | Strategy |
| --- | --- |
| HIGH (above 80%) | run the existing tests after each step |
| MEDIUM (50 to 80%) | run the tests and add safety assertions around the seams you touch |
| LOW (below 50%) | pause and propose characterization tests first |
| NONE | block aggressive refactoring until characterization tests exist or the user accepts the risk in writing |

LOW or NONE coverage goes to the user with three options: add tests first (recommended), proceed with manual verification, or abort. Headless runs take the first when `run_command` and `write_file` are allowed and stop with BLOCKED otherwise.

Write the verification plan (commands, per-step checkpoints, regression indicators) into the codemap or `verification-plan.md`. Evidence is layered (parse or build, static semantics, focused behavior, integration, user surface, diff audit) and no layer stands in for a later one; the table is in `references/evidence-and-stops.md`. A compiler-checked rename can be complete for one symbol and still say nothing about reflection, configuration strings, serialized names, templates or runtime loading.

### Phase 5: plan

Write the plan before editing: have `lit-planner` draft it from the codemap and verification plan inlined, or write it yourself for a small target. The plan:

1. breaks the work into atomic steps, each independently verifiable;
2. orders steps by dependency;
3. names exact files and line ranges per step;
4. gives every step a rollback action;
5. defines commit checkpoints;
6. states the compatibility strategy and the removal criterion for any shim.

Fill the decision packet from `references/safe-change-playbook.md` (target, structural outcome, observable behavior preserved, non-goals, consumers, baseline commands, real scenario, migration order, rollback). A packet that cannot be written from repository evidence means the refactor is not ready.

Good slices are reversible and independently checkable: add the new internal seam with old behavior, migrate one ownership region, verify, migrate the remaining consumers, switch the public boundary, remove temporary compatibility, run the full gates and the scenario. A shim carries a warning, an owner, a removal criterion and a deadline. Before executing, check that every identified file is addressed and each step has a rollback and a test command.

### Phase 6: execute, verify, revert on red

Run the same protocol for every step.

**Pre-step.** Mark the step in progress. Read the current file state with `read_file`. Confirm diagnostics equal the Phase 2 baseline and `git status --short` shows no overlapping unowned changes.

**Editing method**, in order of preference: a compiler-supported migration or semantic rename with reviewable edits; a syntax-aware transformation with dry-run output (`structural-search`: preview, review, apply); a small explicit edit; a bounded text replacement followed by a semantic read of the diff. Spelling alone never justifies a replacement: rename what the impact map says is the same symbol and leave strings, generated output, fixtures and same-spelled unrelated symbols alone. Claim a semantic operation only when a command in this conversation ran it and its output is saved.

**One coherent step.** One mechanical change per step (extract, move, rename, inline), behavior preserved, opportunistic cleanup deferred; rename, extraction, docs update and formatting each get their own diff. Follow the project's module style (explicit import extensions where the repo requires them), update comments the move made stale, remove imports the refactor made unused, and leave pre-existing dead code for a cleanup request. A moved public symbol keeps a re-export at the old path until the user asks for removal and every caller has migrated.

**Post-step verification (mandatory).**

1. Parse, format-check, compile or typecheck the touched region and compare diagnostics with the baseline.
2. Run the narrowest behavioral test, then the affected tests.
3. Inspect `git diff -- <paths>`.
4. Search for stale declarations, imports and compatibility markers.
5. Compare failures with the captured baseline.

Record one block per step in `steps.md` (template in `references/phase-templates.md`). Verification passes: tick the row and continue. Verification fails: stop and fix before anything else.

**Failure recovery.** On any failed verification:

1. stop and hold the next slice;
2. preserve the failing command and its output;
3. revert your own slice (`git restore`, as above);
4. identify the earliest slice that introduced the failure;
5. choose: retry smaller, skip the step if optional, ask `quality-reviewer` (read-only, failure inlined) for a fix strategy, or ask the user;
6. rerun the baseline and the failing scenario before resuming, and update the plan.

Three consecutive failures on the same step end the run: stop and report with the evidence.

**Commit checkpoints.** After each coherent group, offer a checkpoint commit through `lit-commit` when the user wants commits; otherwise leave the working tree and say so. Subject shape: `refactor(scope): description`, adapted to the repo's own message style.

### Phase 7: final regression sweep

1. Run the full suite and save it to `02-after.log`. Test counts match or exceed the baseline with zero new failures.
2. Run the full type check, the linter and the build when the project has them.
3. Re-run diagnostics on every changed file and compare with the baseline.
4. For a published package, compare the pack listing before and after (`npm pack --dry-run --json`, read `[0].files`).
5. Exercise the real surface once (the CLI command, the page, a downstream import, the built artifact) and save it to `03-surface.log`.
6. Run the adversarial pass (old public names, failure paths, packaged form, exit codes and ordering, whitespace-blind diff, regenerated artifacts, cleanup); the checklist is in `references/evidence-and-stops.md`.
7. Summarize in the shape from `references/phase-templates.md`.

## Safe split

Split by responsibility, and name each new file for what it holds (parsing, state reads, state writes, command dispatch, hook context, policy text). After each move: circular imports checked, module top-level side effects in their old load order, default and named exports both kept, tests moved with their code or importing from the public path, `files[]` allowlists, manifests, doc links and hook script paths updated in the same slice, renamed public CLI commands given a compatibility alias. The expanded checklist and per-language checks live in `references/language-and-surface-checks.md`; parallel lanes for file-independent steps live in `references/parallel-dispatch.md`.

## Evidence

`.litgravity/evidence/<slug>/` holds `00-baseline.log`, `01-characterized.log`, `codemap.md`, `verification-plan.md`, `steps.md`, `02-after.log`, `03-surface.log` and the two diagnostics files; `references/evidence-and-stops.md` describes each and carries the final review matrix. Append ledger lines with `kind:"evidence"` per file and `kind:"decision"` for any approved contract change. When baseline gates are already red, isolate the pre-existing failure and show the refactor added no new one.

The completion claim states the preserved invariant, files changed, baseline and post-change evidence, real-surface probes, known risks and cleanup, and that no behavior change was intended. A skipped gate is named with its risk.

## Stop and report

Reader-facing reply: result, material risk, required action. Commands, counts and cleanup receipts stay in the evidence files unless requested.

- **Result:** PASS (equivalence shown), FAIL (a step could not be made green) or BLOCKED (red baseline, tests that cannot be written, a contract break needed, a structural engine missing for a required structural step).
- **Material risk:** dynamic lookups, external consumers or persisted formats the tests cannot see, and anything outside the evidence boundary. "Unchanged" covers the surfaces actually observed, and a partial migration is reported as partial.
- **Required action:** shim removal, approved contract changes, follow-up behavior changes.

Abort and consult the user when coverage is NONE and characterization tests were declined, a public contract would break, the scope is unclear after one question, three consecutive failures hit one step, a user constraint would be violated, the tree has overlapping unowned changes, rollback would need destructive git, or the change crosses into a release, publish, tag or another repository. The full list with the response for each is in `references/evidence-and-stops.md`. A recorded blocked result names the exact boundary; stopping preserves behavior until a new plan or approval exists.

## Pitfalls

- Editing a symbol before mapping its call sites, or proceeding on red tests.
- Silencing a type or lint error (`as any`, `@ts-ignore`, `# type: ignore`, `#[allow]`, `//nolint`) to pass a step.
- Weakening a test, or rewriting a characterization test to match new output, which turns a regression into a pass.
- Large single-step moves, and a whole-repository format that buries the semantic diff.
- Trusting a tool preview unreviewed, or compiler success over runtime behavior.
- Forgetting non-code consumers: doc links to file paths, package `files[]`, manifest entries, hook script paths, payload files that look unused.
- Treating child reports as proof, or giving a child every write tool.

`references/evidence-and-stops.md` lists the rest.
