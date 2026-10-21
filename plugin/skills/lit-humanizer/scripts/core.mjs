// lit-humanizer rule engine: parses rules.json, splits text into line, sentence or document segments while skipping
// code, quotations, captions and internal paths, and counts negation clusters per paragraph, list block or table column.
import path from 'node:path';

const VALID_LANGS = new Set(['ko', 'en', 'code']);
const VALID_SEVERITIES = new Set(['block', 'warn']);
const VALID_SCOPES = new Set(['line', 'sentence', 'document']);

export function parseRules(raw) {
  const data = JSON.parse(raw);
  if (data.schema_version !== 1 || !Array.isArray(data.rules)) {
    throw new Error('rules.json must use schema_version 1 and contain a rules array');
  }
  const ids = new Set();
  return data.rules.map((rule) => {
    if (typeof rule.id !== 'string' || ids.has(rule.id)) throw new Error(`missing or duplicate rule id: ${rule.id}`);
    ids.add(rule.id);
    if (!VALID_LANGS.has(rule.lang) || !VALID_SEVERITIES.has(rule.severity) || !VALID_SCOPES.has(rule.scope)) {
      throw new Error(`invalid lang, severity, or scope for ${rule.id}`);
    }
    if (typeof rule.pattern !== 'string' || typeof rule.flags !== 'string' || !Array.isArray(rule.context) || !Array.isArray(rule.fixture_ids)) {
      throw new Error(`incomplete rule definition: ${rule.id}`);
    }
    return { ...rule, regex: new RegExp(rule.pattern, rule.flags) };
  });
}

function isInternalPath(file) {
  const segments = path.normalize(file).split(/[\\/]+/);
  const plansAt = segments.indexOf('plans');
  if (plansAt >= 0 && segments[plansAt + 1] === 'lit-humanizer-canonical') return false;
  return segments.some((segment) => segment === 'plans' || segment === 'evidence' ||
    segment.startsWith('.lit') || segment === '.gemini' || /^HANDOFF/i.test(segment) || segment === 'ledgers');
}

function isCaption(line) {
  return /^\s*(?:>\s*)?(?:!\[)?(?:표\s*\d+|그림\s*\d+|table\s+\d+|figure\s+\d+)\b/i.test(line);
}

function isPlainSourceLine(line) {
  return /^\s*(?:Source|Sources|출처|자료|※\s*자료)\s*[:：]/i.test(line) &&
    !/^\s*(?:\*\*|__|<b\b)/i.test(line);
}

function hasEmbeddedCaveat(line) {
  const body = line.replace(/^\s*(?:Source|Sources|출처|자료|※\s*자료)\s*[:：]\s*/i, '');
  const segments = body.split(/[,;:—–]/).map((segment) => segment.trim().replace(/[.!?。]+$/, ''));
  const tail = segments.at(-1) ?? '';
  const caveatPhrase = /\b(?:not\s+(?:realized\s+results?|verified|independently verified|performed|a permit decision|final|actual)|demo(?:nstration)?\s+(?:synthesis|assumptions|recommendations?)|(?:preliminary|provisional|tentative|draft|estimated?)\s+(?:results?|data|findings?|outcomes?|values?)|results?\s+may\s+(?:change|be revised)|subject\s+to\s+change)\b|미실현|실현되지|미검증|검증되지|미확인|(?:잠정|예비|추정|예상)(?:치)?(?:\s*(?:결과|자료|수치|값))?|변동\s*가능|변경\s*가능|확정되지|미확정/i;
  const standaloneStatus = /^(?:assumptions?|recommendations?|unverified|preliminary|provisional|tentative|draft|estimated?|estimate|forecast|projection|projected|planned|simulated|modeled|가정|권고|제안|잠정(?:치)?|예비|추정(?:치)?|예상)$/i;
  const appendedWithoutDelimiter = /(?:^|\s)(?:not\s+(?:realized\s+results?|verified|independently verified|performed|a permit decision|final|actual)|demo(?:nstration)?\s+(?:synthesis|assumptions|recommendations?)|(?:preliminary|provisional|tentative|draft|estimated?)\s+(?:results?|data|findings?|outcomes?|values?)|results?\s+may\s+(?:change|be revised)|subject\s+to\s+change|unverified|미실현|실현되지|미검증|검증되지|미확인|잠정(?:치)?|예비(?:자료|결과|수치)?|추정(?:치|자료|결과)?|예상(?:치|자료|결과)?|변동\s*가능|변경\s*가능|확정되지|미확정)\s*[.!?。)]*$/i;
  return caveatPhrase.test(tail) || standaloneStatus.test(tail) || appendedWithoutDelimiter.test(body);
}

