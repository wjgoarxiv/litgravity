#!/usr/bin/env node
// Genre-sensitive Korean prose signals for lit-humanizer. They are review prompts for an editor; they carry no
// authorship meaning and set no rewrite target. Exit 0 no warnings, 1 warnings present, 2 usage or unreadable input.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const thresholds = Object.freeze({
  conclusionPivotMin: 4,
  cleftMin: 2,
  cleftMinEojeol: 40,
  connectiveOpenersPerParagraph: 3,
  connectiveEndingCommaMin: 3,
  connectiveEndingCommaRate: 0.5
});

const conclusionLexicon = ['결론적으로', '따라서', '이를 통해', '그러므로'];
const connectiveOpeners = ['또한', '따라서', '즉', '나아가', '아울러', '게다가', '더욱이', '그러므로', '반면', '그러나', '하지만'];
const safeBalanceLexicon = ['양쪽 모두', '두 가지 모두', '장점도 있지만', '신중하게', '균형'];
const connectiveEnding = /(?:고|며|지만|면서|아서|어서)(?=[\s,\.!?。！？]|$)/g;
const connectiveEndingComma = /(?:고|며|지만|면서|아서|어서)\s*,/g;
const inlineCodePattern = new RegExp(String.fromCharCode(96) + '[^' + String.fromCharCode(96) + ']*' + String.fromCharCode(96), 'g');
const backtickFence = String.fromCharCode(96).repeat(3);

function stripMarkdown(text) {
  const kept = [];
  let fenced = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*~~~/.test(line) || line.trim().startsWith(backtickFence)) {
      fenced = !fenced;
      continue;
    }
    if (fenced || /^\s*>/.test(line) || /^\s{0,3}#{1,6}\s/.test(line)) continue;
    if (/^\s*\|.*\|\s*$/.test(line) || /^\s*\|?\s*:?-{3,}/.test(line)) continue;
    kept.push(line.replace(inlineCodePattern, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[[^\]]+\]\([^)]*\)/g, ''));
  }
  return kept.join('\n');
}

function splitSentences(text) {
  return (text.match(/[^.!?。！？\n]+[.!?。！？]?/g) || [])
    .map((part) => part.trim())
    .filter(Boolean);
}

function sentenceOpeners(text) {
  const clean = text.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim();
  for (const word of connectiveOpeners) {
    if (new RegExp('^' + word + '(?:[,，、:]|\\s)').test(clean)) return word;
  }
  return null;
}

function countOccurrences(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

export function analyzeKoText(input) {
  const prose = stripMarkdown(input);
  const eojeol = (prose.match(/\S+/g) || []).length;
  const sentences = splitSentences(prose);
  const conclusionPivots = conclusionLexicon.reduce((sum, item) => sum + prose.split(item).length - 1, 0);
  const cleftPattern = /(?:필요한|중요한|핵심인|문제인|관건인|답인|더\s+(?:심각한|뼈아픈))\s+것은\s+[^.!?。！？\n]{1,100}(?:이다|다|라는 점이다|데 있다)|(?:문제|핵심|관건|답)은\s+[^.!?。！？\n]{1,100}(?:이다|다|는 점이다|데 있다)/g;
  const clefts = countOccurrences(prose, cleftPattern);
  const paragraphs = prose.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const openerCounts = paragraphs.map((paragraph) => splitSentences(paragraph).filter(sentenceOpeners).length);
  const connectiveEndingCount = countOccurrences(prose, new RegExp(connectiveEnding.source, 'g'));
  const connectiveEndingCommaCount = countOccurrences(prose, new RegExp(connectiveEndingComma.source, 'g'));
  const commaFreeNumbers = prose.replace(/(?<=\d),(?=\d)/g, '');
  const commaSentenceShare = sentences.length
    ? sentences.filter((sentence) => /,/.test(sentence.replace(/(?<=\d),(?=\d)/g, ''))).length / sentences.length
    : 0;
  const lengths = sentences.map((sentence) => (sentence.match(/\S+/g) || []).length);
  const averageLength = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const variance = lengths.length ? lengths.reduce((sum, value) => sum + (value - averageLength) ** 2, 0) / lengths.length : 0;
  const endingKeys = sentences.map((sentence) => sentence.match(/[가-힣]{1,2}[.!?。！？]?$/)?.[0]?.replace(/[.!?。！？]/g, '')).filter(Boolean);
  const warnings = [];

  if (conclusionPivots >= thresholds.conclusionPivotMin) warnings.push('ko-conclusion-pivot-cluster');
  if (eojeol >= thresholds.cleftMinEojeol && clefts >= thresholds.cleftMin) warnings.push('ko-cleft-cluster');
  if (openerCounts.some((count) => count >= thresholds.connectiveOpenersPerParagraph)) warnings.push('ko-paragraph-initial-connective-cluster');
  const commaRate = connectiveEndingCount ? connectiveEndingCommaCount / connectiveEndingCount : 0;
  if (connectiveEndingCommaCount >= thresholds.connectiveEndingCommaMin && commaRate >= thresholds.connectiveEndingCommaRate) warnings.push('ko-connective-ending-comma-cluster');

  return {
    version: 1,
    scope: 'review-only; genre and sentence function still decide',
    metrics: {
      eojeol,
      sentenceCount: sentences.length,
      conclusionPivotCount: conclusionPivots,
      cleftCount: clefts,
      paragraphInitialConnectiveCounts: openerCounts,
      connectiveEndingCount,
      connectiveEndingCommaCount,
      connectiveEndingCommaRate: Number(commaRate.toFixed(3)),
      commaSentenceShare: Number(commaSentenceShare.toFixed(3)),
      sentenceLengthMeanEojeol: Number(averageLength.toFixed(2)),
      sentenceLengthCv: averageLength ? Number((Math.sqrt(variance) / averageLength).toFixed(3)) : 0,
      endingVariety: endingKeys.length ? Number((new Set(endingKeys).size / endingKeys.length).toFixed(3)) : 0,
      safeBalanceCount: safeBalanceLexicon.reduce((sum, item) => sum + prose.split(item).length - 1, 0),
      proseCommaCount: countOccurrences(commaFreeNumbers, /,/g)
    },
    warnings
  };
}

const usage = 'Usage: node scripts/ko-metrics.mjs [--json] [FILE ...] (stdin when FILE is omitted)';

function readRegular(file) {
  const info = fs.lstatSync(file);
  if (info.isSymbolicLink()) throw new Error(file + ': refusing a symbolic link');
  if (!info.isFile()) throw new Error(file + ': not a regular file');
  return fs.readFileSync(file, 'utf8');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    process.stdout.write(usage + '\n');
    return 0;
  }
  const json = args.includes('--json');
  const unknown = args.find((arg) => arg.startsWith('--') && arg !== '--json');
  if (unknown) throw new Error('unknown option: ' + unknown);
  const files = args.filter((arg) => arg !== '--json');
  const input = files.length
    ? files.map(readRegular).join('\n\n')
    : fs.readFileSync(0, 'utf8');
  const result = analyzeKoText(input);
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else {
    process.stdout.write('Korean prose signals (review only)\n');
    process.stdout.write(JSON.stringify(result.metrics, null, 2) + '\n');
    process.stdout.write('Warnings: ' + (result.warnings.join(', ') || 'none') + '\n');
  }
  return result.warnings.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(usage + '\n' + (error instanceof Error ? error.message : String(error)) + '\n');
    process.exitCode = 2;
  }
}
