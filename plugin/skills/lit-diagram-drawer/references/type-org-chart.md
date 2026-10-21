# Org chart and responsibility map

**Catalog ID:** `org-chart`  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

Pick Org chart when the reader needs to know who owns work, how to reach an owner, where escalation goes, or which responsibility is still unstaffed. It covers people, teams, agents, queues, and accountable roles. Tree suits a generic hierarchy where ownership and invocation are irrelevant, and Swimlane or Process suits work that moves over time.

## Exclusions

This grammar shows one reporting or responsibility parent per node. Arbitrary dependencies, many-to-many assignments, timelines, and task steps belong to other diagrams. A missing owner is a visibly optional or setup gap and takes a distinct treatment from an active node. Cross-functional routing belongs in a separate flow diagram.

## Content schema

```yaml
title: "Support ownership"
nodes:
  - { id: intake, name: Support desk, kind: front-door, invocation: "/help", scope: "Triage · routing" }
  - { id: platform, parent: intake, name: Platform pod, kind: team, invocation: "#platform", scope: "Runtime · deploys" }
  - { id: identity, parent: platform, name: Identity owner, kind: owner, invocation: "IAM queue", scope: "Login · access", status: active }
  - { id: after-hours, parent: intake, name: After-hours owner, kind: owner, invocation: "—", scope: "Not assigned", status: gap }
escalations: ["Security approval required for production access"]
```

Each node has a stable ID, a visible name, a parent (except the single root), a role kind, a concise scope, and an optional invocation route. `status` is `active`, `optional`, or `gap`, and a gap always reads as unstaffed. Use at most two short escalation notes outside the tree.

## Deterministic layout recipe

Lay the chart out top-down. Put the root on the first tier and then the children in stable input order on each next tier. Every tier shares one y baseline, and its node centers are distributed evenly from the left safe margin to the right safe margin; compute each tier's x positions from its child count and skip manual nudges. Draw connectors first: a vertical drop from each parent to a horizontal bus, then vertical drops to its children. Use right-angle paths and leave enough space between tiers for the bus and labels. Nodes within a tier share one width, and the canvas size comes from the largest measured label plus fixed padding. Cap the view at 12 visible nodes, 4 tiers, and 5 direct reports per parent. Group larger teams into a pod node and link a second detail chart.

## Encoding rules

Give one root/front door the focal treatment. Team/pod nodes use the neutral team treatment, owner nodes use the owner treatment, and approval gates use the security treatment while staying separate from reporting lines. Dashed outlines mark optional or unconfigured roles. Each node answers name, invocation, and scope in that order, and an unavailable invocation shows an explicit unavailable marker. Escalation notes go in a side callout or footer, so no phantom reports appear in the tree. A pure org chart needs no arrows or connector labels.

## Korean behavior

Use Korean role names and scope words where that is the team's language. Keep handles, slash commands, queue names, and IDs in their original spelling on a single line. Use one or two intentional name lines and at most two short scope lines. Center labels in identical node geometry across languages; when the text overflows, shorten the role or split the chart by pod.

## Light, dark, and full variants

Light and dark share the same tree, node dimensions, and status encoding. Change only the shared tokens, keep dashed gaps dashed, and keep the single focal owner consistent. The full variant may add an editorial heading and a compact escalation note or coverage summary below the same chart. People and responsibilities stay exactly as the source gives them.

## Accessibility

Use a titled SVG with a description of the root, the reporting direction, and any visible coverage gap. Provide a linear text list in DOM order, parent before children, giving each node's name, invocation, scope, and status. Pair color with another cue for the active/gap distinction. Connector contrast meets the shared non-text contrast rule, and node text stays readable at slide scale.

## Verifier gates

Run `node scripts/verify-diagram.mjs` for overlaps, label clipping, canvas bounds, contrast/skin polarity, SVG title/description, and visible-text checks. Run `node scripts/verify-type.mjs --type=org-chart` to validate the catalog marker. Review root/parent links, tier and report limits, node status, and orthogonal ownership connectors against this guide. See [Verifier guide](verifier-guide.md). Confirm that the gallery wrapper's `data-type` value matches this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- A process lane for an ownership question, or a reporting tree for a sequence question.
- More than 12 nodes, 4 tiers, or 5 reports under one parent without a split.
- An unconfigured owner shown as active, or the gap hidden entirely.
- Identical boxes for the front door, team, owner, and approval role.
- Job-description paragraphs, repeated handles in callouts, diagonal lines, or floating legends.
