# Structural rewrite safety

Open this reference when the user has asked for mutation. Finding a match grants no right to rewrite it. A codemod is accepted when its target set, preview, diff and verification are all observable.

## Preconditions

Before constructing a replacement:

1. Confirm the active git root (`git rev-parse --show-toplevel`) and read `git status --short`.
2. Separate pre-existing changes from task-owned paths.
3. Name target roots and exclusions.
4. Identify generated, vendored, cached, fixture, snapshot and lockfile paths.
5. Confirm the parser language and any version-sensitive syntax.
6. Find the project's formatter and at least one parser, compiler, typecheck or test gate.
7. Write expected match and changed-file counts, as ranges when exact counts are unknown.

When an unrelated dirty edit overlaps the target, stop and ask. Overwriting it destroys work the user may not have saved elsewhere.

In a headless `agy -p` run, `run_command` is the gate for every step below. Ask for it once at the start, and when it is refused the run ends, so the safe stop is the preview text already produced plus the commands for a user to run.

## Two distinct passes

Preview and mutation are separate commands.

### Pass 1: preview

```sh
ast-grep run \
  --lang ts \
  --pattern 'console.log($$$ARGUMENTS)' \
  --rewrite 'logger.info($$$ARGUMENTS)' \
  src
```

This command shape relies on the CLI's default non-updating behavior; confirm it in the installed `run --help`. When the release offers structured diff output, use it for capture and keep a human-readable preview as well.

Review:

- every matched syntax class;
- every file path;
- capture preservation;
- comment and whitespace placement;
- import or declaration prerequisites;
- nested forms and multi-line arguments;
- generated or vendored false positives.

Save the full preview to `.litgravity/evidence/<slug>/preview.diff` and the touched paths to `manifest.txt`.

### Pass 2: apply

Only after the preview is accepted:

```sh
ast-grep run \
  --lang ts \
  --pattern 'console.log($$$ARGUMENTS)' \
  --rewrite 'logger.info($$$ARGUMENTS)' \
  --update-all \
  src
```

Verify the exact update flag in the installed help before using it (`--update-all` and `-U` in current releases; `--interactive` offers hunk-by-hunk acceptance). Keep mutation apart from JSON or other output modes unless the live CLI documentation guarantees both effects together; two commands give an unambiguous receipt.

Inspect right away:

```sh
git diff --check
git status --short
git diff -- src
```

Stop when an unlisted path changed.

## Replacement design

### Every replacement capture is bound

Reviewable:

```text
pattern: console.log($$$ARGUMENTS)
rewrite: logger.info($$$ARGUMENTS)
```

Broken:

```text
pattern: console.log($VALUE)
rewrite: logger.info($MESSAGE)
```

`$MESSAGE` has no source. An unbound capture can fail, emit a literal `$MESSAGE` or behave differently per version.

### Valid syntax proves little

Changing `console.log(value)` into `logger.info(value)` yields parseable code, and it still fails when `logger` is missing from that scope. Use structural rewriting for the local shape, and a compiler, type checker or project test for integration facts such as imports and initialization.

### Rewrites that need more context

- Converting promise chains to `await` needs an async-capable enclosing function and equal error behavior.
- Replacing Rust `.unwrap()` with `?` needs a compatible return type and an error conversion.
- Converting CommonJS imports to ESM changes module mode, file extensions, globals and load timing.
- Changing allocations or ownership constructs changes lifetime and cleanup semantics.
- Deleting a list element needs separator-aware range expansion.

For these, pair a relational rule with project analysis, use a compiler-native codemod, or stage the migration over several previews. Describe a one-line replacement as complete only when the checks above passed.

## YAML fixes

A reusable rule may carry `fix`:

```yaml
id: direct-console-log
language: TypeScript
severity: warning
message: "Use the project logger"
rule:
  pattern: console.log($$$ARGUMENTS)
fix: logger.info($$$ARGUMENTS)
files:
  - "src/**/*.ts"
  - "src/**/*.tsx"
ignores:
  - "**/*.generated.ts"
```

Scan first, with no apply flag:

```sh
ast-grep scan --rule .litgravity/evidence/<slug>/rule.yml src
```

Read `scan --help` for the installed fix flag and apply after the same target set was reviewed. A stored rule keeps the two-pass requirement.

### Deletion and range expansion

An empty `fix` deletes the match. Deleting an element of a comma-separated list, a declaration group or an argument sequence can leave invalid punctuation. When the installed schema supports a range-expanding fix (`template` with `expandStart` and `expandEnd`), test:

- the first element;
- a middle element;
- the last element;
- the only element;
- a trailing comma;
- attached comments.

Without proof for those cases, the delete codemod stays narrow.

### Transforms and rewriters

Transforms derive new text from captures, and rewriters recursively rewrite captured subtrees. Both multiply the proof surface. Require:

- a bounded input alphabet or an explicit constraint;
- positive cases for each transform branch;
- a no-change case;
- a check that derived identifiers are valid in the target language;
- a preview that shows the final replacement;
- formatter and compiler evidence after application.

A direct capture-preserving fix wins when it is expressive enough.

## Changed-file manifest

Capture the intended target set before application. A reproducible approach:

```sh
git status --short
ast-grep run --lang ts --pattern 'console.log($$$ARGUMENTS)' src
```

Record the paths from the preview as the manifest in the evidence folder. After applying, compare `git status --short` and `git diff --name-only` with the manifest and account for pre-existing dirty paths separately.

Raw matcher output stays out of destructive shell pipelines, since paths can hold spaces, newlines, leading dashes or hostile text.

## Verification ladder

Cheapest checks first, so a bad codemod fails quickly:

1. `git diff --check`
2. the project formatter in check mode, or on changed files only
3. parser, compiler or typechecker for the changed language
4. narrow tests for the changed behavior
5. the broader package or repository gate when coupling warrants it
6. the old structural query again
7. a query for the new shape
8. manual inspection of representative diffs

The old query reaches zero only when no exclusions apply. Report expected and remaining counts with reasons.

## Behavior-preserving review questions

- Does evaluation order stay identical?
- Are arguments evaluated the same number of times?
- Do thrown errors, returned promises and short-circuit behavior survive?
- Did the rewrite add a symbol that is missing in some scopes?
- Did a comment move from one node to another?
- Did automatic formatting expose malformed syntax?
- Are overloads, decorators, macros, templates or preprocessor forms involved?
- Did the rewrite cross a language-version boundary?
- Did ignored or generated files need regeneration through a project command?

When an answer is uncertain, narrow the transformation or escalate to the project-native semantic tool (`lsp` and the checker CLIs).

## Failure handling

When the apply result surprises you:

1. stop all further mutation;
2. capture `git status --short`, changed paths and the relevant diff;
3. separate task-owned edits from pre-existing work;
4. revert only task-owned edits, using a scoped patch or `git restore -- <manifest paths>` after confirming those files carry no user edits;
5. reduce the pattern to a minimal fixture or one representative source file;
6. fix the query and repeat the preview phase;
7. withhold any success claim while an unexplained diff remains, even after a green test run.

Recovery stays scoped: a stash, reset or clean can swallow the user's work along with the codemod's.

## Completion receipt

A structural rewrite report includes:

- validated executable and version;
- parser language;
- pattern or rule, and replacement or fix;
- target roots and exclusions;
- preview count and intended manifest;
- actual changed-file count;
- `git diff --check` result;
- formatter, compiler and test results;
- old-shape remaining count and expected exclusions;
- cleanup result for temporary fixtures or rule files.
