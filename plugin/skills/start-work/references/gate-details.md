# Gate details

The per-row loop in `SKILL.md` is `PIN -> RED -> GREEN -> SURFACE -> CLEAN -> VERIFY -> TICK -> RECORD`. This file holds the detail behind each gate: how to produce a failing proof for each kind of row, which channel proves which surface, which adversarial classes to probe and how cleanup receipts look.

## Gate B: producing a failing proof for each kind of row

| Row kind | Failing proof | Notes |
| --- | --- | --- |
| Behavior change in code | A characterization test pinning today's behavior (green on unchanged code), then the new test (red for the described reason) | Save `task-N-pin.log` and `task-N-red.log`. The red must be an assertion about the missing behavior. A syntax error, an import failure or a crash before the assertion fails that test. |
| New behavior with no test seam (script entry point, config, prose-adjacent) | The row's QA scenario captured failing, or a scripted check `check-N.sh` under the evidence folder that exits non-zero | The script prints the observation it checks so the log reads on its own. |
| Test-only row (coverage for behavior that already works) | A mutation proof: force the exact regression the assertion names, capture the assertion failing, revert the mutation, capture green | The mutation is temporary and never committed. An assertion that survives its own mutation adds no coverage. |
| Prose row (skill, command doc, README) | Pin a machine-consumed value: a parsed field, a token a hook or scanner reads, a JSON sample run through its real validator, a copy-equality check | Pure wording ships on review and a read-through, because wording is not behavior. |
| Config or manifest row | The validator for that file: `agy plugin validate plugin --json --strict` for a plugin, a JSON or YAML parse, the repository's version-lockstep check | Capture the validator output before the edit when it passes, then after. |
| Script row | `node --check <file>` plus a run of the script with a literal input and a failure-path input | The failure-path run proves the script validates its input. |

Tests that cannot fail for the regression they name provide no evidence: mock-call assertions, pinned constants, a fixture equal to the default it overrides, an expected value derived from the output under test.

## Gate C: diagnostics for every modified file

agy has no language-server tool. The repository's own checkers stand in, and `lsp` (checker CLIs) applies when installed:

- typecheck and lint commands from the manifest scripts;
- `node --check <file>` for scripts;
- a parse for JSON, YAML and TOML;
- `agy plugin validate plugin --json --strict` for a plugin bundle (free, offline);
- the repository's legacy-token or forbidden-word scanner after prose changes.

Zero new errors is the bar. Warnings that predate the run stay. A GREEN far larger than the row implies means the proof was too coarse, so split the row through the amendment steps.

When a row builds or restyles an interface and `frontend-ui-ux` is installed, validate its design contract before broad implementation and hand viewport checks to `visual-qa`.

## Gate D: the channel for each surface

| Surface | Drive it with | Artifact |
| --- | --- | --- |
| CLI or script | the real command with literal arguments | transcript with the exit code |
| HTTP service | `curl -i` against the live endpoint | response head and body, server log tail |
| Terminal UI | a `tmux` session with `send-keys` and `capture-pane` | pane capture; a screenshot for colour or CJK layout |
| Browser UI | `visual-qa` (several widths, states, screenshots) or `browser-drive` | screenshots and a state list |
| agy-facing behavior | `agy -p "<prompt>" --output-format json --print-timeout 170s < /dev/null` | the JSON result; one call per scenario, within the plan's quota line |
| agy plugin load | `agy -p "/hooks"`, `"/skills"`, `"/agents"` (free listings) and `agy plugin validate` | the listing text |
| Package or installer | `npm pack`, then install the tarball into a temp folder and run from there | pack listing and the run transcript |
| Data or migration | before and after state diff, invariants, rollback check | the diff and the invariant output |

A browser criterion is never downgraded to a string assertion on rendered HTML, and a GUI criterion is never discharged by a command-line dump. A surface that cannot be reached is `BLOCKED` for that row with the missing capability named. A headless run ends with no output when `run_command` is refused, so state in the row what permission the channel needs.

## Adversarial classes

Probe each class whose trigger holds. Record a one-line reason for the others.

| Class | Trigger | Probe |
| --- | --- | --- |
| malformed input | a new parser, flag or schema | truncated, wrong-type, empty and oversized input |
| prompt injection | untrusted external text reaches the model or a command | an instruction-shaped fixture is parsed as content and changes nothing |
| cancel and resume | long-running or resumable flows | interrupt mid-task, rerun, state stays consistent |
| stale state | generated or cached artifacts, digests, packed archives | run against an artifact left by an earlier run |
| dirty worktree | uncommitted user files in scope | uncommitted sibling changes stay intact and unaffected |
| hung commands | long external commands | unavailable dependency, timeout and error surface |
| flaky tests | new or timing-sensitive tests | run the targeted test three times; any variance is a finding |
| misleading success | success claims taken from logs | exit 0 with error text; check the decisive assertion or file |
| repeated interruptions | mid-operation interrupts | interrupt twice at different points, recovery each time |

## Gate E: bounded cleanup

When a scenario spawns a resource, add its teardown as its own checklist item the same moment. Before the row closes, remove all of it:

- processes: `kill <pid>`, then `kill -0 <pid>` fails; `ps` lists none of the run's commands;
- tmux sessions: `tmux ls` lacks the name;
- ports: `lsof -i :<port>` prints nothing;
- containers, browser contexts, worktrees, tarballs, temp files and directories (delete the exact `mktemp` paths);
- QA-only environment variables.

Kill paths carry a timeout. Append a one-line receipt next to the artifact, for example `cleanup: killed 12345; tmux kill-session lit-qa-3; removed /tmp/lit.aB12cD; port 8080 free`. A row without a receipt stays open. Scratch lives outside `.litgravity/evidence/`, so cleanup never deletes proof.

## Independent verification gate

Fires for any HEAVY row, any row touching three or more files, security-sensitive or network-facing work, shared state, or when the plan or the user asked for rigor. A LIGHT row records a self-review instead: reread the diff, check diagnostics, confirm each acceptance line has its artifact, and note why LIGHT held.

The verifier is a different context from the implementer. The claim format is in `execution-templates.md`. Start `lit-verifier` through `invoke_subagent` with `TypeName` set to the agent name and a prompt holding the plan path, the row text, the goal record path, the claim and the evidence folder. Its job is to refute the claim: every artifact exists and says what the claim says, the diff touches only the Files line, and each listed adversarial class has an artifact behind it. It runs no commands, so it names the probes it wants repeated and the parent runs them (or `qa-runner` does, which has a shell). `confirmed` is the only pass. `false-positive`, `needs-fix` and `needs-human-review` keep the row open: append the feedback to the ledger, set the row back to in progress, redo gates C, D and E with fresh evidence and send it to the same verifier with `send_message`. "Looks good, but…" is a rejection. When no agent can start and the parent verifies itself, write `verifier_independence: limited_by_host` in the claim and back every line with a reproducible command or artifact.
