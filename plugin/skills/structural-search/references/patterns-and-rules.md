# Structural patterns and reusable rules

Open this reference after the engine probe in `SKILL.md` identified a real ast-grep executable. Examples write `ast-grep`; when only `sg` passed the identity check, `sg` takes its place. Command-line options drift between releases, so confirm any flag that has not yet appeared in this conversation:

```sh
ast-grep run --help
ast-grep scan --help
```

## Start from a sentence

Say the target in plain language before writing syntax:

> Match a call whose callee is `console.log`, capture every argument, and skip property reads that are never invoked.

The sentence names the root node (a call), the fixed syntax (`console.log`), the capture (`$$$ARGUMENTS`) and a boundary (property access without invocation). Translate it into the smallest valid pattern:

```sh
ast-grep run --lang ts --pattern 'console.log($$$ARGUMENTS)' src
```

A sentence that mentions ancestors, descendants, siblings, exclusions or several alternatives belongs in a YAML rule. One pattern cannot hold relationships.

## Capture behavior

### One node

`$EXPRESSION` stands for one syntax node:

```sh
ast-grep run --lang ts --pattern 'await $EXPRESSION' src
```

Use descriptive upper-case names. A wildcard-style name is fine for discovery, and named captures make rewrites and diagnostics reviewable.

### A sequence of nodes

`$$$ARGUMENTS` stands for a sequence in a grammar position that accepts several children:

```sh
ast-grep run --lang ts --pattern 'Promise.all([$$$ITEMS])' src
```

The sequence may be empty. When emptiness is invalid for the policy, add a constraint or test the arity with a more precise pattern.

### Anonymous capture and unnamed nodes

`$_` matches one node and discards it, which keeps a pattern readable when a position is irrelevant (`foo($_, $SECOND)`). A name starting with `$_` is also non-capturing, so equal names at two positions are not compared. Punctuation and keywords are unnamed nodes in the grammar; `$$NAME` (two dollars) captures one of them when a rule must see an operator.

### Repeated names

Reusing a capture name asks the matcher to compare the captured source:

```sh
ast-grep run --lang ts --pattern '$VALUE === $VALUE' src
```

This is source equality inside the matcher. Type identity and runtime equality are outside it. Pick different names when the nodes may legitimately differ.

## Valid parse context

Patterns are parsed as code in the selected language. A fragment that is invalid standalone code, or that parses as a different node than intended, needs surrounding code. Put the fragment inside valid context and select the relevant subnode in a YAML pattern object:

```yaml
id: class-field-initializer
language: TypeScript
severity: hint
message: "Selected field initializer"
rule:
  pattern:
    context: |
      class Example {
        target = $VALUE
      }
    selector: public_field_definition
```

Selector names come from the installed language grammar. Another language or another parser release spells them differently, so read the debug output on a minimal sample and record the observed node kind:

```sh
ast-grep run --lang ts --pattern 'target = $VALUE' --debug-query=ast src/example.ts
```

`--debug-query` accepts `pattern`, `ast`, `cst` and `sexp` in current releases. Confirm the accepted values in `run --help`.

### Strictness

A pattern object may carry `strictness`, which decides how literally the pattern's syntax must appear in the target. `smart` (the default) skips unnamed nodes in the target that the pattern leaves out; `cst` demands every node; `ast` compares named nodes only; `relaxed` ignores comments as well; `signature` compares only the node kinds. Raise strictness when a loose match sweeps in near-misses, and lower it when a harmless comment or punctuation difference blocks a wanted match. Record the value in the rule file so the next reader sees why.

## Inline pattern or YAML

Use an inline pattern when all of these hold:

- one syntax shape is enough;
- no ancestor, descendant, sibling, field or exclusion relation is needed;
- no reusable message or severity is wanted;
- the query is exploratory or one-off.

Use YAML when any of these apply:

- the target depends on `inside`, `has`, `precedes` or `follows`;
- alternatives or a negation are required;
- capture constraints cut false positives;
- the rule needs a stable id, message, severity, file set, test or fix;
- another rule should reuse the logic.

