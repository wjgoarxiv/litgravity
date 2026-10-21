# Ledger and evidence layout

Everything a research run writes, where it goes, and what shape it has. `SESSION_DIR` is `.litgravity/evidence/<slug>/` in the workspace root. The root conversation is its only writer; lanes report in messages.

## Files in `SESSION_DIR`

| File | Written | Holds |
| --- | --- | --- |
| `manifest.md` | Step 1, updated throughout | the manifest below and the lane table |
| `questions.md` | Step 1 | sub-questions with their axis keys and the evidence that would settle each |
| `wave-<N>-<class>-<axis>.md` | each lane return | the root's digest: findings, sources with locators, the `## EXPAND` and `## CLAIMS` blocks verbatim |
| `expansion-log.md` | each return | the lead ledger: every lead ever seen, its state and its ancestry |
| `evidence-graph.md` | throughout | append-only nodes and edges: claims, sources, commands, artifacts, records, open leads |
| `claim-graph.md` | Step 4 | the cleared list at the top, then one node per asserted non-code claim |
| `verify-<claim-slug>.md` | Step 4 | one verification each |
| `SYNTHESIS.md` | Step 5 | the internal synthesis |
| `assets/` | Step 6 | charts, captures and tables a report uses |
| `probe-<claim-slug>/` | Step 4 | temp reproduction folders, removed at close unless kept on purpose |

Journal each return the moment it arrives. After compaction, these files reconstruct what was searched, found and expanded.

## Manifest

```text
query: <the demand in the user's words>
intended use: <decision | plan | document | curiosity>
scope and non-goals:
tier: Light | Standard | Exhaustive
axes: A1 <name>, A2 <name>, ...
planned lanes: <count by class>
execution: parallel | sequential-fallback (<reason>)
tools observed: search_web yes/no, read_url_content yes/no, invoke_subagent yes/no, run_command allowed/refused
overflow queue: <leads waiting for the next wave>
source classes in scope:
verification candidates:
report format: <reply only | path>
workspace boundary: <dirty files left as they are>
external-access boundary: <public only; user-supplied excerpts>
```

## Lead states

| State | Meaning |
| --- | --- |
| `open` | found, waiting for a lane |
| `running` | a lane owns it |
| `verified` | settled with evidence |
| `refuted` | the evidence went against it |
| `duplicate` | same as another lead (link it) |
| `dead_end` | followed and dry (reason recorded) |
| `blocked` | needs access or a tool this run lacks |
| `deferred` | out of the depth cap; listed as known unexplored |

Leads keep their key across waves even when reworded. Refuted and duplicate leads stay in the log so a restart does not rediscover them.

`expansion-log.md` per wave:

```text
## wave 2  (started 10:31, closed 10:58)
lanes: L-04 (A1/L3), L-05 (A2/L5), L-06 (L6)
markers gained: 7   new leads: L8, L9   duplicates: 3 (of L2, L5, L5)
closed: L3 verified, L5 dead_end (vendor page moved; archive matches S-07), L6 verified
open after wave: L8, L9
convergence: no (2 live leads)
```

## Evidence graph

Node kinds: `claim`, `source`, `command`, `artifact`, `record`, `lead`. Edge kinds: `supports`, `contradicts`, `depends_on`, `duplicates`, `derived_from`.

- Claim keys look like `claim:<slug>:<n>` and are issued once. A correction appends a new node and links it; earlier nodes stay.
- Source keys derive from the canonical DOI, the canonical URL with query secrets removed, or an artifact digest (`S-07` as a short alias is fine when the alias table maps it).
- Attach retrieval attempts and their verdicts to the source node. A successful fetch creates a source node; the claim edge comes from reading the passage.
- An unsupported claim stays visible as unsupported until evidence arrives or it is rejected.

```text
S-07  source  https://example.org/docs/v3/limits  retrieved 2026-10-20  T1  strong
S-11  source  vendor repo @ 9f2c1e0 src/batch.ts:41  T1  strong
C-3   claim   claim:queue-limits:3 "batch size is capped at 100 in v3"
E     S-07 supports C-3
E     S-11 supports C-3
P-1   command node probe-batch.mjs -> exit 1 at size 101
E     P-1 supports C-3
```

## Scientific records

When the research handles papers:

1. **DOI identity.** Trim whitespace, remove a leading `doi:` or resolver prefix (`https://doi.org/`), drop surrounding citation punctuation, lowercase for identity, and keep the publisher's original spelling as provenance. Deduplicate metadata, PDF and conversion work by that canonical DOI. A record without a DOI gets a stable source key and lower confidence; a DOI is never invented.
2. **Four independent states per record:**

| State | Values |
| --- | --- |
| `metadata` | `untried`, `found`, `partial`, `failed` (with source and DOI provenance) |
| `acquisition` | `untried`, `validated_pdf`, `blocked`, `failed` |
| `conversion` | `not_requested`, `pending`, `succeeded`, `failed` |
| `review` | `needs_review`, `reviewed`, `rejected` |

3. **PDF proof.** A filename, a `.pdf` suffix, a MIME header or HTTP 200 leaves the file unproven. Check the first five bytes with `run_command` (`head -c 5 <file>` prints `%PDF-`) before setting `validated_pdf`, and record path, byte count, SHA-256 digest and source.
4. A failed text conversion sets `conversion: failed` and leaves a validated PDF and good metadata as they are.
5. Generated summaries, citations and BibTeX stay `needs_review` until a person or an evidence-bearing review resolves them.
6. Append a receipt after each batch so an interrupted run skips records already acquired.

## Ledger lines

Append to `.litgravity/ledger/<conversation-id>.jsonl` (the hooks add one line per tool call on their own):

```json
{"ts":"2026-10-20T10:02:11Z","kind":"note","text":"litresearch queue-limits: tier Standard, 5 axes","path":".litgravity/evidence/queue-limits/manifest.md"}
{"ts":"2026-10-20T11:20:40Z","kind":"evidence","text":"synthesis written, 14 claims, 3 verifications","path":".litgravity/evidence/queue-limits/SYNTHESIS.md"}
{"ts":"2026-10-20T11:21:02Z","kind":"decision","text":"plan question Q2 settled: batch cap is 100 in v3","path":".litgravity/evidence/queue-limits/verify-batch-cap.md"}
{"ts":"2026-10-20T11:25:15Z","kind":"note","text":"cleanup: removed /tmp/lr-clone-a3; kept probe-batch-cap/ as evidence","path":""}
```

Blocked states go in as `note` lines carrying the access verdict (`auth-required`, `rate-limited`, `blocked`, `not-found`) and the untried routes.

## Read-only mode

When the user asked for no files, keep the manifest, lead list and verdicts in the conversation, give each lead the same key it would have on disk, and write nothing under `.litgravity/`. Tell the user once that a compaction may lose the trail. If they later approve writes, transcribe the journal to `SESSION_DIR` first, then continue.
