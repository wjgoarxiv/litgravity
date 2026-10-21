# Post-write review loop, long form

`SKILL.md` lists the four steps and the eight questions. This file shows what a failing answer looks like in each language, what the fix is, and how to record the result. Run the loop every time you finish writing or substantially editing code, before claiming done, including for small files.

## Step 1: measure

For every created or changed file:

1. Pure LOC with `awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(\/\/|#|--)/' <file> | wc -l`.
2. The language checker (commands in `language-jump-table.md` in this folder).
3. On a route, append both outputs to `.litgravity/evidence/<slug>/checker.log`, each block starting with the command.

## Step 2: interpret

| Pure LOC | Verdict | Action |
|---|---|---|
| up to 200 | healthy | continue |
| 200 to 250 | warning band | say so in the next message; propose the split if the next edit adds lines; ledger `note` if it stays |
| over 250 | defect | split now, in this task (`file-size-ceiling.md` in this folder) |

Every checker finding is a defect. Fix it, or add the opt-out marker with a real reason and a ledger `note` when the rule truly does not apply.

## Step 3: the eight questions with examples

Answer each internally. The reply mentions only failures, material consequences, required actions or detail the user asked for.

### 1. Single responsibility

Name what the file owns in one short noun phrase. "Order pricing" passes. "Order pricing and tax and the HTTP handler" fails; split along the "and".

### 2. Boundary purity

Failing shapes: `def handle(payload: dict[str, Any])` deep in the domain; `fn apply(v: serde_json::Value)` past the handler; `function process(input: unknown)` in a service; `func Apply(m map[string]any)` in `internal/domain`. Fix: parse at the edge into a model (`Order.model_validate`, `serde_json::from_slice::<Order>`, `OrderSchema.parse`, `NewOrder(raw)`) and pass the typed value inward.

### 3. Variant discrimination

Failing shapes: `if isinstance(evt, Created): … elif isinstance(evt, Deleted): … else: …`; a TypeScript `switch` without a `never` default; a Rust `match` with `_ =>` on an enum you own; a Go type switch without the `exhaustive` linter enabled. Fix: exhaustive match with the language's never-check.

### 4. Escape hatches

Search the diff for: `Any`, `cast(`, `# type: ignore`, `# pyright: ignore`; `.unwrap()`, `.expect(` outside `main` and tests, `as u8`/`as i32` narrowing, `#[allow(`; `: any`, `as any`, `as unknown`, postfix `!`, `@ts-ignore`, `@ts-expect-error`; `interface{}`, `_ = err`, `//nolint` without a reason. Fix the type; where a hatch is truly needed, write why beside it.

### 5. Defensive layers

Failing shapes: `if user is None:` right after a function typed `-> User`; `try:` around arithmetic on validated integers; `if (typeof id !== "string")` on a branded `UserId`; `if cfg == nil` after a constructor that cannot return nil. Delete them; the type already carries the proof.

### 6. One-off helpers

A function, class or trait with one caller and no second caller planned. Inline it. A helper earns its place at the second call site, or when it names a concept the domain uses.

### 7. Tests

Revert the production edit mentally (or actually, in a scratch copy): does a test fail? If not, the behavior is unlocked; write the test that would have caught the revert.

### 8. Necessity and reuse

Walk the phase -1 ladder backwards over what you wrote: could the stdlib, a native feature or an installed dependency have done it? A hand-rolled retry loop next to an installed `tenacity`, `backoff`, `go-retryablehttp` or `p-retry` fails this question.

## Step 4: hand off

| Signal | Go to |
|---|---|
| A file past 250 pure LOC, or more than two failed answers | `refactor` (`../refactor/SKILL.md`): characterize, plan, move in small steps with tests after each |
| An inherited branch dense with generated-code patterns (broad excepts, redundant null checks, vague TODOs, dead helpers, oversized modules) | `lit-burnoff` (`../lit-burnoff/SKILL.md`): pins regression tests first, then cleans by category |
| Stale or narrating comments across the diff | `comment-checker` (`../comment-checker/SKILL.md`) |

Improvising a large structural change under time pressure is how behavior silently changes; the hand-off skills exist to keep behavior fixed while structure moves.

## Recording the result

On a route, add one ledger line per loop run:

```json
{"ts":"<iso>","kind":"note","text":"post-write review: 3 files, max 182 pure LOC, checker clean, 8/8 answers pass","path":"<repo-relative file or dir>"}
```

When an answer failed and you fixed it, say what changed in the same line. When you left a file in the warning band, name it. Off a route, keep the same facts in the internal record of the reply.
