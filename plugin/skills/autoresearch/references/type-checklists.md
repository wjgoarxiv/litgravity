# Readiness checklists for `ship` mode

`modes/ship.md` prepares a reversible readiness packet and stops at a human decision. Its first phase identifies the artifact type; this file gives the checklist for each type. Read it with `read_file` once the type is known, copy the matching list into `ship-log.md` under the artifact root, and work through it item by item.

## Authority

Ship mode verifies; it never releases. The approved packet names the artifact, the destination the user has in mind, the commands allowed for verification (tests, build, pack in dry-run form), the roots and the budget. Publishing, deploying, tagging, pushing, bumping a version, changing a registry or host configuration: each of these is an irreversible action that a person performs after reading the packet. When a checklist item can only be proven by doing one of these, mark it `needs human` and name the action.

## Marking items

Each item ends as one of:

- `ok`: verified, with the command and its exit status or the file and line;
- `failed`: verified as wrong; the packet lists it as a blocker;
- `unverified`: the check could not run (tool missing, access missing); readiness cannot be claimed on it;
- `needs human`: proving it requires an irreversible or external action;
- `n/a`: does not apply to this artifact, with a reason.

The final verdict is `READY_FOR_HUMAN_DECISION` only when no item is `failed` or `unverified`; otherwise `BLOCKED_READINESS`. Both verdicts are statements about evidence. Neither says the artifact was released.

## 1. Library or package

Destinations: a language package registry.

- [ ] Changelog has an entry for this version, including breaking changes and the migration path.
- [ ] Every version-bearing file agrees (manifest, lockfile root, source constant, docs). Read them; changing them is a separate approval.
- [ ] README shows install and a quickstart that actually runs against the built package.
- [ ] Public functions and types have docs or type signatures.
- [ ] The test suite passes from a clean install (`npm ci && npm test`, `python -m pytest`, `cargo test`).
- [ ] No secrets in source, history of this change, or the package contents.
- [ ] A licence file is present and matches the manifest's licence field.
- [ ] The packed contents match intent: `npm pack --dry-run --json` (read the `files` array), `python -m build` then list the archive, `cargo package --list`.
- [ ] Ignore rules keep build output, dev config and local state out of the package.

## 2. Command-line tool

Destinations: a package registry, a downloadable binary, an install script.

- [ ] `--help` matches the commands and flags that exist.
- [ ] `--version` prints the version the manifest declares.
- [ ] Each command was run end to end on a real input, with output saved.
- [ ] Exit codes are consistent and documented (0 success, non-zero failure, distinct codes where the docs promise them).
- [ ] No paths that only exist on the developer's machine.
- [ ] Builds exist for every platform and architecture the README lists.
- [ ] Shell completions, if shipped, match the current commands.
- [ ] Changelog and README install steps updated; the test suite passes.

## 3. HTTP API

Destinations: a hosted environment or a self-managed server.

- [ ] Every endpoint's request and response schema is documented (an OpenAPI file or equivalent) and matches the code.
- [ ] Authentication and authorization tested per route, including the denied cases.
- [ ] Unit and integration tests pass.
- [ ] Required environment variables are listed in an example file with no real values.
- [ ] Rate limits configured on public and sign-in routes.
- [ ] A health endpoint answers 200 when the service is ready.
- [ ] Database migrations are backward compatible, or the rollout and rollback order is written down.
- [ ] Errors return one consistent JSON shape with a useful message and no internals.
- [ ] Cross-origin policy restricted to the intended origins.
- [ ] The API version appears in the path or a header.

## 4. Web application

Destinations: a static host, a container platform, a self-managed server.

- [ ] Unit and end-to-end tests pass.
- [ ] The production build completes with no errors or new warnings.
- [ ] Production environment values are set in the deploy target and absent from the repository.
- [ ] The main user flows were exercised in a real browser with no console errors (the `visual-qa` skill captures this).
- [ ] An accessibility and performance audit of the key pages meets the bar the plan set (for example a score of 80 or more in each).
- [ ] `robots.txt` and the sitemap are correct for the environment.
- [ ] A Content-Security-Policy header is configured.
- [ ] Not-found and error pages are helpful.
- [ ] Links on key pages resolve.
- [ ] Error reporting or analytics configured when the plan calls for them.

## 5. Model or dataset

Destinations: a model or dataset hub, object storage, a model registry.

