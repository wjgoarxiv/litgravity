# Repository evidence and readable assembly

Begin at the package users actually install. Inspect its manifest, executable entry point, installation scripts, license and current README, and check git state before editing. A monorepo root is sometimes a different place from the product root. Package name, version and install syntax have to agree with those files. Keep useful anchors and bilingual text, and change only the content this task needs.

For every reader-visible claim, record an id, the exact proposed value and a relative source in `readme-facts.json`. Reopen the source and compare meaning. The checker validates shape and safe existing file paths, including path-traversal and symlink rejection. Even for successful input it returns factual_accuracy=not-checked on purpose, because false prose that cites a real file still passes structure validation. A status badge additionally needs an inspected real status endpoint. The checker performs no fetch and makes no availability or truth claim.

Run the helper from `<skill-dir>`, the folder holding SKILL.md; the activation note gives the SKILL.md absolute path. The shell working directory and a guessed plugin-cache path are the wrong anchors. Set `README_STUDIO_SKILL_ROOT` to `<skill-dir>` and `README_STUDIO_PROJECT_ROOT` to the authorized project root:

```bash
node "$README_STUDIO_SKILL_ROOT/scripts/validate-readme-facts.mjs" \
  --project-root "$README_STUDIO_PROJECT_ROOT" \
  --facts "$README_STUDIO_PROJECT_ROOT/.litgravity/evidence/readme-studio/readme-facts.json"
```

Badge URLs are absolute HTTP(S), free of credentials, and free of raw whitespace and control characters. Leave out any badge that cannot be verified instead of guessing. Add docs, support, contribution and license links after checking the actual target, and confirm that a conventional filename exists before linking it.

Build the page in this order: one clear cover, a small relevant badge row, a concise purpose and an immediately usable quick start. Demonstrated capabilities follow, then a useful screenshot or demo, then navigation when the document needs it. Keep semantic headings and selectable install commands. Pick the alignment that fits the project's voice; a centered cover works well while body prose stays left-aligned. Emoji help scanning and sit next to real labels.

Use `templates/readme-cover-section.md` once every named artifact exists. Reduced-motion static branches come before animation branches, since picture takes the first matching source. Mobile and dark branches follow the actual output that was produced. The static img is always present. Record GIF and WebP support separately; an MP4 link gives no inline animated preview. New assets reference the current tree and avoid any old immutable published package version. Hosted display stays POST_PUBLICATION_UNVERIFIED until a separately authorized release and verification.
