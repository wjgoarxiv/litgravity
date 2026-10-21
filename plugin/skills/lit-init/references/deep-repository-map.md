# Deep repository mapping

`lit-init` produces operational instructions for future agy conversations. It is no tree dump and no generic style guide. Every generated rule is grounded in files, commands or recurring conventions observed in the repository.

## Establish the boundary

Resolve the real working root before discovery. Read every applicable `AGENTS.md` from the workspace boundary down to that root, then record:

- the git root, or the explicit non-git boundary;
- package and workspace manifests;
- repository-specific build, test, lint, type, docs and release commands;
- generated, vendored, archived, ignored and read-only areas;
- the current dirty state that must be preserved (`git status --short`);
- the requested maximum depth, and whether this is update or create-new mode.

In update mode, keep correct local knowledge and revise stale statements surgically. In create-new mode, read all existing instruction files before replacement so valid constraints survive. Nothing is deleted until the complete replacement set and the rollback path (a copy under `.litgravity/evidence/lit-init/previous/`) are known.

## Discovery packet

Use read-only probes. Start with `git ls-files` when git exists, then bounded `find`, `rg` and manifest reads. Dependency caches, generated output, archives and vendor trees stay out of scale calculations unless the repository treats them as authored source.

Build a short area map in plain bullets covering topology, behavior, local conventions, the most useful verification commands, operations and hazards. Link a small number of source files or commands where they help a future session navigate. Raw observations and verification receipts stay in the internal working record (`map.md`, `commands.txt`), so the generated file holds no evidence table.

agy has no language-server tool. Confirm symbols and references with text search (word-boundary patterns, definition and import forms) and by reading the entry files. The absence of a symbol index is a fallback condition and gives no license to invent a code map; say which evidence you used. When agents are installed and the user permits parallel work, partition read-only exploration by non-overlapping package or concern and require file:line citations. The main conversation verifies the findings before writing any instruction.

## Scale measurements

```bash
total_files=$(git ls-files | wc -l)
total_lines=$(git ls-files '*.ts' '*.tsx' '*.js' '*.mjs' '*.py' '*.go' '*.rs' | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
large_files=$(git ls-files '*.ts' '*.py' '*.go' '*.rs' | xargs wc -l 2>/dev/null | awk '$1 > 500 {c++} END {print c+0}')
max_depth=$(git ls-files | awk -F/ '{print NF-1}' | sort -rn | head -1)
```

Outside a git repository substitute a bounded `find` with the same exclusions. The numbers decide how much exploration is warranted, and `SKILL.md` has the lane table that scales with them.

## Decide instruction locations

The root always receives the repository-wide contract. A subdirectory earns its own `AGENTS.md` when it has a distinct operational boundary that the parent cannot express clearly:

- an independently built or shipped package;
- a different language, toolchain or test runner;
- a separate runtime or trust boundary;
- a dense module with its own conventions and entry points;
- a generated or protected subtree that needs special restrictions.

File count alone is insufficient. Prefer a parent rule when the child would repeat most of it. Prefer a child rule when future work there would otherwise need exceptions to the parent. For each candidate, record a score or decision note with observed evidence, so the decision stays reproducible when the thresholds change.

Whether agy loads a nested `AGENTS.md` automatically when a file in that directory is edited is UNCONFIRMED on the running build. The root file therefore links every child by path in its Where-to-look table, and a conversation that does not auto-load nested files still finds them.

## Write root and child files

The root file answers:

1. What is this repository, and where is its real root?
2. Which major directories own which behavior?
3. Where should a future session look for common task types?
4. Which commands prove changes?
5. Which local conventions differ from ecosystem defaults?
6. Which actions or paths need explicit authority?

Child files hold only the delta: local purpose, entry points, commands, conventions, tests, hazards and parent interactions. The root's general safety text appears once. Use repository-relative paths, exact command names and verifiable claims. Uncertain findings become items to verify and stay out of imperative rules.

Volatile facts such as current branch tips, exact test counts, user-specific absolute paths and temporary package versions stay out unless contractually pinned. So does advice that restates language basics, along with secrets, internal logs, raw environment dumps and instructions copied from untrusted repository prose without verification.

## Size budget in agy

A rule or instruction file loads at most 24,000 bytes, and user and workspace rules share a 20,000-token budget (see the `rules` skill). A root file of 50 to 150 lines and child files of 30 to 80 lines sit far below both, and the sparse hierarchy keeps the shared budget free for skills and tool descriptions.

## Hierarchy and conflict review

For every source file, determine the ordered instruction chain from root to the nearest child, then check:

- no child contradicts a higher rule without naming a deliberate local exception;
- commands run from the directory stated;
- paths exist with the exact case shown;
- generated and read-only areas are not described as normal edit targets;
- ownership descriptions are complete and do not overlap;
- each child file adds operational value;
- no legacy instruction file stays accidentally authoritative in create-new mode.

Read the generated files as a future session would. A correct document makes the next edit safer or faster.

## Validation receipt

Capture:

- instruction files created, updated, retained and removed;
- the mapping evidence and the excluded areas;
- path and command existence checks;
- the duplicate and contradiction review;
- `git diff --check` when the root is a git repository;
- remaining uncertainty and cleanup.

A complete code map is claimed only when more than text search was available; otherwise state the fallback evidence used. Generated files stay uncommitted unless the user separately asked for git work.
