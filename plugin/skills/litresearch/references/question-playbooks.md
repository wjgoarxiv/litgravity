# Playbooks by question type

Pick the playbook that matches the demand, copy its axes into `questions.md`, and adjust. A demand that spans two types (a survey that ends in a version check) uses both and keeps the axis keys distinct.

## Survey and landscape ("how do others handle X", "what are the options for Y")

- **Axes:** the problem definition and its vocabulary; the named approaches; implementations of each; evaluations and benchmarks; failure reports and migrations away.
- **First moves:** collect the vocabulary first (two or three searches for synonyms), because each community names the problem differently. Then one lane per approach family.
- **Settled when:** each approach has a primary description (its documentation or paper), at least one real implementation pinned to a commit, and a known limitation from an independent source.
- **Output shape:** a comparison table (approach, how it works, where it is used, limits, sources) followed by a recommendation tied to the user's constraints.
- **Watch for:** vendor comparison pages that rank their own product first; count them as T4 for rankings and T1 only for their own features.

## Prior art ("has anyone solved this", "is this idea new")

- **Axes:** exact-match search; paraphrase search with the problem's mechanism; adjacent fields that solve the same structure; code hosts; papers and patents when relevant.
- **First moves:** write the idea as three different one-line mechanisms and search each. Search the mechanism without the product vocabulary.
- **Settled when:** the closest three to five prior works are found with dates, and the difference between each and the user's idea is stated in one line.
- **Boundary rule:** "no prior art found" names the search boundary (queries, sources, date range). The finding reads "none found within this boundary".

## Version and compatibility ("does Z support W since N", "will upgrading break us")

- **Axes:** the version in use (from the lockfile or manifest, read with `read_file`); the changelog between that version and the target; the migration guide; open issues tagged for the feature; the source at both tags.
- **First moves:** read the lockfile first. Then the changelog and the tag diff. Documentation for the latest release can describe behavior the pinned version lacks.
- **Settled when:** the claim is tied to a specific version range with a T1 source, and behavioral claims have a probe at the pinned version.
- **Verdict trap:** `OUTDATED` applies when the evidence is true for another version than the one in use.

## Standards, legal and policy

- **Axes:** the controlling text and its effective date; official guidance or interpretation; amendments, errata and superseding documents; jurisdiction or scope limits.
- **First moves:** go to the issuing body's site. Read the version in force on the date the user cares about.
- **Settled when:** the answer quotes the controlling clause with its section number and effective date, and every amendment after that date was checked.
- **Boundary:** research reports what the text says and where sources disagree. For a legal decision, say that a qualified professional should confirm; give that line once.

## Scientific literature

- **Axes:** foundational papers; recent surveys; the specific result in question and its method; replications and critiques; datasets.
- **First moves:** find one recent survey, then walk its references and its citing papers. Normalize every DOI (see `ledger-and-evidence.md`).
- **Settled when:** the reported result has its original paper (T1 primary-measured), its method and sample stated, and any replication or critique found.
- **Watch for:** press coverage that rounds or generalizes a result; quote the paper's own numbers with units and conditions.

## Market, numbers and dated facts

- **Axes:** the primary dataset or filing; independent measurements; the definition used by each source; the observation date of each number.
- **Rule:** every number here is high-risk and passes the claim gate in `disputed-claims.md`. Two sources with different definitions are two different claims; report both with their definitions.

## Repository-internal questions

- **Axes by surface:** package manifest and pack boundary; hooks and routes; skills and agents; runtime library; tests and scanners; release checklist.
- **First moves:** `read_file` on `AGENTS.md` and the manifest, then `rg` through `run_command` for the terms in question, then `git log -S '<term>' --all` for history.
- **Settled when:** each finding has `path:line`, the commit, and the command that verifies it. Untracked handoff or evidence files are clues until tracked source and live output agree.
- **Quantities:** record the exact measurement method (glob, splitting rule, whether frontmatter and code fences count). A threshold given by the user is an input. Report the current total and the gap.
- **Small-slice stop:** once local files name the test to extend, the files to edit, the method and the gates, record `local evidence sufficient` and stop. Web lanes join only when the task depends on current external behavior.

## Host facts (questions about agy itself)

- **Axes:** official release notes; `agy --help` and subcommand help; `agy plugin validate --json` output; probes in a throwaway workspace.
- **Rule:** facts are build-specific. Cite the build (`agy --version`). A feature documented upstream that your tool list lacks is reported as "documented upstream, unavailable in this conversation". Model-calling probes (`agy -p`) cost quota; use them only when the user approved that budget.
- **Boundary:** credential files under the user's home stay closed. Stop at `auth-required` and ask for an exported excerpt.

## Exact-output requests ("five bullets, one official link each")

1. Transcribe every named category from the prompt as its own checkbox. Split compound categories into the subtopics they contain.
2. Build the coverage matrix:

```text
row | requested fact or category | version or period | primary source | supporting passage | allowed host? | status
1   | <category>                 | <version>         | <URL>          | "<quote>"          | yes           | supported
```

3. Reserve one output slot per required category before adding secondary facts. A line that deepens a covered category leaves a missing one missing.
4. Resolve the named primary document first. When the user asks for a migration guide and one exists, a neighbouring release note does not stand in for it.
5. Use each search to close a remaining gap, changing the angle each time, and read the page before accepting the claim.
6. For comparisons, check both sides and the stated transition between them.
7. Before writing, every row is supported or marked specifically unavailable. Then check line count, shape, one link per required line, allowed hosts, and that no unsupported number slipped in.