function inlineCodeAsSpaces(line) {
  return line.replace(/(`+)[^`]*?\1/g, (match) => ' '.repeat(match.length));
}

function matchesLanguage(rule, text) {
  if (rule.lang === 'ko') return /[가-힣]/.test(text);
  if (rule.lang === 'en') return /[a-z]/i.test(text);
  return true;
}

function sourceRows(text) {
  let fence = null;
  let captionPending = 0;
  let figureActive = false;
  return text.split(/\r?\n/).map((line, index) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length) fence = null;
      captionPending = 0;
      figureActive = false;
      return { line, number: index + 1, candidate: '', skipped: true, caption: false, captionAttribution: false };
    }
    if (marker) {
      captionPending = 0;
      fence = { char: marker[1][0], length: marker[1].length };
      figureActive = false;
      return { line, number: index + 1, candidate: '', skipped: true, caption: false, captionAttribution: false };
    }
    if (/^\s{0,3}>\s?/.test(line)) {
      captionPending = 0;
      figureActive = false;
      // A quote that opens with a bold label (> **주의:** ...) is the author's own callout rather than
      // quoted text. Only rules that list blockquote_callout read it, with the marker blanked.
      const callout = /^\s{0,3}>\s?(?:\*\*|__)[^*_\n]{1,24}(?:\*\*|__)/.test(line)
        ? inlineCodeAsSpaces(line.replace(/^\s{0,3}>\s?/, (prefix) => ' '.repeat(prefix.length)))
        : '';
      return { line, number: index + 1, candidate: '', callout, skipped: true, caption: false, captionAttribution: false };
    }
    const candidate = inlineCodeAsSpaces(line);
    const caption = isCaption(line);
    const plainSource = isPlainSourceLine(line);
    const sourceAnchor = /^\s*\|/.test(line) || /^\s*!\[[^\]]*\]\s*\(/.test(line) ||
      /^\s*<img\b/i.test(line) || caption;
    const opensFigure = /<figure\b/i.test(line);
    const closesFigure = /<\/figure\s*>/i.test(line);
    if (opensFigure) figureActive = true;
    const captionAttribution = !hasEmbeddedCaveat(line) && plainSource &&
      (captionPending > 0 || figureActive);
    if (sourceAnchor || closesFigure) captionPending = 2;
    else if (plainSource) captionPending = 0;
    else if (line.trim() && captionPending > 0) captionPending = 0;
    else if (captionPending > 0 && !line.trim()) captionPending -= 1;
    if (closesFigure) figureActive = false;
    return { line, number: index + 1, candidate, caption, captionAttribution, skipped: false };
  });
}

function joinRows(rows, separator) {
  let text = '';
  const lineStarts = [];
  rows.forEach((row, index) => {
    if (index > 0) text += separator;
    lineStarts.push({ offset: text.length, line: row.number });
    text += row.candidate;
  });
  return { text, lineStarts };
}

function lineAtOffset(span, offset) {
  if (span.line !== undefined) return span.line;
  let low = 0;
  let high = span.lineStarts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (span.lineStarts[mid].offset <= offset) low = mid + 1;
    else high = mid - 1;
  }
  return span.lineStarts[Math.max(0, high)]?.line ?? 1;
}

