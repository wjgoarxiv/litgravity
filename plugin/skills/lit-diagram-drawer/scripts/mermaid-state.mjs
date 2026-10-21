import { reject } from './import-common.mjs';
import { addGroup, addNode, addRelationship, createDiagram, finalizeDiagram, normalizeLabel } from './mermaid-common.mjs';

function stateToken(value, side, diagram, groups) {
  const token = value.trim();
  if (token === '[*]') {
    const sourceId = side === 'from' ? '__initial' : '__final';
    const label = side === 'from' ? 'Initial state' : 'Final state';
    return addNode(diagram, sourceId, label, 'circle', 'state', groups.length ? { parentId: groups.at(-1).id } : {});
  }
  const quoted = /^(["'])([\s\S]*)\1$/u.exec(token);
  const sourceId = quoted ? quoted[2] : token;
  if (!/^[A-Za-z0-9_][A-Za-z0-9_. -]*$/u.test(sourceId)) reject(`unsupported Mermaid state identifier: ${token}`);
  const node = addNode(diagram, sourceId, sourceId, 'state', 'state', groups.length ? { parentId: groups.at(-1).id } : {});
  for (const group of groups) if (!group.nodeIds.includes(node.id)) group.nodeIds.push(node.id);
  return node;
}

function transition(line, diagram, groups) {
  const match = /^(.+?)\s*-->\s*(.+?)(?:\s*:\s*(.*))?$/u.exec(line);
  if (!match) return false;
  const from = stateToken(match[1], 'from', diagram, groups);
  const to = stateToken(match[2], 'to', diagram, groups);
  const guard = match[3] ?? '';
  addRelationship(diagram, from.sourceId, to.sourceId, guard, 'transition', 'forward', { guard: normalizeLabel(guard).text });
  return true;
}

export function parseStateDiagram(source, index = 0) {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() && !line.trim().startsWith('%%'));
  if (headerIndex < 0 || !/^stateDiagram-v2\s*$/iu.test(lines[headerIndex].trim())) reject('Mermaid state diagram must start with stateDiagram-v2');
  const diagram = createDiagram('state', index);
  const groups = [];
  for (let row = headerIndex + 1; row < lines.length; row += 1) {
    const line = lines[row].trim();
    if (!line) continue;
    if (line.startsWith('%%')) {
      diagram.discarded.comments += 1;
      if (line.startsWith('%%{')) diagram.discarded.directives += 1;
      continue;
    }
    if (/^direction\s+(?:TB|TD|BT|RL|LR)\s*$/iu.test(line)) {
      diagram.discarded.directives += 1;
      continue;
    }
    if (line === '}') {
      if (!groups.length) reject('state composite has an unmatched closing brace');
      groups.pop();
      continue;
    }
    const composite = /^state\s+([A-Za-z0-9_][A-Za-z0-9_.-]*)(?:\s+as\s+(.+?))?\s*\{\s*$/iu.exec(line);
    if (composite) {
      if (groups.length >= 16) reject('state composite nesting exceeds the depth limit (16)');
      const group = addGroup(diagram, composite[1], composite[2] ?? composite[1], 'composite');
      groups.push(group);
      continue;
    }
    const declaration = /^state\s+(["'])([\s\S]*?)\1\s+as\s+([A-Za-z0-9_][A-Za-z0-9_.-]*)(?:\s+<<([A-Za-z]+)>>)?\s*$/iu.exec(line);
    if (declaration) {
      const node = addNode(diagram, declaration[3], declaration[2], declaration[4] ?? 'state', 'state', groups.length ? { parentId: groups.at(-1).id } : {});
      for (const group of groups) if (!group.nodeIds.includes(node.id)) group.nodeIds.push(node.id);
      continue;
    }
    const simpleState = /^state\s+([A-Za-z0-9_][A-Za-z0-9_.-]*)\s*$/iu.exec(line);
    if (simpleState) {
      const node = addNode(diagram, simpleState[1], simpleState[1], 'state', 'state', groups.length ? { parentId: groups.at(-1).id } : {});
      for (const group of groups) if (!group.nodeIds.includes(node.id)) group.nodeIds.push(node.id);
      continue;
    }
    if (/^title\s*:/iu.test(line)) {
      diagram.title = normalizeLabel(line.replace(/^title\s*:\s*/iu, '')).text;
      continue;
    }
    if (transition(line, diagram, groups)) continue;
    reject(`unsupported Mermaid state statement: ${line.slice(0, 80)}`);
  }
  if (groups.length) reject('state composite is missing a closing brace');
  return finalizeDiagram(diagram);
}
