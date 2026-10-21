# Lane 2: qa

The qa lane tests behavior on the real surface a user touches and leaves code review to lane 3. The default agent is `qa-runner`: it holds a shell and no file-editing tools, and it writes captured output only to the evidence path the brief names.

## Inputs

RUN_COMMAND and the repository's gate commands, the plan's Verification section, AUTOMATED_EVIDENCE and SURFACE_EVIDENCE the author reported, the changed-file list.

## The five-step scenario method

1. **Brainstorm** every scenario before touching the surface, as fifteen to thirty one-liners with expected behavior: happy paths; boundary conditions (empty, maximum, zero, negative, unicode, very large); error paths (invalid input, missing files, denied permission, timeouts); regression scenarios on code the change touches; state transitions (out of order, rapid repeats, concurrent use); interface cases (widths, keyboard, loading and error states); integration points.
2. **Augment** with the careless or hostile user and with environment conditions (disk full, slow network, expired token, dirty working tree, read-only folder, no `run_command` permission in a headless run). Add at least five scenarios.
3. **Prioritize** into P0 (must pass), P1 (should pass) and P2 (nice to pass), each with steps and expected result.
4. **Execute** in priority order and record actual against expected, with evidence for each failure. A surface that will not start is an immediate FAIL.
5. **Compile** coverage counts and per-scenario results.

## Channel per surface

| Surface | How to drive it |
| --- | --- |
| CLI | the real command with arguments, pipes and exit codes |
| Library | a short script that imports the public API |
| HTTP service | `curl -i` against the live endpoint |
| Terminal UI | `tmux` with `send-keys` and `capture-pane` |
| Built interface | hand viewport checks to `visual-qa` and fold its verdict into this lane |
| agy-facing behavior | `agy -p "<prompt>" --output-format json --print-timeout 170s < /dev/null`, one call per scenario, within the quota the plan names; free listings `agy -p "/hooks"`, `"/skills"`, `"/agents"` and `agy plugin validate` cost nothing |
| Package or installer | `npm pack`, then install the tarball into a temp folder and run from there |

## Gates and baselines

Run the repository's own gates (tests, typecheck, lint, build) and record the command, working directory, exit status and pass and fail counts. Calling a failure pre-existing needs a detached checkout of the base that fails the same way (`git worktree add --detach <path> <base>`, run, `git worktree remove <path>`).

## Stale state and misleading success

Where generated artifacts, caches, packed archives, digests or size guards are involved, prove that the artifact was regenerated from current source, or that the verifying command reads source only. When stdout says success, check the decisive observable: the exit code, the assertion text, the generated file content, the manifest field.

## Cleanup

Register every process, port, tmux session, browser context, worktree and temp path at creation and remove it before the lane returns. The receipt is a nonexistence check: `kill -0 <pid>` fails, `tmux ls` lacks the name, `lsof -i :<port>` prints nothing, the path is gone. A missing receipt makes the lane BLOCKED even when every test passed.

## Output

The fixed lane schema, plus `scenarios: total, P0 pass/fail, P1 pass/fail, P2 pass/fail`, the gate table, and the cleanup receipt.

## Severity hints

| Situation | Severity |
| --- | --- |
| The surface fails to start, or a P0 scenario fails | BLOCKER |
| A required gate is red and the baseline was green | BLOCKER |
| A P1 scenario fails | MAJOR |
| New behavior has no scenario or test | MAJOR |
| A P2 scenario fails | MINOR |
| An optional gate the author named as not run, with a reason | NOTE |
