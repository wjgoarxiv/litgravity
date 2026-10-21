# Tier triage and success criteria

## What counts as the change set

The change set is what this conversation itself will edit or execute. Work handed to another conversation, a background child or a scheduled task is payload and sizes that lane's process. Launching it is control-plane work and stays LIGHT however large the delegated project is.

## HEAVY facts

HEAVY applies when the change set hits a fact you can point to:

- a new module, layer or domain model;
- authentication, permissions or session handling;
- building or changing an external integration (calling an existing one is ordinary work);
- a schema change or data migration;
- concurrency, locking, transaction boundaries or cache invalidation;
- a refactor crossing module boundaries;
- release-facing or published artifacts, or anything that cannot be fully reverted;
- a public API, CLI flag, config format or UI state change;
- more than one success criterion;
- the user signaling care ("carefully", "thoroughly", "design first") or asking for a review of this conversation's work.

When unsure, take HEAVY. A HEAVY fact that surfaces mid-task upgrades the tier immediately, and whatever the LIGHT path skipped is redone. Tiers only go up.

## LIGHT

LIGHT is the default for a known pattern with no open design decision: a one-spot bug fix, an endpoint matching an existing pattern, a validation rule, a query tweak, copy or constants. Plan directly in `notes.md`, with one or two success criteria (the happy path and the riskiest edge) and one real-surface proof of the user-visible deliverable. Auxiliary surfaces such as CLI stdout or a parsed config dump count for CLI- and data-shaped work. A self-review in the notes replaces the reviewer gate.

## HEAVY process

Three or more success criteria cover the happy path, edge cases (boundary, empty, malformed, concurrent), the adjacent-surface regression named by file and function, and adversarial risk. Each criterion has its own channel scenario and both evidence pieces (a failing-first proof and a surface proof). HEAVY work also gets a goal record under `.litgravity/goals/<slug>.json` by the `litgoal` rules, and the reviewer gate runs until the verdict is unconditional.

When the sizing exceeds one coherent change (several unrelated features, a redesign), stop and recommend `lit-plan`.

## Writing a criterion

A criterion has five parts:

| Part | Content |
| --- | --- |
| id and deliverable | `c1`: the user-visible outcome in one line |
| scenario | the literal command, request or page action with concrete inputs (URL, payload, keystrokes, selectors) |
| observable | the single binary signal that decides PASS or FAIL |
| failing-first proof | the test id or scenario captured RED before the implementation, GREEN after it |
| artifact | the path the surface proof will be saved to |

"Run the endpoint", "open the page" and "check it works" are not scenarios. Write the `curl …`, the `send-keys …`, and the expected status or text. The stop line completes the contract: "I stop right away when <the exact observable state that ends this run>". Evidence added after the green code does not satisfy a failing-first proof.

## Layer to consumer map

A source diff observes none of the consumers, so map every changed layer to the surface that exercises it.

| Layer | Consumer surface | Required observation |
| --- | --- | --- |
| Library or module | caller, import boundary, public API | a focused executable check plus caller-level behavior |
| CLI | the built command invoked with concrete input | exit code and stdout and stderr transcript |
| Hook or plugin component | hook replay or the installed plugin route | dispatch output from the host-shaped boundary |
| Installer or package | disposable install or archive inspection | installed files and a real command from the isolated target |
| HTTP service | running endpoint | status, relevant headers, body, server cleanup |
| Browser or desktop UI | rendered page or running app | action log, observable state, screenshot |
| Data or migration | before and after state | parsed diff, invariants, rollback or recovery check |

## Channel rules that stay fixed

- A browser criterion stays a browser criterion. A unit test, a rendered-HTML string assertion, a DOM snapshot or "the handler returns 200" does not discharge a criterion about what the user sees. When no browser is reachable, the criterion is `BLOCKED:` and a substitute leaves it unpassed.
- Interface changes also pull in `frontend-ui-ux`, and viewport and state checks go to `visual-qa`.
- A non-browser GUI criterion needs the host's desktop automation, and a command-line dump leaves it unpassed.
- Auxiliary surfaces (CLI stdout, a state diff, a parsed config dump, hook JSON on stdin) are first-class evidence for CLI- or data-shaped criteria. A channel scenario is the choice whenever the behavior is user-facing.
- A dry run, printing the command, "should respond" and "looks correct" count for nothing.
