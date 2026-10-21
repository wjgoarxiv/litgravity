# Partial Runtime Evidence — When You Cannot Execute the Real Operation

Read this when "runtime truth beats code reading" collides with "you cannot run the actual operation".

The skill's first invariant is that runtime state is the only source of truth. Sometimes the only state you can produce is a *partial* observation: the real call needs paid credits, a device you do not have, access through a corporate proxy, a production secret, or a customer dataset.

**Partial runtime evidence is still runtime evidence.** This reference tells you which partial signals to harvest and how to combine them so the conclusion holds up.

---

## When this applies

Use it when all three hold:

1. The bug or extraction question needs runtime confirmation (skill invariant 1).
2. You tried the obvious "just run it" path and it failed for reasons unrelated to the bug: 401/402/403 from a paid API, "device not found" or "permission denied" or a SIP block, production-only credentials, network isolation, or time-of-day or quota limits.
3. Mocking the whole system would defeat the verification — you specifically need evidence about how the *real* code behaves, not a stub.

When only 1 and 2 hold and you can mock cleanly, mock and proceed. This file is for cases where mocking would invalidate the answer.

Under agy, remember that a refused `run_command` in a headless `-p` run ends the run. When the real operation needs a permission the host denies, record the denial as a `BLOCKED:` line, harvest whatever partial signals you can read, and present the conclusion as partial.

---

## The hierarchy of partial evidence (strongest first)

When you cannot capture the full outbound payload plus the full response, capture as much as possible. Evidence lower on the list carries more inference; evidence higher up sits closer to ground truth.

### Tier 1 — Pre-send / post-receive logs (the best partial evidence)

The system builds a request, then sends it. When the build step logs the assembled request *before* transmission, that log is ground truth for everything except the wire-level bytes (TLS, headers the HTTP library adds).

```bash
APP_DEBUG=1 APP_LOG_LEVEL=debug APP_LOG_FILE=/tmp/trace.log ./target -x "minimal valid input" 2>&1 | head -200
```

Look for lines like `Building request: model=X, params={...}`, `[provider] payload: {...}`, or `Sending to <url>: <serialized body>`.

**Strength**: ~95% of ground truth. It misses only wire-level transformations.

### Tier 2 — Local interception via a proxy or shim

Run the real binary against a local proxy that records and optionally returns a canned response.

```bash
mitmproxy --listen-host 127.0.0.1 --listen-port 8888 --mode regular &
HTTPS_PROXY=http://127.0.0.1:8888 SSL_CERT_FILE=~/.mitmproxy/mitmproxy-ca-cert.pem ./target ...
# mitmproxy now logs the actual TLS-decrypted request
```

A `DYLD_INSERT_LIBRARIES` / `LD_PRELOAD` shim that wraps the network call to log the payload and return a fake 200 is the other route (see `../tools/pwntools.md` for shim examples).

**Strength**: wire-level ground truth, provided the target honors your proxy or preload.

### Tier 3 — Static extraction cross-checked against a runtime fingerprint

When you cannot send a request at all, cross-check static analysis against what the binary does without the real call:

- the binary builds the request even when sending fails; trace the build step (Tier 1);
- the binary writes a state file or cache; read it;
- the binary emits a version-specific User-Agent; confirm it matches your static extraction;
- `--help` or `--version` reveals build metadata; confirm model lists and feature flags.

**Strength**: disjoint evidence sources confirming the same fact. Two independent partial signals that agree come close to one full observation.

### Tier 4 — Contrastive runtime under different inputs

When you can run input variant A but not B, run A and reason about B from the shared code:

```bash
./target --action=read --resource=local-file   # A: free-tier input, works
# B: the paid inference call is blocked, but the request-building code is shared with A.
# Capture A's logs, then read the B path and confirm only the model/endpoint differs.
```

**Strength**: confirms the shared code path; the gap is only the A-to-B difference.

### Tier 5 — Vendor-published API logs or dashboard

When the operation succeeded earlier (before quota ran out, before access was revoked), the vendor's dashboard or audit log may show the request. Lower fidelity, still observed behavior.

**Strength**: real wire data, usually summarized — token counts and status codes, no payload bodies.

### Tier 6 — Pure code reading with peer review

When none of the above is available, read the code carefully and request one late skeptical review (below). This is the weakest tier; mark its conclusions "unverified" in the journal.

---

## How to combine partial signals

A defensible conclusion prefers two independent signals from different tiers, with one exception: a complete Tier 2 wire-level capture is ground truth and can stand alone for request-shape claims, because the wire bytes are exactly what the remote received. For *behavioral* claims (what the system does next, what state it stores, what side effects it produces), combine it with another signal.

