# Image input, typography and safe local assets

Check which native tools this session offers. The host's image tool, `generate_image` when the live tool list offers it (the name is unverified, so the tool list decides), is the generator. Assistants and command-line programs found elsewhere on PATH are out of scope. A real call to that tool plus an inspected result establishes generated imagery, and nothing else does. Record the tool identity, the prompt, the returned asset, its hash and the copied project path. When the tool is missing, state IMAGE_GENERATION_UNAVAILABLE, retain that result, and continue only with an explicitly supplied background. Facts and README text move forward without the image, while full cover delivery waits. Procedural stand-ins are excluded, provenance disclaimer or not. Wait for an explicitly supplied image before background composition or rendering. Keep the original input plus a manifest of created paths and stages, so an interrupted composition never repeats generation blindly.

Backgrounds carry no words, logos or baked-in captions. Examine the wide and mobile crops before composing. Blur, grain, glow and depth are deterministic composition layers and say nothing about generation. Foreground pixel art stays original and sharp. Untrusted SVG images can carry scripts, foreignObject, external references or event handlers; reject them or rasterize them safely through a supported isolated tool, and keep arbitrary SVG markup out of documents.

Resolve local Pretendard for Korean, display and prose text, and Meslo LGS NF for technical text. Inspect the actual family, style, version and applicable license notice, and record hashes and upstream provenance. A similarly named file fails that check. Font files are regular, bounded, non-symlink inputs; missing glyphs, a wrong family and an uncertain license each block the work. System-wide font installs and font bytes inside the plugin package are both excluded. Store a redistribution license next to any authorized project-local font copy.

Copy `templates/typography/` from the exact selected skill directory into a fresh output workspace. Its lockfile pins fontkit 2.0.4. The helper loads fontkit first from the readme runtime cache, `${XDG_DATA_HOME:-$HOME/.local/share}/litgravity/runtime/readme` (override it with `LITGRAVITY_README_RUNTIME`), and then from a local `node_modules` after `npm ci --ignore-scripts --no-audit --no-fund` in the workspace. Fill the cache with `node <skill-dir>/scripts/readme-runtime.mjs install`, or pre-warm it from a terminal with `npx @litfamily/litgravity runtime install readme`. Headless `agy -p` runs end when a command is refused, so a failed install is reported as BLOCKED together with the pre-warm command. The helper reads a bounded descriptor, shapes glyph runs with advances and offsets, and computes a padded union of the actual transformed glyph bounds. Whitespace can have an empty outline and still carry an advance. A missing-glyph id of zero is rejected. Output creation is exclusive inside an explicit existing root, with non-symlink parent checks.

```bash
node "$README_STUDIO_PROJECT_ROOT/.litgravity/evidence/readme-studio/typography/shape-text-to-svg.mjs" \
  --font "/explicit/task-font/Pretendard-Regular.otf" \
  --family "Pretendard" --text "연구 노트 / Research notes" \
  --output-root "$README_STUDIO_PROJECT_ROOT" --output "assets/title-dark.svg" \
  --font-size 84 --fill '#18272b'
```

Give every revision a fresh filename. For dark fields, repeat with light ink and a different output. Ink names describe the glyph fill: `title-dark.svg` sits on a light field and `title-light.svg` on a dark field. Require at least 4.5:1 for the actual text and field pair, measured at the darkest and lightest points of any moving background. When the art makes contrast uncertain, put the text on a solid or near-opaque field.

Keep the helper's font, hash and geometry result together with the editable text in cover-source.json. Confirm that the SVG holds path geometry and has no text element or external font reference, and compare the displayed wording character by character. An SVG title is semantic metadata and differs from outlined geometry. Repeat the exact title in Markdown for accessibility. A raster background with SVG text makes an honest hybrid cover.

Primary API reference: https://github.com/foliojs/fontkit (layout glyphs and positions, path and bounding box). Font choice and license stay the user's explicit project inputs.
