# Wiki Rules

## Scope
- This wiki covers the current working directory only.
- It is a task-local or repo-local wiki; a global personal knowledge base lives elsewhere.
- Exact boundary for this wiki:

## Novice onboarding policy
- First-run users should not need to understand the internal folder contract before getting a useful result.
- Ask at most three first-run questions unless ambiguity blocks execution:
  1. What should this wiki remember over time?
  2. What source material exists now, and what kind of sources will keep arriving?
  3. How autonomous should the agent be while organizing it?
- If the folder is empty, offer a starter pack first: personal knowledge, research/deep dive, project handoff, book/course notes, or business/team wiki.
- If seed material is still missing, ask for three things this wiki should remember first.

## Layers
- `raw/` = immutable source inputs
- `wiki/` = maintained synthesized knowledge
- `schema/` = local conventions and operating rules
- `log/` = append-only activity history

## Naming
- Use stable, descriptive kebab-case file names.
- Prefer one concept per page.
- Avoid `misc`, `notes`, `stuff`, or other catch-all names.

## Page creation threshold
- Create a new page only if it improves navigation or prevents an existing page from becoming overloaded.
- Otherwise update an existing page.
- Do not create pages that merely mirror existing folder names or README headings without adding synthesis.

## Optional umbrella-domain / cluster policy
- Stay flat unless repeated source material, pages, or user queries show stable sub-domains under the same local boundary.
- If clusters are used, record why each cluster exists and link it from `wiki/index.md` or `wiki/home.md`.
- `wiki/shared/`, if present, is only for cross-cluster glossary terms, canonical concepts, shared decisions, or reusable comparisons.
- Split a cluster into a separate project wiki, or ask before reorganizing, when it has independent ownership, audience, privacy boundary, source stream, or maintenance cadence.
- Cluster policy for this wiki:

## Public-repo portability and privacy
- Use neutral placeholders in reusable examples.
- Do not record personal names, private paths, credentials, private exports, or machine-specific assumptions in templates.
- Preserve provenance without copying sensitive raw content into reusable docs.

## Bridge / promotion policy
- `wiki/bridges/` holds local export packets; an external or global wiki is updated only through an approved export.
- Create a bridge packet when knowledge is reusable across projects, requested for global synthesis, or would prevent future rework elsewhere.
- Do not write outside this working directory unless the user explicitly approves the destination.
- Bridge status values used here: `candidate`, `approved-to-export`, `exported`, `rejected`.
- Destination policy for this wiki:

## Optional graph / relationship lens
- Graph-style relationship analysis is optional and should not be part of first-run novice onboarding.
- Graph outputs, if used, must stay inside the current working directory unless an external destination is explicitly approved.
- Do not make graph tooling a required dependency for the local wiki.

## Scientific paper ingest policy
- Scientific papers, TeX bundles, bibliography files, supplements, and converted paper Markdown remain source material under `raw/`.
- Paper source notes should use a stable path under `wiki/sources/` unless this local wiki explicitly adopts a separate `wiki/papers/` entity layer.
- Preferred paper source-note template: `assets/paper-source-note-template.md` when available.
- Required paper metadata fields for this wiki:
- Paper importance / relevance scale, if used: 1 low, 2 background, 3 useful, 4 important, 5 core
- New topic/entity creation budget:
  - Low-importance papers:
  - High-importance papers:
- Dedup rule before creating paper-derived pages:
- Citation provenance style: parsed references | `.bib` | DOI/arXiv | Semantic Scholar | manual | unknown
- Figure/table/equation anchor style:
- TeX-bundle limitations to record: unresolved macros, missing includes, missing figures, incomplete bibliography, compile-only content, or unknown

## Optional local research relationship artifacts
- `wiki/graph/edges.jsonl`, if enabled, stores semantic relationships between local wiki pages.
- `wiki/graph/citations.jsonl`, if enabled, stores bibliographic citation relationships separately from semantic claims.
- `wiki/gaps.md`, if enabled, aggregates open questions, limitations, weak claims, and future-work leads.
- `wiki/context.md`, if enabled, is a compact query brief and must be rebuilt or marked stale after major ingest changes.
- `.ingest-manifest.json`, if enabled, tracks batch ingestion status and resume points.
- Relationship artifact policy for this wiki:

## Linking
- Prefer wiki-style internal linking where supported by the user’s markdown environment.
- Otherwise use relative markdown links.
- Chosen link format for this wiki:

## Provenance
- Important claims should point back to a source page or raw file.
- Preserve uncertainty when a source is partial, conflicting, or ambiguous.
- Durable pages should include a `Built from:` line near the top.
- For bridge packets, cite the local page(s) and source note(s) that justify export.
- Chosen source ID / provenance style for this wiki:

## Re-ingest behavior
- Re-processing the same source updates the existing source note and linked pages in place.
- Preferred duplicate-handling rule for this wiki:

## Maintenance
- Safe fixes: broken links, weak page openings, orphan-page navigation, obvious duplicates.
- Human-review items: ambiguous merges, contradictory claims, scope changes, cluster split/merge decisions, external export, graph export, or destructive reorganizations.

## Local vocabulary / quality signals
- Allowed page types:
- Allowed tags or labels, if any:
- Confidence values, if used: high, medium, low
- Contradiction marker style:
- Source drift marker style:
- Paper source drift marker style:
- Relationship edge confidence style:

## Durable page metadata
Use this block for pages expected to survive across sessions:
```markdown
Type:
Status:
Built from:
Last reviewed:
Confidence:
```
Do not force it onto tiny scratch pages.
