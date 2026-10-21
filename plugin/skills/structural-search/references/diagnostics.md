# Structural-search diagnostics

Diagnose the matcher before changing the repository. A zero-result query may mean "no matching syntax", and it may equally mean the wrong parser, an invalid pattern root, shell expansion, ignored files, unsupported syntax or a traversal boundary. Each section below pairs a symptom with checks, ordered from cheapest to most expensive.

## Diagnostic order

Each step removes one class of uncertainty:

1. verify executable identity and version;
2. verify the target path exists and contains a known example;
3. verify the selected language;
4. verify shell quoting;
5. run on one minimal positive sample;
6. inspect how the pattern parses;
7. simplify to a larger stable node;
8. add captures and relations one at a time;
9. inspect ignores and globs;
10. expand to the real target after the sample works.

A repository-wide scan waits until the same query succeeds on a ten-line sample. Write the sample under `.litgravity/evidence/<slug>/fixtures/` so the calibration stays reproducible.

## Executable confusion

Symptom: `sg` exists, but flags are rejected or the output has nothing to do with source parsing.

Check:

```sh
command -v sg
sg --version 2>&1
```

Proceed when the version output names ast-grep. Otherwise leave `sg` alone and use the validated `ast-grep` binary, a labelled `rg` fallback, or a blocker. On Linux the unrelated utility from shadow-utils owns the name `sg`; macOS and most Windows setups have no competing `sg`, and the version check settles which case applies.

## Command refused or missing in the run

Symptom: the probe never printed an answer, or the host answered that the command is not permitted.

- Interactive session: ask the user to allow the `run_command` call, then repeat the probe once.
- Headless `agy -p` run: a refused `run_command` ends the run, so no later step executes. Report `BLOCKED: run_command refused`, list the exact commands for the user's terminal, and attach whatever `read_file` and the fixtures already established.
- Binary absent: follow the missing-binary path in `SKILL.md`. Installing software is the user's decision.

## Shell expansion

Symptom: a pattern containing `$NAME` becomes empty, returns surprising results, or behaves differently in an interactive shell and in a script.

Cause: double quotes or an unquoted argument let the shell expand the metavariable.

Use single quotes:

```sh
ast-grep run --lang ts --pattern 'console.log($$$ARGUMENTS)' src
```

Pass each pattern, path and option as its own argument. A command string assembled from pieces re-introduces expansion and injection risk, and `run_command` shows the final string in the permission prompt, so a quoting slip is visible to the user as well.

## Known source exists, zero matches

### Wrong language

Check the project metadata and the actual file. `.h`, templates, embedded code, component files with script blocks and nonstandard extensions are the ambiguous ones. Pass an explicit language and test a minimal file with the same syntax version.

### Pattern is invalid standalone code

A class member, decorator attachment, list element or partial control-flow form may need surrounding context. Move to a YAML pattern object with valid context and select the intended node with `selector`.

### Pattern root differs from the target root

The parser may treat the snippet as a larger or smaller node than expected. When the installed CLI supports pattern debug output, inspect it:

```sh
ast-grep run \
  --lang ts \
  --pattern '$OBJECT.$METHOD($$$ARGUMENTS)' \
  --debug-query=pattern \
  src/example.ts
```

Confirm the option in `run --help`. If it is absent, simplify the pattern and use a known source file to infer the root.

### Reused captures over-constrain

`$VALUE === $VALUE` excludes comparisons whose two source expressions differ. Rename captures when equality was never intended:

```text
$LEFT === $RIGHT
```

### Sequence capture sits in the wrong grammar position

`$$$ITEMS` represents a sequence where the grammar admits one. Move it to an argument list, statement body, import list, array, parameter list or another repeated-child position.

### Traversal stops early

An ancestor or descendant relation may inspect only a near neighbor until `stopBy` says otherwise. Add an explicit traversal boundary supported by the installed rule schema, then test both immediate and distant nesting.

### Files were ignored

Check:

- `.gitignore` and tool-specific ignores;
- rule-level `files` and `ignores`;
- explicit globs;
- the current working directory;
- symlink behavior;
- generated and vendor exclusions the operator added.

Target one known path explicitly before touching ignore behavior. Switching off every ignore as a first reaction pulls dependency trees into the scan.

### Strictness hides a match

A smart-strictness pattern tolerates unnamed nodes the pattern omits, and a cst pattern requires them. When two spellings of the same construct differ in matching, test the same pattern at another `strictness` in a YAML pattern object and record which value fits.

## Too many matches

Cut false positives in this order:

1. anchor more fixed syntax in `pattern`;
2. use an observed `kind`;
3. constrain a capture;
4. add a required ancestor or descendant relation;
5. exclude a syntax alternative with `not`;
6. narrow file paths and language globs;
7. add a bounded regex to an already structural candidate.

