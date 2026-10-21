import { createHash } from 'node:crypto';
import { closeSync, openSync, readSync } from 'node:fs';

export class ImportFailure extends Error {}

export function reject(message) {
  throw new ImportFailure(message);
}

export function readBoundedFile(file, limit, description) {
  let fd;
  try {
    fd = openSync(file, 'r');
    const chunks = [];
    let total = 0;
    while (total <= limit) {
      const buffer = Buffer.alloc(Math.min(64 * 1024, limit + 1 - total));
      const count = readSync(fd, buffer, 0, buffer.length, null);
      if (count === 0) break;
      chunks.push(buffer.subarray(0, count));
      total += count;
    }
    if (total > limit) reject(`${description} exceeds the ${Math.floor(limit / (1024 * 1024))} MiB limit`);
    return Buffer.concat(chunks, total);
  } catch (error) {
    if (error instanceof ImportFailure) throw error;
    reject(`cannot read input: ${error instanceof Error ? error.message : 'I/O error'}`);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function safeId(sourceId, used, description = 'diagram') {
  if (!sourceId) reject(`${description} contains an element without an id`);
  const candidate = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u.test(sourceId)
    ? sourceId
    : `n-${createHash('sha256').update(sourceId).digest('hex').slice(0, 16)}`;
  if (used.has(candidate)) reject(`${description} contains duplicate or colliding ids`);
  used.add(candidate);
  return candidate;
}

export function sha256(data) {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

export function decodeEntities(text) {
  return text.replace(/&(#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);/giu, (entity, name) => {
    if (name[0] === '#') {
      const hex = name[1]?.toLowerCase() === 'x';
      const point = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(point) || point < 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) {
        reject('label contains an invalid character reference');
      }
      return String.fromCodePoint(point);
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' })[name.toLowerCase()] ?? entity;
  });
}

export function cleanLabel(raw, { html = false, markdown = false, removeControls = false } = {}) {
  let text = html ? decodeEntities(raw) : raw;
  if (/<\s*(?:script|iframe|object|embed)\b|\bon[a-z]+\s*=/isu.test(text)) {
    reject('executable markup or event attributes in labels are unsupported');
  }
  const urls = text.match(/\b(?:https?|ftp|file|javascript|data):[^\s<>"']+/giu)?.length ?? 0;
  text = text.replace(/\b(?:https?|ftp|file|javascript|data):[^\s<>"']+/giu, '');
  if (html) {
    text = text.replace(/<br\s*\/?>|<\/(?:p|div)\s*>/giu, '\n').replace(/<[^>]*>/gu, ' ');
    text = text.replaceAll('\u00a0', ' ');
  }
  if (markdown) text = text.replace(/\*\*(.*?)\*\*|__(.*?)__/gu, (_all, a, b) => a || b);
  text = text.replace(/\r\n?/gu, '\n');
  if (removeControls) text = [...text].filter((char) => char === '\n' || char === '\t' || char.codePointAt(0) >= 32).join('');
  const lines = text.split('\n').map((line) => line.replace(/[ \t]+/gu, ' ').trim()).filter(Boolean);
  return { text: lines.join('\n').slice(0, 2_000), urls };
}

export function strictUtf8(data, message) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    reject(message);
  }
}
