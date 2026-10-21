# Deployment

**Catalog ID:** deployment

## Purpose and selection

Pick deployment to show where software runs: environments, network zones, hosts, pods, managed services, artifacts, versions, replicas, and protocol paths. The placement decision has to be visible. Architecture fits when only logical communication matters and placement adds no answer.

## Content schema

Declare up to 3 actual zones, each with an environment or network-boundary meaning. Each infrastructure node has a stable ID, a type (host, VM, pod, managed service, CDN), a zone, and a name. Each artifact has a deployed version, and a node may have a replica count. Edges record protocol and port, and may mark asynchronous or replication traffic. Limit the drawing to 6 infrastructure nodes, 9 artifact labels, and 8 network paths.

## Deterministic layout recipe

Use three nested levels in a 1000px-wide viewBox: the outer zone, the infrastructure node, and the artifact chips inside a node. Keep zone order from public/edge to private/data unless the brief names another direction. Split the interior of each zone into columns by declared node order, center nodes in their column, and distribute them vertically with fixed 24px gaps. Artifact chips follow a stable version/name order with 8px spacing. A replica badge lives inside the owning node.

Paint zone boundaries first, then orthogonal network routes, then node frames and artifact rows. Mostly horizontal paths use right/left ports, and vertical paths use top/bottom ports. Label each path with protocol and port on a masked paper strip. A route that crosses a zone boundary may use the link color, and within-zone traffic stays neutral. Async or replication paths take a dashed stroke.

## Encoding rules

A boundary stands for a real environment or network boundary, which makes it more than a grouping device. State node type with a small text tag, and give artifact names explicit version values. Show replicas as one node plus a count. Use at most two accent targets: a new component, or a single point of failure together with its consequential replication route.

## Korean behavior

Korean zone captions suit a Korean-speaking deployment audience. Cloud regions, hostnames, ports, image tags, and protocol names stay exact, with Korean explanations of abbreviations nearby. Pretendard sets descriptions and mono sets versions, ports, and image identifiers. Counts are numerals, and dates and versions are technical tokens in their original form.

## Light, dark, and full variants

Light uses quiet zone fills with dashed boundary strokes. Dark redraws the zone tint and network paths for clear separation, built from its own tokens. Full adds a title, the deployment scope, and a short legend outside the nested zones. Node count, zone placement, versions, and path endpoints stay fixed across variants.

## Accessibility

Describe each zone's meaning, hosts and artifacts, replica counts, and the important network paths. Keep a text list of deployments and protocol/port values available. Every host icon has an adjacent name, and boundary meaning comes from a label and line pattern with hue as a supplement. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for nested-boundary geometry, rendered clipping, contrast, accessibility, and text. Run scripts/verify-type.mjs --type=deployment for node/artifact/path limits, version tags, replica counts, and endpoint placement. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- A logical architecture repeated with hostnames sprinkled on top.
- A zone with no real trust or environment meaning.
- Deployed artifacts without versions.
- One node per replica.
- A wall of vendor logos replacing named infrastructure.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Icons](primitive-icons.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