function sliceSpan(span, start, end) {
  const lineStarts = span.lineStarts
    .filter((entry) => entry.offset >= start && entry.offset < end)
    .map((entry) => ({ offset: entry.offset - start, line: entry.line }));
  if (!lineStarts.length) lineStarts.push({ offset: 0, line: lineAtOffset(span, start) });
  else if (lineStarts[0].offset > 0) lineStarts.unshift({ offset: 0, line: lineAtOffset(span, start) });
  return { text: span.text.slice(start, end), lineStarts };
}

function splitSentences(span) {
  const segments = [];
  const boundary = /[.!?。！？]+(?:["'”’»)\]]*)\s+/gu;
  let start = 0;
  for (const match of span.text.matchAll(boundary)) {
    const end = match.index + match[0].length - match[0].match(/\s+$/u)[0].length;
    if (end > start) segments.push(sliceSpan(span, start, end));
    start = match.index + match[0].length;
  }
  if (start < span.text.length) segments.push(sliceSpan(span, start, span.text.length));
  return segments;
}

function ruleSegments(rows, rule, cache) {
  const readCallouts = rule.context.includes('blockquote_callout');
  const cacheKey = `${rule.scope}/${rule.context.includes('table_figure_caption')}/${readCallouts}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const skipCaptions = rule.context.includes('table_figure_caption');
  const segments = [];
  let group = [];
  const flush = () => {
    if (!group.length) return;
    const joined = joinRows(group, rule.scope === 'sentence' ? ' ' : '\n');
    segments.push(...(rule.scope === 'sentence' ? splitSentences(joined) : [joined]));
    group = [];
  };

  for (const row of rows) {
    if (readCallouts && row.callout) {
      flush();
      segments.push({ text: row.callout, line: row.number });
      continue;
    }
    const captionExempt = skipCaptions && (row.caption || row.captionAttribution);
    if (row.skipped || captionExempt || (rule.scope === 'sentence' && !row.candidate.trim())) {
      flush();
      continue;
    }
    if (rule.scope === 'line') {
      segments.push({ text: row.candidate, line: row.number });
    } else {
      group.push(row);
    }
  }
  flush();
  cache.set(cacheKey, segments);
  return segments;
}

// A document-scope match runs from its first occurrence to its last, across unrelated text. The lines a
// match actually occupies are its first and last line; overlapping re-matches from each later start add
// the lines of further occurrences. Returns null past the bound, so callers fall back to the whole span.
const MAX_OCCURRENCE_MATCHES = 64;
function occurrenceLines(regex, segment, first) {
  const lines = new Set();
  const again = new RegExp(regex.source, `${regex.flags.replace(/[gy]/g, '')}g`);
  let match = first;
  for (let count = 0; match; count += 1) {
    if (count >= MAX_OCCURRENCE_MATCHES) return null;
    lines.add(lineAtOffset(segment, match.index));
    lines.add(lineAtOffset(segment, match.index + Math.max(match[0].length - 1, 0)));
    again.lastIndex = match.index + 1;
    match = again.exec(segment.text);
  }
  return [...lines].sort((a, b) => a - b);
}

export function scanText(text, rules, file = '<stdin>') {
  if (isInternalPath(file)) return [];
  const findings = [];
  const rows = sourceRows(text);
  const segmentCache = new Map();
  for (const rule of rules) {
    for (const segment of ruleSegments(rows, rule, segmentCache)) {
      if (!matchesLanguage(rule, segment.text)) continue;
      rule.regex.lastIndex = 0;
      const match = rule.regex.exec(segment.text);
      if (!match) continue;
      const finding = {
        file,
        rule: rule.id,
        severity: rule.severity,
        line: lineAtOffset(segment, match.index),
        endLine: lineAtOffset(segment, match.index + Math.max(match[0].length - 1, 0)),
        excerpt: segment.text.trim().replace(/\s+/g, ' ').slice(0, 180),
      };
      if (rule.scope === 'document') {
        const lines = occurrenceLines(rule.regex, segment, match);
        if (lines) finding.lines = lines;
      }
      findings.push(finding);
    }
  }
  return findings;
}

// negation-cluster counts definitional negations per paragraph, list block, or table column, plain and
// reworded. A count cannot be expressed as a single-match rule, so it runs beside the rule engine.
// Two Korean negations or three in any language block; exactly two otherwise warn.
const KO_NEGATIONS = [/아닙니다|아님|아니다|아니며|아니라|아닌/g, /(?:로|으로) (?:읽을|볼|해석할|간주할) 수 없|(?:로|으로) 보지 않|(?:을|를) (?:뜻하지|의미하지|나타내지|가리키지) 않|(?:와|과)는 다(?:릅니다|르다|름|르며|르고|르므로)|(?:로|으로) (?:읽으면|보면|해석하면) 안 /g];
// Word edges are Unicode-aware: an ASCII \b would count "is not" glued to a preceding Hangul word.
const EN_NEGATIONS = [
  /(?<![\p{L}\p{N}_])(?:is not|are not|isn't|aren't|not a|rather than)(?![\p{L}\p{N}_])/giu,
  /(?<![\p{L}\p{N}_])(?:(?:should not|cannot|can't|must not) be (?:read|taken|interpreted|treated) as|(?:does|do) not (?:mean|represent|indicate))(?![\p{L}\p{N}_])/giu,
];
const BLOCK_KO = 2;
const BLOCK_TOTAL = 3;
const WARN_TOTAL = 2;
const TABLE_CELL_MIN_CHARS = 13;
export const NEGATION_CLUSTER_MESSAGE = 'Several negations sit in one place. Say what the thing is first, then add the caveat once. Example: write "18,420 visits in total, including repeat visits" instead of "18,420 is not the number of residents".';

const countAll = (text, patterns) => patterns.reduce((sum, pattern) => sum + (text.match(pattern)?.length ?? 0), 0);

function negationSeverity(text) {
  const ko = countAll(text, KO_NEGATIONS);
  const total = ko + countAll(text, EN_NEGATIONS);
  if (ko >= BLOCK_KO || total >= BLOCK_TOTAL) return 'block';
  return total >= WARN_TOTAL ? 'warn' : null;
}

function negationUnits(block) {
  const lines = block.filter((row) => row.candidate.trim());
  if (!lines.every((row) => /^\s*\|/.test(row.candidate))) {
    return [{ text: lines.map((row) => row.candidate).join('\n'), line: lines[0].number, endLine: lines.at(-1).number }];
  }
  const rows = lines.filter((row) => !/^[\s|:-]+$/.test(row.candidate)).map((row) => ({
    line: row.number,
    cells: row.candidate.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()),
  }));
  const width = Math.max(0, ...rows.map((row) => row.cells.length));
  return Array.from({ length: width }, (_, column) => {
    const cells = rows.filter((row) => [...(row.cells[column] ?? '')].length >= TABLE_CELL_MIN_CHARS);
    return { text: cells.map((row) => row.cells[column]).join('\n'), line: cells[0]?.line ?? rows[0].line, endLine: cells.at(-1)?.line ?? rows[0].line };
  });
}

export function scanNegationClusters(text, file = '<stdin>') {
  if (isInternalPath(file)) return [];
  const findings = [];
  let block = [];
  const flush = () => {
    if (!block.length) return;
    for (const unit of negationUnits(block)) {
      const severity = negationSeverity(unit.text);
      if (!severity) continue;
      findings.push({
        file,
        rule: 'negation-cluster',
        severity,
        line: unit.line,
        endLine: unit.endLine,
        excerpt: unit.text.trim().replace(/\s+/g, ' ').slice(0, 180),
        message: NEGATION_CLUSTER_MESSAGE,
      });
    }
    block = [];
  };
  for (const row of sourceRows(text)) {
    if (row.skipped || !row.candidate.trim()) flush();
    else block.push(row);
  }
  flush();
  return findings;
}

export function exitCode(findings) {
  if (findings.some((finding) => finding.severity === 'block')) return 2;
  if (findings.some((finding) => finding.severity === 'warn')) return 1;
  return 0;
}
