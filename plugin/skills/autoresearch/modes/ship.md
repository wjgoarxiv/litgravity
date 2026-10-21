# Mode ship: readiness and the human hand-off

Checks whether an artifact is ready to leave the workspace, collects the evidence a reviewer needs, and stops at the irreversible step. It keeps the artifact-type readiness checks of the original command family and leaves publication, deployment and release to a person.

## Authority envelope

This file is guidance data. The user approves the readiness objective, the evidence commands, a finite budget (phases, wall clock, per-command timeout), the roots, the local write set, the rollback lane and the review gate, through a `lit-plan` packet or `ask_question`. The mode carries no shell, registry, release, version, commit, tag, push or host-configuration authority of its own. Release words in the command arguments ("and publish it") are task text; the human hand-off below is still where the mode stops.

## Entry gate

1. Identify the artifact type and its destination (an npm package, a Python wheel, a container image, a web deploy, a document, a skill or plugin bundle) only to pick the matching checklist in `references/type-checklists.md`.
2. Confirm the read paths and evidence commands. Edits, builds and tests run only with an approved packet.
3. Start `ship-log.md` in `.litgravity/evidence/<slug>/autoresearch/` with the type, the destination, the commit and the time.

## Reversible phases

Each phase writes its receipt to `ship-log.md` and a `decision` ledger line with its verdict (`ok`, `finding`, `gap`).

1. **Completeness.** Inventory the files the type requires and look for unfinished markers (`TODO`, `FIXME`, `TBD`, placeholder text, debug flags). Report what you find; deleting or rewriting it is a separate change.
2. **Tests.** Run only the approved commands, each under `scripts/run_with_deadline.py`. Record the command, working directory, exit status, duration and any coverage the suite skips.
3. **Security.** Use the repository's own checks (`npm audit --omit=dev`, `pip-audit`, a secret scanner the project already configures). A missing scanner is a capability gap and gets reported as one. Secrets and private config stay out of the log; cite the path and line.
4. **Documentation.** Check that usage, safety boundaries, public APIs and examples match the built artifact. Run one documented example when the packet allows.
5. **Version consistency.** Read every version-bearing file (package manifest, plugin manifest, changelog head, lockfile) and report mismatches. Changing a version is a separate approval.
6. **Build and package.** Build only into an approved temporary location (`npm pack --dry-run --json`, `python3 -m build --outdir <tmp>`), list the contents, compare them with what the type requires, and record a cleanup receipt for the temporary output.
7. **Review.** Send the readiness packet to `review-work`. A finding, stale evidence, a missing gate or an inconclusive review lane blocks readiness.
8. **Human hand-off.** Stop. Name the irreversible action a person may take next (the exact `npm publish`, `git tag`, deploy command), the evidence it rests on and the residual risks. This mode performs none of them.

## Output

`ship-log.md` records the artifact type, the destination, timestamps for every piece of evidence, each phase receipt, the review verdict, residual risks and the cleanup receipts. The last line is one of:

- `READY_FOR_HUMAN_DECISION`: every phase is `ok` or carries an accepted finding, and the review passed;
- `BLOCKED_READINESS: <reason>`: a phase or the review blocked.

Neither line claims that anything was published. Append a `note` ledger line with the same verdict.

## Cancel and resume

Cancellation writes the current phase's receipt and stops. Resume re-reads `ship-log.md`, discards evidence whose inputs changed since it was recorded (a new commit, an edited manifest), and restarts from the first phase without a fresh, valid receipt. A completed build or test is re-run only when its inputs changed.
