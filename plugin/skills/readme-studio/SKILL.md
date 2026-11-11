---
name: readme-studio
description: "Writing or refreshing a README from repository facts. Moved to wjgoarxiv-skills (video-covers plugin): this stub loads the installed copy, or gives the agy install line."
---

# readme-studio: moved to wjgoarxiv-skills

readme-studio wrote READMEs from repository facts that were checked (purpose, install, quick start, commands that ran), with an optional inspected cover. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `plugins/video-covers/skills/readme-studio/`, so a LitGravity install stays small and anyone who wants a README installs this one plugin.

This file keeps the id. `lit readme …`, `lit readme-studio …`, and `/litgravity:readme-studio` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is not published yet, so install it from a local clone:

```bash
agy plugin install <path to your wjgoarxiv-skills clone>/plugins/video-covers
```

agy converts the plugin while installing it and copies it to `~/.gemini/config/plugins/video-covers`. The video-covers plugin also brings lit-typographic-motion, which renders the optional motion cover. Start a new conversation, or type `/skills reload`; the skill then answers as `/video-covers:readme-studio`, and `lit` prompts that reach this stub hand over to it.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/plugins/video-covers/skills/readme-studio/SKILL.md`, then `.agents/plugins/video-covers/skills/readme-studio/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. That copy was written for another agent host, so map its tools onto agy's: its question tool is `ask_question`, its shell tool is `run_command`, file reads and writes are `read_file` and `write_file`, and loading another skill by name means reading that skill's SKILL.md. A check it says a hook of that host runs for you does not run here; run the command yourself.
3. **Not found, asked directly.** Reply in a few lines: what readme-studio did, that it moved to the video-covers plugin of wjgoarxiv-skills, the install line above, and that you made nothing yet. A plain README edit the user asks for by line can still be made directly; a new or refreshed README from this skill cannot.
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `readme-studio not installed` once in the ledger and the reply with the install line, finish the parts that need no README, and mark the part that needs it BLOCKED, not done.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a README exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) cannot install plugins: give the install line and stop.
