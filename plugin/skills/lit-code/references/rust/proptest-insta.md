# Property Tests (proptest) and Snapshot Tests (insta)

Two kinds of test that belong in every Rust project beside ordinary unit tests. Proptest hunts for inputs the unit tests never tried. Insta locks down output shapes that must not change by accident.

## Which tool for which question

| Question | Tool |
|---|---|
| Does one known input give one known output? | `#[test]` with `assert_eq!` |
| Does every input of a given shape behave? | `proptest!` |
| Does the output structure survive a refactor? | `insta::assert_*_snapshot!` |
| Do the parser and the serializer round-trip? | `proptest!` with a round-trip property |
| Is the CLI help text, JSON response or debug output stable? | `insta::assert_snapshot!` |
| Does concurrent code hold under every interleaving? | `loom` (see [concurrency.md](concurrency.md)) |
| Did performance regress? | `criterion` or `divan` (see [libraries.md](libraries.md)) |

Use all three families. They catch different classes of bug.

## Proptest: setup

```toml
[dev-dependencies]
proptest = "1"
proptest-derive = "0.5"           # #[derive(Arbitrary)]
proptest-state-machine = "0.3"    # stateful model tests
```

Proptest reads configuration from a `ProptestConfig` value and from environment variables, with no separate config file:

```rust
use proptest::prelude::*;

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 512,
        max_shrink_iters: 4096,
        ..ProptestConfig::default()
    })]

    #[test]
    fn parse_render_roundtrips(red in any::<u8>(), green in any::<u8>(), blue in any::<u8>()) {
        let color = Color { red, green, blue };
        let parsed = parse(&render(&color)).expect("render output always parses");
        prop_assert_eq!(parsed, color);
    }
}
```

Environment variables override at run time without editing code: `PROPTEST_CASES=10000` for a deep CI sweep, `PROPTEST_MAX_SHRINK_ITERS`, `PROPTEST_FORK=true` to isolate crashing cases, and `PROPTEST_VERBOSE=1` to print progress. The default of 256 cases suits the inner loop; raise it in nightly CI.

Persistence of failures is on by default: a failing case writes a seed line to a `proptest-regressions/` directory beside the source tree, and every later run replays those seeds first. Commit that directory; a bug found once stays found.

## The `proptest!` macro

The body receives `name in strategy` pairs. Each strategy produces values; Proptest runs the body on random samples, and when a case fails it shrinks the input to a minimal counter-example.

Assertions inside the body use the `prop_` family so a failure feeds the shrinker instead of panicking directly:

- `prop_assert!(cond)` and `prop_assert_eq!(left, right)`
- `prop_assume!(cond)` discards a case that violates a precondition. Prefer building the right strategy, because heavy discarding wastes cases and weakens shrinking.

## Strategies: the value language

| Strategy | Produces |
|---|---|
| `any::<T>()` | any `T` that implements `Arbitrary` |
| `0u32..100`, `1..=10` | integers in a range |
| `prop::sample::select(vec![..])` | one element of a list |
| `prop::collection::vec(elem, 0..10)` | vectors with a length range |
| `prop::collection::hash_map(k, v, 0..5)` | maps |
| `prop::option::of(strategy)` | `Option<T>` |
| `prop::result::maybe_ok(ok, err)` | `Result<T, E>` |
| `strategy.prop_map(\|v\| ..)` | transformed values |
| `strategy.prop_filter("reason", \|v\| ..)` | rejects values |
| `strategy.prop_flat_map(\|v\| dependent)` | a second strategy that depends on the first value |
| `prop_oneof![a, b]` | a union of strategies |
| `"[a-z]{3,10}"` | strings that match a regex |
| `"\\PC*"` | any string of non-control characters |

Composite example:

```rust
fn config_strategy() -> impl Strategy<Value = Config> {
    (
        prop::sample::select(vec!["dev", "staging", "prod"]),
        1u16..=65535,
        prop::collection::hash_map("[a-z_]{1,20}", any::<String>(), 0..5),
    )
        .prop_map(|(env, port, vars)| Config { env: env.to_owned(), port, env_vars: vars })
}

proptest! {
    #[test]
    fn valid_configs_validate(cfg in config_strategy()) {
        prop_assert!(validate(&cfg).is_ok());
    }

    #[test]
    fn zero_port_is_rejected(env in "[a-z]{1,8}") {
        let cfg = Config { env, port: 0, env_vars: Default::default() };
        prop_assert!(validate(&cfg).is_err());
    }
}
```

Generating the valid range directly (`1u16..=65535`) keeps every case useful; the second test states the invalid case separately.

## Properties worth writing

For every parser:

1. **Round trip:** `parse(render(x)) == x` for each valid `x`.
2. **Totality:** `parse(arbitrary_string)` returns `Ok` or `Err` and never panics.
3. **Idempotence:** rendering a parsed value and parsing it again gives the same value.
4. **Whitespace tolerance:** `parse(x) == parse(strip_whitespace(x))` where the grammar says so.

