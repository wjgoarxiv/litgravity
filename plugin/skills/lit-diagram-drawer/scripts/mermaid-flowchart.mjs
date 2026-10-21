import { reject } from './import-common.mjs';
import { addGroup, addNode, addRelationship, createDiagram, finalizeDiagram, MAX_NODES, normalizeLabel, parseDelimitedLabel } from './mermaid-common.mjs';

const OPERATORS = ['<-->', '<-.->', '<--', '<==', '==>', '-->', '-.->', '---', '--o', '--x', 'o-->', 'x-->', '==', '--'];

function skipSpace(line, index) {
  while (/\s/u.test(line[index] ?? '')) index += 1;
  return index;
}

function readNode(line, start) {
  let index = skipSpace(line, start);
  if (!/[A-Za-z0-9_]/u.test(line[index] ?? '')) return undefined;
  const idStart = index;
  index += 1;
  while (/[A-Za-z0-9_-]/u.test(line[index] ?? '')) {
    if (line[index] === '-' && OPERATORS.some((operator) => line.startsWith(operator, index))) break;
    index += 1;
  }
  const id = line.slice(idStart, index);
  index = skipSpace(line, index);
  const shapes = [
    { opener: '[(', closer: ')]', shape: 'cylinder' },
    { opener: '[[', closer: ']]', shape: 'subroutine' },
    { opener: '((', closer: '))', shape: 'circle' },
    { opener: '{{', closer: '}}', shape: 'hexagon' },
    { opener: '([', closer: '])', shape: 'stadium' },
    { opener: '[', closer: ']', shape: 'box' },
    { opener: '(', closer: ')', shape: 'rounded' },
    { opener: '{', closer: '}', shape: 'diamond' },
  ];
  const delimiter = shapes.find(({ opener }) => line.startsWith(opener, index));
  if (!delimiter) return { id, label: '', shape: 'box', end: index };
  const content = parseDelimitedLabel(line, index, delimiter.opener, delimiter.closer);
  if (!content) return undefined;
  let label = content.value.trim();
  if ((label.startsWith('"') && label.endsWith('"')) || (label.startsWith("'") && label.endsWith("'"))) label = label.slice(1, -1);
  return { id, label, shape: delimiter.shape, end: content.end };
}

function readOperator(line, start) {
  const index = skipSpace(line, start);
  for (const operator of OPERATORS) if (line.startsWith(operator, index)) return { operator, end: index + operator.length };
  return undefined;
}

function readEdge(line, start) {
  const parsed = readOperator(line, start);
  if (!parsed) return undefined;
  let index = parsed.end;
  let operator = parsed.operator;
  let label = '';
  if (line[index] === '|') {
    const end = line.indexOf('|', index + 1);
    if (end < 0) reject('Mermaid edge label has an unmatched pipe');
    label = line.slice(index + 1, end);
    index = end + 1;
  } else if (parsed.operator === '--') {
    const labeled = /^\s+([^|;]+?)\s+(-->|==>|-\.->)/u.exec(line.slice(index));
    if (labeled) {
      label = labeled[1];
      operator = labeled[2];
      index += labeled[0].length;
    }
  }
  const direction = operator === '<-->' ? 'both'
    : operator.startsWith('<') ? 'reverse'
      : /(?:>|o|x)$/u.test(operator) ? 'forward'
        : 'none';
  return { label, direction, end: index };
}

function addFlowNode(diagram, parsed, groups) {
  const current = addNode(diagram, parsed.id, parsed.label, parsed.shape, 'process', groups.length ? { parentId: groups.at(-1).id } : {});
  for (const group of groups) if (!group.nodeIds.includes(current.id)) group.nodeIds.push(current.id);
  return current;
}

function directive(diagram, line) {
  if (/^(?:click|href)\b/iu.test(line)) diagram.discarded.links += 1;
  else diagram.discarded.directives += 1;
}

