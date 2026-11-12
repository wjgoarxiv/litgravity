---
name: readme-studio
description: "Writing or refreshing a README from repository facts. A LitFamily extension in wjgoarxiv-skills: this stub loads the installed copy, or gives the agy install line."
---

# readme-studio: a LitFamily extension in wjgoarxiv-skills

readme-studio wrote READMEs from repository facts that were checked (purpose, install, quick start, commands that ran), with an optional inspected cover. It no longer ships inside LitGravity. It is a LitFamily extension now, and the whole skill folder lives in the separate wjgoarxiv-skills repository at `variants/litgravity/readme-studio/`, a copy written for agy, so a LitGravity install stays small and anyone who wants a README copies in this one folder.

This file keeps the id. `lit readme …`, `lit readme-studio …`, and `/litgravity:readme-studio` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is public at https://github.com/wjgoarxiv/wjgoarxiv-skills. Clone it (`git clone https://github.com/wjgoarxiv/wjgoarxiv-skills`), then paste these four lines one at a time (zsh or bash) in the workspace you use agy in. They put the skill in agy's user skills, which every workspace sees:

```bash
find .agents/skills _agents/skills ~/.gemini/config/skills ~/.gemini/skills -maxdepth 2 -name SKILL.md -exec grep -l -E '^name: *"?readme-studio"? *$' {} + 2>/dev/null
if [ -e ~/.gemini/config/skills/readme-studio ] || [ -L ~/.gemini/config/skills/readme-studio ]; then b=~/.gemini/extension-backups/$(date +%Y%m%d-%H%M%S); mkdir -p "$b" && mv ~/.gemini/config/skills/readme-studio "$b/" && echo "moved to $b/readme-studio"; fi
mkdir -p ~/.gemini/config/skills && [ ! -e ~/.gemini/config/skills/readme-studio ] && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/readme-studio" ~/.gemini/config/skills/readme-studio
printf '{"id":"%s","source":"%s","variant":"litgravity","installed_at":"%s"}\n' readme-studio "<path to your wjgoarxiv-skills clone>/variants/litgravity/readme-studio" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > ~/.gemini/config/skills/readme-studio/.litfamily-extension.json
```

Line one only looks: it prints every `SKILL.md` named readme-studio that agy could load, and nothing when there is none. agy keeps one same-name skill without a word, a workspace copy first, so move any other one it names aside too. Line two moves an existing copy whole into a dated folder under `~/.gemini/extension-backups/`, which agy never loads; line three copies into the emptied place; line four writes the receipt `.litfamily-extension.json` inside the copy.

For one workspace only, run line one, then these three in the workspace root:

```bash
if [ -e .agents/skills/readme-studio ] || [ -L .agents/skills/readme-studio ]; then b=~/.gemini/extension-backups/$(date +%Y%m%d-%H%M%S)-project; mkdir -p "$b" && mv .agents/skills/readme-studio "$b/" && echo "moved to $b/readme-studio"; fi
mkdir -p .agents/skills && [ ! -e .agents/skills/readme-studio ] && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/readme-studio" .agents/skills/readme-studio
printf '{"id":"%s","source":"%s","variant":"litgravity","installed_at":"%s"}\n' readme-studio "<path to your wjgoarxiv-skills clone>/variants/litgravity/readme-studio" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .agents/skills/readme-studio/.litfamily-extension.json
```

The folder is the whole skill, with its own scripts, references and engine locks. Its neighbours (lit-typographic-motion, which renders the optional motion cover) install the same way, one folder each. Start a new conversation, or type `/skills reload`; the skill then answers as `/readme-studio`, and `lit` prompts that reach this stub hand over to it. To update it, run the same lines again: the old copy moves to a new dated backup and the receipt is rewritten. To remove it, run the second line alone. Nothing is deleted; clear old backups out of `~/.gemini/extension-backups/` when you no longer need them. The LitGravity installer writes only its own plugin folder, so upgrading or removing LitGravity leaves the copy alone, and the names never clash: this stub is `litgravity:readme-studio`, the copy is `readme-studio`.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/skills/readme-studio/SKILL.md`, then `.agents/skills/readme-studio/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. It was written for agy and needs no LitGravity hook: every check it names is a command it tells you to run.
3. **Not found, asked directly.** Reply in a few lines: what readme-studio did, that it is a LitFamily extension now, kept in wjgoarxiv-skills (`variants/litgravity/readme-studio/`), the install lines above, and that you made nothing yet. A plain README edit the user asks for by line can still be made directly; a new or refreshed README from this skill cannot.
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `readme-studio not installed` once in the ledger and the reply with the install lines, finish the parts that need no README, and mark the part that needs it BLOCKED, not done.

## Hard stops

- Give the install lines with the placeholder; never a path from this machine.
- Never say a README exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) never copies the skill in itself: give the install lines and stop.
