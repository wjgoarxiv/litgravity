# Maintenance Report

## Scope reviewed
- Which folders/pages were audited?

## Safe fixes applied
- Broken links fixed
- Page summaries tightened
- Orphan-page navigation improved
- Index updated
- Bridge packet statuses clarified
- Novice-facing start page clarified

## Issues flagged for human review
- Ambiguous duplicates
- Contradictory claims
- Scope or naming decisions with unclear intent
- Cross-project/global export candidates that need approval
- Cluster boundaries that need merge/split review
- Source drift or confidence downgrades that should not be silently normalized
- Paper metadata, citation, or extraction drift that should not be silently normalized
- Any request to write outside the current working directory

## Health gates
| Gate | Status | Notes |
|---|---|---|
| Boundary | pass/fail | |
| Novice UX | pass/fail | First-run path avoids unnecessary internal vocabulary and over-questioning |
| Navigation | pass/fail | |
| Cluster boundary | pass/fail/n/a | Clustered sections are justified by evidence and still share the local boundary |
| Shared pages | pass/fail/n/a | `wiki/shared/` is not being used as a miscellaneous dump |
| Provenance | pass/fail | |
| Scientific paper ingest | pass/fail/n/a | Paper metadata, claims, methods, figures/tables, equations, citations, limitations, and open questions are traceable |
| Research graph artifacts | pass/fail/n/a | Local `edges.jsonl`, `citations.jsonl`, `gaps.md`, `context.md`, or ingest manifests are current or explicitly marked stale |
| Promotion | pass/fail | |
| Graph optionality | pass/fail | Graph/relationship tooling is optional and not first-run required |
| Privacy / portability | pass/fail | No personal paths, credentials, or machine-specific examples in reusable docs |
| Contradictions | pass/fail | |
| Drift | pass/fail | |

## Remaining risks
- Stale pages still present
- Raw-ingestion leftovers not yet integrated
- Coverage gaps in the wiki
- Bridge candidates not exported/rejected yet
- Advanced graph/export actions awaiting explicit approval
