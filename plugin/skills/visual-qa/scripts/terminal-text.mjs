const OSC = /\u001b\][^\u0007]*(?:\u0007|\u001b\\)/gu;
const CSI = /(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]/gu;
const ESCAPE = /\u001b[()][0-2A-Z0-9]|[\u0000-\u0008\u000b-\u001a\u001c-\u001f\u007f-\u009f]/gu;
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

export function inspectTerminalControls(input) {
  let plain = "";
  let valid = true;
  let hasControls = false;
  for (let index = 0; index < input.length;) {
    const code = input.charCodeAt(index);
    if (code === 0x1b) {
      hasControls = true;
      const next = input[index + 1];
      if (next === "[") {
        let cursor = index + 2;
        while (cursor < input.length && cursor - index <= 64
          && !/[@-~]/u.test(input[cursor])) cursor += 1;
        if (cursor >= input.length || cursor - index > 64) {
          valid = false;
          break;
        }
        index = cursor + 1;
        continue;
      }
      if (next === "]") {
        let cursor = index + 2;
        let terminated = false;
        while (cursor < input.length && cursor - index <= 4096) {
          if (input.charCodeAt(cursor) === 0x07) {
            index = cursor + 1;
            terminated = true;
            break;
          }
          if (input.charCodeAt(cursor) === 0x1b && input[cursor + 1] === "\\") {
            index = cursor + 2;
            terminated = true;
            break;
          }
          cursor += 1;
        }
        if (!terminated) {
          valid = false;
          break;
        }
        continue;
      }
      if ("()012ABCDEFGHIJKLMNOPQRSTUVWXYZ".includes(next ?? "")) {
        index += 2;
        continue;
      }
      valid = false;
      break;
    }
    if ((code < 0x20 && code !== 0x09) || (code >= 0x7f && code <= 0x9f)) {
      hasControls = true;
      valid = false;
      index += 1;
      continue;
    }
    const point = input.codePointAt(index);
    plain += String.fromCodePoint(point);
    index += point > 0xffff ? 2 : 1;
  }
  return { plain, valid, hasControls };
}

export function stripTerminalControls(input) {
  const inspected = inspectTerminalControls(input);
  if (inspected.valid) return inspected.plain;
  return input.replace(OSC, "").replace(CSI, "").replace(ESCAPE, "");
}

export function hasTerminalControls(input) {
  return stripTerminalControls(input) !== input;
}

function isWideCodePoint(codePoint) {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f)
    || (codePoint >= 0x2e80 && codePoint <= 0xa4cf)
    || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || (codePoint >= 0xfe10 && codePoint <= 0xfe6f)
    || (codePoint >= 0xff00 && codePoint <= 0xff60)
    || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
    || (codePoint >= 0x1f200 && codePoint <= 0x1faff)
    || (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

function graphemeWidth(grapheme) {
  if (/^\p{Mark}+$/u.test(grapheme)) return 0;
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(grapheme)) return 2;
  for (const character of grapheme) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && isWideCodePoint(codePoint)) return 2;
  }
  return 1;
}

export function stringWidth(input) {
  let width = 0;
  for (const { segment } of segmenter.segment(input)) width += graphemeWidth(segment);
  return width;
}

export function wideColumns(input) {
  const columns = [];
  let column = 0;
  for (const { segment } of segmenter.segment(input)) {
    const width = graphemeWidth(segment);
    if (width === 2) columns.push(column);
    column += width;
  }
  return columns;
}
