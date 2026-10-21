# Execution details for litwork

Detail behind the loop in `SKILL.md`: failing-first proofs per target kind, discovery batching, waiting, delegation, the verification gate, commits and recovery.

## Failing-first proof per target kind

| Target | Proof | Notes |
| --- | --- | --- |
| Existing behavior being changed | A characterization test that passes on unchanged code, then the new failing test | Save `before.log` for the recorded before-state and `<id>-red.log` for the RED. The failure is an assertion about the missing behavior. A syntax error or missing import is a broken test. No production code yet. |
| Behavior with no seam (script entry point, config) | The criterion's real-surface scenario captured failing, or `.litgravity/evidence/<slug>/check-<id>.sh` that exits non-zero | The script prints the observation it checks. |
| Test-only target (coverage for behavior that already works) | A mutation proof | Force the exact regression the new assertion names, capture the assertion failing, revert the mutation and capture GREEN. An assertion that stays green under its own mutation is not coverage, so fix the fixture (a value equal to the default it must override proves nothing) or assert the artifact the criterion names. Reverting the probe is the GREEN, and the GREEN step is skipped. |
| Prose target (skill body, command doc, agent prompt, rule, README) | A machine-consumed value | Pin a parsed frontmatter field, a token a hook or scanner reads, a documented JSON sample through its real validator, or one equality between two shipped copies. Sentence presence and word counts are not a contract. A pure-prose change with no machine consumer ships on review and a read-through. |

A test that cannot fail for the regression it names is no evidence: assertions on mock calls, pinned constants, a fixture equal to the default it must override, or an expected value derived from the output under test. A real-surface proof with no new test beats a tautological one.

## Finding things

Locate with the right tool and reread before claiming or changing anything. Memory is a hint and the file is the fact.

**Batch the first wave.** When several independent lookups produce results that can be filtered, joined or reduced, write one program that runs them and prints only the decision-relevant evidence: a single `run_command` pipeline, or one short `node -e` script that fans out with `Promise.all`. Reducing in the program beats reading N raw outputs. Keep separate calls when one result chooses the next action, when output is already small, when judgment is needed between calls, when approval or side effects are involved, or when the native artifact must stay verbatim as evidence.

Pick the lens by the shape of the question:

- Repository text, filenames, history, bounded command output: `rg` and `git` through `run_command`, or `grep_search` and `list_dir` when the host offers them.
- Verbatim content: `read_file` on the exact file.
- Symbols, definitions, references and rename impact: agy has no language-server tool, so use text search for references, the repository's typecheck and lint commands for diagnostics, `lsp` for checker CLIs and `structural-search` when a text search would over- or under-match a code construct.
- Architecture, flow and blast radius across an unfamiliar layout: a read-only discovery child (`lit-planner`) in place of a dozen serial greps.
- Research that leaves the repository (library behavior, API limits, docs): `librarian-researcher`.

Launch independent discovery lanes in one action and keep doing root work while they run. After two exploration waves with no new useful fact, stop exploring and act.

## Waiting discipline

A poll costs a full model round, because every status check replays the accumulated context. For a long command (installs, builds, full suites, containers, CI) run it to completion in one call with a timeout sized to the expected duration, or send its output to a log file and read the file once. `run_command` returns early for a long command; read it with `command_status` in the fewest, longest waits the host allows, and do independent root work meanwhile. When two consecutive checks show no change, double the wait. A child that has not returned is alive, so work on something independent.

## Delegation

When agents are installed, a HEAVY change may go to `lit-executor`, one criterion per child. Use `qa-runner` for the SURFACE step on a shell without file-write access, `quality-reviewer` for defects and security, and `lit-verifier` for a PASS or FAIL against the criteria. `invoke_subagent` always carries a `TypeName`, because a child started without one is general-purpose with every tool and no role limits.

Every child message is a self-contained assignment that starts with `TASK: <imperative>` and names `DELIVERABLE` (the exact artifact), `SCOPE` (the files it may touch), `VERIFY` (the test or scenario proving the deliverable) and `STOP WHEN` (the observable condition ending its run). Paste only the context the child needs, since a child that inherits the whole history tends to continue the parent's old task.

```text
invoke_subagent
  TypeName: lit-executor
  Role: implementer
  Prompt: TASK: Make criterion 2 pass test first.
    DELIVERABLE: failing then passing test, changed files, logs crit2-red.log and crit2-green.log under .litgravity/evidence/<slug>/.
    SCOPE: edit only lib/parser.mjs and test/parser.test.mjs; other workers share this tree and their changes stay untouched.
    VERIFY: node --test test/parser.test.mjs fails first with 'ParseError expected', then passes.
    STOP WHEN: both logs exist, or send BLOCKED: <reason>.
```

Run independent lanes side by side only when they touch different files; otherwise give each its own worktree (`git worktree add`). agy has no wait tool: each child sends a message when it finishes, so keep working and read messages as they arrive. For long assignments ask the child to send `WORKING: <task> - <phase>` before long passes and `BLOCKED: <reason>` when progress stops.