| Available evidence | Defensibility |
|---|---|
| Tier 1 + Tier 1 (same log, different lines) | weak — single source |
| Tier 1 + Tier 2 (debug log + proxy capture) | **strong** — independent confirmation |
| Tier 1 + Tier 3 (debug log + version-output cross-check) | **strong** — disjoint sources |
| Tier 2 alone (full proxy capture) | strong **for request-shape claims only** — add a second signal for response-handling or state claims |
| Tier 3 + Tier 4 (cross-check + contrastive run) | medium — both partial |
| Tier 6 alone (code reading only) | **insufficient** — escalate or mark unverified |

Record in the journal:

```markdown
## Partial runtime evidence
### Question being verified
<the specific claim>

### Available signals
- Tier 1: debug log /tmp/trace.log line 47-49 shows `effort: "high"`
- Tier 3: static extraction of the mode function returns "high" for smart mode
- Tier 6: code path verified by reading the prompt builder

### Independence assessment
Tier 1 and Tier 3 are independent — the log came from a different code path than
the mode function and would diverge if the static reading were wrong.

### Conclusion
VERIFIED via Tier 1 + Tier 3 agreement.
```

When you cannot reach either a complete Tier 2 capture or two independent non-Tier-6 signals, write an explicit note in the deliverable:

> Partial-evidence finding. The full outbound payload stayed out of reach because [reason]. The conclusion rests on [signal A — tier and source] and [signal B — tier and source]. A future verification should attempt [the missing tier] when [condition].

---

## Late skeptical review for non-debug artifacts

The reframing review in `04-oracle-triple.md` is for a stuck root-cause hunt. When the deliverable is an artifact rather than a fix — an extraction, an audit, a binary analysis, or compliance documentation — use one late skeptical reviewer with the deliverable in hand.

### When to invoke

- Right before you declare an extraction or audit task done.
- After every significant revision of the deliverable, not after every small edit.
- Up to 3 or 4 iterations before escalating to the user.

### Review packet

Give the reviewer the verbatim outcome criteria, the deliverable paths and ownership, the evidence already captured, the exact files or commands it may inspect, a read-only constraint, an instruction to find one concrete counterexample or missing requirement, and a ban on enhancements and scope growth. Ask for the strongest concern, its exact supporting evidence, the smallest resolving query, and a pass only when no concrete concern survives.

When `invoke_subagent` can start a read-only reviewer (`TypeName: quality-reviewer`), use it. Otherwise run a separate skeptical pass yourself and write the counterexample before you re-read the optimistic conclusion. Reviewer output is a lead; replay the resolving query.

### How it differs from the debugging reframing

| | Orthogonal reframing (debug) | Late skeptical review (artifact) |
|---|---|---|
| Trigger | 2 failed hypothesis rounds | about to declare "done" |
| Count | 3 orthogonal reasoning passes | 1 focused review |
| Goal | break out of the mental box | catch unsubstantiated claims |
| Tone | brainstorm wide alternatives | skeptical audit |
| Iteration | reset the hypothesis set after | resolve concerns and repeat if needed |

Keep the two apart: three speculative reframings on a finished artifact waste effort, and one late reviewer is no substitute for runtime investigation of a live bug.

---

## Common partial-evidence anti-patterns

| Anti-pattern | Why it fails | Replacement |
|---|---|---|
| "It looks right in the code, so it works" | Tier 6 alone, unverified | add at least one Tier 1-3 signal |
| "I ran it once, it did not error, so it is correct" | absence of error is not presence of correctness | capture the actual output and verify its content |
| "The mock returns the value I wrote, so the code is fine" | a tautology — the mock loops back your assumption | use Tier 2 (proxy), or cross-check with Tier 3 |
| "The dashboard shows my call worked" | it usually shows the status code, not the behavior | combine with Tier 1 when available |
| "I will trust the newest forum answer" | code from a different version or context | verify against the binary you actually have |

---

## Cleanup additions for partial-evidence work

```bash
# Proxy artifacts
pkill -f mitmproxy 2>/dev/null
rm -f ~/.mitmproxy/cache_* 2>/dev/null

# Debug log files
rm -f /tmp/trace.log /tmp/*-debug-trace.log

# DYLD_INSERT / LD_PRELOAD shim libraries
rm -f /tmp/*.dylib /tmp/*.so

# Confirm env vars set in the shell did not persist
unset HTTPS_PROXY APP_DEBUG APP_LOG_LEVEL APP_LOG_FILE 2>/dev/null
```
