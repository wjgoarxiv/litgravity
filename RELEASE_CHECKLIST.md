# LitGravity release checklist

Every publish, tag or push needs the maintainer's explicit approval. Work through this list first.

## Publish blockers (open)

- [x] Cover art: both READMEs show the seven-bay family cover from `docs/assets/`. The images stay out of the tarball; npm resolves the relative paths against `repository`, so check the npm page shows them after the push.
- [ ] Brand terms: Google's rules bar "Antigravity" in a product name, hence "gravity". Re-read them before the first publish.
- [ ] Repository: this history sits on the original repository, which is renamed to `wjgoarxiv/litgravity` before the first publish (GitHub redirects the old name). `package.json` `repository`, `bugs` and `homepage` and the README badges already use the new name, and `LICENSE` keeps the original MIT line beside the new one.
- [ ] Package weight: the tarball carries about 22 MB unpacked (10 MB tarball) of skills (fonts, vendored design corpus, diagram templates). Check the unpacked size in `npm pack --dry-run --json` against what the maintainer accepts for a first publish.

## Gates

- [ ] `npm test` (check `pgrep -fl 'node --test'` first; one suite at a time on this machine)
- [ ] `npm run check:version` — package.json, plugin manifest and CHANGELOG agree
- [ ] `npm run scan:legacy-tokens`
- [ ] `npm run validate` — `agy plugin validate --json --strict` reports zero errors and zero warnings
- [ ] `npm run sync:fixtures`, then read the diff of `test/fixtures/skill-depth.json` and `pack-files.json`
- [ ] `npm pack --dry-run --json --ignore-scripts` — `[0].files` equals `test/fixtures/pack-files.json`
- [ ] Before any publish: run the umbrella decode-aware leak scan over every tracked and untracked file (`zsh ../plans/tools/leak-scan.sh` with each file as a target) and require rc 0
- [ ] Motion: with a warm motion runtime, `node scripts/qa-cover-recipes.mjs --negatives` (the painted recipe uses its pinned five-panel base `test/fixtures/motion/painted-light-base.png`) reports the three recipes `PASS` and the four negatives and `feather-150` as caught; `motion.mjs cover-gate <cover.webp> --strict` reads `PASS+TARGET`
- [ ] Live: `agy -p "lit plan a tiny todo app" --output-format json < /dev/null` in a throwaway project with the plugin at `.agents/plugins/litgravity/`; the reply or the ledger shows the activation. Real model calls count against the user's quota; keep them few.
- [ ] Fresh clone: `git clone` the repo into a temp folder and run `npm test` there

## After publish

- [ ] `npm view @litfamily/litgravity version` matches, and `npx @litfamily/litgravity@latest install --dry-run` works
