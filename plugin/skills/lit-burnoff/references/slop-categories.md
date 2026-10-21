# Slop categories with KEEP and REFACTOR rules

Ten categories in three groups. Each carries a KEEP rule, because the usual burnoff failure is deleting something that looked generated and was load-bearing. A candidate that fits no category stays untouched.

## Stylistic

### 1. Obvious comments

Comments that restate the code, trivial docstrings, section dividers, commented-out code, vague TODO and NOTE lines, and comments that narrate the diff ("now we call X").

KEEP: comments that explain why (business rules, edge cases, workarounds), ticket links, regular-expression and algorithm explanations, BDD markers such as `# given / # when / # then`, license headers, and tool pragmas and lint directives.

### 2. Over-defensive code

Null checks on values the type system guarantees, try and catch around code that cannot throw, instance checks on statically typed parameters, defaults for required parameters, backward-compatibility shims for callers that no longer exist, validation repeated at every layer after one parse, and broad exception catching (`except Exception`, `except BaseException`, an empty `catch {}`, or `catch (e) { console.error(e) }` that neither narrows nor rethrows).

KEEP: validation at system boundaries (user input, network, files, process output, persistence), I/O error handling, nullable database fields, and a top-level catch-all (a CLI `main()`, an HTTP handler) that logs and rethrows.

REFACTOR: a broad catch becomes the specific exception you expect. An empty catch gets narrowing or a rethrow. Log-and-swallow gets narrowed, handles the known cases and rethrows the unknown.

### 3. Excessive complexity

Nesting deeper than three levels, nested ternaries, boolean expressions combining four or more predicates, parameter lists longer than five without a struct, god functions over about fifty lines doing several jobs, clever one-liners that cost readability, `if/elif` chains that discriminate a type, enum or literal where a `match` or `switch` with an exhaustiveness check fits, and `object` or `any` used as a type where a protocol, generic or explicit union is right.

KEEP: established patterns in this codebase, a hot path that intentionally uses a dense idiom, and plain `if/else` on booleans and ranges (that is not variant discrimination).

REFACTOR: nested chains become guard clauses and early returns. Complex ternaries become explicit `if/else`. Variant chains become an exhaustive `match` with an assert-never wildcard. Vague annotations become a protocol, generic or union.

## Structural

### 4. Needless abstraction

Pass-through wrappers, single-use helpers, speculative indirection ("we might need this later"), interfaces with one implementer and no testability win, factories that only call a constructor, config options nobody sets.

KEEP: abstractions that provide a real seam (a test double, several implementers, a framework-required boundary) and wrappers that add policy, isolation, instrumentation or compatibility.

### 5. Boundary violations

Wrong-layer imports (a UI importing a database driver), handlers doing business logic that belongs in a service, module A reading module B's private state, side effects inside functions named as pure.

KEEP: pragmatic short-circuits already established as a pattern here. When unsure, flag the candidate for human judgment.

### 6. Dead code

Unused imports, unused private functions, unreachable branches, stale feature flags, debug leftovers (`console.log`, `print(...)`, `dbg!`), references to removed code.

KEEP: code reached through reflection, dynamic dispatch, string lookup, config, package exports, command routing or generated manifests (see the existence proof in `behavior-preserving-cleanup.md`), and a flag kept on purpose as a rollback path (ask).

### 10. Oversized modules

A source file over 250 pure lines (non-blank, non-comment). Measure with `awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(#|\/\/)/' <file> | wc -l`. This is an architectural defect and a separate modular split that needs the user's approval of the plan. It never rides along as a drive-by cut.

Plan the split by responsibility and name each new file after the concept it owns (`utils`, `helpers`, `common` and `part_1` name nothing). Re-export files hold no logic. Verify that every resulting file is within budget and that tests, typecheck and lint stay green. The repository's own size checker wins when one exists, and the awk count is the fallback. Counting blanks or comments toward the budget, splitting by token count, catch-all dump files and "it's generated" for anything outside a build output folder are not accepted. KEEP: a genuinely self-contained single-responsibility script, with an in-file note saying why.

## Hidden cost and coverage

### 7. Duplication

Copy-pasted branches that differ in one literal, helpers doing the same job in two places, repeated runs of magic numbers.

KEEP: incidental duplication, meaning two blocks that look alike but serve intents that may diverge. Leaving them apart beats a premature shared abstraction.

### 8. Performance equivalences

Changes provably equal in semantics and cheaper: a list scan replaced by a set lookup, a computation hoisted out of a loop, an eager list iterated once turned into a generator, string concatenation in a loop turned into a join, redundant calls in a loop batched, redundant deep copies dropped, a length recomputed in a loop cached.

Hard rule: apply a change only when the equivalence is obvious. Algorithms with subtle correctness implications, ordering, laziness, exception timing, numeric precision and allocation lifetime stay as they are. A hot path gets no micro-optimization without a benchmark. When in doubt, SKIP.

### 9. Missing tests

Behavior present in scope that no test locks. The fix adds the narrowest test that pins current behavior (Phase 1 of `SKILL.md`), and it removes no code.

## Order inside a file

Safest to riskiest: comments, dead code, defensive bloat, duplication, complexity, abstraction and boundary, performance, missing tests, oversized modules. The order bounds the blast radius of any one change. Group edits into small batches that share one verification command.
