# Capture and review protocol

The reviewed-knowledge layer: what to capture, how to build the event, how a review pass runs. The script's exact interface is in `references/knowledge-script-contract.md`.

## Operations without an MCP server

LitGravity's first release registers no MCP server for wikify. The same three operations run as script subcommands through `run_command`, with identical semantics:

| Tool-style operation | LitGravity subcommand | Writes |
| --- | --- | --- |
| capture a structured finding | `capture --event-json '<event>'` | one `review-needed` revision, or none on `duplicate` / `disabled` |
| review a captured finding | `review --id <id> --state accepted\|rejected\|stale`, or `save --id <id>` for accept | one revision, or none when the state is unchanged |
| query accepted knowledge | `query --text '<words>' [--budget N]` | nothing |
| (supporting) list the queue | `list [--state …]` | nothing |
| (supporting) health check | `verify` | nothing |
| (supporting) opt-out switch | `config --capture on\|off` | `settings.json` |

Run every call from the workspace root, quote the JSON in single quotes, and add `--json` to get a machine-readable receipt.

## What deserves a capture

Capture a finding when all three hold:

1. It is short: one sentence of at most 512 bytes says it.
2. It is checked: you saw the evidence (a file, a command result saved under `.litgravity/evidence/<slug>/`, a page section).
3. It will matter again: a later conversation would otherwise rediscover it.

Good kinds of capture:

| kind | Example text |
| --- | --- |
| `fact` | The staging API returns 429 after 60 requests per minute per token. |
| `decision` | Use pnpm workspaces for the monorepo; npm workspaces broke hoisting of the native module. |
| `failure` | Running the migration with `--parallel` corrupts the sequence table; run it serially. |
| `risk` | The nightly export overwrites `reports/latest.csv` without a lock. |
| `rule` | Every public CLI flag needs an entry in docs/cli.md before release. |
| `checkpoint` | Data model v3 merged on 2026-10-18; v2 readers removed. |

Poor captures: impressions ("the code is messy"), restatements of the README, whole paragraphs, anything copied from a source body, anything with a secret in it.

## Building the event

```json
{"kind":"failure","text":"<one checked sentence>","provenance":{"ref":"<where you learned it>"},"evidence":{"ref":"<relative/path#anchor>"}}
```

- `provenance.ref`: a page (`wiki/topics/migrations.md`), a note, or a dated label (`conversation 2026-10-20 migration run`). Keep it short; it is part of the id hash.
- `evidence.ref`: a relative path inside the workspace with an optional anchor. Absolute paths, `~`, `..` segments and URLs are refused. To cite a URL, write it on a source note and point `evidence.ref` at that note.
- Screen the text yourself first: no credential, token, key or password; no URL with `user:pass@`; no sentence phrased as an order to an AI system. The script refuses those with exit 1 and reason `rejected-or-integrity`.
- The id is derived from kind, text, provenance ref and evidence ref. Changing any of them makes a new entry; re-sending the same event is reported as `duplicate`.

After a capture, append a ledger `note` line with the returned id: `{"ts":"…","kind":"note","text":"captured wk-… (failure)","path":"<base>/wiki/.knowledge/claims.jsonl"}`.

## The review pass

Run it when the user asks, at the end of a long task, or when lint reports a long queue.

1. `list --state review-needed --json`. Oldest first is a fair order.
2. For each entry, open its `evidence` path with `read_file` and check the sentence against it.
3. Decide:
   - **accepted**: the evidence supports the sentence as written.
   - **rejected**: the evidence contradicts it, or it was never true.
   - **stale**: it was true, but the evidence moved on (a version changed, a file is gone).
   - A sentence that is nearly right is rejected and recaptured in corrected form; the text is part of the id, so an edit is a new entry.
4. Who decides: in an interactive run, show the user each decision in a compact table and ask once with `ask_question` ("accept these 4, reject 1, stale 1?", recommended: as proposed). When the user asked you to review on their behalf, apply the decisions directly. Headless runs without that instruction only propose.
5. Apply with `review --id … --state …` (or `save --id …` for accepted). Each call prints a receipt; `duplicate` means the state was already set.
6. Accepted entries that belong on a page go there too, through save, with the `wk-` id written next to the bullet.
7. Log one `review` entry in `log/log.md` and one ledger `note` with the counts.

## Accepted entries that age

Lint and query watch for accepted entries whose evidence path no longer exists or whose page went stale. Propose `stale` for them in the next review pass. Rejected and stale entries stay in the history; query ignores them.

## Opt-out and privacy

- `config --capture off` stops new captures for this base (they report `disabled`); review and query keep working. Record the setting in `schema/wiki-rules.md`.
- The store sits in the user's workspace with mode 0600 files in 0700 directories. It is cooperative state: another process running as the same user can read or change it, so it is the wrong place for anything confidential.
- Git: whether `.litgravity/` is committed is the user's choice; mention it once when the store is first created.
