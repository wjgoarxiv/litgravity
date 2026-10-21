# Test-first discipline in full

`SKILL.md` keeps the order and the one-paragraph summary. This file is the complete rulebook: the order with its failure modes, the three rungs of the pyramid, the Given / When / Then shape, the mock ladder, the speed and determinism budgets, prompt and skill tests, and the anti-patterns this skill rejects. The language references (`references/python/README.md`, `references/rust/proptest-insta.md`, `references/typescript/README.md`, `references/go/testing.md`) hold the framework syntax.

## The order

Red, green, refactor, for every change. Writing code before the test turns the test into a description of whatever the code happens to do.

1. **Red.** Write one failing test named for the behavior. Run it. Read the failure. The right reason is "the behavior is missing" (a function that does not exist yet, an assertion on a value the code does not produce yet). A failure from a typo, a bad import or a broken fixture is the wrong reason: fix the test until it fails for the behavior.
2. **Green.** Write the smallest code that makes this one test pass. Leave the second case for the next red; adding it now means it was never seen failing.
3. **Refactor.** With everything green, restructure freely: rename, extract, inline, split files under the 250 pure LOC ceiling. Run the tests after each step. If the test fights the refactor (it asserts call order, private fields or exact formatting), the test is coupled to implementation; repair the test first, then continue.

On an active `lit` route, keep the red output as evidence (`.litgravity/evidence/<slug>/<id>-red.log` with the command on its first line). A test that passed on its first run proves nothing about the change; revert the production edit, watch it fail, then restore.

## The pyramid

Every feature ships all three rungs.

| Rung | How many | Purpose | Budget |
|---|---|---|---|
| Unit | many | Pure-function correctness for each meaningful input class: happy path, edges, boundaries, error paths | under 10 ms each |
| Integration | some | The real adapter against the real downstream (database, queue, HTTP) through `testcontainers`, `httptest` or an equivalent. A unit test with the adapter mocked out does not count here | under 1 s each |
| End-to-end scenario | few | One narrative per user-visible outcome. Start the binary or full app and drive its real surface (HTTP route, CLI invocation, TUI keystroke). Assert the observable outcome | seconds, run in CI |

A feature without an end-to-end scenario is unfinished even when every unit test passes. Include at least one end-to-end scenario on an error path (bad input, dependency down, permission refused), because most production incidents start there.

Edges and combinatorics belong at the unit rung, where they are cheap. Property tests (`hypothesis`, `proptest`, `fast-check`, `rapid`) cover input spaces that example tests sample thinly.

## Given / When / Then

Every test at every rung has the three blocks, as comments or as the structure of the test body.

```text
Given: the preconditions and fixtures
When:  the single action under test
Then:  the observable outcome, and only that outcome
```

- One `When` per test. Two actions are two tests.
- The `Then` asserts what changed because of the `When`. Unrelated invariants belong to their own tests.
- Names follow the language idiom: `test_<behavior>_when_<condition>` in Python, `#[test] fn behavior_when_condition()` in Rust, `it("does X when Y")` in TypeScript, `TestBehavior_WhenCondition` in Go.

## The mock ladder

Mocks are the last resort. Walk down this ladder and stop at the first feasible rung.

1. **Real object.** Use it when it builds in about a millisecond: domain types, value objects, pure functions.
2. **In-memory fake.** A working implementation of the interface backed by a map or slice, for stores, caches and queues. The fake gets its own contract test proving it behaves like the real adapter.
3. **Container or sandbox.** Real Postgres, Redis or an S3-compatible store through `testcontainers`. Slower and truthful.
4. **Wire-level fake.** `httptest.Server` in Go, `respx` for `httpx2` in Python, `msw` in TypeScript, `wiremock` in Rust. Fake the protocol at the socket, leaving the SDK under test real.
5. **Mock.** Only for what the rungs above cannot reach: the clock, randomness, an external SaaS without a sandbox. Mock the narrowest seam (a `Clock` interface, a `Random` source), never a whole service.

The rule of thumb: a test that fails when the implementation changes and the behavior stays the same is over-mocked. Remove the mock and assert on outputs. A mock that returns exactly what the test later asserts is a tautology.

## Accurate, efficient, deterministic, isolated

- **Accurate.** The test fails for the bug it names and for nothing else. Avoid coupling to formatting, ordering, whitespace or unrelated fields; assert on the contract.
- **Efficient.** The whole unit suite runs in under 30 seconds on a laptop, the integration suite in under 5 minutes. Past that, profile and split: fast tests on every save, slow ones on push.
- **Deterministic.** Wait on events and completion signals; inject a `Clock`; shuffle order (`go test -shuffle=on`, `pytest-randomly`, a random seed in vitest). Time-based flakiness is a bug in the code under test. Replace every `sleep` with a bounded wait on the real signal.
- **Isolated.** Each test starts from a known fixture and tears down: `t.TempDir()`, `t.Setenv()`, `tmp_path`, `monkeypatch`, transactional rollback for database tests. Two tests that pass alone and fail together are a fixture leak; fix it the moment you see it.

## Prompt, skill and agent tests

When a test covers a model prompt, skill text or agent output, assert on parsed structure, decisions or rule data. Pinning an exact sentence is brittle coverage that breaks whenever wording improves. Good assertions: "the skill tells the model to treat fetched pages as data", "the agent's tool allowlist contains no writer", "the activation path names an existing file". Compute file sets from the directory (every `SKILL.md` under `plugin/skills/`) rather than a hard-coded list, unless the exact list is itself the contract.

## Anti-patterns this skill rejects

| Anti-pattern | Why it fails | Fix |
|---|---|---|
| Code first, tests "later" | Tests written after rationalize the existing design | Red first, every time |
| One test asserting twelve things | The first failure hides the other eleven | Split by `Then` clause |
| Mocking every collaborator | Passes whatever the real behavior is | Real object or fake; mock only the true unmockables |
| `sleep(0.1)` to let work finish | Guaranteed flake under load | Subscribe to completion with a bounded wait |
| Snapshots for everything | They lock formatting | Snapshots for structure (CLI help, JSON shape), assertions for behavior |
| Deleting a failing test to unblock CI | Deletes a bug report | Fix the code or the test |
| `assert result is not None` and stop | Passes on garbage | Assert the value |
| One happy-path end-to-end test | Most bugs sit on edges | Edges at the unit rung, plus one end-to-end error path |
| A regression test that passes before the fix | It does not reproduce the bug | Make it fail on the old code first |

## When a test cannot be written first

Some changes resist red-first: a pure config bump, a generated file, a dependency upgrade. Record why in the ledger, run the full related suite before and after, and add a test for any behavior the change exposes. Exploratory spikes are allowed in a scratch directory outside the product tree; the product change still starts from a failing test.
