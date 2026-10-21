# What agy loads: facts and where they come from

Each row says what is known about guidance loading on agy and how it was learned. Loading behavior is build-specific (agy updates often), so a fact that decides an answer is re-probed on the running build with the free probes listed at the end.

## Sources

| Source | Where it lives | What is known | Provenance |
| --- | --- | --- | --- |
| Global rules | `~/.gemini/GEMINI.md`, `~/.gemini/AGENTS.md`, their `~/.gemini/config/` counterparts, and the `rules/` folder in `~/.gemini/config/` | The agent may read these files and asks before editing them. Two paths that are symlinks to one file load once. | host changelog |
| Workspace customizations | `.agents/` directories from the working directory up to the project root, each with optional `skills.json`, `rules.json`, `plugins.json`, `agents.json`, plus `.agents/skills/`, `.agents/agents/`, `.agents/hooks.json` and `.agents/plugins/<name>/` | Manifests load from every `.agents/` directory between the working directory and the project root, so a session started in a subdirectory still sees the parents'. | host changelog |
| Directory entries in manifests | the folders that `skills.json`, `rules.json`, `agents.json` and `plugins.json` name | An entry loads the items directly inside the folder, as `.agents/skills/` does. A nested item is named in `include_only`, for example `{"path": "shared_skills", "include_only": ["category/my-skill"]}`. | host changelog |
| Plugin rules | `rules/` inside a plugin, or a plugin-level `rules.json` | Every rule file needs valid frontmatter with a `trigger`. A `model_decision` rule needs a `description`, a `glob` rule needs `globs`, and content past 24 KB is cut. An `AGENTS.md` or `GEMINI.md` at the plugin root (outside `rules/`) is flagged by the validator. | host changelog and `agy plugin validate` |
| Plugin skills, agents and hooks | `skills/`, `agents/`, `hooks.json` of an enabled plugin | Loaded with the plugin, without an approval step. Plugin skill slash commands are `/<plugin>:<skill>`. | probes on 1.4.3 |
| Agent-level rules | a Markdown agent's `rules:` frontmatter | A rule named there always applies. An agent's `inheritCustomizations` switch decides whether it adopts the user's skills, rules, plugins, subagents and MCP servers. Relative paths in agent frontmatter resolve against the agent file. | host changelog |
| Built-in guides | the `agy-customizations` and `antigravity-guide` skills, when `agy -p "/skills"` lists them | Their descriptions say they cover loading priority, discovery and the creation of skills, rules, plugins, hooks and MCP servers. Read them for current detail. | `/skills` listing on this machine |

## Budgets and limits

- A single rule file and a single `SKILL.md` body load at most 24 KB (24,000 bytes). The validator warns above that.
- User and workspace rules share a dedicated 20,000-token budget. Oversized rules are cut on newline boundaries and over-budget rules are listed by path and description, so a large rule set no longer evicts skills, workflows, subagents or MCP tools.
- Rules and discovered paths are sorted deterministically, so the prompt order is stable between turns.
- A rules directory reachable through a symlink loads once.
- Exclusion rules and allowlists in `rules.json` apply, so a rule that seems missing may be excluded there.

## Frontmatter of a rule file

```markdown
---
trigger: model_decision
description: "When to apply this rule, in one sentence."
---
```

Known `trigger` values from validator messages: `model_decision` (needs `description`) and `glob` (needs `globs`). Other accepted values exist and the running build's validator or the built-in `agy-customizations` skill names them. UNCONFIRMED here: the full list.

## Free probes that answer most questions

| Question | Probe | Cost |
| --- | --- | --- |
| Which skills loaded, from which plugin | `agy -p "/skills" < /dev/null` | none |
| Which hooks loaded | `agy -p "/hooks" < /dev/null` | none |
| Which agents loaded | `agy -p "/agents" < /dev/null` | none |
| Is the plugin bundle valid, rules included | `agy plugin validate <plugin-dir> --json --strict` | none |
| Which build is running | `agy --version` | none |
| What a settings or permissions page says | `agy -p "/config"`, `"/permissions"` | none |
| Which rules reached the model | read the session-start context in the conversation, or ask the model to quote the rule text it holds | a model call; use sparingly |

None of these probes reads a credential file, and the skill never opens `~/.gemini` credential or settings files. Global rule files named in the table above are read only when the question is about their content.

## UNCONFIRMED on this build

- The exact precedence between a project-root `AGENTS.md`, a project `GEMINI.md` and rules under `.agents/`. Use the built-in guide or a probe before stating an order.
- Whether a nested `AGENTS.md` in a subdirectory loads automatically when a file there is edited.
- The effect of workspace trust on which customizations load (the changelog mentions trusted workspaces).
- The values of `trigger` beyond `model_decision` and `glob`.
