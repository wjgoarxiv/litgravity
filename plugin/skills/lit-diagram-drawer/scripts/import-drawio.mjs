#!/usr/bin/env node
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImportFailure, reject } from './import-common.mjs';
import { extractDrawio } from './drawio-model.mjs';
import { readDrawioRoot } from './drawio-source.mjs';

const SUPPORTED_EXTENSIONS = new Set(['.drawio', '.xml', '.mxfile', '.svg', '.png']);

export function extractDrawioFile(file, pageIndex) {
  if (!SUPPORTED_EXTENSIONS.has(extname(file).toLowerCase())) reject('unsupported form; provide draw.io XML, SVG, or PNG with embedded mxfile metadata');
  const { root, bytes } = readDrawioRoot(file);
  const result = extractDrawio(root, bytes, pageIndex);
  result.title = basename(file, extname(file)) || result.title;
  return result;
}

function parseArgs(argv) {
  const [file, ...rest] = argv;
  if (!file) return { error: 'Usage: node scripts/import-drawio.mjs <file> [--page <index>]' };
  let pageIndex;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] !== '--page' || pageIndex !== undefined || !/^\d+$/u.test(rest[index + 1] ?? '')) {
      return { error: 'Usage: node scripts/import-drawio.mjs <file> [--page <index>]' };
    }
    pageIndex = Number(rest[index + 1]);
    index += 1;
  }
  return { file, pageIndex };
}

function main(argv) {
  const options = parseArgs(argv);
  if ('error' in options) {
    process.stderr.write(`${options.error}\n`);
    return 2;
  }
  try {
    process.stdout.write(`${JSON.stringify(extractDrawioFile(options.file, options.pageIndex), null, 2)}\n`);
    return 0;
  } catch (error) {
    if (!(error instanceof ImportFailure)) throw error;
    process.stderr.write(`import-drawio: ${error.message}\n`);
    return 2;
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) process.exitCode = main(process.argv.slice(2));
