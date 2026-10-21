#!/usr/bin/env node
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanLabel, ImportFailure, readBoundedFile, reject, safeId, sha256, strictUtf8 } from './import-common.mjs';

const MAX_INPUT = 16 * 1024 * 1024;
const MAX_ELEMENTS = 10_000;
const MAX_NODES = 2_000;
const MAX_RELATIONSHIPS = 5_000;
const MAX_DEPTH = 64;
const NODE_SHAPES = new Map([
  ['rectangle', 'rectangle'], ['ellipse', 'ellipse'], ['diamond', 'diamond'],
  ['image', 'image'], ['embeddable', 'embed'], ['iframe', 'embed'],
]);
const EDGE_TYPES = new Set(['arrow', 'line']);
const CONTAINER_TYPES = new Set(['frame', 'magicframe']);
const URL_RE = /\b(?:https?|ftp|file|javascript|data):[^\s<>"']+/giu;
const EXEC_RE = /<\s*(?:script|iframe|object|embed)\b|\bon[a-z]+\s*=/isu;

function checkJsonDepth(text) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '[' || char === '{') {
      depth += 1;
      if (depth > MAX_DEPTH) reject('scene nesting exceeds the depth limit (64)');
    } else if (char === ']' || char === '}') depth -= 1;
  }
}

function finiteGeometry(element) {
  for (const key of ['x', 'y', 'width', 'height']) {
    const value = element[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) reject(`element geometry field ${key} must be numeric`);
    if (Math.abs(value) > 10_000_000) reject(`element geometry field ${key} is outside the supported range`);
  }
}

