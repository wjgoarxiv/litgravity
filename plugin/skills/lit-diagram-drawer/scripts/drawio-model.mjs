import { cleanLabel, reject, safeId, sha256 } from './import-common.mjs';
import { descendants, inflateDiagram, parseXml, xmlText } from './drawio-xml.mjs';

const MAX_PAGES = 100;
const MAX_NODES = 2_000;
const MAX_RELATIONSHIPS = 5_000;

function diagramModel(diagram) {
  const nested = descendants(diagram, 'mxGraphModel')[0];
  if (nested) return nested;
  const payload = xmlText(diagram).trim();
  if (!payload) reject('draw.io page has no graph model');
  return parseXml(payload.startsWith('<') ? payload : inflateDiagram(payload));
}

function styleOf(entry) {
  return Object.fromEntries((entry.style ?? '').split(';').filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    return separator < 0 ? [part, '1'] : [part.slice(0, separator), part.slice(separator + 1)];
  }));
}

function cellEntries(model) {
  const entries = [];
  for (const cell of descendants(model, 'mxCell')) {
    const wrapper = cell.parent?.attributes.id && cell.parent.name !== 'root' ? cell.parent : undefined;
    const attributes = { ...cell.attributes, ...(wrapper?.attributes ?? {}) };
    if (cell.attributes.vertex === '1' || cell.attributes.edge === '1') {
      attributes.vertex = cell.attributes.vertex;
      attributes.edge = cell.attributes.edge;
    }
    entries.push({ attributes, wrapper: Boolean(wrapper) });
  }
  return entries;
}

function shapeHint(style) {
  const shape = style.shape ?? '';
  if (/swimlane|container|group/iu.test(shape)) return 'container';
  if (/rhombus|diamond/iu.test(shape)) return 'diamond';
  if (/ellipse|oval/iu.test(shape)) return 'ellipse';
  if (/cylinder|database/iu.test(shape)) return 'cylinder';
  if (/cloud/iu.test(shape)) return 'cloud';
  if (/image/iu.test(shape)) return 'image';
  return 'rectangle';
}

function labelOf(attributes) {
  return cleanLabel(attributes.label ?? attributes.value ?? attributes.name ?? '', { html: true });
}

function extractPage(model, page, pageIndex) {
  const entries = cellEntries(model);
  if (entries.length > 20_000) reject('draw.io cell limit exceeded (max 20,000)');
  const bySourceId = new Map();
  const entryBySourceId = new Map();
  const usedIds = new Set();
  const nodes = [];
  const edges = [];
  const discarded = { styles: 0, links: 0, urls: 0, assets: 0, unsupportedCells: 0, danglingRelationships: 0 };

  for (const entry of entries) {
    const { attributes } = entry;
    const sourceId = attributes.id;
    if (!sourceId || sourceId === '0' || sourceId === '1') continue;
    if (bySourceId.has(sourceId)) reject(`draw.io page contains duplicate cell id ${sourceId}`);
    const style = styleOf(attributes);
    if (attributes.style || entry.wrapper) discarded.styles += 1;
    if (attributes.link || style.link) discarded.links += 1;
    if (attributes.edge === '1' || attributes.source || attributes.target) {
      edges.push({ attributes, style });
      bySourceId.set(sourceId, null);
      entryBySourceId.set(sourceId, entry);
      continue;
    }
    if (attributes.vertex !== '1') {
      discarded.unsupportedCells += 1;
      bySourceId.set(sourceId, null);
      entryBySourceId.set(sourceId, entry);
      continue;
    }
    if (nodes.length >= MAX_NODES) reject('draw.io node limit exceeded (max 2,000)');
    const normalized = labelOf(attributes);
    discarded.urls += normalized.urls;
    const shape = shapeHint(style);
    if (shape === 'image') discarded.assets += 1;
    const id = safeId(sourceId, usedIds, 'draw.io page');
    const node = { id, sourceId, label: normalized.text, kind: shape === 'container' ? 'container' : 'component', shape };
    nodes.push(node);
    bySourceId.set(sourceId, node);
    entryBySourceId.set(sourceId, entry);
  }

  const relationships = [];
  for (const edge of edges) {
    const { attributes, style } = edge;
    const from = bySourceId.get(attributes.source);
    const to = bySourceId.get(attributes.target);
    if (!from || !to) {
      discarded.danglingRelationships += 1;
      continue;
    }
    const normalized = labelOf(attributes);
    discarded.urls += normalized.urls;
    const start = Boolean(style.startArrow && style.startArrow !== 'none');
    const end = Boolean(style.endArrow && style.endArrow !== 'none');
    const direction = start && end ? 'both' : start ? 'reverse' : style.endArrow === 'none' ? 'none' : 'forward';
    relationships.push({ from: from.id, to: to.id, label: normalized.text, kind: 'flow', direction });
    if (relationships.length > MAX_RELATIONSHIPS) reject('draw.io relationship limit exceeded (max 5,000)');
  }

  for (const node of nodes) {
    const entry = entryBySourceId.get(node.sourceId);
    const parentId = entry?.attributes.parent;
    const parent = bySourceId.get(parentId);
    if (parent?.kind === 'container') node.parentId = parent.id;
  }
  const groups = nodes.filter(({ kind }) => kind === 'container').flatMap((container) => {
    const members = nodes.filter(({ parentId }) => parentId === container.id).map(({ id }) => id);
    return members.length ? [{ id: container.id, label: container.label || 'Container', nodeIds: members }] : [];
  });
  if (!nodes.length) reject('draw.io page contains no supported diagram cells');
  return {
    pageId: page.id || `page-${pageIndex + 1}`,
    name: cleanLabel(page.name || `Page ${pageIndex + 1}`).text,
    nodeCount: nodes.length,
    relationshipCount: relationships.length,
    suggestedType: relationships.length ? 'flowchart' : 'architecture',
    nodes: nodes.map(({ sourceId, ...node }) => node),
    relationships,
    groups,
    discarded,
  };
}

function pageDefinitions(root) {
  if (root.name === 'mxGraphModel') return [{ id: 'page-1', name: 'Page 1', model: root }];
  if (root.name !== 'mxfile') reject('XML root is not mxfile or mxGraphModel');
  const diagrams = root.children.filter(({ name }) => name === 'diagram');
  if (!diagrams.length) reject('draw.io file has no diagram pages');
  if (diagrams.length > MAX_PAGES) reject('draw.io page limit exceeded (max 100)');
  return diagrams.map((page) => ({ id: page.attributes.id, name: page.attributes.name, model: diagramModel(page) }));
}

export function extractDrawio(root, bytes, pageIndex) {
  const allPages = pageDefinitions(root);
  if (pageIndex !== undefined && (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= allPages.length)) {
    reject(`page index must be between 0 and ${allPages.length - 1}`);
  }
  const selected = pageIndex === undefined ? allPages.map((page, index) => ({ page, index })) : [{ page: allPages[pageIndex], index: pageIndex }];
  const pages = selected.map(({ page, index }) => extractPage(page.model, page, index));
  return {
    schemaVersion: 1,
    sourceFormat: 'drawio',
    sourceDigest: sha256(bytes),
    title: pages[0].name,
    suggestedType: pages[0].suggestedType,
    pageCount: allPages.length,
    pages,
    warnings: ['Source geometry, routes, and styling are omitted; labels and link text are inert data.'],
  };
}
