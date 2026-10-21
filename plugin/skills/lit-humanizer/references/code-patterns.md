# Code and developer-writing patterns

Comments, docstrings, commit messages, pull request descriptions, READMEs and changelogs are prose with a technical reader. This file covers the tells that show up in them (CODE-01 to CODE-12) and the line where prose editing stops and code review begins. Detector rules: `code-narrating-comment` (warn), `code-defensive-guard` (warn), `code-ai-attribution` (block). Manual cue: `manual-one-use-abstraction`.

## Where prose editing stops

The humanizer edits words. Executable structure belongs to code review, and a shorter implementation is not automatically a better one. When a pattern below touches behavior (CODE-03 to CODE-07, CODE-12), the edit is a code change: it needs the repository's tests to pass before and after, and it belongs in a diff the user asked for. When the user asked only for prose polish, report the code observation and leave the code unchanged.

Keep, whatever the detector says:

- validation at untrusted input boundaries (user input, files, network, environment variables);
- checks that prevent data corruption or loss, and error handling that preserves data;
- permission and authorization checks;
- accessibility behavior;
- cleanup on failure (temporary files, locks, transactions);
- branches that handle real platform variation.

Remove a defensive branch only when an upstream type or contract provably guarantees the value at that call site. A detector warning is a prompt to check, never static-analysis proof.

## CODE-01 | Comments that narrate the next line

- What and why: The comment restates the operation and gives no reason. The reader reads everything twice and learns nothing about intent.
- Detect: Cover the code and read the comment, then cover the comment and read the code. If the code alone says the same thing, the comment can go. Detector: `code-narrating-comment`.
- Leave it: Comments that state a reason, a constraint, a units convention, a hazard or a link to an issue. Teaching material where narration is the point.
- Evidence: warn. Narration is common in generated code and in beginner code alike.

```python
# Before
# Increment the attempt counter by one.
attempts += 1

# After: the comment states the reason the code cannot show
# Count this attempt before sleeping so a crash mid-backoff still counts it.
attempts += 1
```

```js
// Before
// Create the output folder.
await mkdir(outDir, { recursive: true });

// After: no comment; the call is self-explanatory
await mkdir(outDir, { recursive: true });
```

```sh
# Before
# Run the migration.
run_migration

# After
# Hold the deploy lock until the migration exits; a second writer corrupts the index.
run_migration
```

## CODE-02 | Comments and docstrings that describe edit history

- What and why: A permanent comment explains what an earlier version did ("previously this called the API twice", "changed to use the cache"). History belongs in version control; the comment should describe the code as it is.
- Detect: Words such as previously, now, changed, updated, new, fixed in a comment.
- Leave it: A comment that warns against reintroducing a specific bug, written as a present-tense constraint.
- Evidence: warn under `code-narrating-comment` when phrased as narration.

```python
# Before
# This used to fetch the profile twice; changed it to reuse the first response.

# After
# Reuse the first response: a second fetch can return a newer profile mid-request.
```

```ts
// Before
/** Updated to support the new date format. */

// After
/** Parses ISO 8601 dates with or without a time zone offset. */
```

## CODE-03 | Defensive checks that repeat a proven contract

- What and why: A branch re-checks something the type system or the only caller already guarantees. It adds noise and suggests the author did not trust the code around it.
- Detect: Trace the value to its source. If every caller is internal and validated, the check is redundant at that site. Detector: `code-defensive-guard`.
- Leave it: Any value that crosses a trust boundary (environment, file, network, plugin input). When in doubt, keep the check.
- Evidence: warn. Removing a needed guard is far worse than keeping a redundant one.

```ts
// Before: redundant only if every caller passes a validated, non-empty array
function total(items: number[]) {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((a, b) => a + b, 0);
}

// After: valid only inside that internal boundary
function total(items: number[]) {
  return items.reduce((a, b) => a + b, 0);
}
```

```js
// Keep this guard: the path comes from an environment variable.
if (!process.env.EXPORT_DIR) throw new Error('EXPORT_DIR is not set');
```

## CODE-04 | One-use pass-through wrappers

- What and why: A helper called once that adds a name and nothing else: no behavior, no contract, no test seam, no reuse. Manual cue: `manual-one-use-abstraction`.
- Detect: Find helpers with one call site whose body is a single forwarded call.
- Leave it: A wrapper that pins an encoding, maps an error to a domain error, verifies a result before reporting success, or isolates a side effect for tests.
- Evidence: manual.

