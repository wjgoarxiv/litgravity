import { reject } from './import-common.mjs';
import { addNode, addRelationship, createDiagram, finalizeDiagram, normalizeLabel } from './mermaid-common.mjs';

function entity(diagram, id) {
  const current = diagram.nodeBySourceId.get(id);
  if (current) {
    current.kind = 'entity';
    current.shape = 'entity';
    current.fields ??= [];
    return current;
  }
  return addNode(diagram, id, id, 'entity', 'entity', { fields: [] });
}

function relation(line, diagram) {
  const match = /^([A-Za-z0-9_][A-Za-z0-9_-]*)\s+([|o{}]+--[|o{}]+)\s+([A-Za-z0-9_][A-Za-z0-9_-]*)\s*:\s*(.+)$/u.exec(line);
  if (!match) return false;
  const [, fromId, cardinality, toId, label] = match;
  entity(diagram, fromId);
  entity(diagram, toId);
  const [left, right] = cardinality.split('--');
  addRelationship(diagram, fromId, toId, label, 'association', 'none', { cardinality: { left, right, source: cardinality } });
  return true;
}

function addField(line, current, diagram) {
  const match = /^([^\s]+)\s+([A-Za-z0-9_][A-Za-z0-9_-]*)(?:\s+(PK|FK|UK))?(?:\s+"([^"]*)")?\s*$/iu.exec(line);
  if (!match) reject(`unsupported Mermaid ER field: ${line.slice(0, 80)}`);
  const [, type, name, key, comment = ''] = match;
  if (current.fields.some((field) => field.name === name)) reject(`Mermaid ER entity has duplicate field ${name}`);
  const normalized = normalizeLabel(comment);
  diagram.discarded.urls += normalized.urls;
  current.fields.push({ type, name, key: key?.toUpperCase() ?? '', comment: normalized.text });
}

export function parseErDiagram(source, index = 0) {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() && !line.trim().startsWith('%%'));
  if (headerIndex < 0 || !/^erDiagram\s*$/iu.test(lines[headerIndex].trim())) reject('Mermaid ER diagram must start with erDiagram');
  const diagram = createDiagram('er', index);
  let current;
  for (let row = headerIndex + 1; row < lines.length; row += 1) {
    const line = lines[row].trim();
    if (!line) continue;
    if (line.startsWith('%%')) {
      diagram.discarded.comments += 1;
      if (line.startsWith('%%{')) diagram.discarded.directives += 1;
      continue;
    }
    if (line === '}') {
      if (!current) reject('Mermaid ER entity has an unmatched closing brace');
      current = undefined;
      continue;
    }
    const start = /^([A-Za-z0-9_][A-Za-z0-9_-]*)\s*\{\s*$/u.exec(line);
    if (start) {
      if (current) reject('Mermaid ER entities cannot be nested');
      current = entity(diagram, start[1]);
      continue;
    }
    if (current) {
      addField(line, current, diagram);
      continue;
    }
    if (relation(line, diagram)) continue;
    reject(`unsupported Mermaid ER statement: ${line.slice(0, 80)}`);
  }
  if (current) reject('Mermaid ER entity is missing a closing brace');
  return finalizeDiagram(diagram);
}