Starting with a repository-wide regex rule gives the parser little to do and may run slower than `rg`.

## YAML parse or schema errors

Check:

- spaces instead of tabs;
- quotes around strings containing `:`, `{`, `}`, `#` or a leading special character;
- correct nesting under `rule`;
- one top-level `id` and `language`;
- a severity valid for the installed version;
- capture names in `constraints`, messages, transforms and fixes;
- installed support for experimental transform and rewriter fields;
- YAML document separators when one file holds several rules.

Quote pattern strings when YAML could read their punctuation:

```yaml
rule:
  pattern: "console.log($$$ARGUMENTS)"
```

For multi-line code use a block scalar:

```yaml
rule:
  pattern: |
    if ($CONDITION) {
      $$$BODY
    }
```

## Rule matches the relation, but not the intended node

Composite children are evaluated against one candidate node. When the policy says a function contains two different constructs, make the function the candidate and use two `has` relations. A single `has` with an `all` inside asks one descendant to satisfy both children.

Likewise `inside` reports the inner candidate, and the enclosing function stays unhighlighted. Swap the candidate and the relation when the diagnostic should point at the outer node.

## Regex surprises

In a structural rule, regex examines the text of the current node or capture:

- anchor it when full-node matching is intended;
- combine it with `kind` or `pattern`;
- remember that comments and trivia may or may not be part of the selected node text;
- identifier binding is out of reach of spelling;
- reach for `rg` when raw text is the real requirement.

## Unsupported semantic question

Syntax shape alone cannot prove:

- whether two identifiers resolve to the same declaration;
- the inferred or runtime type of a receiver;
- import resolution and re-export identity;
- data flow from source to sink;
- reachability and dead code;
- side effects or purity;
- whether a promise is eventually awaited through another abstraction;
- macro expansion or preprocessor behavior;
- behavioral equivalence of a rewrite.

Use a compiler, the checker CLIs and `lsp`, a type-aware linter, a security analyzer or the project tests. A structural query can generate candidates for those tools and cannot replace them.

## Slow scan

First verify the task needs structure. Literal text goes to `rg`.

For structural scans:

- narrow the roots;
- exclude dependency, build, cache, generated and vendor trees;
- select one language;
- start with `pattern` or `kind`;
- apply regex after candidate reduction;
- split unrelated alternatives into separate measurable rules;
- bound deep `stopBy: end` traversal with an intermediate ancestor where one exists;
- record timing after a warm-up when performance itself is under evaluation.

Correctness comes first: an undocumented file omission would trade a wrong answer for speed.

## Parse errors in some files

Likely causes:

- the project uses newer syntax than the bundled grammar;
- an extension maps to the wrong language;
- a file is a template or generated hybrid;
- the source is incomplete or intentionally invalid;
- preprocessing is required before parsing.

Identify the exact failing files. A report of full-repository coverage is wrong when in-scope files failed to parse. Options:

- upgrade the explicitly authorized project or tool dependency;
- use a project-specific parser or codemod;
- split supported and unsupported path sets in the report;
- use textual candidate search with an explicit limitation;
- stop the rewrite.

## Unexpected rewrite output

Stop applying. Inspect:

```sh
git status --short
git diff --check
git diff --name-only
git diff -- <unexpected-file>
```

Common causes:

- a greedy sequence capture consumed a larger list than expected;
- the replacement omitted a capture;
- the match root included punctuation or comments;
- a relation selected a different node than the highlighted syntax suggested;
- the target scope included generated files;
- an output or fix flag behaved differently in the installed version.

Reduce to one file and return to the preview. Recover task-owned edits only, with a scoped restore of the manifest paths.

## `rg` fallback diagnostics

When ast-grep is unavailable, a text query still answers:

- whether a literal string appears;
- which files mention an API spelling;
- where comments hold a marker;
- candidate locations for later structural review.

It leaves these open:

- node type;
- nesting or parent relation;
- argument count;
- declaration versus use;
- code versus comment or string;
- formatting-insensitive completeness;
- safe replacement boundaries.

Phrase results as "textual candidates" and include the exact regex and glob exclusions. Tag the reply `TEXT FALLBACK: may over- or under-match`.

## Evidence template

Record, in `.litgravity/evidence/<slug>/diagnosis.md`:

```text
engine:
version:
query class:
language:
pattern or rule path:
target roots:
exclusions:
known positive:
known negative:
result count:
parse failures:
exit status:
next verifier:
cleanup:
```

For zero matches, add which diagnostic steps were completed. For excessive matches, record the false-positive classes and the constraint that removed each class.
