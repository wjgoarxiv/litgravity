# Mode plan: the research setup wizard

A seven-step interview that ends in a complete proposed `research.md`, an optional evaluator draft and an approval packet. The mode writes no file, runs no evaluator and starts no loop. Every proposed write and command is handed to the approved run (`start-work`, or this conversation once the user approves the packet).

The one exception to "writes nothing" is the plan file itself when `lit-plan` is the host route: `lit-plan` owns `plans/<slug>.md`, and this mode supplies the research section for it.

## Authority envelope

This file is guidance data. `lit-plan` (or the user through `ask_question`) records the objective, evaluator, finite budget, roots, proposed write set, rollback lane and review gate. This mode stays read-only throughout: `read_file`, `rg` through `run_command` when permitted, and public-source reads with `search_web` and `read_url_content` when the user wants references.

`scripts/init_research.py` produces an INCOMPLETE scaffold with labeled placeholders for the baseline, the current approach, the search space and the references. This mode may propose running it; the approved run executes it, fills the placeholders, validates the fields and records the baseline before any experiment.

## Wizard rules

One step at a time. Show the step title and its questions, wait for the answer, then echo what you recorded ("Recorded: metric accuracy, direction maximize") and move on. Each step produces fields that Step 7 needs. When an answer is vague, probe once; then record your best reading and mark it `assumption`.

In a headless run `ask_question` has no one to answer. The wizard then fills each field with its recommended default, marks every one `assumption`, and ends the packet with `BLOCKED: needs the user's approval` instead of an approval request.

## Step 1: goal

Ask:

1. What are you trying to improve or find out?
2. What does success look like as a number or an observable outcome?
3. What must this work leave intact?

Probes: "better", "faster" or "improve" with no reference point gets "compared with what baseline?"; no named system gets "which file, model, prompt or service?"; several goals get "if only one could be reached, which one?".

Record `goal_statement`: one or two sentences, specific and measurable.

## Step 2: metric

Ask:

1. Which single number decides whether an experiment helped?
2. Maximize or minimize?
3. Which value means "done"? That is the target.
4. Does the number vary between identical runs?

Hints when the user is stuck: performance uses latency (ms), throughput (req/s) or memory (MB), minimized; quality uses accuracy, F1 or a judge score, maximized; cost uses tokens, money or lines, minimized.

Record `metric_name`, `direction`, `target_value`, `noise_runs` (1 when deterministic, 3 to 5 when noisy).

## Step 3: search space

Ask:

1. Which files, parameters, configs or components may change?
2. Which must stay fixed: test sets, public APIs, data formats, production files?
3. Any hard limits that hold even when the metric improves (latency under 2 s, memory under 1 GB)?

Probes: a very broad scope gets "can it be narrower? broad spaces burn iterations"; a missing forbidden list gets an explicit confirmation of the free rein the user is granting.

Record `allowed_changes`, `forbidden_changes`, `guard`.

## Step 4: constraints and budget

Ask:

1. How many iterations? (recommended 20)
2. Unattended, or a review pause every N iterations?
3. Time per experiment, total wall clock, and resource limits: memory, rate limits, money.
4. Does any step call a model (an `agy -p` evaluator, a judge prompt, child agents)? If so, how many calls in total?

An unattended run needs a finite wall-clock limit and iteration count before `pause_every: never` is recorded. agy runs it as a long foreground loop; progress is read from `.litgravity/evidence/<slug>/autoresearch/` and the ledger. A model-calling step with no cap leaves the budget incomplete.

Record `max_iterations`, `pause_every`, `time_budget_per_experiment` (recommended 5 minutes), `wall_clock_limit`, `model_call_cap`, other limits.

## Step 5: evaluator

Ask whether a script can measure the metric, for example `python3 evaluate.py` printing a number.

**With automation**, help the user design an evaluator that prints one JSON line, `{"pass": true, "score": 0.94}`. Ask where the benchmark data lives, which command runs the current implementation, and how the score is extracted. Offer a starter as proposal text; the packet names its intended path, interpreter, inputs, expected output, timeout and root, and the approved run writes it.

Timing starter (minimize, so the score is negated):

```python
#!/usr/bin/env python3
import json, statistics, subprocess, time
TARGET_SECONDS = 0.5  # from Step 2
runs = []
for _ in range(3):
    start = time.perf_counter()
    subprocess.run(["python3", "<target_script>.py"], check=True)
    runs.append(time.perf_counter() - start)
median = statistics.median(runs)
print(json.dumps({"pass": median < TARGET_SECONDS, "score": -median, "metric": median}))
```

Quality starter (maximize):

