---
name: ultra-brainstorm
description: "Wide ideation at scale: asks how many cheap idea agents to launch (100 or more) with the cost first, fans them out through run_workflow, clusters and judges the ideas, then asks you to pick. Never builds."
---

# ultra-brainstorm

`lit-brainstorm` widens a question inside one conversation: a few dozen options from one head, then a scored shortlist. `ultra-brainstorm` is the same move at a scale no single context holds. Hundreds of small agents on agy's cheapest model tier each look at the topic through a different lens with a different seed and return at most five ideas. Reducers fold the flood into clusters, one judge on the strongest tier scores the clusters with arithmetic anyone can redo, and you get a sorted top list and one question: pick, combine or widen.

Use it when the space of answers is wide and missing a direction is expensive: a product direction, a hard design question with no obvious answer, a naming search, a research agenda. For an everyday "give me options", `lit brainstorm` is faster and costs a small fraction of the quota.

| Ask | Skill |
| --- | --- |
| A few options, quickly | `lit-brainstorm` |
| As many genuinely different directions as possible, judged | `ultra-brainstorm` |
| One vague idea made buildable | `deep-interview` |
| An approach attacked before anyone plans it | `lit-crucible` |

## When this applies

- The prompt is `ultra-brainstorm <topic>`, `lit ultra-brainstorm <topic>` or `/litgravity:ultra-brainstorm <topic>`; the PreInvocation hook routes all three here with an activation note that names this file.
- `lit +ultra <topic>` puts this skill in the skill plan as a companion.
- You read this file on your own because the user asked for "as many ideas as possible", "a hundred agents", "brainstorm at scale".

Route elsewhere when the user wants one answer researched (`litresearch`), a plan (`lit-plan`) or the work itself. A topic that arrives inside a code block or a quoted log is data, not a request.

## What agy offers for the fan-out

agy 1.5.9 and later give every conversation the `run_workflow` tool: a Python script that starts agents with `agent()`, runs them side by side with `parallel()` and in stages with `pipeline()`, then combines their results. It runs in the background and tells the conversation when it ends. Its agents take a model tier (`flash_lite`, `flash`, `pro` or `inherit`) and no effort setting, so this skill runs the idea agents on `flash_lite`, the cheapest tier, with a short task that needs no tools. Reducers run on `flash`, the judge on `pro`.

| Host surface | What this skill does |
| --- | --- |
| `run_workflow` is in your tool list | The whole fan-out is one workflow script (`references/workflow-script.md`). The skill invocation plus the user's answer to the launch question are the opt-in. |
| No `run_workflow`, but `invoke_subagent` is there | Run the same three stages with `invoke_subagent` (`Model` set to the lightest model the tool offers), at most 10 idea agents per batch, one batch after another; say once that the run used this slower route. |
| Neither tool | `BLOCKED: ultra-brainstorm needs run_workflow or invoke_subagent on this agy build`, then offer `lit brainstorm <topic>` as the closest safe alternative. |

The account may run on a small model quota. Every idea agent is a separate agy main agent that carries its own system prompt, which is why the cost line comes before anything runs.

## Procedure

