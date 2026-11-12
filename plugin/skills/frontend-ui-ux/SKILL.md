---
name: frontend-ui-ux
description: "Building or restyling a user interface. A LitFamily extension in wjgoarxiv-skills: this stub loads the installed copy, or gives the agy install line."
---

# frontend-ui-ux: a LitFamily extension in wjgoarxiv-skills

frontend-ui-ux built and restyled interfaces from one locked house style and design kit, checked in a browser across phone, tablet and desktop widths. It no longer ships inside LitGravity. It is a LitFamily extension now, and the whole skill folder lives in the separate wjgoarxiv-skills repository at `variants/litgravity/frontend-ui-ux/`, a copy written for agy, so a LitGravity install stays small and anyone who wants an interface copies in this one folder.

This file keeps the id. `lit frontend …`, `lit ui …`, a `lit` prompt that asks to build a page, dashboard or landing page, and `/litgravity:frontend-ui-ux` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is public at https://github.com/wjgoarxiv/wjgoarxiv-skills. Clone it (`git clone https://github.com/wjgoarxiv/wjgoarxiv-skills`), then paste these four lines one at a time (zsh or bash) in the workspace you use agy in. They put the skill in agy's user skills, which every workspace sees:

```bash
find .agents/skills _agents/skills ~/.gemini/config/skills ~/.gemini/skills -maxdepth 2 -name SKILL.md -exec grep -l -E '^name: *"?frontend-ui-ux"? *$' {} + 2>/dev/null
if [ -e ~/.gemini/config/skills/frontend-ui-ux ] || [ -L ~/.gemini/config/skills/frontend-ui-ux ]; then b=~/.gemini/extension-backups/$(date +%Y%m%d-%H%M%S); mkdir -p "$b" && mv ~/.gemini/config/skills/frontend-ui-ux "$b/" && echo "moved to $b/frontend-ui-ux"; fi
mkdir -p ~/.gemini/config/skills && [ ! -e ~/.gemini/config/skills/frontend-ui-ux ] && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/frontend-ui-ux" ~/.gemini/config/skills/frontend-ui-ux
printf '{"id":"%s","source":"%s","variant":"litgravity","installed_at":"%s"}\n' frontend-ui-ux "<path to your wjgoarxiv-skills clone>/variants/litgravity/frontend-ui-ux" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > ~/.gemini/config/skills/frontend-ui-ux/.litfamily-extension.json
```

Line one only looks: it prints every `SKILL.md` named frontend-ui-ux that agy could load, and nothing when there is none. agy keeps one same-name skill without a word, a workspace copy first, so move any other one it names aside too. Line two moves an existing copy whole into a dated folder under `~/.gemini/extension-backups/`, which agy never loads; line three copies into the emptied place; line four writes the receipt `.litfamily-extension.json` inside the copy.

For one workspace only, run line one, then these three in the workspace root:

```bash
if [ -e .agents/skills/frontend-ui-ux ] || [ -L .agents/skills/frontend-ui-ux ]; then b=~/.gemini/extension-backups/$(date +%Y%m%d-%H%M%S)-project; mkdir -p "$b" && mv .agents/skills/frontend-ui-ux "$b/" && echo "moved to $b/frontend-ui-ux"; fi
mkdir -p .agents/skills && [ ! -e .agents/skills/frontend-ui-ux ] && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/frontend-ui-ux" .agents/skills/frontend-ui-ux
printf '{"id":"%s","source":"%s","variant":"litgravity","installed_at":"%s"}\n' frontend-ui-ux "<path to your wjgoarxiv-skills clone>/variants/litgravity/frontend-ui-ux" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .agents/skills/frontend-ui-ux/.litfamily-extension.json
```

The folder is the whole skill, with its own scripts, references and engine locks. Its neighbours (visual-qa, the browser check that accepts a built interface) install the same way, one folder each. Start a new conversation, or type `/skills reload`; the skill then answers as `/frontend-ui-ux`, and `lit` prompts that reach this stub hand over to it. To update it, run the same lines again: the old copy moves to a new dated backup and the receipt is rewritten. To remove it, run the second line alone. Nothing is deleted; clear old backups out of `~/.gemini/extension-backups/` when you no longer need them. The LitGravity installer writes only its own plugin folder, so upgrading or removing LitGravity leaves the copy alone, and the names never clash: this stub is `litgravity:frontend-ui-ux`, the copy is `frontend-ui-ux`.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/skills/frontend-ui-ux/SKILL.md`, then `.agents/skills/frontend-ui-ux/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. It was written for agy and needs no LitGravity hook: every check it names is a command it tells you to run.
3. **Not found, asked directly.** Reply in a few lines: what frontend-ui-ux did, that it is a LitFamily extension now, kept in wjgoarxiv-skills (`variants/litgravity/frontend-ui-ux/`), the install lines above, and that you made nothing yet. Do not build the page another way in its place; plain code edits to an existing interface stay with lit-code or litwork.
4. **Not found, inside a workflow.** A lit workflow that edits an interface keeps going without it: make the edit through lit-code or litwork, say once that frontend-ui-ux is not installed, and claim no design review.

## Hard stops

- Give the install lines with the placeholder; never a path from this machine.
- Never say an interface exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) never copies the skill in itself: give the install lines and stop.