```python
# Before
def load_text(path):
    return open(path).read()

body = load_text(p)

# After, when no contract or reuse exists
body = open(p).read()

# Keep this one: it pins the encoding and maps a missing file to a domain error.
def load_settings(path):
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as err:
        raise SettingsMissing(path) from err
```

## CODE-05 | Speculative configuration

- What and why: An option, flag or environment variable that nothing reads, or that has no defined behavior. It invites users to depend on something that does not work.
- Detect: Search for reads of the option; check the documentation for its meaning.
- Leave it: An option a supported consumer uses, or one the user explicitly asked for.
- Evidence: manual.

```js
// Before: accepted and ignored
export function render(doc, { theme = 'light', experimentalLayout = false } = {}) {
  return paint(doc, theme);
}

// After: remove the unused option, or implement and document it
export function render(doc, { theme = 'light' } = {}) {
  return paint(doc, theme);
}
```

## CODE-06 | Over-broad exception handling

- What and why: A catch-all swallows errors the code cannot recover from, so failures surface far away or never.
- Detect: `catch (e) {}`, `except Exception: pass`, `|| true` after a command that matters.
- Leave it: A top-level handler that logs and exits with a non-zero code; a best-effort cleanup step clearly marked as such.
- Evidence: manual; behavior change, so it needs tests.

```python
# Before
try:
    cfg = read_optional_config(path)
except Exception:
    cfg = {}

# After: recover only from the expected case
try:
    cfg = read_optional_config(path)
except FileNotFoundError:
    cfg = {}
```

```sh
# Before: masks the failure
build_release || true

# After: let it fail with context
build_release || { echo "release build failed" >&2; exit 1; }
```

## CODE-07 | Log spam and over-sharing logs

- What and why: Logs repeat the same success line on every loop, or dump whole environments and payloads to debug one value. Noise hides the useful line, and dumps can leak secrets.
- Detect: Logs inside tight loops; logs that print environment variables, tokens or full request bodies.
- Leave it: Debug-level logs behind a flag the user controls.
- Evidence: manual; secret exposure is a security concern before it is a style one.

```js
// Before
for (const f of files) { process(f); console.log('processing ok'); }

// After: report progress at a useful interval
files.forEach((f, i) => { process(f); if ((i + 1) % 100 === 0) console.log(`${i + 1}/${files.length} files`); });
```

```sh
# Before: prints every variable, secrets included
env

# After: report presence only
[ -n "$API_TOKEN" ] && echo "API_TOKEN is set" || echo "API_TOKEN is missing"
```

## CODE-08 | Commit subjects and attribution trailers

- What and why: A subject should name one concrete change. "Update stuff" or "Improvements" tells the reader of `git log` nothing. Generated-by trailers and co-author lines that name a model describe no behavior and are forbidden by the family rule. Detector: `code-ai-attribution` (block).
- Detect: Read the subject without the diff; can you tell what changed? Check the last lines of the body for attribution trailers.
- Leave it: The repository's own prefix convention (`fix:`, `docs:`) and a human co-author line.
- Evidence: block for model attribution; subject style is repository-specific.

```text
Before: Update things and improve stability
After:  fix: keep empty optional fields when saving a profile

Before: Changes
After:  docs: explain the offline install path

Before (trailer): Generated with an AI assistant
After:  (no trailer; the subject and body describe the change)
```

## CODE-09 | Pull request descriptions that narrate effort

- What and why: "This exciting PR thoughtfully refactors…", "I carefully checked everything." A pull request should say what behavior changes, why, what is in and out of scope, which checks ran, and what risk remains. Effort and enthusiasm are not information.
- Detect: Remove adjectives about the work and the author; see what is left.
- Leave it: An explicit risk, a migration step, a known gap in testing, a request for a specific reviewer's attention.
- Evidence: weak for style. Claims about checks must be literally true: name the command that ran and its result, and say plainly which check did not run or failed.

```text
Before: This exciting change thoughtfully improves the whole import flow.
After:  The importer now keeps an existing mapping when a file is re-imported.

Before: I carefully updated the files and made sure everything works.
After:  Changed the mapping loader and its tests. Ran the unit suite (all pass). Re-imported the sample file by hand; the mapping was kept.
```

## CODE-10 | README instructions that hide prerequisites or limits