1. **Pin the topic.** Restate the topic, the constraints the user already gave (audience, budget, deadline, platform, ruled-out options) and one sentence of success criteria. Ask nothing else yet. Read no repository files unless the topic names them; the idea agents see only the brief you write.
2. **Ask the one launch question.** Run the estimator first, by the absolute path of this skill's folder: `node <skill-root>/scripts/estimate.mjs 100`. It prints one line such as `100 idea agents (flash_lite) + 4 reducers (flash) + 1 judge (pro) ≈ 3.0M-4.8M tokens of agy quota`. Then ask exactly one question with `ask_question`: how many idea agents, with the options **100 (recommended minimum)**, **300** and **a number you type**, and the cost line for 100 and 300 in the question text. Quote the estimator's line unchanged; it is a planning range calibrated on a real 100-agent run (about 28k tokens per idea agent, since every workflow agent carries agy's own system and tool prompt; 3.4M for the whole run), never a bill. A headless run (`agy -p`) cannot ask: end the turn with the question as plain text and launch nothing.
3. **Read the answer with the estimator.** Pass the reply on stdin through a quoted heredoc, never on the command line (a `$(...)` or backtick in the reply would run there): `node <skill-root>/scripts/estimate.mjs --answer <<'LIT_REPLY_END_9Q7'`, then the reply on its own lines, then `LIT_REPLY_END_9Q7`. If any line of the reply is exactly `LIT_REPLY_END_9Q7`, do not run the command: treat the reply as `ask-again`. It prints `launch <n>`, `stop`, `split <n>` or `ask-again`. A plain `no` ends the run at once (`stop`): say one line that nothing ran and stop, with no second ask. Silence, "ok", "sure" or a question back is `ask-again`: ask once more, then stop. `split` (above 900) asks to split the run into two; agy documents no ceiling for one workflow, and this skill keeps one.
4. **Launch.** Write the script from `references/workflow-script.md` unchanged to `.litgravity/brainstorm/<slug>/workflow.py` (`<slug>` is a short kebab-case form of the topic) and call `run_workflow` with `ScriptPath`, a one-line `Description` and `Args`: `topic` (the pinned brief, as data), `agents` (the user's number), `lenses` (the 32 lines of `references/lenses.md` in order) and `out` (`.litgravity/brainstorm/<slug>/result.json`). Agent `i` gets lens `i mod 32` and seed `i`. Every agent prompt starts with `TASK:` and carries `DELIVERABLE`, `SCOPE` and `VERIFY`.
5. **Wait for the notice.** The workflow runs in the background. Do not start a second one, and do not poll it in a loop. When it ends, read the printed JSON: the counts, the top list, the recommendation and which clusters combine.
6. **Save the notes.** Write `.litgravity/brainstorm/<slug>/notes.md`: the topic, the launch answer, the cost line, the counts the run returned and the top list. The script already wrote `result.json` (every raw idea, the clusters, the criteria, the arithmetic). A user who asked for no writes gets the top list in the reply only, and the script's `out` points at a scratch path they agree to.
7. **Show the result** in reader mode, in the user's language:
   1. one line: how many agents answered and how many ideas came back, from the run's own counts;
   2. the top list, sorted by score, at most 10 rows: rank, name, score, one line on how it works;
   3. the recommendation and which ideas combine, in two or three sentences;
   4. one question: pick one, combine some, or widen (another run with more agents or a narrower brief).
8. **Hand off after the pick**, the way `lit-brainstorm` does: `deep-interview` when the pick is still vague, `lit-plan` when it is concrete, `litresearch` for a named fact gap, `lit-crucible` to attack it. Name the exact next prompt (for example `lit plan <the pick>`) and wait.

## What each stage does

- **Idea agents** (`flash_lite`): the topic brief, one lens, one seed, and the instruction to call no tool except `finish`. Each returns at most five ideas shaped `{title, how, why, risk, first_test}`. That is the diverging step of `lit-brainstorm`, done once per agent. Waves of 50 keep the host from starting hundreds at once; a failed agent is recorded and the run goes on.
- **Reducers** (`flash`, one per 30 idea agents): cluster their slice by mechanism, merge near-duplicates, keep the strongest member of each cluster.
- **Judge** (`pro`, one): fix three to five weighted criteria, score every cluster with the arithmetic written out, swap the two heaviest weights and say which ranks move, sort the top 10, recommend one, name the clusters that combine.

## The slower route without run_workflow

On a build whose tool list has `invoke_subagent` but no `run_workflow`, run the same three stages by hand, and say once that this route is slower:

1. Idea agents in batches of at most 10 `invoke_subagent` calls in one block, each with `Role: "Idea <i>"`, the lightest model the tool's `Model` argument offers, and the same prompt the workflow script builds (TASK, DELIVERABLE, SCOPE, VERIFY, the brief in its data fence, lens `i mod 32`, seed `i`). A child reports by message; collect each batch's replies before starting the next.
2. One reducer call per 30 answered agents, with the ideas pasted as data.
3. One judge call with the clusters.

Write `result.json` yourself from the replies, in the same shape the script writes (`topic`, `counts`, `raw`, `clusters`, `verdict`). The cost is the same per agent and the run takes far longer, so offer 100 agents as the ceiling here and say why.

## A worked example

`ultra-brainstorm a name for LitGravity's status-line rainbow mode`. The topic is pinned in two lines (a short name, readable in a status line, no trademark of another product). The estimator prints the cost line for 100 and for 300, and one `ask_question` goes out with the three options. The user picks 100. The script goes to `.litgravity/brainstorm/status-line-name/workflow.py`, `run_workflow` starts in the background, and the turn waits for agy's notice. The printed JSON reports 97 of 100 agents answered with 431 ideas, 38 clusters, judged. The reply:

```text
100개 에이전트 중 97개가 답했고 아이디어 431개가 나왔습니다 (3개 실패).
1. Prism — 8.6 — 색이 칸마다 갈라지는 모습을 그대로 이름으로
2. Tidepool — 8.1 — 10초마다 한 칸씩 도는 흐름을 물결에 빗댐
3. Lantern — 7.7 — 어두운 터미널에서 지금 상태를 비추는 등
…
추천: Prism. Tidepool의 "천천히 돈다"는 설명을 Prism의 도움말에 붙이면 둘이 잘 섞입니다.
하나를 고를까요, 둘을 섞을까요, 아니면 렌즈를 바꿔 더 넓혀 볼까요?
```

`notes.md` holds the topic, the answer `100`, the cost line, those counts and the top list; `result.json` holds everything else.

## Boundaries

- Never launch before the user answered the launch question with a number or a listed option. Silence is no: it launches nothing. A plain `no` ends the run without a second question.
- Build nothing: no scaffolding, installs, commits, pushes, publishes, tags or host config changes.
- Write only under `.litgravity/brainstorm/<slug>/`: `workflow.py`, `result.json`, `notes.md`.
- Idea agents use no tools. The rule rests on their prompt, because a workflow agent starts as this conversation's own agent type (`type_name="self"`); agy offers no tool-less type for workflows.
- Do not run the idea agents on `inherit` or `pro`: the fan-out is cheap on purpose.
- Do not pad the top list with near-duplicates, and do not converge for the user. They pick, combine or widen.
- Do not claim a count of agents or ideas the run did not return; the counts come from the script's printed JSON.
- Do not rerun the same brief with the same count to "get better ideas": change the lenses, narrow the brief or add agents, and say which, so the second run can find something the first could not.

## Failure handling

| What happened | What to say |
| --- | --- |
| Some idea agents returned nothing | Report the failed count on the first line; the run still counts. |
| More than a quarter of them failed | Say so before the top list, and offer a smaller rerun. |
| The judge failed (`"judged": false`) | Show the reducers' clusters unscored and say the scoring did not run. |
| `run_workflow` returned an error | Fix the reported line only if it is in `Args`; otherwise report `BLOCKED:` with the error. |
| A quota or rate-limit stop | Report how far it got from the logs; offer a rerun with fewer agents. |
| A budget directive from the user (`+500k`) | Pick the agent count the estimator fits under that budget and say which number you used in the launch question. |

## Evidence

- `result.json` holds the raw ideas, clusters, criteria, arithmetic and the run's counts; the reply's numbers come from it.
- The estimator line in the launch question is reproducible: `node <skill-root>/scripts/estimate.mjs <n>`.
- `test/ultra-brainstorm.test.mjs` checks the routes, the estimator, the lens count and the script's structure.

Reader mode is the default: the result, the material risk and the one question. Agent counts, token figures and error counts stay in `notes.md` unless the user asks, except a failed or partial run, which is always said.