For every serializer:

1. **Length bound:** `render(x).len() <= bound(x)`.
2. **Alphabet:** every output character belongs to the allowed set.

For collection operations:

1. **Identity:** sorting a sorted list, de-duplicating a unique list.
2. **Idempotence:** `op(op(x)) == op(x)`.
3. **Commutativity** where the operation promises it (set union).
4. **Length relation:** `op(a, b).len()` equals a known function of the input lengths.

For numeric code:

1. **Monotonicity:** `a <= b` implies `f(a) <= f(b)`.
2. **Identity element:** `f(x, identity) == x`.
3. **Overflow safety:** checked and saturating forms agree where no overflow occurs.

Reach for Proptest the moment one of these properties is checkable. Write the property first, then derive the example tests from failures it finds.

## Derive `Arbitrary`

```rust
use proptest::prelude::*;
use proptest_derive::Arbitrary;

#[derive(Debug, Clone, PartialEq, Arbitrary)]
struct Vec3 {
    #[proptest(strategy = "-100.0f32..=100.0")]
    x: f32,
    #[proptest(strategy = "-100.0f32..=100.0")]
    y: f32,
    #[proptest(strategy = "-100.0f32..=100.0")]
    z: f32,
}

proptest! {
    #[test]
    fn dot_product_commutes(a in any::<Vec3>(), b in any::<Vec3>()) {
        prop_assert!((dot(&a, &b) - dot(&b, &a)).abs() < 1e-3);
    }
}
```

`#[derive(Arbitrary)]` generates the strategy, and per-field `#[proptest(strategy = "..")]` attributes narrow it. Without bounds, `f32` would generate infinities and NaN, which belong in a separate, deliberate test.

## Stateful model tests

For types with operations (queues, maps, trees, caches), compare the real implementation against a trivial model across random operation sequences with `proptest-state-machine`.

```rust
use proptest::prelude::*;
use proptest_state_machine::{prop_state_machine, ReferenceStateMachine, StateMachineTest};

#[derive(Clone, Debug)]
enum Op {
    Push(i32),
    Pop,
}

struct StackModel;

impl ReferenceStateMachine for StackModel {
    type State = Vec<i32>;
    type Transition = Op;

    fn init_state() -> BoxedStrategy<Self::State> {
        Just(Vec::new()).boxed()
    }

    fn transitions(state: &Self::State) -> BoxedStrategy<Self::Transition> {
        if state.is_empty() {
            any::<i32>().prop_map(Op::Push).boxed()
        } else {
            prop_oneof![any::<i32>().prop_map(Op::Push), Just(Op::Pop)].boxed()
        }
    }

    fn apply(mut state: Self::State, transition: &Self::Transition) -> Self::State {
        match transition {
            Op::Push(value) => state.push(*value),
            Op::Pop => {
                state.pop();
            }
        }
        state
    }
}

struct StackTest;

impl StateMachineTest for StackTest {
    type SystemUnderTest = MyStack<i32>;
    type Reference = StackModel;

    fn init_test(_: &<Self::Reference as ReferenceStateMachine>::State) -> Self::SystemUnderTest {
        MyStack::new()
    }

    fn apply(
        mut sut: Self::SystemUnderTest,
        _: &<Self::Reference as ReferenceStateMachine>::State,
        transition: <Self::Reference as ReferenceStateMachine>::Transition,
    ) -> Self::SystemUnderTest {
        match transition {
            Op::Push(value) => sut.push(value),
            Op::Pop => {
                sut.pop();
            }
        }
        sut
    }

    fn check_invariants(
        sut: &Self::SystemUnderTest,
        model: &<Self::Reference as ReferenceStateMachine>::State,
    ) {
        assert_eq!(sut.len(), model.len());
        assert_eq!(sut.peek(), model.last());
    }
}

prop_state_machine! {
    #[test]
    fn stack_matches_vec(sequential 1..50 => StackTest);
}
```

The model is the obviously correct slow version (`Vec` here). Proptest fuzzes sequences of operations against both and asserts the invariants after every step. The `transitions` function encodes preconditions, so the generator never emits a `Pop` on an empty model. When a sequence fails, shrinking drops operations until the shortest failing sequence remains, which is usually a readable five-line reproduction. This technique finds bugs in lock-free and intricate containers that example tests never reach.

## Shrinking

A failing property shrinks automatically for the built-in strategies and for strategies built with `prop_map`. Rejection sampling through `prop_filter` over a wide space slows shrinking and can exhaust the reject budget, so shape the strategy to produce valid values (`prop_flat_map` for dependent values, a range for bounded numbers). Custom `Strategy` implementations supply their own `ValueTree` when shrinking matters.

## Regression corpus

