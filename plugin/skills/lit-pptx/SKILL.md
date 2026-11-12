---
name: lit-pptx
description: "Slide decks (.pptx). A LitFamily extension in wjgoarxiv-skills: this stub loads the installed copy, or gives the agy install line."
---

# lit-pptx: a LitFamily extension in wjgoarxiv-skills

lit-pptx built finished PowerPoint decks: a design direction picked for the audience, Markdown slide source compiled with native charts, a mechanical gate and a look at every rendered page. It no longer ships inside LitGravity. It is a LitFamily extension now, and the whole skill folder lives in the separate wjgoarxiv-skills repository at `variants/litgravity/lit-pptx/`, a copy written for agy, so a LitGravity install stays small and anyone who wants a deck copies in this one folder.

This file keeps the id. `lit deck …`, `lit slides …`, `lit pptx …`, a `lit` prompt that asks for a presentation, and `/litgravity:lit-pptx` still land here, and the steps below take it from there.

## Install it in agy

The short route is LitGravity's own command, run in a terminal: `npx @litfamily/litgravity extensions install lit-pptx` prints what it would do, and the same with `--yes` does it (`--project` for one workspace). It fetches the skill, stops if another skill named lit-pptx sits where agy loads skills, moves an old copy aside and writes the receipt; `extensions update`, `remove` and `check` do the rest. The lines below are the same steps by hand.

wjgoarxiv-skills is public at https://github.com/wjgoarxiv/wjgoarxiv-skills. Clone it (`git clone https://github.com/wjgoarxiv/wjgoarxiv-skills`), then paste these four lines one at a time (zsh or bash) in the workspace you use agy in. They put the skill in agy's user skills, which every workspace sees:

```bash
find .agents/skills _agents/skills ~/.gemini/config/skills ~/.gemini/skills -maxdepth 2 -name SKILL.md -exec grep -l -E '^name: *"?lit-pptx"? *$' {} + 2>/dev/null
if [ -e ~/.gemini/config/skills/lit-pptx ] || [ -L ~/.gemini/config/skills/lit-pptx ]; then b=~/.gemini/extension-backups/$(date +%Y%m%d-%H%M%S); mkdir -p "$b" && mv ~/.gemini/config/skills/lit-pptx "$b/" && echo "moved to $b/lit-pptx"; fi
mkdir -p ~/.gemini/config/skills && [ ! -e ~/.gemini/config/skills/lit-pptx ] && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-pptx" ~/.gemini/config/skills/lit-pptx
printf '{"id":"%s","source":"%s","variant":"litgravity","installed_at":"%s"}\n' lit-pptx "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-pptx" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > ~/.gemini/config/skills/lit-pptx/.litfamily-extension.json
```

Line one only looks: it prints every `SKILL.md` named lit-pptx that agy could load, and nothing when there is none. agy keeps one same-name skill without a word, a workspace copy first, so move any other one it names aside too. Line two moves an existing copy whole into a dated folder under `~/.gemini/extension-backups/`, which agy never loads; line three copies into the emptied place; line four writes the receipt `.litfamily-extension.json` inside the copy.

For one workspace only, run line one, then these three in the workspace root:

```bash
if [ -e .agents/skills/lit-pptx ] || [ -L .agents/skills/lit-pptx ]; then b=~/.gemini/extension-backups/$(date +%Y%m%d-%H%M%S)-project; mkdir -p "$b" && mv .agents/skills/lit-pptx "$b/" && echo "moved to $b/lit-pptx"; fi
mkdir -p .agents/skills && [ ! -e .agents/skills/lit-pptx ] && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-pptx" .agents/skills/lit-pptx
printf '{"id":"%s","source":"%s","variant":"litgravity","installed_at":"%s"}\n' lit-pptx "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-pptx" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .agents/skills/lit-pptx/.litfamily-extension.json
```

The folder is the whole skill, with its own scripts, references and engine locks. Start a new conversation, or type `/skills reload`; the skill then answers as `/lit-pptx`, and `lit` prompts that reach this stub hand over to it. To update it, run the same lines again: the old copy moves to a new dated backup and the receipt is rewritten. To remove it, run the second line alone. Nothing is deleted; clear old backups out of `~/.gemini/extension-backups/` when you no longer need them. The LitGravity installer writes only its own plugin folder, so upgrading or removing LitGravity leaves the copy alone, and the names never clash: this stub is `litgravity:lit-pptx`, the copy is `lit-pptx`.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/skills/lit-pptx/SKILL.md`, then `.agents/skills/lit-pptx/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. It was written for agy and needs no LitGravity hook: every check it names is a command it tells you to run.
3. **Not found, asked directly.** Reply in a few lines: what lit-pptx did, that it is a LitFamily extension now, kept in wjgoarxiv-skills (`variants/litgravity/lit-pptx/`), the `extensions install` command and the install lines above, and that you made nothing yet. Do not write the deck another way in its place (python-pptx, soffice, an HTML page called slides).
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `lit-pptx not installed` once in the ledger and the reply with the install lines, finish the parts that need no deck, and mark the part that needs it BLOCKED, not done.

## Hard stops

- Give the install lines with the placeholder; never a path from this machine.
- Never say a deck exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) never copies the skill in itself: give the install lines and stop.
