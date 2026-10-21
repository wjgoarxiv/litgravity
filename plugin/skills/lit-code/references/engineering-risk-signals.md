# Engineering risk signals

Read this before a broad design review, a concurrency change, a public API change, and during the post-write quality pass. A signal is a prompt to ask three things: who owns this, which invariant is at stake, and what evidence shows it holds. A signal by itself is not a verdict; some are acceptable once named and tested.

Each section lists what to look for and the direction of a correction. The review procedure at the end turns an observed signal into a bounded decision.

## Boundary signals

- One input is parsed or validated in several layers.
- Domain code takes raw dictionaries, generic maps or untyped JSON.
- Errors are translated into transport form in more than one place.
- Transport, persistence and domain share a single struct or model.
- A configuration default quietly changes production behavior.

Direction: pick one trust boundary, parse once there, keep domain types inside, and translate errors once at the outward edge. `core/shared-rules.md` in this folder has the per-language shape.

## State signals

- Combinations of booleans encode a state machine nobody named.
- A partly initialised object is reachable by callers.
- Transitions are scattered across unrelated methods.
- Cache, database and memory can disagree, and no rule says which one is authoritative.
- A retry can repeat a side effect (a charge, an email, a write).

Direction: name the states as a tagged type, restrict transitions to one place, make idempotency explicit with keys or version checks, and test the crash and retry edges.

## Concurrency signals

- Work starts with no owner, no cancellation path and no join.
- A timeout stops the waiting while the operation keeps running.
- Shared mutation is correct only under lucky timing.
- A channel or queue has no backpressure decision (unbounded, or bounded with no policy when full).
- Tests wait with `sleep`.

Direction: bind child work to a lifetime (task group, `JoinSet`, `errgroup`, `AbortController`), propagate cancellation to the operation itself, wait on observable completion signals, and run the language's race or schedule explorer (`go test -race`, loom for Rust primitives, Miri for `unsafe` concurrency, shuffled test order for Python and TypeScript).

## Error signals

- An error is caught and dropped.
- Error message text is used as a machine-readable code.
- Context replaces the cause instead of wrapping it.
- A library ends the process.
- A success value can carry an embedded failure.

Direction: typed outcomes, chained causes, exit or response decisions at the application boundary only, and tests on the outward contract (status code, exit code, error type).

## Resource signals

- Acquire and release sit far apart.
- Cleanup runs on the success path only.
- A background process, file, socket, transaction or lock has no owner.
- A pool or client runs on unbounded defaults.
- Temporary artifacts land in production paths.

Direction: lexical lifetimes or explicit guards, bounded pools and queues, isolated temp state, and a cleanup receipt in the evidence.

## API signals

- Callers pass several neighbouring primitives of the same type (`(string, string, string)`).
- An optional parameter switches the function into a different mode.
- One function both decides policy and performs I/O.
- A return value mixes data, warnings and failure without a tag.
- An internal type leaks into a public contract.

Direction: semantic value types, policy separated from adapters, outcomes as variants, and an inventory of downstream callers (`structural-search` or the `lsp` skill) before changing a public shape.

## Test signals

- Assertions follow implementation order instead of observable behavior.
- A mock returns exactly what the test later asserts.
- Only the happy path exists.
- Fixtures depend on wall-clock time, global environment or execution order.
- A snapshot approval hides a change in meaning.
- A regression test passes on the unfixed code.

Direction: failing-first behavior tests, real values and narrow fakes, controlled clocks and randomness, and one real-surface scenario. `core/tdd-discipline.md` holds the full rules.

## Performance signals

- An optimisation rests on intuition instead of a profile.
- Benchmark inputs look nothing like production.
- Allocation or caching trade-offs are undocumented.
- An average stands in for latency percentiles.
- The faster version weakens correctness or cancellation.

Direction: define a budget, capture a baseline, profile the real workload, change one cause at a time, and compare distributions in the same environment.

## Maintainability signals

- A name describes mechanism instead of responsibility (`DataManager`, `process2`).
- One file changes for unrelated reasons.
- A helper has a single caller and hides a simple operation.
- A generic abstraction has exactly one concrete use.
- Comments restate syntax instead of invariants or decisions.
- Generated and hand-edited code look identical.

Direction: cohesive ownership, generalise at the second use, mark generated files with the standard "do not edit" header, and comment the reason a constraint exists.

## Signals specific to agy plugins

- A hook parses its payload in several places, or trusts a field name from one build only (tool names differ across agy builds).
- A skill names a resource path that does not exist in its folder.
- An agent meant to be read-only has a writer in its `tools:` list.
- A child agent is started without `TypeName`.
- An engine installs outside `$XDG_DATA_HOME/litgravity/runtime/<name>`.

Direction: one parser per payload with tolerant name matching, closure checks in tests, explicit allowlists, typed spawns, and engine installs pinned to the runtime cache.

## Review procedure

For each signal you observe, write a short record in the draft, the ledger or the review reply:

```text
Signal:
Concrete location:            <file:line>
Invariant at risk:
Current evidence:
Smallest safe correction:
Verification:
Decision: fix now | accept explicitly | out of scope
```

Keep the change to the requested scope. Fix a signal now when it blocks the requested behavior, makes the requested edit unsafe, or would make verification meaningless. Otherwise report it as a bounded risk with its location, and let the user decide whether it becomes its own task.
