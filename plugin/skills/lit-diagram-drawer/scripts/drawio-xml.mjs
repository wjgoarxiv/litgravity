import { inflateRawSync } from 'node:zlib';
import { decodeEntities, reject, strictUtf8 } from './import-common.mjs';

const MAX_XML_CHARS = 24 * 1024 * 1024;
const MAX_XML_NODES = 50_000;
const MAX_XML_DEPTH = 64;
const MAX_INFLATED_BYTES = 32 * 1024 * 1024;
const NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*/u;

function appendText(node, value) {
  if (value) node.text.push(value);
}

function decodeXmlText(value) {
  if (/&(?!(?:#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);)/iu.test(value)) {
    reject('XML contains an unsupported entity reference');
  }
  return decodeEntities(value);
}

function tagEnd(source, start) {
  let quote = '';
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '>') return index;
  }
  reject('XML contains an unterminated tag');
}

function parseOpeningTag(raw) {
  const match = NAME.exec(raw);
  if (!match) reject('XML contains an invalid element name');
  const name = match[0];
  const attributes = Object.create(null);
  let rest = raw.slice(name.length).trim();
  const selfClosing = rest.endsWith('/');
  if (selfClosing) rest = rest.slice(0, -1).trim();
  while (rest) {
    const attribute = /^([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(["'])([\s\S]*?)\2/u.exec(rest);
    if (!attribute) reject('XML contains a malformed attribute');
    const [, key, , value] = attribute;
    if (Object.hasOwn(attributes, key)) reject(`XML contains duplicate attribute ${key}`);
    attributes[key] = decodeXmlText(value);
    rest = rest.slice(attribute[0].length).trim();
  }
  return { name, attributes, selfClosing };
}

export function parseXml(source) {
  if (source.length > MAX_XML_CHARS) reject('XML exceeds the 24 MiB decoded limit');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/iu.test(source)) reject('DOCTYPE and entity declarations are unsupported');
  const document = { name: '#document', attributes: Object.create(null), children: [], text: [] };
  const stack = [document];
  let count = 0;
  let cursor = 0;
  while (cursor < source.length) {
    if (source[cursor] !== '<') {
      const end = source.indexOf('<', cursor);
      const next = end < 0 ? source.length : end;
      const text = source.slice(cursor, next);
      if (stack.length === 1 && text.trim()) reject('XML has text outside the root element');
      appendText(stack.at(-1), decodeXmlText(text));
      cursor = next;
      continue;
    }
    if (source.startsWith('<!--', cursor)) {
      const end = source.indexOf('-->', cursor + 4);
      if (end < 0) reject('XML contains an unterminated comment');
      cursor = end + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', cursor)) {
      const end = source.indexOf(']]>', cursor + 9);
      if (end < 0) reject('XML contains an unterminated CDATA section');
      appendText(stack.at(-1), source.slice(cursor + 9, end));
      cursor = end + 3;
      continue;
    }
    if (source.startsWith('<?', cursor)) {
      const end = source.indexOf('?>', cursor + 2);
      if (end < 0) reject('XML contains an unterminated processing instruction');
      cursor = end + 2;
      continue;
    }
    if (source.startsWith('<!', cursor)) reject('unsupported XML declaration');
    const end = tagEnd(source, cursor + 1);
    const raw = source.slice(cursor + 1, end).trim();
    if (raw.startsWith('/')) {
      const closing = raw.slice(1).trim();
      if (stack.length === 1 || stack.at(-1).name !== closing) reject('XML has mismatched closing tags');
      stack.pop();
    } else {
      const parsed = parseOpeningTag(raw);
      const parent = stack.at(-1);
      const node = { name: parsed.name, attributes: parsed.attributes, children: [], text: [], parent };
      parent.children.push(node);
      count += 1;
      if (count > MAX_XML_NODES) reject('XML element limit exceeded (max 50,000)');
      if (!parsed.selfClosing) {
        stack.push(node);
        if (stack.length - 1 > MAX_XML_DEPTH) reject('XML nesting exceeds the depth limit (64)');
      }
    }
    cursor = end + 1;
  }
  if (stack.length !== 1 || document.children.length !== 1) reject('XML is incomplete or has multiple root elements');
  return document.children[0];
}

export function descendants(node, name) {
  const found = [];
  const pending = [...node.children].reverse();
  while (pending.length) {
    const current = pending.pop();
    if (current.name === name) found.push(current);
    for (let index = current.children.length - 1; index >= 0; index -= 1) pending.push(current.children[index]);
  }
  return found;
}

export function xmlText(node) {
  return node.text.join('');
}

export function inflateDiagram(text) {
  const compact = text.replace(/\s+/gu, '');
  if (!compact || compact.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(compact)) reject('compressed diagram payload is not valid base64');
  const compressed = Buffer.from(compact, 'base64');
  let inflated;
  try {
    inflated = inflateRawSync(compressed, { maxOutputLength: MAX_INFLATED_BYTES });
  } catch {
    reject('compressed diagram payload is invalid or exceeds the 32 MiB limit');
  }
  const textPayload = strictUtf8(inflated, 'compressed diagram is not valid UTF-8');
  if (textPayload.startsWith('<')) return textPayload;
  try {
    const decoded = decodeURIComponent(textPayload);
    if (!decoded.startsWith('<')) reject('compressed diagram does not contain XML');
    return decoded;
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not contain XML')) throw error;
    reject('compressed diagram URI encoding is malformed');
  }
}
