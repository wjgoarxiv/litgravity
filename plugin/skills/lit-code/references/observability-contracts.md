# Observability contracts

Logs, metrics, traces and error surfaces are part of a feature's public behavior. An operator reading them must be able to tell success, expected rejection, dependency failure, cancellation, timeout and internal defect apart, with secrets kept out. Read this file whenever a change touches logging, metrics, tracing, retries, cancellation, background work or any failure an operator sees.

## Start from the questions

Write down the operational questions before adding a single field:

- Did the operation start, finish, get cancelled or time out?
- Which boundary failed?
- Is the failure worth retrying?
- Which release, route, job or command produced it?
- Can related events be correlated without recording user content?
- Where does the data go, and how long is it kept?

A field that answers none of these stays out.

## Event contract

Use stable event names and typed fields. One completion event beats several lines of prose.

```text
event:           operation.completed
component:       stable subsystem name
operation:       stable verb
outcome:         success | rejected | cancelled | timeout | dependency_error | internal_error
duration_ms:     non-negative integer
correlation_id:  opaque identifier
attempt:         positive integer
dependency:      optional stable service name
error_code:      optional stable code
```

Message text is for humans. Dashboards, alerts and tests read structured fields.

## Severity

| Level | Use it for |
|---|---|
| debug | local decision detail that helps diagnosis |
| info | normal lifecycle transitions and user-visible completions |
| warn | degraded or recoverable state that needs attention |
| error | the requested outcome failed and someone must act |

Log an expected validation rejection at info or warn with `outcome: rejected`; error level is for failures. A swallowed exception stays visible at its real level. Emit the error once, at the boundary that owns the outcome; lower layers attach context and return.

## Sensitive data

Keep these out of every sink: credentials, authorization headers, cookies, session contents, private keys, full prompts, unredacted request bodies, and environment dumps. Treat file paths, URLs, query strings, email addresses and source snippets as possibly sensitive.

Prefer:

- extracting allowlisted fields;
- opaque identifiers;
- counts and bounded lengths;
- stable error codes;
- redaction before formatting.

Redacting after serialisation is too late: another sink may already hold the value. The same applies to evidence files and ledger lines written during this skill's own work: record command shapes with secrets masked.

## Correlation and causality

Carry one correlation id across process and network boundaries. Give each attempt its own span or operation id. Retries appear as retries, each with its attempt number.

For asynchronous work, record enqueue, start, terminal outcome and cancellation as separate events. A successful enqueue says nothing about processing. A 200 response says nothing about the background job it started.

## Performance telemetry

Measure durations with a monotonic clock and keep wall time for human correlation. Histogram fields carry their unit in the name (`duration_ms`). Keep label cardinality bounded: user ids, raw paths, error messages and request ids belong in events, kept off metric labels.

Profile and trace before optimising. A benchmark is comparable evidence only with its warm-up policy, input shape, runtime version and variance recorded.

## Language notes

- **Python:** module-level structured loggers (`structlog` in production); keep exception chains with `raise … from …`; report anyio cancellation as `outcome: cancelled`. `references/python/libraries.md` has the configuration.
- **Rust:** fields on `tracing` spans; typed errors; keep rich error chains out of metric labels. See `references/rust/axum-stack.md` for the subscriber setup.
- **TypeScript:** every promise rejection reaches a handler that records it; pass `AbortSignal` through; keep the process exit code meaningful independent of stdout. `pino` with child loggers per request.
- **Go:** pass `context.Context` along request paths; `slog` with typed attributes (`slog.String`, `slog.Int`); inject loggers as dependencies instead of stashing them in the context. `references/go/backend-stack.md` covers middleware order.

Follow the project's existing logging library and field names before introducing a new stack.

## Verification

Exercise at least:

1. normal success;
2. invalid input;
3. dependency failure;
4. timeout or cancellation;
5. retry, when the code retries.

Capture the emitted fields and confirm secrets are absent. Assert stable event names and outcome codes; leave timestamps and fully formatted lines out of assertions. Run the real CLI, HTTP route, worker or UI action as well as the unit tests of field construction. On a `lit` route, keep the captured events in `.litgravity/evidence/<slug>/telemetry.log`.

## Failure modes to watch for

- Only a start event: a hang looks the same as a crash.
- Success logged before the durable write completes: false positives.
- Catch, log, return success: the caller reports success for a failure.
- High-cardinality labels: the monitoring backend degrades or drops data.
- The same error logged at every layer: the owning boundary is hidden.
- Error sampling: the rare failure you are hunting disappears.
- Debug logging enabled globally: data leaks and timing shifts.

## Cleanup receipt

Remove temporary verbose settings, trace exporters, local collectors, scratch dashboards, packet captures and background processes started for the probe. State which telemetry changes remain in the product and where their retention policy is defined.
