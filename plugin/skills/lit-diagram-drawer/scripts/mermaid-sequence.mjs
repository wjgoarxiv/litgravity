import { reject } from './import-common.mjs';
import { addNode, addRelationship, createDiagram, finalizeDiagram, normalizeLabel } from './mermaid-common.mjs';

const MESSAGE = /^([A-Za-z0-9_][A-Za-z0-9_-]*?)\s*(-->>|->>|--x|->x|-->|->|-\))\s*([+-]?)([A-Za-z0-9_][A-Za-z0-9_-]*)\s*(?::\s*(.*))?$/u;
const FRAGMENT_START = /^(alt|opt|loop|par|critical|break|rect|par_over)\b(?:\s+(.+))?$/iu;

function cleanAlias(value) {
  const alias = value.trim();
  return (alias.startsWith('"') && alias.endsWith('"')) || (alias.startsWith("'") && alias.endsWith("'"))
    ? alias.slice(1, -1)
    : alias;
}

function participant(diagram, id, alias = '') {
  return addNode(diagram, id, alias || id, 'lifeline', 'participant');
}

function openActivation(diagram, activations, sourceId) {
  const current = activations.get(sourceId) ?? [];
  current.push(diagram.relationships.length);
  activations.set(sourceId, current);
}

function closeActivation(diagram, activations, sourceId) {
  const stack = activations.get(sourceId) ?? [];
  if (!stack.length) reject(`deactivate has no matching activation for ${sourceId}`);
  const startMessageIndex = stack.pop();
  diagram.activations.push({ participantId: diagram.nodeBySourceId.get(sourceId).id, startMessageIndex, endMessageIndex: diagram.relationships.length });
}

function recordMessage(diagram, activations, fragments, line, order) {
  const match = MESSAGE.exec(line);
  if (!match) reject(`unsupported Mermaid sequence statement: ${line.slice(0, 80)}`);
  const [, from, arrow, activation, to, label = ''] = match;
  participant(diagram, from);
  participant(diagram, to);
  const fragment = fragments.at(-1);
  const messageMode = arrow === '-)' ? 'async' : 'message';
  const relationship = addRelationship(diagram, from, to, label, 'message', 'forward', {
    order,
    mode: messageMode,
    ...(arrow.endsWith('x') ? { endMarker: 'cross' } : {}),
    ...(fragment ? { fragmentId: fragment.id } : {}),
  });
  if (activation === '+') openActivation(diagram, activations, to);
  if (activation === '-') closeActivation(diagram, activations, to);
  return relationship;
}

export function parseSequence(source, index = 0) {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() && !line.trim().startsWith('%%'));
  if (headerIndex < 0 || !/^sequenceDiagram\s*$/iu.test(lines[headerIndex].trim())) reject('Mermaid sequence diagram must start with sequenceDiagram');
  const diagram = createDiagram('sequence', index);
  const fragments = [];
  const activations = new Map();
  for (let row = headerIndex + 1; row < lines.length; row += 1) {
    const line = lines[row].trim();
    if (!line) continue;
    if (line.startsWith('%%')) {
      diagram.discarded.comments += 1;
      if (line.startsWith('%%{')) diagram.discarded.directives += 1;
      continue;
    }
    const title = /^title\s*:\s*(.*)$/iu.exec(line);
    if (title) {
      diagram.title = normalizeLabel(title[1]).text;
      continue;
    }
    const declaration = /^(participant|actor)\s+([A-Za-z0-9_][A-Za-z0-9_-]*)(?:\s+as\s+(.+))?$/iu.exec(line);
    if (declaration) {
      participant(diagram, declaration[2], cleanAlias(declaration[3] ?? ''));
      continue;
    }
    if (/^(?:autonumber|hide\s+footbox|show\s+footbox)\b/iu.test(line)) {
      diagram.discarded.directives += 1;
      continue;
    }
    const fragmentMatch = FRAGMENT_START.exec(line);
    if (fragmentMatch) {
      const id = `fragment-${diagram.fragments.length + 1}`;
      const normalized = normalizeLabel(fragmentMatch[2] ?? '');
      diagram.discarded.urls += normalized.urls;
      const fragment = { id, type: fragmentMatch[1].toLowerCase(), label: normalized.text, branches: [] };
      diagram.fragments.push(fragment);
      fragments.push(fragment);
      continue;
    }
    const branch = /^(else|and|option)\b(?:\s+(.+))?$/iu.exec(line);
    if (branch) {
      const current = fragments.at(-1);
      if (!current) reject(`${branch[1]} has no open sequence fragment`);
      const normalized = normalizeLabel(branch[2] ?? '');
      diagram.discarded.urls += normalized.urls;
      current.branches.push({ type: branch[1].toLowerCase(), label: normalized.text });
      continue;
    }
    if (/^end\s*$/iu.test(line)) {
      if (!fragments.length) reject('sequence fragment has an unmatched end');
      fragments.pop();
      continue;
    }
    const control = /^(activate|deactivate)\s+([A-Za-z0-9_][A-Za-z0-9_-]*)$/iu.exec(line);
    if (control) {
      participant(diagram, control[2]);
      if (control[1].toLowerCase() === 'activate') openActivation(diagram, activations, control[2]);
      else closeActivation(diagram, activations, control[2]);
      continue;
    }
    const lifecycle = /^(create|destroy)\s+(?:participant\s+)?([A-Za-z0-9_][A-Za-z0-9_-]*)$/iu.exec(line);
    if (lifecycle) {
      const actor = participant(diagram, lifecycle[2]);
      diagram.notes.push({ kind: lifecycle[1].toLowerCase(), participantId: actor.id, order: diagram.relationships.length });
      continue;
    }
    const note = /^Note\s+(left|right)\s+of\s+([A-Za-z0-9_][A-Za-z0-9_-]*)\s*:\s*(.+)$/iu.exec(line)
      ?? /^Note\s+over\s+([A-Za-z0-9_][A-Za-z0-9_-]*(?:\s*,\s*[A-Za-z0-9_][A-Za-z0-9_-]*)?)\s*:\s*(.+)$/iu.exec(line);
    if (note) {
      const actorList = /^Note\s+over/iu.test(line) ? note[1].split(',') : [note[2]];
      const text = /^Note\s+over/iu.test(line) ? note[2] : note[3];
      const actors = actorList.map((actorId) => participant(diagram, actorId.trim()).id);
      const normalized = normalizeLabel(text);
      diagram.discarded.urls += normalized.urls;
      diagram.notes.push({ participantIds: actors, label: normalized.text, order: diagram.relationships.length });
      continue;
    }
    recordMessage(diagram, activations, fragments, line, diagram.relationships.length);
  }
  if (fragments.length) reject('sequence fragment is missing end');
  for (const [sourceId, starts] of activations) {
    for (const startMessageIndex of starts) {
      diagram.activations.push({ participantId: diagram.nodeBySourceId.get(sourceId).id, startMessageIndex, endMessageIndex: null });
    }
  }
  for (const node of diagram.nodes) delete node.sourceId;
  return finalizeDiagram(diagram);
}
