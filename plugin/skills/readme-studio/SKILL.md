---
name: readme-studio
description: "Writing or refreshing a README from repository facts. Moved to wjgoarxiv-skills: this stub loads the installed copy, or gives the agy install line."
---

# readme-studio: moved to wjgoarxiv-skills

readme-studio wrote READMEs from repository facts that were checked (purpose, install, quick start, commands that ran), with an optional inspected cover. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `variants/litgravity/readme-studio/`, a copy written for agy, so a LitGravity install stays small and anyone who wants a README copies in this one folder.

This file keeps the id. `lit readme …`, `lit readme-studio …`, and `/litgravity:readme-studio` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is public at https://github.com/wjgoarxiv/wjgoarxiv-skills. Clone it (`git clone https://github.com/wjgoarxiv/wjgoarxiv-skills`), then copy the skill folder into agy's user skills, which every workspace sees:

```bash
mkdir -p ~/.gemini/config/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/readme-studio" ~/.gemini/config/skills/
```

For one workspace only, run this in its root instead: `mkdir -p .agents/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/readme-studio" .agents/skills/`.

The folder is the whole skill, with its own scripts, references and engine locks. Its neighbours (lit-typographic-motion, which renders the optional motion cover) install the same way, one folder each. Start a new conversation, or type `/skills reload`; the skill then answers as `/readme-studio`, and `lit` prompts that reach this stub hand over to it. To update it, delete the copied folder and copy it again. The LitGravity installer writes only its own plugin folder, so upgrading or removing LitGravity leaves the copy alone, and the names never clash: this stub is `litgravity:readme-studio`, the copy is `readme-studio`.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/skills/readme-studio/SKILL.md`, then `.agents/skills/readme-studio/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. It was written for agy and needs no LitGravity hook: every check it names is a command it tells you to run.
3. **Not found, asked directly.** Reply in a few lines: what readme-studio did, that it moved to wjgoarxiv-skills (`variants/litgravity/readme-studio/`), the install line above, and that you made nothing yet. A plain README edit the user asks for by line can still be made directly; a new or refreshed README from this skill cannot.
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `readme-studio not installed` once in the ledger and the reply with the install line, finish the parts that need no README, and mark the part that needs it BLOCKED, not done.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a README exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) never copies the skill in itself: give the install line and stop.
