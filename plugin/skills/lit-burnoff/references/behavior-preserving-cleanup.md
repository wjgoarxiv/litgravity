# Behavior-preserving cleanup

The goal is a smaller, clearer implementation with the same authorized behavior. "Looks generated" is no evidence. Every removal needs an existence proof, a behavior pin and a post-change falsification attempt. This file backs `lit-burnoff` (a whole scope) and `lit-burnoff-file` (one file).

## Scope and baseline

Resolve the comparison base the user named. If none was named, identify the branch point or the changed-file set and state the assumption before editing. Record dirty paths (`git status --short`) so unrelated user work stays out of the cleanup.

For every candidate capture at least one existence signal:

- the exact diff hunk or symbol;
- a structural or text search result;
- a reference or call-site result;
- a diagnostic from the repository's configured tool;
- a runtime or test observation;
- a generated-file manifest or reflection registry entry.

Classify the candidate as comment noise, redundant defense, accidental complexity, needless abstraction, boundary leakage, dead code, duplication, hidden cost, missing behavior coverage or oversized responsibility (`slop-categories.md`). A candidate that fits no category stays untouched.

## Existence proof before deletion

Check static references and the dynamic ones that apply: string lookup, reflection, registration tables, configuration files, package `exports`, command routing, manifest files, documentation that links the symbol, and generated manifests. Absence from one text search is not enough for dynamically discovered code. Search the whole repository and not only the scope. For an agy plugin, also check the route table, the hook scripts that name a skill id, the manifest and the test fixtures that pin file lists.

## Pin behavior before edits

Choose the narrowest proof that would fail if the candidate's required behavior changed:

- an existing focused test;
- a new characterization test, when the task permits tests;
- a type or lint assertion for a static contract;
- a CLI invocation with success and failure inputs;
- an HTTP, browser or desktop scenario for a user-facing path;
- a reproducible output snapshot or a parsed artifact for generated data.

Run the pin on the unchanged code and keep its decisive observable. A test added after the cleanup does not prove the old behavior. A mock-call assertion that mirrors implementation structure is weaker than a public result. When behavior cannot be pinned, mark the candidate `needs-context` and leave it in place.

## Removal rules

- **Comments.** Remove obvious comments after confirming they are not tooling markers. Keep explanations of intent, external contracts, security boundaries, compatibility constraints and surprising algorithms.
- **Defensive code.** Reduce it when the guarantee is real and enforced at a closer boundary. Keep validation for user input, network responses, persistence, filesystem operations, process output and other uncertain systems.
- **Complexity.** Flatten with guard clauses, clearer names or data-driven dispatch when evaluation order and error behavior stay the same. Concurrency, retry, transaction and cleanup semantics need a direct runtime proof before any simplification.
- **Wrappers.** Inline a wrapper when it adds no policy, isolation, instrumentation, compatibility or test seam. Architecture boundaries stay even when a direct call is shorter.
- **Deletion.** Delete after checking the references listed above.
- **Duplication.** Deduplicate when the repeated blocks represent the same concept and should evolve together. Incidental similarity is no shared abstraction.
- **Performance.** Apply a change when equivalence is straightforward and observable. A benchmark comes first for micro-optimizations, and ordering, laziness, exception timing, numeric precision and allocation lifetime stay as they are.
- **Oversized files.** Split by responsibility. Name modules after owned concepts, preserve public exports deliberately, and run import and package-surface probes afterwards.

## Bounded execution

Work in small groups that share one verification command. After each group:

1. inspect the diff for scope creep;
2. rerun the behavior pin;
3. run changed-file diagnostics (the repository's typecheck and lint);
4. search for dangling imports, routes, exports, docs and configuration;
5. keep the group when every decisive observable is still correct.

When verification fails, diagnose the smallest cause. Revert only the cleanup group you own, or edit it forward with a proven fix. Unrelated work never gets discarded to get back to green.

## Falsification pass

Try to disprove the cleanup:

- exercise empty, malformed, boundary and repeated inputs where they apply;
- bypass caches or regenerate artifacts to rule out stale success;
- inspect the actual output or state, because a summary line can say success next to an error;
- run one clean process when behavior can depend on module cache or environment;
- check packaging or installation when a removed file could still be listed in a manifest;
- verify that the dirty worktree contains only the intended cleanup plus the pre-existing work.

A critical review asks what information the removed code or prose carried and where it lives now. If the answer is "nowhere", the removal is suspect.

## Completion receipt

Report the candidates inspected, categories changed, skipped candidates with reasons, baseline pins, exact verification commands, the real-surface probe, the final diff scope and the cleanup. State whether any tests, public APIs, generated artifacts, packages, versions, commits or remote refs changed. A claim that all residue is gone applies to the bounded scope only.