```python
#!/usr/bin/env python3
import json, subprocess
TARGET = 0.9  # from Step 2
out = subprocess.run(["python3", "<test_suite>.py"], capture_output=True, text=True, check=False)
score = float(out.stdout.rsplit("score:", 1)[-1].split()[0])
print(json.dumps({"pass": score >= TARGET, "score": score}))
```

Ask for the keep policy: `score_improvement` (keep only a strict gain over the best kept score) or `pass_only` (keep anything that passes).

**Without automation**, record `Evaluator: none (agent judges)` and tell the user the loop will be slower and its evidence weaker; suggest adding a script later.

Record `evaluator_command` (or `none`), `keep_policy`.

## Step 6: baseline gate

Specify the baseline; running it belongs to the approved run. Put this in the packet:

```bash
# baseline for the approved run, under the deadline helper
python3 scripts/run_with_deadline.py 300 -- python3 evaluate.py
```

Expected: one JSON line such as `{"pass": true, "score": 0.73}`.

Acceptance for the approved run: exit 0 and a schema-valid line record iteration 0 and allow the setup writes. A non-zero exit, a timeout, invalid JSON or a crash stops before any setup write with a BLOCKED receipt; fixing the evaluator means a revised packet and a new approval. A baseline the user measured earlier is labeled with its source and confirmed by the approved run.

With a manual evaluator, ask the user for the current value and record it as a user-supplied baseline, marked weaker evidence.

Record `baseline_score` or `baseline_source`.

## Step 7: proposal and approval packet

Render the full proposed `research.md` in the reply (or in the research section of `plans/<slug>.md` when `lit-plan` hosts this) and ask for approval. Writing it waits for the approved run.

When the helper is chosen, propose this action for the approved run:

```bash
python3 scripts/init_research.py \
  --goal "<goal_statement>" \
  --metric "<metric_name>" \
  --direction <maximize|minimize> \
  --target "<target_value>" \
  --evaluator "<evaluator_command>" \
  --max-iterations <max_iterations> \
  --output .litgravity/evidence/<slug>/autoresearch/
```

Otherwise propose the content from `assets/research_template.md` with every field filled.

The packet lists:

1. The intended paths: `research.md`, the evaluator file when one is drafted, and the result files under `.litgravity/evidence/<slug>/autoresearch/`.
2. The baseline command, its expected output and timeout, the write set, the forbidden paths, the finite budget with its model-call cap, the rollback lane, the stale-state rule and the cancellation rule.
3. When the helper is used, every placeholder it leaves and the requirement that the approved run fills and validates each before the baseline. A zero exit from the helper proves only that the scaffold exists.
4. The approval question, through `ask_question`, with "approve as shown" as the recommended option.

After approval, the reply ends with the hand-off: "Approved. Run `start-work` on `plans/<slug>.md` (or say `go` to run it here) to execute the baseline gate, write the files and begin the bounded loop. `scripts/check_progress.sh .litgravity/evidence/<slug>/autoresearch/` shows progress." Suggest mode `ship` for the readiness review after the loop finishes.

## Output checklist

- [ ] The proposed `research.md` has every section filled; no `TBD` or `TODO` remains.
- [ ] The baseline source is named, and its mechanical confirmation is listed as a gate for the approved run.
- [ ] The evaluator draft and its acceptance contract are present when automation was chosen.
- [ ] The packet names exact writes, commands, roots, budget, model-call cap, rollback lane and stop rules.
- [ ] Nothing was written or executed by this mode beyond `plans/<slug>.md` under `lit-plan`.
- [ ] A `decision` ledger line records the approval, or a `note` line records `BLOCKED: needs the user's approval`.

## Worked packet, in brief

```text
Goal: cut the median parse time of fixtures/sample.csv below 0.5 s without changing the output.
Metric: parse_seconds, minimize, target < 0.5, noise_runs 3, min_delta 0.02.
Search space: src/parser/*.py may change; tests/, fixtures/ and evaluate.py are frozen.
Guard: python3 -m pytest -q passes; output digest equals the baseline digest.
Budget: 15 iterations, 60 min wall clock, 120 s per evaluator run, 0 model calls.
Rollback lane: scratch branch autoresearch/csv-parse-speed.
Baseline gate: python3 scripts/run_with_deadline.py 120 -- python3 evaluate.py
Writes: .litgravity/evidence/csv-parse-speed/autoresearch/*, src/parser/*.py on the scratch branch.
Stops: target met, budget spent, two failed pivots, user stop, any guard failure that cannot be isolated.
```

## Cancel and resume

The wizard keeps its recorded fields in the reply as it goes. When the user stops partway, the reply lists the fields recorded so far and the next step. A later `autoresearch plan` picks up from the first step without a recorded field, after echoing the earlier answers back for confirmation.