function stripInlineComment(line) {
  const closers = [];
  let quote = '';
  let pipeLabel = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      if (char === quote && line[index - 1] !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '|' && closers.length === 0) {
      pipeLabel = !pipeLabel;
      continue;
    }
    if (line.startsWith('%%', index) && closers.length === 0 && !pipeLabel) {
      return { text: line.slice(0, index).trimEnd(), hasComment: true };
    }
    if (pipeLabel) continue;
    if (char === '[' || char === '(' || char === '{') closers.push(char === '[' ? ']' : char === '(' ? ')' : '}');
    else if (char === ']' || char === ')' || char === '}') closers.pop();
  }
  return { text: line, hasComment: false };
}

export function parseFlowchart(source, index = 0) {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() && !line.trim().startsWith('%%'));
  if (headerIndex < 0 || !/^(?:flowchart|graph)\s+(?:TD|TB|BT|RL|LR)\s*$/iu.test(lines[headerIndex].trim())) {
    reject('Mermaid flowchart must start with flowchart or graph and a direction');
  }
  const diagram = createDiagram('flowchart', index);
  const groups = [];
  for (let row = headerIndex + 1; row < lines.length; row += 1) {
    let line = lines[row].trim();
    if (!line) continue;
    if (line.startsWith('%%')) {
      diagram.discarded.comments += 1;
      if (line.startsWith('%%{')) diagram.discarded.directives += 1;
      continue;
    }
    const uncommented = stripInlineComment(line);
    line = uncommented.text.trim();
    if (uncommented.hasComment) diagram.discarded.comments += 1;
    if (!line) continue;
    if (line.endsWith(';')) line = line.slice(0, -1).trim();
    if (/^(?:classDef|class|style|linkStyle|click|href)\b/iu.test(line)) {
      directive(diagram, line);
      continue;
    }
    const subgraph = /^subgraph\s+([A-Za-z0-9_][A-Za-z0-9_-]*)(?:\s*(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}))?\s*$/iu.exec(line);
    if (subgraph) {
      if (groups.length >= 16) reject('Mermaid subgraph nesting exceeds the depth limit (16)');
      const group = addGroup(diagram, subgraph[1], subgraph[2] ?? subgraph[3] ?? subgraph[4] ?? subgraph[1]);
      groups.push(group);
      continue;
    }
    if (/^end\s*$/iu.test(line)) {
      if (!groups.length) reject('Mermaid subgraph has an unmatched end');
      groups.pop();
      continue;
    }
    if (/^(?:direction|title)\b/iu.test(line)) {
      if (/^title\s+/iu.test(line)) diagram.title = normalizeLabel(line.replace(/^title\s+/iu, '')).text;
      else diagram.discarded.directives += 1;
      continue;
    }
    const first = readNode(line, 0);
    if (!first) reject(`unsupported Mermaid flowchart statement: ${line.slice(0, 80)}`);
    let current = addFlowNode(diagram, first, groups);
    let cursor = first.end;
    let foundEdge = false;
    while (cursor < line.length) {
      const edge = readEdge(line, cursor);
      if (!edge) {
        if (!line.slice(cursor).trim()) break;
        reject(`unsupported Mermaid flowchart syntax near ${line.slice(cursor, cursor + 40)}`);
      }
      const next = readNode(line, edge.end);
      if (!next) reject('Mermaid flowchart edge has no target node');
      const target = addFlowNode(diagram, next, groups);
      addRelationship(diagram, current.sourceId, target.sourceId, edge.label, 'flow', edge.direction);
      current = target;
      cursor = next.end;
      foundEdge = true;
      if (diagram.nodes.length > MAX_NODES) reject('Mermaid node limit exceeded (max 2,000)');
    }
    if (!foundEdge && cursor < line.length && line.slice(cursor).trim()) reject(`unsupported Mermaid flowchart syntax: ${line.slice(cursor, cursor + 40)}`);
  }
  if (groups.length) reject('Mermaid subgraph is missing end');
  return finalizeDiagram(diagram);
}
