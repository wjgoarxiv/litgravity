# Wikify provenance

The wiki workflow in this skill derives from the owner source identified by these stable values:

- Owner source identifier: `llm-wikify`
- Owner source commit: `dfe8f8bc372c3bc153dd57697f4a36f366a63e74`
- Owner source tree: `ca02699317261cf36f9f89e96186728013778da6`
- Verified public locator: `https://github.com/wjgoarxiv/llm-wikify/tree/dfe8f8bc372c3bc153dd57697f4a36f366a63e74`
- License: MIT, copyright 2026 llm-wikify contributors; the full text is kept unchanged in `LICENSE`

The pinned locator identifies the verified public owner source; package integrity does not depend on network
retrieval.

What this LitGravity port carries over, and how:

- The five command modes (init, ingest, query, save, lint) are re-expressed for the agy host in `modes/*.md`, with
  agy tool names, the `.litgravity/` state directory and LitGravity's approval flow (`lit-plan`, `start-work`,
  `review-work`). The prose is rewritten for this product; the mode semantics follow the owner source.
- The five authored templates in `assets/` (home, source note, paper source note, wiki rules, maintenance report) are
  the owner source's templates. Three lines of `assets/wiki-rules-template.md` were reworded into positive form; the
  meaning is unchanged.
- `SKILL.md` and `references/*.md` are written for LitGravity. They cover the owner source's root skill (locality,
  novice onboarding, bootstrap, ingest, scientific paper ingest, query, save filters, bridge packets, lint and
  maintenance, metadata discipline) in agy vocabulary.
- `scripts/wikify-knowledge.mjs` is original LitFamily code (a dependency-free reviewed-knowledge ledger) adapted
  for LitGravity: base `.litgravity/`, the `LITGRAVITY_WIKI_BASE` override, the `litgravity` provenance product and
  the 0/1/2 exit-code contract. It contains no code from the owner source.

Excluded from the port: the owner source's tests, product docs, examples, installer and build code, release files,
caches, generated distributions and local session state. The wiki pattern is inspired by Andrej Karpathy's
llm-wiki idea.
