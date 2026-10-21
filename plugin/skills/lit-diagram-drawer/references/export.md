# Exporting diagrams

Export after the HTML or SVG source passes verification. The export captures the diagram itself. Gallery pages, editor controls and a full-editorial browser frame stay out of the image.

## PNG

Run `scripts/export.mjs` with a source HTML or SVG and a scale of 1, 2 or 3. The script drives agent-browser 0.38.1 or newer against Chrome. It waits for `document.fonts.ready`, confirms that the local Pretendard face is loaded and computed, then captures a static state.

`scripts/diagram-runtime.mjs` resolves the renderer. A copy already on `PATH` at 0.38.1 or newer is used. Otherwise the first export installs the pinned agent-browser into the LitGravity runtime cache, `${XDG_DATA_HOME:-$HOME/.local/share}/litgravity/runtime/diagram` (override with `LITGRAVITY_DIAGRAM_RUNTIME`). Every agent-browser child runs with `HOME=<cache>/home`, so its state and any downloaded browser stay inside the cache. Control sockets sit in `/tmp/lgd-<uid>` because socket paths have a length limit.

A Chrome or Chromium that is already installed comes first: `LITGRAVITY_DIAGRAM_CHROME`, `CHROME_PATH`, `AGENT_BROWSER_EXECUTABLE_PATH`, the macOS Google Chrome or Chromium app, then `google-chrome` or `chromium` on `PATH`. Only when none exists does `agent-browser install` fetch Chrome for Testing 154 into `<cache>/home/.agent-browser/browsers`. Pixels can differ between Chrome builds, so write the version line from `status --json` into the evidence. Nothing installs globally and the real home directory stays untouched.

`--allow-font-fallback` exists to render the labeled constructed-naive foils for comparison. A source never passes verification through it.

Headless `agy -p` runs refuse `run_command` calls that need approval, and sandboxes may block the network. A failed first-use install is therefore a `BLOCKED:` result. Report the error line and give the user the pre-warm command for a terminal: `npx @litfamily/litgravity runtime install diagram`. `node scripts/diagram-runtime.mjs status --json` reports readiness and installs nothing. When the font file is missing, stop and say so; the skill never downloads fonts. The default output folder is `docs/diagrams/exports/` under the current directory, and `--out` picks another.

For `tree-block-decomposition`, add `--registry` only when a traceability sidecar was requested. The exporter writes `<diagram-basename>.registry.json` next to the other exports. It lists `data-block-id`, `data-block-parent`, `data-block-name`, `data-block-input`, `data-block-output`, `data-block-constraint`, `data-block-assumption` and `data-block-impl` in source-document order, leaves out absent values and a root parent, and rejects blank or duplicate ids, missing parents, several roots and cycles. Missing fields stay missing, and the sidecar exists only on request.

## Standalone SVG

- Keep the root viewBox, title, description and referenced ids.
- Add the SVG namespace when it is absent.
- Write explicit hexadecimal fill and stroke values. A supported alpha color becomes a hex value plus `fill-opacity` or `stroke-opacity`, and transparent paint becomes `none`.
- Keep ids unique and local. External images, fonts, stylesheets, scripts and CSS imports are rejected, and so is every CSS `url()` except a local fragment such as `url(#marker)`. Scheme URLs (`file:`, `ftp:`, `https:` and others), protocol-relative URLs, relative resource URLs, escaped URL tokens and malformed URL functions all fail closed. Office mode injects its own embedded Pretendard data URL after this input check.
- Office-safe mode keeps to conservative SVG elements and embeds the bundled Pretendard when the source holds Korean text.
- Say that text was outlined only when the exported SVG holds paths in place of those text nodes.

## Office proof

Place the exported SVG or PNG in the intended PowerPoint or Word document and open it in the target renderer. Inspect Korean text, mono labels, geometry, colors and margins at the final page or slide size. The skill builds no PPTX or DOCX container, and SVG validation never counts as Office rendering. When no Office renderer is available, name the part that stays unverified.

## Failure behavior

Preflight rejects a missing source, an SVG without a viewBox, an unsupported scale, an HTML file without an SVG, and a PNG request without a renderer. A failed preflight writes nothing. After a successful export, report the real paths and byte sizes.
