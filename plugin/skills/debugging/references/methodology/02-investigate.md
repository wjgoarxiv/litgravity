# Phase 2 + 3 — Hypothesis Formation and Parallel Investigation

One hypothesis is a hunch. Three hypotheses is a decision. Investigation turns the decision into runtime evidence.

---

## Phase 2 — Hypothesis Formation (at least three)

### Why three, rather than one

A single hypothesis breeds confirmation bias: you read runtime state looking for what confirms it and quietly discount the contradictions. Three hypotheses force you to design queries that *distinguish* between them, and that is the only way runtime evidence becomes decisive.

### Generate across orthogonal axes

If all three hypotheses are variations of "the handler has a bug", you have one hypothesis wearing three hats. Span the space:

| Axis | Example framing |
|---|---|
| **User-code logic** | "The handler early-returns because condition X is unexpectedly true." |
| **Library/SDK behavior** | "The third-party client swallows the error and returns a stub." |
| **Environment/config** | "The env var is read at module-load time before it is populated, so it is empty." |
| **Async/timing** | "The promise rejects (or the goroutine panics) after the response is already sent." |
| **Silent side-effect** | "An earlier turn mutated shared state that the current turn inherits." |
| **Observability gap** | "The error is raised but suppressed before logging; it exists only as an unawaited rejection or an ignored signal." |
| **Binary-level** (when it applies) | "The function we think is running is jumped over by a patched thunk, or a different version is loaded." |
| **Build-vs-runtime** | "The code we read is not the code that runs: a stale build, a wrong symlink, a cached wheel, or `dist/` ahead of `src/`." |

### For each hypothesis, write in the journal

1. **Claim** — one sentence.
2. **Distinguishing evidence** — the exact value or state that confirms or refutes it, and where to read it (file:line, log source, breakpoint location, memory address).
3. **If true, the fix is** — two words. This forces you to weigh fix cost before committing to the hunt.

### Collapse rule

When two hypotheses share identical distinguishing evidence, they are one hypothesis: collapse them and find a real alternative. When you cannot produce a third distinct hypothesis, you understand the system too little to investigate yet. Read a little more code first.

---

## Phase 3 — Independent Investigation Lanes

Parallelism helps only when the evidence sources avoid contending for the same process, port, fixture, or editable file. Start by writing a lane table in the journal:

| Lane | Hypothesis | Read-only target | Decisive observation | Shared resource |
|---|---|---|---|---|
| Runtime | H1 | live process state | the exact value at the branch | process id |
| Trace | H2 | logs and spans | ordered timestamped events | log directory |
| Reproduction | H3 | an isolated invocation | input plus observed output | temp directory |

Keep two debugger attaches to one process, two writers to one trace file, or two instrumentation edits to the same source in separate sequential lanes, even when `invoke_subagent` is available.

### With `invoke_subagent`

Give each genuinely independent lane one read-only child. Set `TypeName` to `librarian-researcher` for docs or `quality-reviewer` for code reading; a child with no `TypeName` is a general-purpose agent holding every write tool. Give every explorer a self-contained assignment:

- the symptom and the exact reproduction command;
- one hypothesis only;
- the file, process, log, or address it may inspect;
- the value that would confirm or refute the hypothesis;
- a ban on source edits and Git mutations;
- the report shape you want back: commands, exit codes, raw observations, and uncertainty.

The coordinating agent stays responsible for the journal and the verdict. There is no wait-or-read-result tool in agy: the child sends a message when it finishes, so keep the root work moving and read the message when it arrives. A child report is a lead, not evidence: replay the decisive command or inspect the cited artifact before you change a hypothesis status. When a lane needs instrumentation, stop that lane, journal the proposed edit, and let one owner make the smallest reversible change.

Good lane roles are runtime-state inspection, trace correlation, and reproduction minimization. More roles rarely add independence; three strong evidence streams beat many agents reading the same code.

### Without child agents

Run the same lanes in sequence. Keep the lane table and run the cheapest falsification query first. A missing delegation surface changes the scheduling, and the rigor stays:

1. capture the baseline reproduction;
2. read the runtime value most likely to split the hypothesis set;
3. correlate logs against that run;
4. update every hypothesis status before you start another round.

### Lane completion and failure modes

A lane is complete only when it returns one of these:

- **confirmed** — the raw evidence matches the predeclared confirming value;
- **refuted** — the raw evidence contradicts the claim;
- **inconclusive** — the evidence source was reached but cannot distinguish the hypotheses;
- **blocked** — a named capability, permission, credential, or live resource is unavailable.

A timeout is not a refutation. Empty output is evidence only after you confirm the command targeted the right process, file, time range, and build. When two lanes disagree, keep both artifacts and run a single query designed to split them; averaging the conclusions hides the real one.

---

## Evidence capture discipline (both paths)

For every piece of runtime state you capture, record in the journal:

```markdown
### <ISO timestamp> — <what you looked at>
- Source: <file:line | log source | the command you ran | breakpoint address>
- Value: `<verbatim>`
- Interpretation: <one line — why this matters>
- Refutes/Confirms: H<n>
```

**Verbatim values only.** `messages.length=0` is evidence. "messages seemed empty" is a memory of an observation, and a memory of an observation is where debug sessions go to die. When you catch yourself about to paraphrase, go back and copy the raw value.

---

## Round completion

A round is complete when every hypothesis has confirming or refuting evidence, or when you have exhausted the available evidence sources with no decisive result. An inconclusive round counts as a failed round for the counter in the journal. At two consecutive failed rounds, go to `04-oracle-triple.md`.