```text
proptest-regressions/
`- parse_color.txt     # commit this
```

Each line is a seed that previously failed. Future runs replay the seeds first. When a failing case is understood, also add it as an ordinary named unit test, so the scenario survives even if the strategy changes shape.

## Insta: setup

```toml
[dev-dependencies]
insta = { version = "1", features = ["yaml", "json", "redactions", "filters"] }
```

Install the review tool once:

```bash
cargo install cargo-insta
```

## Insta: basic snapshots

```rust
#[test]
fn renders_default_help() {
    insta::assert_snapshot!(render_help());
}
```

The first run writes `snapshots/<module>__renders_default_help.snap.new` beside the test file. `cargo insta review` shows each pending diff; accept one with `a`, reject with `r`. Accepted snapshots lose the `.new` suffix and get committed. Later runs diff against the committed file and fail on a mismatch.

## Insta: typed snapshots

```rust
#[derive(Debug, serde::Serialize)]
struct Outcome {
    status: String,
    user: User,
    duration_ms: u64,
}

#[test]
fn json_response() {
    insta::assert_json_snapshot!(compute());
}

#[test]
fn yaml_response() {
    insta::assert_yaml_snapshot!(compute());
}

#[test]
fn debug_repr() {
    insta::assert_debug_snapshot!(compute());
}
```

Choose by data:

- `assert_snapshot!` for `String` and `Display` output (help text, error messages, generated code).
- `assert_debug_snapshot!` for Rust-internal data via `{:?}`.
- `assert_json_snapshot!` for structured data that crosses process boundaries.
- `assert_yaml_snapshot!` when YAML reads better in review diffs.

## Insta: redactions and filters

Values that change per run (timestamps, identifiers, paths) are redacted:

```rust
#[test]
fn with_redactions() {
    let value = ApiResponse {
        id: uuid::Uuid::now_v7(),
        created_at: time::OffsetDateTime::now_utc(),
        body: "hello".to_owned(),
    };
    insta::assert_json_snapshot!(value, {
        ".id" => "[uuid]",
        ".created_at" => "[timestamp]",
    });
}
```

Regex filters rewrite text before comparison:

```rust
#[test]
fn with_filters() {
    insta::with_settings!({
        filters => vec![
            (r"/tmp/[a-z0-9-]+", "[TMP]"),
            (r"\d+\.\d+ms", "[TIMING]"),
        ]
    }, {
        insta::assert_snapshot!(run_command());
    });
}
```

`with_settings!` scopes the filters to its block. Setting `sort_maps => true` inside it makes map-backed values deterministic.

## Insta workflow

1. Write the test and run it. The first run produces `.snap.new`.
2. Run `cargo insta review`, read each diff, accept or reject.
3. Commit accepted snapshots with the code change.
4. Refactor; the tests diff against the committed snapshots.
5. When new output is correct, accept it (`cargo insta review`); when wrong, fix the code.

In CI, insta refuses to write snapshots and fails on mismatch. The environment variable `INSTA_UPDATE=no` makes that explicit, and `cargo insta test --check` fails when pending snapshots exist. A guard step catches stray files:

```bash
cargo nextest run
if find . -name "*.snap.new" | grep -q .; then
    echo "pending snapshots: run 'cargo insta review'"
    exit 1
fi
```

## Inline snapshots

```rust
#[test]
fn small_output() {
    insta::assert_snapshot!(compute(), @"hello world");
}

#[test]
fn json_inline() {
    insta::assert_json_snapshot!(value, @r#"
    {
      "status": "ok",
      "count": 3
    }
    "#);
}
```

The expected value sits in the source file, which suits short outputs. `cargo insta review` rewrites the literal in place.

## Anti-patterns

1. **Snapshots of unstable output.** `HashMap` iteration order changes per run. Sort, use `BTreeMap`, or enable `sort_maps`.
2. **Giant snapshots.** A 10 KB JSON dump where three fields matter forces a 10 KB re-review on every refactor. Snapshot the fields that matter.
3. **Snapshots of implementation detail.** "Function called three times" is a behaviour assertion; write a real assertion.
4. **Blind acceptance.** `cargo insta accept --all` without reading the diff defeats the tool.
5. **Snapshots of random inputs.** Proptest checks properties and insta checks shapes; combining them multiplies noise.

## CI pairing

```yaml
- name: Tests
  run: cargo nextest run --all-features
- name: Doc tests
  run: cargo test --doc --all-features
```

Because `proptest-regressions/` is committed, the ordinary test run replays old failures. A new regression file appearing in a diff means Proptest found a fresh failure; check it in with the fix.

## What these tools cannot find

- Failures that need several processes or a network: integration tests with fault injection.
- Concurrency interleavings: `loom`.
- Performance regressions: `criterion` or `divan`.

For any function with a domain of inputs, though, Proptest finds more bugs than hand-picked examples. Write the property first and the example test second.
