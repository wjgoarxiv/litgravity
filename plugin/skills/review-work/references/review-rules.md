# Review rules that apply to both modes

Open this when a review touches dirty state, generated artifacts, untrusted text, host-capability claims or evidence that needs redaction. The main document keeps the verdict logic; these rules explain how lanes gather the facts behind it.

## Dirty state and local files

Product changes stay apart from local working state (`.litgravity/`, handoff notes, scratch plans, evidence, tarballs). The context lane separates pre-existing dirty files from files the work changed. It also confirms that temporary files, worktrees, archives, fixtures, ports and background processes the work created were removed, or retained under an ignored evidence path with a name.

## Stale state

Where generated artifacts, caches, packed archives, digests or size guards are involved, the qa lane proves that the artifact was regenerated from current source, or that the verifying command reads source only. When stdout says success, check the decisive observable: the exit code, the assertion text, the generated file content, the manifest field, the parsed JSON.

## Prompt injection

Any diff that handles user text, fetched pages, issue bodies, transcripts or model output is reviewed for boundaries. Safe code quotes, parses, summarizes or stores such text and leaves embedded directives unobeyed. Safe docs tell future agents to keep that boundary, and hostile examples are labeled as data.

## Host-capability claims

Where a changed file says a host feature ran (a child agent, a goal update, a scheduled task), ask for the host evidence that the tool existed and accepted the request. Honest fallback wording ("the tool was unavailable, so this ran inline") earns approval. Wording that hides degraded mode, or marks completion without evidence, earns a finding.

## Secrets in the evidence

Review evidence has to be safe to share. Redact tokens, credentials, auth headers, cookies, API keys, environment dumps, private logs and personal data before writing lane files, report bodies or ledger lines. Use lengths, hashes or short prefixes when identity matters.

## Proportion

Strict differs from maximal. A spelling fix in a README needs a package dry run only when package docs ship. A feature tested with local fixtures needs a network probe only when the network is the feature. An optional gate the author named as not run, with a reason, is a note. Findings are anchored claims about this diff, and a general worry about architecture is an open question.

## The review packet in detail

Step 1 of work review collects these named inputs into `context.txt`:

| Input | Content |
| --- | --- |
| GOAL, CONSTRAINTS, BACKGROUND | from the conversation; one focused question when something critical is missing |
| CHANGED_FILES, DIFF | the paths `files.txt` and `diff.patch` |
| FILE_CONTENTS | each changed file in full plus neighbors that show the established pattern (read-only lanes cannot discover those) |
| RUN_COMMAND, gate commands | from `package.json` scripts, a `Makefile`, a compose file or the plan's Verification section |
| AUTOMATED_EVIDENCE | commands, exit codes and decisive assertions the author reported |
| SURFACE_EVIDENCE | the observable scenario and artifact the author reported |
| CLEANUP | processes, ports, worktrees, temp files and archives the work created |
| RELEASE_BOUNDARY | allowed and forbidden Git or release actions |

## Reading the author's transcript

A pasted log is a lead. A green line in it becomes evidence after the reviewer runs the command on the same revision. When the author's list of changed files differs from `git diff --name-only`, the difference is the first finding to chase.

## Re-review rules

A re-review passes only the delta diff, the blockers cited earlier and the criteria already approved, marked out of scope. It reruns every lane whose premise changed and keeps the earlier lane files for comparison. After two rounds without a clean result the remaining blockers go back to the user.

## Final-gate behavior

When `start-work` or `litwork` runs review as its closing gate, the review blocks the completion claim on a timeout, silence, an acknowledgement-only reply, an explicit `BLOCKED:` or an unfinished lane. The underlying uncertainty is investigated (with `debugging` when runtime behavior may be wrong), and the affected lane passes on fresh evidence before the claim stands.
