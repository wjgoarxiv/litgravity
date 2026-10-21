# Shared rules in depth

The six axioms in `SKILL.md` are short on purpose. This file gives each one the detail, the per-language shape and the review question that catches a violation. Read it the first time `lit-code` drives a change in a conversation, and again whenever review keeps finding the same class of defect.

## 1. The type system is the proof system

The compiler or type checker runs on every save, costs nothing per case and covers every path at once. Treat it as the first test suite.

- Encode a state machine as a tagged union of states, each carrying only the fields valid in that state. A `status: str` plus four optional fields lets the code build combinations that never occur in the domain.
- Prefer constructors that can fail (returning a result or raising a typed error) over objects that exist in a half-valid form and get "checked later".
- Keep `Optional`/`Option`/`T | undefined` for values that are genuinely absent in the domain. A field that is always present after construction gets a non-optional type.

| Language | Typical shape |
|---|---|
| Python | `Pending | Running | Done` as frozen dataclasses with a `kind: Literal[...]` field, matched with `match` |
| Rust | `enum State { Pending, Running { started: Instant }, Done { result: Output } }` |
| TypeScript | `type State = { kind: "pending" } | { kind: "running"; started: number } | { kind: "done"; result: Output }` |
| Go | sealed interface `State` with an unexported marker method, one struct per state |

Review question: can the code construct a value the domain says is impossible? If yes, change the type.

## 2. Parse at the boundary, then trust the type

A boundary is any place data enters from outside the program's control: CLI arguments, environment variables, files, HTTP bodies, queue messages, hook payloads on stdin, database rows from a schema you do not own, and model output.

Parse once, there, into a typed value. After that line, code receives the typed value and does no further shape checking.

- CLI arguments become a command object or option record before dispatch.
- JSON from a hook, queue or HTTP body is parsed once; malformed input ends in a typed, reportable error with the field that failed.
- Config files and manifests load as structured data and are checked by named fields.
- Environment variables are read at the edge and turned into paths, booleans, durations or enums; inner code receives those values as parameters.
- Model output is parsed into a schema or tagged union before any branch depends on it. Free text that "looks like" JSON is still untrusted until it parses.

Tools: Pydantic v2 models (Python), `serde` derive plus a validating constructor (Rust), Zod v4 schemas with `z.infer` (TypeScript), `validator/v10` tags on transport structs plus a smart constructor for the domain type (Go).

Signal that the boundary is missing: the same `if not x` or `len(x) == 0` check appears in three functions, or interior code accepts `dict[str, Any]`, `serde_json::Value`, `unknown` or `map[string]any`.

## 3. One name per concept

Distinct meanings get distinct types even when the representation is the same. Ids, units, paths, versions, plugin keys and command names are the usual candidates.

- Python: `UserId = NewType("UserId", int)`; for units with arithmetic, a frozen dataclass wrapping the number.
- Rust: `struct UserId(u64);` with `#[repr(transparent)]` when layout matters, and `From`/`TryFrom` for the conversions you allow.
- TypeScript: `type UserId = string & { readonly __brand: "UserId" }` with a parse function that is the only way to produce one.
- Go: `type UserID string` with a `NewUserID(raw string) (UserID, error)` constructor; keep the raw conversion inside the package.

Review question: could a caller pass seconds where milliseconds were meant, or an order id where a user id was meant, and still compile?

## 4. Exhaustive variant matching

When a new variant is added, every place that discriminates on the type should fail to compile or fail the linter until it handles the new case.

- Python: `match value:` with a final `case _ as unreachable: assert_never(unreachable)`; basedpyright reports the missing case.
- Rust: `match` is exhaustive by default; avoid a wildcard arm on enums you own, because it hides new variants.
- TypeScript: `switch (value.kind)` with `default: return assertNever(value)` where `assertNever(x: never): never` throws.
- Go: a sealed interface, a type switch, and the `exhaustive` linter configured for switches and maps (`default-signifies-exhaustive: false`).

An `if`/`elif`/`else` chain over a tagged variant is the anti-pattern: the `else` arm silently takes every future variant.

## 5. Trust framework guarantees; validate at boundaries

Defensive code that checks for impossible states adds lines, hides intent and suggests to the next reader that the state is possible.

- A value typed non-null gets used directly.
- A function that cannot raise sits outside `try`.
- A Rust `unwrap` or TypeScript `!` that papers over a contract is replaced by a type that states the contract (a non-empty vector type, a parsed config struct).
- A possible state is named, handled and tested. An impossible state is made unrepresentable by parsing or types.

## 6. Test-driven, with the right shape of test

Each production line exists because a test demanded it. The test fails first, for the reason it names, and passes after the minimum change. `tdd-discipline.md` in this folder holds the order, the pyramid, the mock ladder and the anti-pattern table.

## Type and error discipline

- Use semantic names for ids, paths, versions and keys.
- Return or raise typed errors at boundaries. An error states what failed and with which input (the path, the field, the id), and keeps its cause chained.
- A lint or type suppression is allowed only when local policy allows it, scoped to one line, with the reason beside it and a ledger `note` on a route.
- Error text is for humans. Machines branch on error types or stable codes.
- Libraries return errors; the application boundary decides exit codes, HTTP statuses and retries.

## Resource and state hygiene

Every resource you create during work or a probe has an owner and a release step registered at creation time: spawned processes, tmux sessions, temp directories, open ports, browser contexts, containers, background jobs started with `run_command`.

- Prefer lexical lifetimes: `with`, `Drop`, `using`, `defer`.
- In tests, use the framework's temp helpers (`tmp_path`, `t.TempDir()`, `tempfile::TempDir`) and environment helpers (`monkeypatch.setenv`, `t.Setenv`).
- Probe resources get a cleanup receipt in the evidence: what was started, how it was stopped, and a check that it is gone (`ps`, `lsof -i :<port>`, `tmux ls`).
- A process left running after the task is unfinished work, whatever the tests say.

## When the repo disagrees

House conventions outrank these rules where they conflict: an existing error style, a logging library, a test layout. Follow the repo, write one line in the reply naming the deviation, and log a ledger `note`. Where the repo has no convention, these rules are the default.
