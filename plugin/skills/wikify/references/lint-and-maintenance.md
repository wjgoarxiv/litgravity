# Lint and maintenance

Checks, commands and pass rules for `modes/lint.md`. All commands run through `run_command` from the workspace root with `B=<base>` (default `.litgravity`). Everything here is read-only until a fix packet is approved.

## Inventory

```bash
find "$B/wiki" -name '*.md' -not -path '*/.knowledge/*' | sort > /tmp/<slug>-pages.txt
wc -l < /tmp/<slug>-pages.txt
```

Keep the inventory file under `.litgravity/evidence/wikify/` when the run needs a before/after comparison, and delete any `/tmp` copy at the end.

## Checks

| Check | How | Pass rule |
| --- | --- | --- |
| Broken links | extract `](target)` and `[[target]]` with `rg -o`, resolve each relative to its page, `test -e` | every target exists |
| Escaping links | `realpath` of each local target starts with the base | no local link leaves the base (external URLs are fine) |
| Orphans | pages that no other page links to and that are absent from `wiki/index.md` | none, or each one listed with a reason |
| Index drift | pages missing from the index; index lines pointing at missing pages; status in the index differing from the page | index and pages agree |
| Duplicates | similar titles (`rg -i '^# ' "$B/wiki"`), the same `Built from:` set, overlapping claims | each pair merged or explained |
| Weak openings | the first three lines fail to say what the page covers or what it was built from | every durable page opens with scope and `Built from:` |
| Unintegrated sources | a source note whose "Wiki updates triggered" section is empty or names no topic page | each note feeds at least one page, or says why it stands alone |
| Provenance | durable bullets without `Source:`, `Derived from:` or a link | none on durable pages |
| Contradictions | struck bullets, `Uncertain:` lines and conflicting numbers across pages | each conflict visible on every page that repeats the claim |
| Schema drift | page types, statuses, tags or confidence values absent from `schema/wiki-rules.md` | vocabulary matches the rules file |
| Bridge drift | packets marked `approved-to-export` with no matching log entry, or exported packets still `candidate` | statuses reflect what happened |
| Source drift | recompute `shasum -a 256` for each raw file a note records; compare | equal, or the note flagged `needs-review` |
| Page age | `Updated:`/`Last reviewed:` older than 30 days (compare with `date +%F`) | each old page spot-checked or listed |
| Knowledge store | `wikify-knowledge.mjs verify --json`; `list --state review-needed --json` | healthy; queue reviewed or listed |

## Age review

1. List every page in the index with its date.
2. Candidates: pages older than 30 days, and pages citing files that moved or vanished (`test -e` on each cited path).
3. Spot-check one or two sources per candidate with `read_file`.
4. Outcomes: still true, bump the checked date; changed, update the fact with a dated bullet and strike the old one; gone, set `Status: stale` with the reason.
5. Merge true duplicates into the older slug and mark the other `superseded by [<slug>](<slug>.md)`.
6. Report a table: page, outcome, reason.

## Health gates

Checked before a lint or any other mode claims success:

| Gate | Pass condition |
| --- | --- |
| Boundary | no page widens scope beyond the base; no write happened outside it |
| Navigation | important pages are reachable from `wiki/home.md` or `wiki/index.md` |
| Novice path | `wiki/home.md` makes sense to someone who has never seen the folder contract |
| Provenance | durable claims point to source notes, raw files or repo landmarks |
| Paper ingest | (when papers exist) metadata, methods, anchors, limitations and citations trace to notes |
| Relationship artifacts | (when enabled) current, or marked stale |
| Promotion | cross-project knowledge sits in bridge packets |
| Clusters and shared pages | (when present) justified by evidence; `shared/` holds cross-cluster concepts only |
| Graph optionality | no relationship tooling became a first-run requirement |
| Privacy | no credential, private path or personal detail in reusable templates or examples |
| Contradictions | conflicting claims are marked and routed to the user when unsafe |
| Drift | changed sources are flagged |
| Knowledge store | `verify` reports `healthy` or `empty` |

## Fix packets

- **Safe and reversible** (eligible for a packet): a fixed relative link, an added index line, a missing grounding block filled from the page's own sources, a `stale` flag on a page whose source vanished, a navigation link from home to an orphan.
- **Judgment calls** (stay findings for the user): merging two pages with different purposes, deleting content, choosing between contradictory sources, splitting or merging clusters, exporting anything, renaming slugs.

Packet format, written to the user before any change:

```text
Fix packet <YYYY-MM-DD>
Base: <base>
Repairs:
  1. wiki/topics/build.md: link ../sources/ci-notes.md → ../sources/ci-pipeline.md (target renamed)
  2. wiki/index.md: add line for wiki/topics/release.md
Rollback: revert the listed lines (originals quoted in the report)
Evidence: before/after gate table in wiki/maintenance/<YYYY-MM-DD>.md
```

After approval, apply only the listed repairs, write the report from `assets/maintenance-report-template.md` to `wiki/maintenance/<YYYY-MM-DD>.md`, append `## [YYYY-MM-DD] lint | <summary>` to `log/log.md`, re-run the same checks, and put both gate tables in the report. A drop in finding count with a regressed boundary or provenance gate is a FAIL.

## Reporting

The reply gives the verdict, the count of findings by severity, the one or two that need the user, and the report path. The full table stays in the report file.
