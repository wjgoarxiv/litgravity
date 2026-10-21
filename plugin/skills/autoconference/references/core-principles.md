# autoconference: core principles

Twelve principles hold the conference together. The first seven come from the single-lane research loop of the `autoresearch` skill and govern each Researcher's inner loop. The last five belong to the conference layer: what the root does between and around the lanes. Each principle below names the `conference.md` field or file that carries it and what goes wrong when it is dropped.

Read this file when you write `conference.md` (plan mode), when a lane's behavior looks wrong, and when analyze mode explains why a conference under-delivered. For the inner-loop principles in full, read the `autoresearch` skill: its `SKILL.md` sits next to this skill's folder, at `../autoresearch/SKILL.md` from the skill root, and agy reads it with `read_file` (older builds: `view_file`).

## Part 1: inner-loop principles (each Researcher)

| # | Principle | What it asks | Where it lives |
| --- | --- | --- | --- |
| 1 | One metric | Optimize one measurable quantity with one direction. Secondary concerns become constraints. | `## Success Metric` |
| 2 | Mechanical verification | A command computes the metric, with no human judgment. Relaxed in qualitative mode, where principle 9 carries the weight. | the evaluator command and its dry run |
| 3 | One change per iteration | A single change per iteration, so a gain or loss has one cause. | the Researcher prompt, iteration step 3 |
| 4 | Keep or undo | Better by more than the noise floor: keep. Anything else: undo at once. | `status` column of `researcher_<ID>_results.tsv` |
| 5 | Full history | Every attempt is recorded, failures included; a failed idea narrows the space for every lane. | per-lane log and TSV, append-only |
| 6 | Bounded search | Allowed and forbidden changes are written down; the evaluator and its data are always forbidden. | `## Search Space` |
| 7 | Unattended inside the budget | The loop runs without asking the user, inside the approved budget and authority, and stops at their edge. | `## Constraints`, `pause_every` |

### How the conference tightens them

- **One metric** across lanes: every lane optimizes the same metric with the same evaluator. A lane that "improves" a different number has left the conference.
- **Mechanical verification** gets a second check: a metric claim enters Shared Knowledge only with a re-measurement receipt from a separate `qa-runner` lane, or with an evaluator log the Reviewer could read from the lane's own worktree.
- **Bounded search** also covers lanes: in `assigned` partitioning each lane's focus is written into its prompt, so two lanes do not spend a round on the same idea.
- **Unattended inside the budget** means the root runs every phase of every round without asking "shall I continue". The questions it does ask are the start gate, the `pause_every` pauses, worktree disposition and any change to scope or budget.

## Part 2: conference principles (the root)

| # | Principle | What it asks | Where it lives |
| --- | --- | --- | --- |
| 8 | Knowledge transfer | Validated findings reach every lane before the next round. | `## Shared Knowledge` in `conference.md`; the next Researcher prompts |
| 9 | Adversarial review | A separate child challenges every claim before it spreads. | `peer_review_round_<N>.md` |
| 10 | Synthesis over selection | The result combines what survived from every lane. | `synthesis.md` |
| 11 | Persistence inside a fixed budget | The conference spends its approved budget unless an end condition fires, and stops at the budget. | `## Constraints`, the budget counters in each `round.completed` |
| 12 | Root ownership | The root alone writes shared state, relays between lanes and talks to the user; children report. | the delegation map, the events log |

### 8. Knowledge transfer

- **Why it matters.** Lanes cannot see each other in agy; a child knows only its prompt and the files its agent type may read. Without transfer, three lanes rediscover each other's dead ends, and the conference costs three times a single loop while learning what one loop would.
- **What breaks without it.** N independent loops with a poster session nobody uses. The review overhead buys nothing.
- **How it is done.** After Phase 4, each validated finding becomes one sentence in Shared Knowledge with its round, lane and evidence path. The next Researcher prompts carry the list. Challenged findings wait for a later review.
- **Example.** Researcher A finds in round 1 that a connection pool above 64 entries makes the p95 latency worse under the benchmark load. Shared Knowledge carries "Pool sizes above 64 raise p95 (A, r1, receipt r1-a3)". In round 2 Researcher B skips pool sizing and spends its iterations on query batching.

### 9. Adversarial review

