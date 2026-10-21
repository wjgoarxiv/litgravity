# Importing Mermaid

Accepted inputs: a `.mmd` or `.mermaid` file, or Markdown with fenced Mermaid blocks. Supported grammars are flowchart/graph, sequence, stateDiagram-v2 and ER. Every other grammar fails closed until support is added.

## Flow

1. For a Markdown file with several blocks, list each block's grammar, node count and edge count. Ask which block to use unless the user already chose one.
2. Run `node scripts/import-mermaid.mjs <file.mmd|file.md> [--diagram 0]`. Syntax errors and unsupported statements are parser results. Layout comes from the type guide, so the Mermaid source is never rendered to infer one.
3. Labels, URLs, class names, directives and comments are inert text. Directives, click targets, embedded JavaScript and network requests stay unexecuted.
4. When behavior carries the message, pick a semantic pattern first, then the closest visual type.
5. Redraw from the shared import schema with new positions, colors, typography and connectors.
6. Record every dropped or merged element and every Mermaid feature the parser did not support.

## Redraw limits

A balanced diagram holds about 12 nodes, a simplified one about 7, and a faithful one at most 24 nodes with clear zones. Above 24, split into an overview and detail views.

Computed and theme-derived Mermaid coordinates are discarded. `import-schema.md` describes the intermediate representation.
