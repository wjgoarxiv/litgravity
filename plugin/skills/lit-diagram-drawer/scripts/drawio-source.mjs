import { inflateSync } from 'node:zlib';
import { readBoundedFile, reject, strictUtf8 } from './import-common.mjs';
import { descendants, parseXml } from './drawio-xml.mjs';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_INPUT = 16 * 1024 * 1024;
const MAX_METADATA = 32 * 1024 * 1024;
const CRC_TABLE = (() => {
  const values = new Uint32Array(256);
  for (let index = 0; index < values.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    values[index] = value >>> 0;
  }
  return values;
})();

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function inflateMetadata(data) {
  try {
    return strictUtf8(inflateSync(data, { maxOutputLength: MAX_METADATA }), 'PNG metadata is not valid UTF-8');
  } catch (error) {
    if (error instanceof Error && /PNG metadata/u.test(error.message)) throw error;
    reject('PNG compressed metadata is invalid or exceeds the decoded limit');
  }
}

function pngText(type, data) {
  if (type === 'tEXt') {
    const separator = data.indexOf(0);
    if (separator < 0) reject('PNG text chunk has no keyword terminator');
    return { keyword: data.toString('latin1', 0, separator), text: strictUtf8(data.subarray(separator + 1), 'PNG mxfile metadata is not valid UTF-8') };
  }
  if (type === 'zTXt') {
    const separator = data.indexOf(0);
    if (separator < 0 || data[separator + 1] !== 0) reject('PNG compressed text chunk is malformed');
    return { keyword: data.toString('latin1', 0, separator), text: inflateMetadata(data.subarray(separator + 2)) };
  }
  if (type !== 'iTXt') return null;
  const keywordEnd = data.indexOf(0);
  if (keywordEnd < 0 || data.length < keywordEnd + 5) reject('PNG international text chunk is malformed');
  const compressed = data[keywordEnd + 1];
  const method = data[keywordEnd + 2];
  let cursor = data.indexOf(0, keywordEnd + 3);
  if (cursor < 0) reject('PNG international text language is malformed');
  cursor = data.indexOf(0, cursor + 1);
  if (cursor < 0) reject('PNG international text translation is malformed');
  let text = data.subarray(cursor + 1);
  if (compressed === 1) {
    if (method !== 0) reject('PNG international text compression method is unsupported');
    text = Buffer.from(inflateMetadata(text), 'utf8');
  } else if (compressed !== 0) reject('PNG international text compression flag is invalid');
  return { keyword: data.toString('latin1', 0, keywordEnd), text: strictUtf8(text, 'PNG mxfile metadata is not valid UTF-8') };
}

function pngMxfile(bytes) {
  if (bytes.length < 20 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) reject('input is not a PNG file');
  let offset = 8;
  let sawHeader = false;
  let sawEnd = false;
  const candidates = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) reject('PNG has a truncated chunk header');
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (length > MAX_INPUT || end > bytes.length) reject('PNG chunk length is invalid or exceeds the limit');
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString('ascii');
    if (!/^[A-Za-z]{4}$/u.test(type)) reject('PNG chunk type is invalid');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const expected = bytes.readUInt32BE(offset + 8 + length);
    if (crc32(Buffer.concat([typeBytes, data])) !== expected) reject(`PNG ${type} chunk CRC check failed`);
    if (type === 'IHDR') {
      if (sawHeader || offset !== 8 || length !== 13) reject('PNG header chunk is malformed');
      sawHeader = true;
    }
    const metadata = pngText(type, data);
    if (metadata?.keyword === 'mxfile') candidates.push(metadata.text);
    offset = end;
    if (type === 'IEND') {
      if (length !== 0 || offset !== bytes.length) reject('PNG end chunk is malformed or has trailing data');
      sawEnd = true;
      break;
    }
  }
  if (!sawHeader || !sawEnd) reject('PNG is incomplete');
  if (!candidates.length) reject('PNG contains no embedded mxfile text metadata');
  return candidates;
}

function embeddedMxfile(root) {
  if (root.name === 'mxfile' || root.name === 'mxGraphModel') return root;
  return descendants(root, 'mxfile')[0];
}

function candidateRoot(candidate) {
  let value = candidate.trim();
  const dataUri = /^data:[^,]*;base64,/iu.exec(value);
  if (dataUri) value = value.slice(dataUri[0].length);
  else if (value.startsWith('data:') && value.includes(',')) {
    const comma = value.indexOf(',');
    try {
      value = decodeURIComponent(value.slice(comma + 1));
    } catch {
      reject('embedded mxfile data URI is malformed');
    }
  }
  if (value.startsWith('<')) return embeddedMxfile(parseXml(value));
  if (/^[A-Za-z0-9+/\s]+={0,2}$/u.test(value) && value.replace(/\s/gu, '').length % 4 !== 1) {
    const decoded = strictUtf8(Buffer.from(value.replace(/\s/gu, ''), 'base64'), 'embedded mxfile payload is not valid UTF-8');
    return embeddedMxfile(parseXml(decoded));
  }
  return undefined;
}

export function readDrawioRoot(file) {
  const name = file.toLowerCase();
  const bytes = readBoundedFile(file, MAX_INPUT, 'draw.io input');
  const extension = name.slice(name.lastIndexOf('.'));
  if (extension === '.png') {
    const roots = pngMxfile(bytes).map(candidateRoot).filter(Boolean);
    if (!roots.length) reject('PNG mxfile metadata does not contain a readable mxfile document');
    return { root: roots[0], bytes };
  }
  const source = strictUtf8(bytes, 'draw.io input is not valid UTF-8');
  const parsed = parseXml(source);
  if (extension === '.svg' || parsed.name === 'svg') {
    const embedded = embeddedMxfile(parsed);
    if (embedded) return { root: embedded, bytes };
    for (const metadata of descendants(parsed, 'metadata')) {
      const root = candidateRoot(metadata.text.join(''));
      if (root) return { root, bytes };
      for (const value of Object.values(metadata.attributes)) {
        const attributeRoot = candidateRoot(value);
        if (attributeRoot) return { root: attributeRoot, bytes };
      }
    }
    reject('SVG has no readable embedded mxfile metadata');
  }
  if (parsed.name !== 'mxfile' && parsed.name !== 'mxGraphModel') reject('XML root is not mxfile or mxGraphModel');
  return { root: parsed, bytes };
}