Fall back only when a lane finished without its deliverable, answered with an acknowledgement only, or stopped running. Send one targeted follow-up with `send_message`. If the lane is still silent, record it as inconclusive (inconclusive is no approval), ask it to stop, and start a smaller assignment carrying only the missing deliverable. After two silent stretches send `TASK STILL ACTIVE: return <deliverable> or BLOCKED: <reason>`; after four, close the lane.

Check every child claim yourself: each evidence file exists, the decisive command reruns green, the diff stays inside the SCOPE you gave, and no skip, ignore, unsafe cast, error suppression or hollow mock assertion created a false green. With no agents installed, run every step in this conversation and mention it once.

**Transition barrier.** An open lane owns its evidence until it returns. A todo stays unticked while a child owns its evidence, dependent implementation waits until the audit, research or review result is integrated or recorded as inconclusive, and the final message waits until no lane is open. A silent child is not a terminal state; returned, failed, blocked and recorded-inconclusive are.

## Verification gate

The gate fires when the tier is HEAVY, when the user asked for strict, rigorous or high-accuracy review, or when the change is release-facing, security-sensitive or hard to revert. A LIGHT change without a trigger records a self-review in the notes: reread the diff, run diagnostics, confirm each criterion's evidence and state in one line why the tier held.

1. Hand a self-contained reviewer assignment to `lit-verifier` (goal and guardrail conformance, judged from files) or `quality-reviewer` (defects, maintainability, security). Pass the goal, the success criteria, the scenario evidence, the full diff saved to a file the reader can open, and the notes path. For a release-facing change, or a diff the user wants a blocking verdict on, read `../review-work/SKILL.md` and run its work mode instead.
2. Verify each concern yourself against the evidence. A concern blocks when it names a success criterion that the evidence fails. A concern citing no criterion is recorded as a note with a one-line reason, then fixed or declined at your judgment, and recorded either way.
3. Fix every criterion-cited blocker. Rerun only the scenario QA the fix affected, capture fresh evidence for the delta and update the notes.
4. Resubmit to the same reviewer at most twice, passing only the delta diff, the blockers it cited and the already-approved criteria marked out of scope. An approval whose only remaining items are notes counts as approval.
5. On approval, declare done. If criterion-cited blockers remain after two re-reviews, stop and surface them to the user.

HEAVY work additionally falsifies, through the reviewer or an explicit fresh pass: user-intent coverage, regression and malformed-input behavior, prompt-injection boundaries when untrusted text is handled, cancel and resume and repeated interruption when state is durable, stale generated or installed output, misleading success logs not backed by an assertion, missing cleanup and authority drift. Approval must be unconditional, and a conditional approval is a blocker list.

## Commits

Commits are atomic Conventional Commits: `<type>(<scope>): <imperative>` with `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci` or `perf`. One logical change per commit, each building and testing green on its own, and no WIP commits on the final branch. When a plan file backs the work, the final commit footer is `Plan: plans/<slug>.md`.

`git commit` runs only when the user requested or preauthorized it in this conversation. The default is to leave the work unstaged, present the changed-file list and a draft message, and let the user decide. In a repository with unrelated dirty files, stage with explicit pathspecs so that nothing you did not author is staged. Pushing, tagging, publishing and version bumps are separate approvals that "commit" does not imply. `lit-commit` carries the history-safety detail once the operation grows past a single commit.

## Interruption and recovery

New input mid-run is one of four things. **Additive**: merge it into the current criterion or queue a new bounded unit. **Corrective**: stop obsolete work, keep useful artifacts and re-bind the criterion. **Replacement**: stop lanes whose output no longer matters, clean their resources and drop the old objective. **Status request**: report verified progress, then continue. A lane whose ownership was reassigned stops writing.

After compaction or restart, reread the nearest instructions, the request, the notepad and the latest `git status`, then resume from `## Now`. Plans, handoffs, package metadata, test output and ledgers drift between turns, so earlier green output is stale unless its artifact still exists and names the command and an exit line.

After two identical failed attempts at one step, compare failure signatures. A materially different diagnosis or probe is a new approach, and rerunning the same command is the same attempt. Surface what was tried and what the evidence shows, hand a stubborn failure to `debugging`, and ask before another retry. Three bounded fix attempts at one criterion end in FAIL with the diagnosis. On explicit cancellation, stop starting work, ask active lanes to stop, end task-created runtime state, report the last verified boundary and wait for a fresh instruction.

## Adversarial classes

Probe the classes that apply: malformed input; prompt injection; cancel and resume; stale state; dirty worktree; hung or long commands; flaky tests (run the targeted test three times); misleading success output (check the decisive assertion or file, because a summary line can say success next to an error); repeated interruptions. A class that does not apply gets a one-line reason in `notes.md`.

## Completion receipt

The receipt answers, from files: the requested outcome and any deferred non-goals; every criterion with its artifact path and verdict; the focused automated checks and real-surface probes run this turn; the reviewer verdict when the gate fired; protected dirty files untouched; task-created processes, sessions, ports, workers, archives and temp paths gone; and the commit, push, version, tag, release and publish status, stated without implying ungranted actions. An unknown item keeps the work incomplete or blocked.
