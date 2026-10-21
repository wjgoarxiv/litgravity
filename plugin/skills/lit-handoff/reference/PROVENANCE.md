# Handoff closure provenance

The handoff contract bundled in this skill comes from an owner-authorized MIT source snapshot (copyright Woojin, see `../LICENSE`). Three authored files are kept byte for byte; only the first one was renamed, so that agy does not load a nested file as a second skill entry point. The fourth file, the evaluation set, was re-expressed for agy: its scenarios follow the original cases and add the agy destination set, quick mode, headless refusals, injected text in an old packet and secret redaction.

| Path in this skill | Origin path | Status | SHA-256 |
| --- | --- | --- | --- |
| `reference/canonical-handoff.md` | `SKILL.md` | snapshot, unchanged | `e5bbd253dfa5b5baa9739dfaebc458003daab43cb27c4a407423da1e7a31dec6` |
| `templates/HANDOFF.md` | `templates/HANDOFF.md` | snapshot, unchanged | `2a795a06e7bb81a57e6675ae70ed26db0dbfdb792c01f0a60f96f02cbef49fbd` |
| `examples/HANDOFF-example-generic-auth-refactor.md` | `examples/HANDOFF-example-generic-auth-refactor.md` | snapshot, unchanged | `43c767e573ac8c8900832d2b7a92ee1e83fd2d3d794fe2c82ecef87e5737f2a3` |
| `evals/evals.json` | `evals/evals.json` (origin SHA-256 `0a70f0d149e59641100c7dcf8b9f2f1c0ceae57b98518e165f08088f2c2484da`) | re-expressed for agy | `86a504e5c964c02c7a89eabffdf85c56b2579435cd3ff360c8f78e5178a31645` |

- Source commit of the snapshot: `235ed3af614a7becaee6ef1d1a18e5c4b13994f4`. It is provenance only; nothing here reads the original checkout at runtime.
- The MIT licence in `../LICENSE` covers the snapshot files and the re-expressed evaluation set. Its copyright and permission notice are kept as issued.
- `node scripts/verify-closure.mjs` (from the skill folder) recomputes the four hashes from the installed files and exits 0 only when all match; `--json` prints the per-file result.
- The agy-specific behavior (the `.litgravity/handoff/` destination set, quick mode, the ledger line, secret handling, verification) lives in `../SKILL.md`. The three snapshot files stay as issued.
- The canonical text uses the placeholder `${SKILL_ROOT}`; here it means the folder that holds this skill's `SKILL.md`.
- When `evals/evals.json` changes, update its hash in this table and in `scripts/verify-closure.mjs` together.