- What and why: A promotional lead-in ("This powerful tool makes setup seamless") delays the command, and the real prerequisites, side effects or limits are missing.
- Detect: Can a reader find, within the first screen, what to install, which command to run, what they should see, and what to do when it fails?
- Leave it: Security warnings, compatibility notes and licence lines.
- Evidence: weak; a usability check.

```md
Before: This powerful tool makes setup seamless and easy for everyone!
After:  Requires Node 20 or later. Run `npm install`, then `npm start`.

Before: Start the server and enjoy.
After:  Set `APP_PORT` (default 8080) and run `npm start`. The server writes its cache to `~/.cache/app`; delete that folder to reset it.
```

## CODE-11 | Changelog inflation or missing version facts

- What and why: "A groundbreaking release that transforms the experience." A changelog entry should name the version, the changed behavior, and any migration or compatibility impact.
- Detect: Check each entry against the actual release: version number, behavior, breaking changes, links.
- Leave it: The project's established format and a short user-facing reason.
- Evidence: weak; facts and release conventions decide.

```md
Before: A groundbreaking update that transforms your workflow.
After:  2.3.0: Keep the configured endpoint during an in-place update.

Before: Various fixes and improvements.
After:  2.3.1: Fix CSV export when a file name contains a comma.
```

## CODE-12 | Keep API contracts when simplifying

- What and why: A tidier rewrite can drop a guard, an error path or a side effect that callers rely on.
- Detect: Before editing, trace inputs, outputs, thrown errors, file writes and host compatibility. Run the tests before and after.
- Leave it: If the contract is unclear, defer the cleanup and say why.
- Evidence: a safety invariant rather than a writing score. Detector: `code-defensive-guard` warns on some of these shapes; verify before acting.

```ts
// Before: trusts untrusted JSON
const manifest = JSON.parse(raw) as Manifest;

// After: validate at the trust boundary
const manifest = parseManifest(JSON.parse(raw));
```

```python
# Before: a corrupt file is treated like a missing one
try:
    return parse_settings(path)
except (FileNotFoundError, ValueError):
    return DEFAULTS

# After: default only when absent; let a corrupt file raise
try:
    return parse_settings(path)
except FileNotFoundError:
    return DEFAULTS
```

```sh
# Keep the target check before a destructive command
check_target "$build_dir"
rm -rf -- "$build_dir"
```

## Quick review list

- Comments state why, which invariant, or which compatibility rule holds. They do not narrate the next line or the edit history.
- Docstrings describe public behavior: inputs, outputs, errors and side effects.
- Commit subjects name one change in the repository's style. No model attribution trailers.
- Pull requests state behavior, reason, scope, the checks that actually ran, and remaining risk.
- READMEs put prerequisites, the command, the expected result and the recovery path on the first screen.
- Changelogs name the version, the behavior and the migration impact.
- Guards at trust boundaries, error paths and cleanup stay unless a contract provably makes them redundant.

## Running the detector on developer prose

Extract the prose first: the commit message, the pull request body, the changed comment lines. Fenced code is skipped by `scripts/detect.mjs`, so a code block with a narrating comment inside a Markdown file is not scanned; paste the comment lines on their own if you want them checked. For a commit message, write it to a scratch file under `.litgravity/drafts/` and scan that file before committing.

## Which entries apply to which artifact

| Artifact | Entries to check | Detector rules that fire there | Worked example |
|---|---|---|---|
| Inline comments and docstrings | CODE-01, CODE-02 | `code-narrating-comment` | `examples/code-comments/before.md` |
| Commit message | CODE-08 | `code-ai-attribution` | `examples/commit/before.md` |
| Pull request description | CODE-09, plus EN-S23 and EN-S26 for narration and chat residue | `code-ai-attribution`, `en-left-in-narration`, `en-lets-dive` | `examples/pr/before.md` |
| README | CODE-10, plus EN-C04 and EN-S27 for promotional openers | `en-lexical-tell`, `en-chatbot-opener` | `examples/readme/before.md` |
| Changelog | CODE-11, plus EN-C01 for inflated significance | `en-testament`, `en-lexical-tell` | `examples/changelog/before.md` |
| API reference page | CODE-10, EN-S10, EN-S20 | `en-bracket-status-tag`, `en-bold-deliverable-label` | `examples/api-reference/before.md` |
| Code under review | CODE-03 to CODE-07, CODE-12 | `code-defensive-guard` | (code review, outside prose editing) |

Each worked example pairs a `before.md` with an `after.md` that keeps every fact and number.
