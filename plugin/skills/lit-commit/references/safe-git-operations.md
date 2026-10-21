# Safe git operations

This runbook covers commits, history investigation, recovery, rebases and pull-request evidence. Git commands can alter shared history or mix unrelated work, so establish authority and a recovery point first. The `lit-commit` skill carries the spine; this file carries the detail for the cases that go wrong.

## Authority matrix

| Requested outcome | Read-only inspection | Local write | Remote or shared write |
|---|---|---|---|
| Explain status or history | allowed | none | none |
| Create commits | inspect first | stage and commit only the named scope | push needs separate authority |
| Reorder, squash or fix up | inspect first | only the named local branch | pushed history needs explicit rewrite authority |
| Recover lost work | inspect reflog and objects | restore to a new ref or file first | no remote mutation by default |
| Prepare a pull request | inspect branch and remote | optional local commits only if requested | creating or updating must be requested |

"Finish the code" grants no commit. Permission to commit grants no push. Permission to push grants no force-update, release or settings change.

## Permission shape in agy

Every command runs through `run_command`, and a write command may prompt the user. Plan the permission requests so a session does not stall halfway:

- Interactive session: run the read-only snapshot first, state which writes follow (`git add`, `git commit`), and let the prompts approve them one by one.
- Headless `agy -p` run: a refused command ends the run with no output. Request the permission set once, up front, name the writes in the plan, and stop with the staged state described if the first write is refused.
- Network commands (`git push`, `git fetch`, `gh`) depend on network access in the user's environment and on explicit user request for anything that publishes.
- Remote URLs and tokens appear in some outputs (`git remote -v`, push logs). Redact them in anything saved or quoted.

## Snapshot before mutation

```bash
git status --short --branch
git diff --stat
git diff --staged --stat
git branch --show-current
git log -12 --oneline
git remote -v
```

Inspect the full relevant diff before staging. Resolve the repository root with `git rev-parse --show-toplevel`; an umbrella directory is often not the git root. Note untracked and ignored work that matters to the task, and add it only when it is an intended product artifact.

When a remote relationship matters, read the configured upstream and compare tips. A failed upstream lookup means unknown or absent, and it never signals that rewriting is safe.

## Detecting the commit message style

Read the last twenty subjects and three or four full messages:

```bash
git log --oneline -20
git log -5 --format=%B
```

Classify what you see: conventional commits with scopes, area prefixes, plain imperative sentences, ticket-prefixed subjects, or a body habit (wrapped paragraphs, bullet lists, none). Mirror subject length, tense, capitalization and scope vocabulary. When the history is mixed, follow the most recent twenty commits by the same contributor. When the repository has a contributor guide that states a format, the guide wins over the history.

Attribution lines (assistant credits, co-author trailers, generated-with footers) appear only when the user asks for them in this conversation. A trailer the repo itself uses, such as a ticket reference or a sign-off required by the contributor guide, follows the repo's convention.

## Atomic staging and commits

Build a staging manifest from the requested behavior. Group files by what can be reverted independently. An implementation and the tests that directly prove it usually belong together; unrelated docs, generated output, formatting and refactors usually go elsewhere.

Prefer explicit pathspecs:

```bash
git add -- path/to/file another/path
git diff --staged --stat
git diff --staged
```

Hunk staging suits a file that mixes separable user work and task work. Two ways to drive it in agy:

- `git add -p <file>` through `run_command`, answering the prompts with `send_command_input` (`y` stage, `n` skip, `s` split, `q` quit), then `command_status` to read the result.
- A patch file: write the wanted hunks with `write_file` as a unified diff, check it with `git apply --check --cached <patch>`, then `git apply --cached <patch>`. This route needs no prompt and leaves a reviewable artifact in the evidence folder.

Inspect the staged patch afterwards. Before committing, confirm the staged diff holds no secrets, local ledgers, evidence archives, editor files, credentials or unrelated changes.

After the commit, capture the new hash, subject, staged state and remaining worktree state. A successful commit proves nothing about tests and implies no push.

## Splitting one large diff

