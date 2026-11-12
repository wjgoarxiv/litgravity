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
- [ ] `npm run sync:lock` reads `already current`; after a skill or package change, read the diff of `skills.lock.json`
- [ ] `npm pack --dry-run --json --ignore-scripts` — `[0].files` equals the `pack` list in `skills.lock.json`
- [ ] Before any publish: run the umbrella decode-aware leak scan over every tracked and untracked file (`zsh ../plans/tools/leak-scan.sh` with each file as a target) and require rc 0
- [ ] Moved skills: each of the nine stubs still names `wjgoarxiv-skills`, its `variants/litgravity/<id>/` folder and the four install lines for both scopes (preflight, move-aside into `~/.gemini/extension-backups/`, `cp -R` into `<dest>/<id>`, receipt) with the placeholder (`test/moved-skills.test.mjs`, `test/extension-lines.test.mjs`)
- [ ] Live: `agy -p "lit plan a tiny todo app" --output-format json < /dev/null` in a throwaway project with the plugin at `.agents/plugins/litgravity/`; the reply or the ledger shows the activation. Real model calls count against the user's quota; keep them few.
- [ ] Fresh clone: `git clone` the repo into a temp folder and run `npm test` there

## After publish

- [ ] `npm view @litfamily/litgravity version` matches, and `npx @litfamily/litgravity@latest install --dry-run` works
