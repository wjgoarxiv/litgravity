import { cleanLabel, reject, safeId } from './import-common.mjs';

export const MAX_SOURCE_CHARS = 2 * 1024 * 1024;
export const MAX_DIAGRAMS = 100;
export const MAX_NODES = 2_000;
export const MAX_RELATIONSHIPS = 5_000;

export function normalizeLabel(value) {
  return cleanLabel(value, { html: true, markdown: true, removeControls: true });
}

export function createDiagram(grammar, index) {
  return {
    grammar,
    index,
    title: '',
    suggestedType: ({ flowchart: 'flowchart', sequence: 'sequence', state: 'state', er: 'er' })[grammar],
    nodes: [],
    relationships: [],
    groups: [],
    discarded: { directives: 0, comments: 0, links: 0, urls: 0, unsupportedStatements: 0 },
    fragments: [],
    activations: [],
    notes: [],
    nodeBySourceId: new Map(),
    usedIds: new Set(),
  };
}

export function addNode(diagram, sourceId, label = '', shape = 'box', kind = 'process', properties = {}) {
  if (!sourceId) reject('Mermaid node identifier is empty');
  const normalized = normalizeLabel(label);
  diagram.discarded.urls += normalized.urls;
  const current = diagram.nodeBySourceId.get(sourceId);
  if (current) {
    if (normalized.text && normalized.text !== sourceId) {
      if (current.label !== sourceId && current.label !== normalized.text) reject(`Mermaid node ${sourceId} has conflicting labels`);
      current.label = normalized.text;
    }
    if (properties.parentId) current.parentId = properties.parentId;
    Object.assign(current, properties);
    return current;
  }
  if (diagram.nodes.length >= MAX_NODES) reject('Mermaid node limit exceeded (max 2,000)');
  const node = {
    id: safeId(sourceId, diagram.usedIds, 'Mermaid diagram'),
    sourceId,
    label: normalized.text || sourceId,
    kind,
    shape,
    ...properties,
  };
  diagram.nodes.push(node);
  diagram.nodeBySourceId.set(sourceId, node);
  return node;
}

export function addGroup(diagram, sourceId, label, kind = 'subgraph') {
  const id = safeId(`group-${sourceId}`, diagram.usedIds, 'Mermaid diagram');
  const normalized = normalizeLabel(label || sourceId);
  diagram.discarded.urls += normalized.urls;
  const group = { id, sourceId, label: normalized.text || sourceId, kind, nodeIds: [] };
  diagram.groups.push(group);
  return group;
}

export function addRelationship(diagram, from, to, label = '', kind = 'flow', direction = 'forward', properties = {}) {
  const source = diagram.nodeBySourceId.get(from);
  const target = diagram.nodeBySourceId.get(to);
  if (!source || !target) reject(`Mermaid relationship refers to an unknown node (${from} → ${to})`);
  const normalized = normalizeLabel(label);
  diagram.discarded.urls += normalized.urls;
  if (diagram.relationships.length >= MAX_RELATIONSHIPS) reject('Mermaid relationship limit exceeded (max 5,000)');
  const relationship = { from: source.id, to: target.id, label: normalized.text, kind, direction, ...properties };
  diagram.relationships.push(relationship);
  return relationship;
}

export function finalizeDiagram(diagram) {
  for (const group of diagram.groups) {
    if (group.nodeIds.length === 0) group.nodeIds = diagram.nodes.filter(({ parentId }) => parentId === group.id).map(({ id }) => id);
    group.nodeIds = [...new Set(group.nodeIds)];
    delete group.sourceId;
  }
  if (!diagram.nodes.length) reject(`Mermaid ${diagram.grammar} diagram contains no supported nodes`);
  const { nodeBySourceId, usedIds, index, ...result } = diagram;
  result.nodes = result.nodes.map(({ sourceId, ...node }) => node);
  return result;
}

export function parseDelimitedLabel(line, start, opener, closer) {
  if (!line.startsWith(opener, start)) return undefined;
  let depth = 0;
  let quote = '';
  for (let index = start; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      if (char === quote && line[index - 1] !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (line.startsWith(opener, index)) {
      depth += 1;
      index += opener.length - 1;
    } else if (line.startsWith(closer, index)) {
      depth -= 1;
      if (depth === 0) return { value: line.slice(start + opener.length, index), end: index + closer.length };
      index += closer.length - 1;
    }
  }
  reject('Mermaid node label has an unmatched delimiter');
}
