# Playwright recipes for the `playwright` tier

Use this tier when the probe reports an installed Playwright package with a cached Chromium build and no usable `agent-browser`. Start from `templates/drive.cjs` and fill in its `STEPS` array. Everything here runs against the installed package; no recipe installs anything.

## Running the script

```bash
TARGET_URL=<url> node .litgravity/evidence/<slug>/drive.cjs .litgravity/evidence/<slug>
```

Add `NODE_PATH="$(npm root -g)"` when Playwright is a global install. The script is CommonJS so that `NODE_PATH` works. It writes `step-NN.png`, `trace.zip`, `extracted.json` and `run.log` into the output directory, and a `fail-step-N.png` when a step throws. Exit codes: 0 all steps ran, 1 a step failed, 2 bad usage.

## Locators

Prefer the locators a person would use, in this order:

1. `page.getByRole('button', { name: 'Save' })` for anything with an ARIA role.
2. `page.getByLabel('Email')` for form fields.
3. `page.getByText('Order placed')` for visible copy; add `{ exact: true }` when a substring would match two elements.
4. `page.getByTestId('row-3')` when the app ships test ids.
5. A CSS or XPath locator only when none of the above exists, and say so in `run.log`.

A locator that matches more than one element throws in strict mode. That is useful: narrow it with a parent (`page.getByRole('dialog').getByRole('button', { name: 'Save' })`) instead of switching to `.first()`.

## Waiting

| Need | Wait with |
|---|---|
| A navigation after a click | `await Promise.all([page.waitForURL('**/done'), button.click()])` |
| An element to appear | `await locator.waitFor({ state: 'visible' })` |
| A response from the app | `await page.waitForResponse(r => r.url().includes('/api/items') && r.ok())` |
| Text to change | `await expect`-style polling with `page.waitForFunction(() => document.title.includes('Done'))` |
| The page to be quiet | `waitForLoadState('networkidle')` as a last resort; single-page apps with polling never reach it |

A fixed `waitForTimeout` is a guess. Use it only to let an animation finish before a screenshot and note it in `run.log`.

## Evidence per step

- `await page.screenshot({ path: ..., fullPage: true })` after every meaningful step. For a long page also capture the viewport (`fullPage: false`) at the point of the action.
- `extracted[...] = await locator.innerText()` for values; compare two or three of them with the last screenshot with `read_file`.
- The trace (`trace.zip`) holds DOM snapshots and screenshots per action; the user opens it with `npx playwright show-trace trace.zip`.

## Forms, dialogs and downloads

- Typing: `fill` replaces a value in one step; `pressSequentially` types key by key for fields that react to key events.
- Dialogs: register `page.on('dialog', d => d.dismiss())` before the action that opens one, and log the message. Dismissing is the safe default; accepting a confirm counts as an outward action and needs approval.
- Downloads: `const [dl] = await Promise.all([page.waitForEvent('download'), link.click()]); await dl.saveAs(path.join(out, dl.suggestedFilename()));` then record name and size.
- File uploads: `locator.setInputFiles(<path>)` with a fixture the user named.
- New tabs: `const [popup] = await Promise.all([context.waitForEvent('page'), link.click()])`; close it in the `finally` block.

## Storage state

A user who logs in themselves can save a state file with `npx playwright codegen --save-storage=<file> <url>` in their own terminal. Pass it with `browser.newContext({ storageState: '<file>' })`. The file holds cookies, so it stays outside the repository and the evidence folder, and the report names its path without printing any content. `references/credential-and-approval-boundaries.md` covers approval wording.

## Viewports, locale and emulation

`browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', colorScheme: 'dark', reducedMotion: 'reduce' })` covers a phone, a language, dark mode and reduced motion. Judging a full interface across such matrices belongs to `visual-qa`; use these options here to reproduce one state a task needs.

## Network and console signals

`page.on('console', m => log.push(...))` and `page.on('requestfailed', r => ...)` capture errors during the flow. Save them as `console.txt`. A flow that ends in the expected state with console errors is a PASS with a noted risk.

## Failure patterns

| Symptom | Likely cause | Next move |
|---|---|---|
| `browserType.launch: Executable doesn't exist` | Package and browser build mismatch | BLOCKED; the user runs `npx playwright install chromium` |
| `strict mode violation` | Locator matched several elements | Narrow it with a parent or a name |
| `Timeout 30000ms exceeded` on a locator | Element absent, in an iframe, or behind a consent wall | Screenshot plus accessibility snapshot, then fix the locator once or twice |
| Page shows a challenge | Bot protection | BLOCKED with the challenge named |
| Script ends 0 and the screenshot shows an error page | The flow reached the wrong state | FAIL at that step; the screenshot is the evidence |

## Cleanup

The `finally` block stops the trace and closes the browser. Afterwards compare the process list with the one taken before the run (`references/cleanup-receipts.md`) and delete any storage-state copy, download and scratch file the run created.
