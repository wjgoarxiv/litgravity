# Wiki layout, page types and metadata

Read this when bootstrapping, when a page type is in doubt, or when lint reports schema drift. Paths are relative to the wiki base (default `.litgravity/`).

## Full default layout

```text
raw/                    immutable sources the user drops in; read, hash, never rewritten
wiki/
  home.md               start page for someone arriving cold
  index.md              catalog, grouped by section, one line per page
  topics/               concepts, mechanisms, workflows, comparisons, decisions
  entities/             named systems, tools, teams, services, components (only when useful)
  sources/              one note per source or source bundle
  bridges/              export packets for knowledge that should travel
  conversations/        handoff notes written by save (only when the handoff filter fires)
  maintenance/          lint maintenance reports, one per fix run
  .knowledge/           claims.jsonl and settings.json, owned by scripts/wikify-knowledge.mjs
schema/
  wiki-rules.md         the local contract (from assets/wiki-rules-template.md)
log/
  log.md                append-only history of bootstrap, ingest, query, save, lint, bridge
```

This is the default shape. A repo that already keeps a better local structure (a `docs/` tree with an index) keeps it; the wiki links into it and records the choice in `schema/wiki-rules.md`.

## The reduced form

For a small task the whole wiki can be `wiki/index.md` plus `wiki/<slug>.md` pages, one per topic, listed in the index. Record "flat layout" in the rules file. Move to folders when the index passes roughly thirty entries or when sources need their own notes.

Flat page template:

```markdown
# <Title>

Status: current | stale | superseded by [<slug>](<slug>.md)
Updated: YYYY-MM-DD
Scope: <what this page covers, one line>

## Facts
- <claim> — source: <path:line | exact command | URL> (checked YYYY-MM-DD)

## Decisions
- YYYY-MM-DD — <decision> because <reason>. Source: <...>

## Open questions
- <question> — raised YYYY-MM-DD

## Related
- [<other page>](<slug>.md)
```

## Optional categories (evidence-gated)

Create each one only when the material proves it, and record it in `schema/wiki-rules.md`:

| Folder | Earns its place when | Holds |
| --- | --- | --- |
| `decisions/` | three or more decisions with owners and reasons accumulate | decision, rationale, owner, date, status |
| `errors/` | a failed approach must stay untried and keeps coming up | what failed, the evidence, what to do instead |
| `conversations/` | the handoff filter fires in save | what was done, decisions, open items, pages to read first |
| `projects/`, `design/`, `dev-tasks/` | the task really has parallel workstreams with their own pages | one folder per stream |
| `shared/` | clusters exist and some concepts cross them | glossary, canonical concepts, shared comparisons |
| `clusters/<cluster>/` | stable sub-domains recur (see below) | a cluster home, topics, sources |
| `graph/` | paper mode or relationship tracking is enabled | `edges.jsonl`, `citations.jsonl` (see `references/paper-notes.md`) |

## Page types

- **home.md**: what the wiki is about, the current focus, where to start, the two to four most useful pages. Written for a person who has never seen the folder contract.
- **index.md**: every persistent page, by section. Line format: `- [<title>](<path>) — <one-line summary> (updated YYYY-MM-DD, status: current|stale|superseded)`.
- **sources/*.md**: one per important source or bundle: identity, a short summary, what changed in the wiki because of it, contradictions and open questions. Papers add metadata, methods, anchors, citation context, limitations and drift (`assets/paper-source-note-template.md`).
- **topics/*.md**: a concept that appears across several sources, is linked from more than one page, or would overload an existing page. Otherwise extend an existing page.
- **entities/*.md**: rare in small repos. A name mentioned once, or with no navigation value, stays inside a topic or source page.
- **bridges/*.md**: export packets with a status of `candidate`, `approved-to-export`, `exported` or `rejected` (see `references/bridge-and-promotion.md`).

## Metadata: pick one style per wiki

Grounding block, near the top of a durable page:

```markdown
Type: topic | entity | source | decision | comparison | bridge
Status: draft | active | stale | candidate | exported | rejected
Built from: README.md, raw/<source-file>, [[sources/<note>]]
Last reviewed: YYYY-MM-DD
Confidence: high | medium | low
```

YAML frontmatter, for wikis that want machine-readable headers:

```markdown
---
type: decision | source | concept | error | project | design | dev-task | handoff
date: YYYY-MM-DD
status: draft | active | stale | superseded
source: raw/<source-file> or [[sources/<note>]]
---
```

Rules: record the chosen style in `schema/wiki-rules.md`; leave metadata off tiny scratch pages and put it on every page expected to survive the session; define any tag vocabulary in the rules file before using it; record new page types and status labels there too; record source hashes or mtimes when available so drift is detectable.

## Naming and the MECE check

- Slugs are lowercase kebab-case, at most 60 characters, stable once created. Renaming breaks inbound links; change the title instead.
- One concept per page. Names such as `misc`, `notes`, `stuff`, `random` are refused; find the concept the page is really about.
- Folders should be mutually exclusive and, at the scale the project justifies, collectively exhaustive. When two folders are hard to tell apart, merge them.

## Clusters (advanced)

Stay flat while the wiki has one audience and one cadence, home and index remain easy to scan, and sources do not repeatedly fall into the same sub-domains. Add clusters when the directory deliberately covers one large coherent domain, at least two stable sub-domains recur with enough material for a cluster home, and the clusters share boundary, ownership, audience and maintenance loop. Split into a separate wiki (after asking) when a cluster has its own owner, audience, confidentiality boundary, source stream or cadence.

```text
wiki/
  home.md  index.md  topics/  sources/  bridges/
  shared/                glossary, canonical concepts, shared decisions
  clusters/<cluster>/    home.md, topics/, sources/ (each only if justified)
```

`shared/` holds concepts that genuinely cross clusters; everything else lives in its cluster.

## log/log.md format

Append-only, one heading per action so the history parses:

```markdown
## [2026-04-06] bootstrap | initialized local wiki
- Created wiki/home.md, wiki/index.md, schema/wiki-rules.md
- Seeded topic pages for project structure and workflow

## [2026-04-07] ingest | vendor-api-export
- Added source note: wiki/sources/vendor-api-export.md
- Updated wiki/topics/integration-pitfalls.md
- raw/vendor-api-export.json sha256 unchanged (3f2a…)
```

Action words: `bootstrap`, `ingest`, `query`, `save`, `lint`, `bridge`, `review`. A query is logged only when it changed the wiki.

## schema/wiki-rules.md checklist

Written at bootstrap so later sessions follow the same contract (start from `assets/wiki-rules-template.md`):

- the boundary: folder, subproject or repository, written as an exact path;
- what belongs in `raw/` and what in `wiki/`;
- naming conventions and the link style (wiki links or relative Markdown links);
- the provenance style and the metadata style;
- the page-creation threshold and the re-ingest rule;
- how maintenance reports are recorded;
- whether bridge packets are allowed, where they live, and what approval an export needs;
- whether clusters and `shared/` are allowed and what justifies them;
- whether paper mode is used, its required metadata fields, and which relationship artifacts are enabled;
- the tag, type, status and confidence vocabulary;
- how contradictions and source drift are marked;
- whether knowledge capture is on (it is by default; `config --capture off` is the opt-out).