- **Why it matters.** A lane that judges its own work leans toward seeing progress (Goodhart's law: once a measure becomes the target, it stops measuring well). A separate reviewer with no stake in the result, explicit instructions to doubt, and its own measurement receipt catches noise, overfitting and unfair comparisons.
- **What breaks without it.** Noise is reported as signal, an overfit change spreads to every lane through Shared Knowledge, and every later round builds on it.
- **How it is done.** One `quality-reviewer` child per round, read-only, typed so that it cannot edit what it judges. A `qa-runner` child reruns the evaluator for metric claims. Uncertain claims are `challenged`.
- **Example.** Researcher C reports a 3 percent accuracy gain. The re-measurement lane runs the evaluator three times at the same commit and gets gains of 0.4, 2.9 and -0.6 percent; the measured noise floor is 1.5 percent. The Reviewer marks the claim `challenged`, and it stays out of Shared Knowledge.
- **In qualitative mode** this principle carries more weight: self-scores are the only inner-loop signal, so the Reviewer's score is the conference's only real measurement.

### 10. Synthesis over selection

- **Why it matters.** Lanes work different parts of the space and learn different things. Naming one winning lane throws away most of the work.
- **What breaks without it.** The conference becomes an expensive way to run one loop.
- **How it is done.** One `lit-planner` child reads every round artifact and returns a synthesis that stacks independent findings, explains failures by other lanes' successes, and lists open dissent. Where two findings were never measured together, the synthesis says so, and in metric mode the root may run the combined configuration once on `conference/best` before the final report.
- **Example.** Researcher A's best change is a new index; Researcher B's is a cache warm-up. Neither tested the other's. The synthesis names them as independent, the root measures both together, and the combined result beats both single lanes.

### 11. Persistence inside a fixed budget

- **Why it matters.** Most of a conference's value appears in round 2 and later, when transferred findings meet other lanes' strategies. A conference that stops after round 1 because the numbers look acceptable has paid the setup cost and skipped the part that pays back.
- **What breaks without it.** Isolated round-1 results and a synthesis with nothing to combine.
- **How it is done.** The root advances rounds on its own, checks the end conditions after every round, and spends the budget unless one fires. The same principle sets the far edge: the budget approved at the start gate is the limit, and a promising idea in the last round goes into the final report's next steps.
- **Example.** Three lanes, three rounds. Round 1 finds three local optima. Round 2 transfers them and two lanes build hybrids. Round 3 refines the hybrids and the synthesis combines them. A stop after round 1 would have reported three separate local optima.

### 12. Root ownership

- **Why it matters.** In agy the root is the only participant that sees every report, holds the conversation with the user, and can start or message children. Shared files written by several children race, and a child cannot know which findings were validated.
- **What breaks without it.** Two lanes overwrite `conference_results.tsv`, a lane appends an unreviewed claim to Shared Knowledge, or the events log loses ordering, and resume can no longer find where the conference stopped.
- **How it is done.** Read-only children return content in their `send_message` report and the root writes it. Write-capable `lit-executor` lanes write only inside their own worktree or named files. Children start no children and ask the user nothing. Every write the root makes is reflected in an event.

## Mapping principles to `conference.md`

| Principle | Section or file | Enforced by |
| --- | --- | --- |
| One metric | `## Success Metric` | the template asks for one name, one direction, one target |
| Mechanical verification | evaluator command, noise floor | the start-gate dry run and the re-measurement lane |
| One change per iteration | Researcher prompt | the inner-loop text and the Reviewer's logic check |
| Keep or undo | lane TSV `status` | one row per iteration, `kept` or `reverted` |
| Full history | lane log and TSV | append-only; the root never deletes rows |
| Bounded search | `## Search Space` | prompts carry the lists verbatim; the Reviewer checks diffs |
| Unattended inside the budget | `## Constraints` | `pause_every`, the budget table |
| Knowledge transfer | `## Shared Knowledge` | Phase 4 |
| Adversarial review | `peer_review_round_<N>.md` | Phase 3, every round |
| Synthesis over selection | `synthesis.md` | the synthesis step |
| Persistence inside a fixed budget | `## Constraints`, budget counters | the convergence order and the accounting rules |
| Root ownership | delegation map, events log | typed agents and the report envelope |

## When principles pull against each other

- **Persistence against a clear plateau.** The plateau rule wins; spending budget past a confirmed plateau buys nothing. Record the call.
- **Knowledge transfer against diversity.** Transfer can pull every lane toward one idea. Keep `assigned` focuses unchanged when a finding transfers, and keep the Devil's Advocate on the opposite side of the consensus.
- **Unattended running against a needed decision.** A decision outside the approved scope (a forbidden path that blocks progress, a budget raise) waits for the user. The root records a `PAUSED at row N:` note and asks with `ask_question`; headless, it continues inside the old scope and lists the decision as the required action.
- **Synthesis against honesty.** A combination that was never measured together is presented as a hypothesis with its source findings, and the final report keeps measured and unmeasured results apart.