## Minimal reusable rule

```yaml
id: direct-console-log
language: TypeScript
severity: warning
message: "Review direct console logging"
rule:
  pattern: console.log($$$ARGUMENTS)
files:
  - "src/**/*.ts"
  - "src/**/*.tsx"
ignores:
  - "**/*.generated.ts"
  - "**/vendor/**"
```

Run one explicit file before scanning a whole configured project:

```sh
ast-grep scan --rule .litgravity/evidence/<slug>/rule.yml src/example.ts
```

Then widen to the approved target:

```sh
ast-grep scan --rule .litgravity/evidence/<slug>/rule.yml src
```

Check `scan --help` for the installed output-format and fix flags (`--json`, `--update-all`) before relying on them. For a quick one-off without a file, `scan --inline-rules '<yaml>'` takes the rule text directly, which suits fixtures in a test run.

## Rule building blocks

### Atomic matchers

Use one, or combine several:

- `pattern`: match parsed source shape and bind captures.
- `kind`: match an observed grammar node kind.
- `regex`: restrict the full text of the current node; combine it with a structural candidate to keep the search bounded.
- `nthChild`: constrain position among siblings (a number, `An+B`, or an object with `position` and `reverse`).
- `range`: constrain source position when the location itself is part of the policy.

A broad regex at the root of a large tree is slower and says less than `kind` or `pattern`.

### Relations

Relations evaluate from the current candidate node:

- `inside`: an enclosing parent or ancestor matches.
- `has`: a child or descendant matches.
- `precedes`: a matching sibling appears later.
- `follows`: a matching sibling appears earlier.

Traversal depth matters. The default looks only at the nearest neighbor, so a distant ancestor or a deeply nested descendant is missed. `stopBy` widens the walk: `neighbor` (default), `end` (walk to the root or leaves), or a rule that marks where to stop. A relation may also take `field` to require that the related node sits in a named grammar slot. Test one near and one distant example for every relation.

An `await` anywhere inside an async function:

```yaml
id: await-in-async-function
language: TypeScript
severity: hint
message: "Await inside an async function"
rule:
  pattern: await $EXPRESSION
  inside:
    pattern: async function $NAME($$$PARAMETERS) { $$$BODY }
    stopBy: end
```

The rule makes no statement about what `$EXPRESSION` resolves to.

### Boolean composition

- `all`: every child rule matches the same candidate node.
- `any`: at least one child rule matches the candidate.
- `not`: the child rule fails to match the candidate.
- `matches`: reuse a named utility rule defined in `utils` or in the project's utility directory.

Keep the candidate node explicit. When the intent is "a function contains both X and Y", the function is the candidate and the two descendant checks are separate `has` relations:

```yaml
id: function-with-log-and-return
language: TypeScript
severity: hint
message: "Function contains logging and a return"
rule:
  all:
    - kind: function_declaration
    - has:
        pattern: console.log($$$ARGUMENTS)
        stopBy: end
    - has:
        kind: return_statement
        stopBy: end
```

An `all` nested under a single `has` asks one descendant to satisfy both children, which differs from the intent above.

### Capture constraints

Constraints refine metavariables after the main pattern bound them:

```yaml
id: suspicious-handler-name
language: TypeScript
severity: warning
message: "Review handler naming"
rule:
  pattern: function $NAME($$$PARAMETERS) { $$$BODY }
constraints:
  NAME:
    regex: "^handle[A-Z].*"
```

Regex constraints see captured source text and know nothing of resolved symbols. Anchor the expression on purpose and test near-miss names.

### Local utilities

A rule file may define `utils` (named sub-rules) and reference them with `matches`. Use them when two rules share a clause, so a fix to the clause lands once. Keep utility names descriptive and test them through the rules that use them.

## Project configuration

A repository may expose rules, tests and utilities through `sgconfig.yml`:

