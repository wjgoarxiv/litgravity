# Blocker codes and the commands that clear them

A blocker is the result when the browser work stops short of an honest answer. The report names the code, the evidence of the failed check, and the one command or decision that clears it. The probe emits the first three codes itself; the rest are named by the procedure.

| Code | Raised when | Evidence to attach | What clears it |
|---|---|---|---|
| `BLOCKED_BROWSER_DRIVER_UNAVAILABLE` | The probe finds no usable tier: no `agent-browser`, no Playwright with a browser build, no Chrome-family binary | `driver.json` | The user installs one tier (`npm install -g agent-browser` then `agent-browser install`, or `npm i -D playwright` then `npx playwright install chromium`, or Google Chrome) and the probe runs again |
| `BLOCKED_BROWSER_IDENTITY_UNVERIFIED` | A command with the expected name fails the version banner, prints an oversized or suspicious banner, or resolves to a path the probe rejects | The `detail` line in `driver.json` | The user repairs or reinstalls the driver until `agent-browser --version` prints `agent-browser <semver>` |
| `BLOCKED_BROWSER_DRIVER_CLEANUP_FAILED` | The probe's own child process group was not proven gone | The `detail` line | Close the stray process (the report lists its command line), then rerun |
| `BLOCKED: command permission` | `run_command` was refused (a headless `agy -p` run without a permissive mode) | The refusal text | The user reruns with command permission or runs the printed commands themselves |
| `BLOCKED: <url> unreachable` | The target does not answer (`curl -sI` fails, DNS fails, connection refused) | The curl line and exit status | Start the server, fix the URL, or change network access |
| `BLOCKED: approval withheld` | The user declined, or nobody could answer, an approval the next action needs | The `decision` ledger line | The user approves the named action |
| `BLOCKED: <challenge>` | A CAPTCHA, MFA prompt, bot wall, paywall or login with no approved method | Screenshot of the wall | The user solves it or supplies an approved credential method |
| `BLOCKED: cleanup unconfirmed` | A process, context, profile or file from the run survived the cleanup check | The before and after process lists | Stop the named process; delete the named path; rerun the check |

## Result precedence

BLOCKED outranks FAIL, and FAIL outranks PASS. A flow that reached its observable with an unconfirmed cleanup is BLOCKED. Prose never upgrades a blocker to a pass.

## Writing the line in the report

```text
BLOCKED_BROWSER_DRIVER_UNAVAILABLE: probe found no agent-browser, no Playwright browser build, no Chrome binary (driver.json).
Run: npm i -D playwright && npx playwright install chromium   (then ask me to continue)
```

One blocker, one clearing step. When two blockers apply, list the one that must be cleared first and mention the second in a clause.

## Distinguishing a blocker from a failure

A blocker says that the check did not run or did not finish honestly. A failure says that the check ran and the page behaved differently from the task's expectation. A selector that never matched, for example, is a failure of the script when the page is reachable and the screenshot shows the expected element elsewhere, and a blocker when the screenshot shows a challenge page.
