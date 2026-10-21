#!/usr/bin/env node
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImportFailure, readBoundedFile, reject, sha256, strictUtf8 } from './import-common.mjs';
import { MAX_DIAGRAMS, MAX_SOURCE_CHARS } from './mermaid-common.mjs';
import { parseFlowchart } from './mermaid-flowchart.mjs';
import { parseSequence } from './mermaid-sequence.mjs';
import { parseStateDiagram } from './mermaid-state.mjs';
import { parseErDiagram } from './mermaid-er.mjs';

const SUPPORTED_EXTENSIONS = new Set(['.mmd', '.mermaid', '.md', '.markdown']);

function markdownBlocks(source) {
  const blocks = [];
  let fence;
  let body = [];
  let mermaid = false;
  for (const line of source.replace(/\r\n?/gu, '\n').split('\n')) {
    if (fence) {
      const closing = new RegExp(`^ {0,3}${fence.char}{${fence.length},}\\s*$`, 'u');
      if (closing.test(line)) {
        if (mermaid) blocks.push(body.join('\n'));
        fence = undefined;
        body = [];
        mermaid = false;
      } else if (mermaid) body.push(line);
      continue;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
    if (!opening) continue;
    const info = opening[2].trim().split(/\s+/u)[0]?.toLowerCase() ?? '';
    fence = { char: opening[1][0], length: opening[1].length };
    mermaid = info === 'mermaid';
    body = [];
  }
  if (fence && mermaid) reject('Markdown Mermaid fence is missing a closing fence');
  return blocks;
}

function parseDiagram(source, index) {
  const header = source.split(/\r?\n/u).find((line) => line.trim() && !line.trim().startsWith('%%'))?.trim() ?? '';
  if (/^(?:flowchart|graph)\b/iu.test(header)) return parseFlowchart(source, index);
  if (/^sequenceDiagram\b/iu.test(header)) return parseSequence(source, index);
  if (/^stateDiagram-v2\b/iu.test(header)) return parseStateDiagram(source, index);
  if (/^erDiagram\b/iu.test(header)) return parseErDiagram(source, index);
  reject(`unsupported Mermaid grammar: ${header || '(empty)'}`);
}

export function extractMermaid(file, diagramIndex) {
  if (!SUPPORTED_EXTENSIONS.has(extname(file).toLowerCase())) reject('unsupported form; provide .mmd, .mermaid, or Markdown with Mermaid fences');
  const bytes = readBoundedFile(file, MAX_SOURCE_CHARS, 'Mermaid input');
  const source = strictUtf8(bytes, 'Mermaid input is not valid UTF-8');
  if (!source.trim()) reject('Mermaid input is empty');
  const blocks = ['.md', '.markdown'].includes(extname(file).toLowerCase()) ? markdownBlocks(source) : [source];
  if (!blocks.length) reject('Markdown contains no Mermaid fenced blocks');
  if (blocks.length > MAX_DIAGRAMS) reject('Mermaid block limit exceeded (max 100)');
  if (diagramIndex !== undefined && (!Number.isInteger(diagramIndex) || diagramIndex < 0 || diagramIndex >= blocks.length)) {
    reject(`diagram index must be between 0 and ${blocks.length - 1}`);
  }
  const selected = diagramIndex === undefined ? blocks.map((block, index) => ({ block, index })) : [{ block: blocks[diagramIndex], index: diagramIndex }];
  const diagrams = selected.map(({ block, index }) => parseDiagram(block, index));
  return {
    schemaVersion: 1,
    sourceFormat: 'mermaid',
    sourceDigest: sha256(bytes),
    title: diagrams[0].title || `Mermaid ${diagrams[0].grammar} diagram`,
    suggestedType: diagrams[0].suggestedType,
    diagramCount: blocks.length,
    diagrams,
    warnings: ['Source layout, themes, and renderer positions are omitted; source text is inert data.'],
  };
}

function parseArgs(argv) {
  const [file, ...rest] = argv;
  if (!file) return { error: 'Usage: node scripts/import-mermaid.mjs <file.mmd|file.md> [--diagram <index>]' };
  let diagramIndex;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] !== '--diagram' || diagramIndex !== undefined || !/^\d+$/u.test(rest[index + 1] ?? '')) {
      return { error: 'Usage: node scripts/import-mermaid.mjs <file.mmd|file.md> [--diagram <index>]' };
    }
    diagramIndex = Number(rest[index + 1]);
    index += 1;
  }
  return { file, diagramIndex };
}

function main(argv) {
  const options = parseArgs(argv);
  if ('error' in options) {
    process.stderr.write(`${options.error}\n`);
    return 2;
  }
  try {
    process.stdout.write(`${JSON.stringify(extractMermaid(options.file, options.diagramIndex), null, 2)}\n`);
    return 0;
  } catch (error) {
    if (!(error instanceof ImportFailure)) throw error;
    process.stderr.write(`import-mermaid: ${error.message}\n`);
    return 2;
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) process.exitCode = main(process.argv.slice(2));