```yaml
ruleDirs:
  - rules
testConfigs:
  - testDir: rule-tests
utilDirs:
  - rule-utils
languageGlobs:
  TypeScript:
    - "**/*.cts"
    - "**/*.mts"
```

Treat configuration as project behavior:

- create or change it only when the user asked for durable rule enrollment;
- follow the existing rule and test directory conventions;
- confirm that language glob overrides leave unrelated files alone;
- keep custom parser or injection configuration out of a one-off search;
- run the project's own rule tests when the configuration declares them (`ast-grep test`).

For a single rule, `scan --rule <path>` beats editing shared configuration.

## Language-oriented examples

These are syntax starting points. Prototype each against the project's real language version.

### TypeScript and JavaScript

```sh
# Named import declaration
ast-grep run --lang ts --pattern 'import { $$$SPECIFIERS } from $SOURCE' src

# A catch block with a bound error
ast-grep run --lang ts --pattern 'try { $$$BODY } catch ($ERROR) { $$$HANDLER }' src

# Direct method call on any receiver
ast-grep run --lang ts --pattern '$RECEIVER.map($CALLBACK)' src
```

The last pattern finds a syntactic `.map` call. Whether the receiver is an array stays unknown. Use `--lang tsx` for files with JSX.

### Python

```sh
# Decorated function
ast-grep run --lang py --pattern '@$DECORATOR
def $NAME($$$PARAMETERS):
    $$$BODY' .

# Context manager
ast-grep run --lang py --pattern 'with $RESOURCE as $NAME:
    $$$BODY' .

# Async function
ast-grep run --lang py --pattern 'async def $NAME($$$PARAMETERS):
    $$$BODY' .
```

Indentation belongs to Python syntax. When a multi-line shell pattern gets hard to audit, move it into a reviewed YAML rule and keep it out of an assembled command.

### Go

```sh
# Error guard
ast-grep run --lang go --pattern 'if $ERR != nil { $$$BODY }' .

# Deferred call
ast-grep run --lang go --pattern 'defer $FUNCTION($$$ARGUMENTS)' .
```

The first pattern compares syntax. It leaves open whether `$ERR` has the built-in `error` interface type.

### Rust

```sh
# Result propagation
ast-grep run --lang rust --pattern '$EXPRESSION?' src

# Debug macro
ast-grep run --lang rust --pattern 'dbg!($$$ARGUMENTS)' src
```

Macros can have parser-specific shapes. Validate a macro query on one known match.

### Java

```sh
# Constructor call
ast-grep run --lang java --pattern 'new $TYPE($$$ARGUMENTS)' src

# try-with-resources
ast-grep run --lang java --pattern 'try ($$$RESOURCES) { $$$BODY }' src
```

### C and C++

```sh
# Allocation call
ast-grep run --lang c --pattern 'malloc($SIZE)' src

# Smart-pointer factory
ast-grep run --lang cpp --pattern 'std::make_unique<$TYPE>($$$ARGUMENTS)' src
```

Language label spelling is version-sensitive: verify it in the installed help or language list. Preprocessor expansion and template semantics exceed pure syntax matching.

### Shell, YAML, HTML and other grammars

ast-grep ships grammars for more than the languages above (Bash, CSS, HTML, JSON, Kotlin, Lua, Ruby, Swift and others). Availability depends on the release, so list what the installed binary accepts in `run --help` before promising a language to the user. Embedded languages (script blocks inside HTML, template files) need a project-specific injection configuration, and a rule that ignores this reports zero matches in files that do contain the code.

## Rule acceptance checklist

Before keeping a rule:

- the id is stable and describes policy;
- language and file scope are explicit;
- one positive example matches;
- a formatting variant still matches where it should;
- a syntactically similar negative example stays unmatched;
- a nested relation test reaches the intended depth;
- every capture used by a message or fix is bound on every match path;
- the diagnostic tells the reader what to do beyond restating the syntax;
- any fix goes separately through the rewrite workflow's preview;
- project configuration changes, if any, are intentional and verified.