export function extractExcalidraw(file) {
  const name = basename(file).toLowerCase();
  if (!(name.endsWith('.excalidraw') || name.endsWith('.excalidraw.json'))) {
    reject('unsupported form; provide a saved .excalidraw scene');
  }
  const data = readBoundedFile(file, MAX_INPUT, 'input');
  const text = strictUtf8(data, 'scene is not valid UTF-8 JSON');
  checkJsonDepth(text);
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    reject('scene is malformed JSON');
  }
  if (!document || Array.isArray(document) || typeof document !== 'object' || document.type !== 'excalidraw') {
    reject('input is not an Excalidraw scene');
  }
  if (!Array.isArray(document.elements)) reject('scene has no elements array');
  if (document.elements.length > MAX_ELEMENTS) reject('element limit exceeded (max 10,000)');

  const discarded = {
    styles: 0, links: 0, urls: 0, scripts: 0, assets: 0, unsupportedElements: 0,
    deletedElements: 0, freehandStrokes: 0, danglingRelationships: 0,
  };
  const live = [];
  const used = new Set();
  const idMap = new Map();
  for (const item of document.elements) {
    if (!item || Array.isArray(item) || typeof item !== 'object') reject('scene element must be an object');
    if (typeof item.id !== 'string' || typeof item.type !== 'string') reject('scene elements require string id and type fields');
    if (idMap.has(item.id)) reject('scene contains duplicate element ids');
    idMap.set(item.id, safeId(item.id, used, 'scene'));
    finiteGeometry(item);
    if (item.isDeleted === true) {
      discarded.deletedElements += 1;
      continue;
    }
    live.push(item);
  }

  const frameIds = new Set(live.filter((item) => CONTAINER_TYPES.has(item.type)).map((item) => item.id));
  const labels = new Map();
  for (const item of live) {
    if (item.type !== 'text') continue;
    if (item.text !== undefined && typeof item.text !== 'string') reject('text element content must be a string');
    const normalized = cleanLabel(item.text ?? '', { removeControls: true });
    discarded.urls += normalized.urls;
    if (typeof item.containerId === 'string' && idMap.has(item.containerId) && normalized.text) {
      const current = labels.get(item.containerId) ?? [];
      current.push(normalized.text);
      labels.set(item.containerId, current);
    }
  }

  const nodes = [];
  const nodeSourceIds = new Set();
  for (const item of live) {
    const sourceId = item.id;
    const type = item.type;
    if (EDGE_TYPES.has(type) || (type === 'text' && typeof item.containerId === 'string')) continue;
    if (type === 'selection' || type === 'laser') continue;
    if (type === 'freedraw') {
      discarded.freehandStrokes += 1;
      continue;
    }

    let shape;
    let kind;
    let rawLabel;
    if (CONTAINER_TYPES.has(type)) {
      shape = 'container';
      kind = 'container';
      rawLabel = typeof item.name === 'string' ? item.name : '';
    } else if (type === 'text') {
      shape = 'text';
      kind = 'annotation';
      rawLabel = typeof item.text === 'string' ? item.text : '';
    } else if (NODE_SHAPES.has(type)) {
      shape = NODE_SHAPES.get(type);
      kind = 'component';
      rawLabel = '';
      if (type === 'image' || type === 'embeddable' || type === 'iframe') discarded.assets += 1;
    } else {
      discarded.unsupportedElements += 1;
      continue;
    }
    const normalized = cleanLabel(rawLabel, { removeControls: true });
    discarded.urls += normalized.urls;
    let label = normalized.text;
    const boundLabels = labels.get(sourceId) ?? [];
    if (boundLabels.length) label = boundLabels.join('\n').slice(0, 2_000);
    if (typeof item.link === 'string' && item.link) {
      discarded.links += 1;
      if (URL_RE.test(item.link)) discarded.urls += 1;
      URL_RE.lastIndex = 0;
    }
    if (nodes.length >= MAX_NODES) reject('node limit exceeded (max 2,000)');
    const node = { id: idMap.get(sourceId), label, kind, shape };
    if (typeof item.frameId === 'string' && frameIds.has(item.frameId)) node.parentId = idMap.get(item.frameId);
    nodes.push(node);
    nodeSourceIds.add(sourceId);
  }

  const relationships = [];
  for (const item of live) {
    if (!EDGE_TYPES.has(item.type)) continue;
    const startId = item.startBinding?.elementId;
    const endId = item.endBinding?.elementId;
    if (typeof startId !== 'string' || typeof endId !== 'string' || !nodeSourceIds.has(startId) || !nodeSourceIds.has(endId)) {
      discarded.danglingRelationships += 1;
      continue;
    }
    const normalized = cleanLabel((labels.get(item.id) ?? []).join('\n'), { removeControls: true });
    discarded.urls += normalized.urls;
    const startHead = typeof item.startArrowhead === 'string' && !['', 'none'].includes(item.startArrowhead);
    const endHead = typeof item.endArrowhead === 'string' && !['', 'none'].includes(item.endArrowhead);
    const direction = startHead && endHead ? 'both' : startHead ? 'reverse' : endHead || item.type === 'arrow' ? 'forward' : 'none';
    relationships.push({
      from: idMap.get(startId), to: idMap.get(endId), label: normalized.text,
      kind: item.type === 'arrow' ? 'flow' : 'association', direction,
    });
    if (relationships.length > MAX_RELATIONSHIPS) reject('relationship limit exceeded (max 5,000)');
  }

  const groups = [];
  for (const frameId of [...frameIds].sort()) {
    const members = live
      .filter((item) => item.frameId === frameId && typeof item.id === 'string' && nodeSourceIds.has(item.id))
      .map((item) => idMap.get(item.id));
    if (members.length) {
      const frameLabel = nodes.find((node) => node.id === idMap.get(frameId))?.label || 'Frame';
      groups.push({ id: idMap.get(frameId), label: frameLabel, nodeIds: members });
    }
  }
  const sourceGroups = new Map();
  for (const item of live) {
    if (typeof item.id !== 'string' || !nodeSourceIds.has(item.id) || !Array.isArray(item.groupIds)) continue;
    for (const groupId of item.groupIds.slice(0, 64)) {
      if (typeof groupId !== 'string') continue;
      if (!sourceGroups.has(groupId) && sourceGroups.size >= MAX_NODES) reject('group limit exceeded (max 2,000)');
      const members = sourceGroups.get(groupId) ?? [];
      members.push(item.id);
      sourceGroups.set(groupId, members);
    }
  }
  for (const [groupId, members] of sourceGroups) {
    const safeGroupId = `g-${sha256(groupId).slice(7, 23)}`;
    if (used.has(safeGroupId)) reject('group id collides with an element id');
    used.add(safeGroupId);
    groups.push({ id: safeGroupId, label: 'Group', nodeIds: members.map((id) => idMap.get(id)) });
  }

  if (!nodes.length) reject('scene contains no supported diagram elements');
  discarded.styles = live.filter((item) => ['backgroundColor', 'strokeColor', 'strokeStyle', 'roughness'].some((key) => key in item)).length;
  if (document.files && typeof document.files === 'object' && !Array.isArray(document.files)) {
    discarded.assets += Object.keys(document.files).length;
  }
  const title = basename(file).replace(/\.excalidraw(?:\.json)?$/iu, '') || 'Imported diagram';
  return {
    schemaVersion: 1,
    sourceFormat: 'excalidraw',
    sourceDigest: sha256(data),
    title,
    suggestedType: relationships.length ? 'flowchart' : 'architecture',
    nodes,
    relationships,
    groups,
    discarded,
    warnings: ['Source coordinates and styling are omitted; label text is inert data.'],
  };
}

function main(argv) {
  const [file, ...rest] = argv;
  if (!file || rest.length) {
    process.stderr.write('Usage: node scripts/import-excalidraw.mjs <file.excalidraw>\n');
    return 2;
  }
  try {
    process.stdout.write(`${JSON.stringify(extractExcalidraw(file), null, 2)}\n`);
    return 0;
  } catch (error) {
    if (!(error instanceof ImportFailure)) throw error;
    process.stderr.write(`import-excalidraw: ${error.message}\n`);
    return 2;
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) process.exitCode = main(process.argv.slice(2));
