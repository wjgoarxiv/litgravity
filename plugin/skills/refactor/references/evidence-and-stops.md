# Evidence, review matrix and stop rules

Companion to the `refactor` skill: what the evidence folder holds, the questions the final review answers, the layers of proof, the adversarial pass, the abort list and the failure patterns seen in practice.

## Evidence files

`.litgravity/evidence/<slug>/` holds:

| File | Content |
| --- | --- |
| `00-baseline.log` | full suite before any change, with exit status and known pre-existing failures |
| `01-characterized.log` | suite after characterization tests were added |
| `codemap.md` | the Phase 3 codemap with the decision packet, public contract and constraints |
| `verification-plan.md` | commands, checkpoints and regression indicators (may live in the codemap) |
| `steps.md` | one block per step, in the step-record shape from `references/phase-templates.md` |
| `02-after.log` | full suite after the last step |
| `03-surface.log` | the real-surface scenario |
| `diagnostics-before.txt` and `diagnostics-after.txt` | checker CLI output captured at Phase 2 and Phase 7 |

Append ledger lines (`.litgravity/ledger/<conversation-id>.jsonl`) with `kind:"evidence"` per file and `kind:"decision"` for any contract change the user approved. A baseline that is already red gets isolated: list the pre-existing failures, then show the refactor added no new one. A temporary characterization test stays in the repository only when it protects future behavior, and the report says which tests stay.

## Layers of proof

No layer stands in for a later one.

| Layer | Example | What it proves |
| --- | --- | --- |
| Parse or build | compiler or parser | edited artifacts are structurally accepted |
| Static semantics | typecheck, checker CLI | checked relationships satisfy that tool |
| Focused behavior | targeted test or direct invocation | the named contract still behaves as expected |
| Integration | real adapter, database, service or process boundary | the connected ownership path works |
| User surface | CLI, HTTP, browser, TUI, package or hook scenario | the externally visible outcome remains |
| Diff audit | scoped diff, forbidden-token and generated-file checks | the transformation stayed inside the declared boundary |

A compiler-checked rename can be complete for one symbol and still say nothing about reflection, configuration strings, serialized names, templates, external consumers or runtime loading.

## Adversarial pass (Phase 7, step 6)

- Search for the old public name and every transformed spelling (camelCase, snake_case, kebab-case, upper-case constants).
- Run an invalid-input and failure-path scenario and compare with the baseline.
- Exercise runtime loading from the packaged or built form.
- Compare exit codes, response shape, side effects and ordering.
- Read the diff with whitespace ignored first, then normally.
- Regenerate generated artifacts from their source and confirm a clean follow-up run.
- Confirm cleanup: no residual process, port, temp directory or compatibility file.

## Review matrix

| Question | Evidence |
| --- | --- |
| Did all intended consumers migrate? | semantic result when available plus scoped searches |
| Did public names remain compatible? | package, API, CLI and config inspection plus a scenario |
| Did runtime loading still work? | run the built or packaged artifact |
| Did errors remain stable? | failure-path scenario (type or code, cause chain, exit or HTTP status, retryability) |
| Did ordering and side effects remain? | event or state sequence before and after for high-risk paths |
| Did concurrency ownership remain safe? | race or schedule tool and a cancellation scenario |
| Were generated files handled correctly? | generator command and a clean follow-up run |
| Can the step be reversed? | an explicit owned rollback without a destructive repository reset |
| Is temporary state gone? | process, port, temp, config and diff receipt |

The completion claim states the preserved invariant, files changed, baseline evidence, post-change evidence, real-surface probes, known risks and cleanup. It says that no behavior change was intended. When a gate was skipped, it names why and what risk that leaves.

## Abort and consult the user

Stop and ask when any of these holds. Each line pairs the trigger with the response.

- Coverage is NONE and the user declined characterization tests: report BLOCKED with the untested surfaces listed.
- A change would break a public API or contract: present the break and the versioned-boundary option.
- The scope is unclear after one clarifying question: stop with the two readings and a recommendation.
- Three consecutive verification failures hit one step, or a step breaks a test that two attempts cannot explain: revert the step and report.
- A user-defined constraint would be violated: name the constraint and the step.
- The working tree has overlapping unowned changes: list the paths and wait.
- A generated file has no authoritative regeneration path: report the file and ask for the generator.
- The migration would silently break an external or persisted contract: stop before the step.
- The only verification surface is unavailable and no meaningful fallback exists: report BLOCKED with the missing surface.
- Required credentials, services, hardware or fixtures are absent: list them.
- Rollback would need destructive git or data mutation that the user did not authorize: stop before the step.
- The change crosses into another repository, a release, a publish, a tag or a deployment: stop and hand back.
- Tests reveal that current behavior is not understood, the refactor needs a feature change to pass, the diff touches more surfaces than planned, or package output changes unexpectedly: stop and explain.

A recorded blocked result names the exact boundary. Stopping preserves behavior until a new plan or approval exists.

## Failure patterns seen in practice

- Skipping characterization because the change looks mechanical. Mechanical moves break import paths, load order and string-keyed registries.
- Vague "clean up everything" work with no bounded outcome.
- Large single-step moves that leave no way to say which edit broke the build.
- Trusting a tool preview unreviewed, or compiler success over runtime behavior.
- Adding an abstraction before two real consumers or one explicit boundary exist.
- Moving code while also changing error behavior, defaults, ordering or side effects.
- Deleting compatibility before every in-scope consumer migrated.
- Tests that assert internal call order offered as proof of preserved behavior.
- Typecheck, compilation, line count or a green unit suite treated as complete evidence.
- Formatting the whole repository and burying the semantic diff.
- Non-code consumers forgotten: docs that link to file paths, package `files[]`, manifest entries, hooks that reference script locations, installed payload files that look unused.
- Shipped docs or tests deleted as unused.
- Another contributor's files edited, unrelated dirty state reverted, or a commit made without authority.
- A small fix bundled into the refactor diff.
- Child reports treated as proof, or a child run with every write tool.
- Suppressing a type or lint error (`as any`, `@ts-ignore`, `# type: ignore`, `#[allow]`, `//nolint`) to make a step pass.
- Weakening a test, or updating a characterization test to match new output, which converts a regression into a pass.
- Committing broken code, or hiding a behavior change inside a refactor commit.
- Plugin keys, install paths, public command names or package exports changed quietly.

## Reader-facing report

Result, material risk and required action. The result is PASS (equivalence shown), FAIL (a step could not be made green) or BLOCKED (red baseline, tests that cannot be written, a contract break needed, a structural engine missing for a required structural step). Material risk lists the dynamic lookups, external consumers and persisted formats the tests cannot see. Required action lists shim removal, approved contract changes and follow-up behavior changes. Exact commands, counts and cleanup receipts stay in the evidence files unless the user asks for them.