- [ ] A model or dataset card covers architecture or schema, sources, intended use, limits and evaluation.
- [ ] Evaluation numbers come from a held-out split, and the split is named.
- [ ] Licences of weights, code and training data are compatible and stated.
- [ ] An inference or loading example runs and gives the documented output.
- [ ] Known failure modes and biases are written in the card.
- [ ] Size and hardware needs are stated.
- [ ] Training code, configuration and hyperparameters are versioned.
- [ ] No personal data in the dataset or artifacts, or a documented legal basis.
- [ ] The source commit or version is recorded in the artifact metadata.
- [ ] Seeds and environment are pinned so the result can be reproduced.

## 6. Skill or prompt for agy

Destinations: a plugin bundle loaded by agy, a skill folder in a repository.

- [ ] `SKILL.md` frontmatter is exactly `name` (equal to the folder name) and a double-quoted one-line `description` of 20 to 220 bytes.
- [ ] The body after the frontmatter stays at or under 23,500 bytes; agy loads only the first 24,000. Detail lives in `references/`, `templates/` or `scripts/`.
- [ ] Every relative path the skill documents name (`references/…`, `scripts/…`, `templates/…`, `assets/…`) exists; illustrative paths sit in code fences with `<placeholder>` parts.
- [ ] Tool names match agy (`read_file`, `write_file`, `run_command`, `ask_question`, `invoke_subagent`, `send_message`, `search_web`, `read_url_content`), and the text tells the model to use the alias its build offers.
- [ ] State goes under `.litgravity/` (`goals/`, `ledger/`, `evidence/<slug>/`) and nowhere else.
- [ ] Scripts are Node ESM with no dependencies, refuse symlinks, and exit 0 pass, 1 findings, 2 usage; `node --check` passes on each.
- [ ] An engine, if any, answers `status --json` and installs only under `$XDG_DATA_HOME/litgravity/runtime/<name>`.
- [ ] The skill states when to use it, its inputs and state, a numbered procedure, evidence, the stop and report shape, and pitfalls.
- [ ] Untrusted input (pages, logs, fixtures, tool output) is named as data.
- [ ] `agy plugin validate <plugin-dir> --json --strict` reports no findings, and the repository's structural tests pass.
- [ ] The skill was exercised on at least two representative prompts, within the agreed model-call budget, and the transcripts are saved.
- [ ] Route words and listings that should reach the skill are enrolled in the plugin's own router and help output.

## 7. Documentation site

Destinations: a static docs host or an internal wiki.

- [ ] The build completes cleanly with the site generator the project uses.
- [ ] No broken internal or external links (a link checker run, saved).
- [ ] The search index is rebuilt.
- [ ] Versioned pages match the software version being documented.
- [ ] Code samples were run.
- [ ] Images carry alt text.
- [ ] Navigation reaches every page; no orphans.
- [ ] A helpful not-found page exists.
- [ ] Redirects cover moved or renamed pages.

## 8. Infrastructure as code

Destinations: a cloud account, a cluster, an infrastructure state backend.

- [ ] The plan or preview command (`terraform plan`, `pulumi preview`, a synth step) completes with no errors, and its output is saved.
- [ ] The plan was read for deletions and replacements; each one is intended and listed.
- [ ] Secrets come from a secret manager; none in the code or variables files.
- [ ] State is remote and locked.
- [ ] Permissions follow least privilege.
- [ ] Resources carry the required tags (environment, owner, cost centre).
- [ ] A rollback procedure exists for a failure partway through apply.
- [ ] The change was applied to a non-production environment first, with evidence.
- [ ] Cost impact estimated.
- [ ] Blast radius written down: which services the change can affect.

## 9. Research paper or report

Destinations: a preprint server, a journal or conference, an internal report.

- [ ] The abstract matches the contributions the body supports.
- [ ] Every claim cites a source or a result shown in the paper.
- [ ] Code, data and seeds are available, or the reason they are not is stated.
- [ ] Each figure caption stands on its own.
- [ ] Related work covers the obvious prior art.
- [ ] A limitations section exists where the venue expects one; otherwise material risks are stated once in the summary.
- [ ] Authors and affiliations confirmed with each author.
- [ ] Supplementary material is referenced correctly from the main text.
- [ ] Spelling and grammar checked on the final draft.
- [ ] Submission metadata (title, abstract, categories) reviewed.

## Adding a type

When the artifact fits none of the above, write a checklist with the same shape in `ship-log.md`: destination, eight to twelve items, each provable by a command or a file reference, and the irreversible actions listed separately as `needs human`. Ask the user to confirm the list with `ask_question` before checking it (headless: record the list as a `decision` and proceed with it).