1. List the files and group them by intent in a short table (group, files, reason).
2. Order the groups so each commit builds on the previous one and the repo stays buildable at every step.
3. Stage group one, run the fast gate, commit, repeat.
4. When one file belongs to two groups, stage hunks for the first group and leave the rest unstaged.
5. After the last commit, `git status` should show only what the plan left out on purpose.

## Hooks that fail

A failed pre-commit hook means the commit did not happen. Read the hook output, fix the cause (format, lint, test), restage the changed files and create a new commit. When the hook rewrote files, inspect the new diff and rerun the relevant tests before committing again. The hook-bypass flag stays unused, and amending the previous commit is not the remedy because the failed attempt created none. If the hook failure comes from code outside the task, report BLOCKED with the hook's output, since fixing unrelated code widens the commit.

## History investigation

Match the query to the claim:

- exact text appeared or disappeared: `git log -S "literal" -- path`;
- a diff line matched a pattern: `git log -G "pattern" -- path`;
- ownership of a current range: `git blame -L <start>,<end> -- path` (add `-w -C -C` to see through whitespace and moves);
- file history across a rename: `git log --follow -- path`;
- one candidate's intent: `git show --stat --patch <hash>`;
- first breaking change: `git bisect`, with known good and bad bounds and a deterministic command;
- recent local ref movement or recovery: `git reflog`.

A bisect session:

```bash
git bisect start <bad> <good>
git bisect run <test-command>
git bisect log
git bisect reset
```

The test command exits 0 for good, 1 to 127 (except 125) for bad, and 125 to skip an untestable commit. Run `git bisect reset` even after an error, because an open session keeps HEAD detached. Save `git bisect log` to the evidence folder.

Triangulate important conclusions with the candidate patch and neighboring history. Report hash, subject, path and relevant context, and separate author date, commit date and merge date when the difference matters.

## Rewrite and recovery gates

Before a rebase or autosquash, identify the base, list the exact commits to be rewritten, account for dirty work, and decide whether the branch is published. A protected or shared branch needs explicit authority. Save `git rev-parse HEAD` as the recovery point.

Conflict handling:

1. Read both sides and the commit message of each; the intended behavior decides the resolution.
2. Edit the files to the merged result, then `git add -- <paths>`.
3. Continue with `GIT_EDITOR=true git rebase --continue`.
4. Rerun the focused verification after each resolved step.

Choosing an entire side blindly is a defect, because it discards the other side's intent silently.

Preferred exits when something goes wrong:

- the active rebase is wrong: `git rebase --abort`;
- a local commit is missing: find it in `git reflog`, then create a recovery branch (`git branch recover/<name> <sha>`) before changing the current branch;
- staged content is wrong: unstage only the explicit path (`git restore --staged -- <path>`) and keep its worktree content;
- a force update is approved: use a lease-based update (`git push --force-with-lease`) and refresh remote state right before running it.

Reach for a destructive reset after a recovery point exists. Restore the smallest object to a recoverable location first, verify it, then decide how it re-enters history.

## Pull-request evidence

When the user requests a pull request or an update to one, build the body from verified facts after the final diff and tests. Attach or link shareable artifacts. Redact tokens, headers, cookies, private logs, user data, environment dumps and local absolute paths.

For each evidence artifact, record:

- the command or scenario that produced it;
- the product commit it verifies;
- its repository-relative or approved remote location;
- a short interpretation of the decisive observable;
- the cleanup or retention policy.

An artifact counts as attached after the pull-request body or comment surface shows it; local existence is insufficient. Recheck branch status and review state before reporting success. When the task was only to draft a body, the pull request itself stays untouched, and the draft goes into the reply or an evidence file.

## Release-adjacent steps

Tags, version bumps, changelog edits and package publishes are separate authorizations, even when the branch name mentions a release. Before such a step, confirm the version files agree, the changelog entry exists, the pack list is what is expected, tests and scanners passed, and the registry state matches the claim. A tag created to mark a local milestone can trigger CI, so it waits for a request.

## Final receipt

Report the mode used, commands run, hashes or history findings, tests or probes, remaining dirty paths, remote actions actually performed, and the recovery point. State explicitly when no commit, push, rewrite, pull request, tag, version change or release action occurred.
