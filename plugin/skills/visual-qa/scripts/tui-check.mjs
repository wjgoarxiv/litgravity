import { VisualQaError } from "./errors.mjs";
import { inspectTerminalControls, stringWidth, wideColumns } from "./terminal-text.mjs";

const BOX = /[\u2500-\u257f]/u;
export const TUI_MAX_BYTES = 1024 * 1024;
export const TUI_MAX_LINES = 4096;

export function checkTui(text, expectedColumns) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > TUI_MAX_BYTES) {
    throw new VisualQaError("TUI_INPUT_TOO_LARGE", "TUI capture exceeds the 1 MiB byte limit");
  }
  const lines = text.split(/\r?\n/u);
  if (lines.at(-1) === "") lines.pop();
  if (lines.length > TUI_MAX_LINES) {
    throw new VisualQaError("TUI_INPUT_TOO_LARGE", "TUI capture exceeds the 4,096 line limit");
  }
  const lineWidths = [];
  const overflowLines = [];
  const frameWidths = new Set();
  const wide = new Set();
  let controlSequencesValid = true;
  const plainLines = [];
  for (let index = 0; index < lines.length; index += 1) {
    const inspected = inspectTerminalControls(lines[index] ?? "");
    const plain = inspected.plain;
    controlSequencesValid &&= inspected.valid;
    plainLines.push(plain);
    const width = stringWidth(plain);
    lineWidths.push(width);
    if (width > expectedColumns) overflowLines.push({ line: index + 1, width });
    if (BOX.test(plain)) frameWidths.add(width);
    for (const column of wideColumns(plain)) {
      if (wide.size < 64) wide.add(column);
    }
  }
  const maxWidth = lineWidths.reduce((maximum, width) => Math.max(maximum, width), 0);
  const borderMisaligned = frameWidths.size > 1;
  const hasAnsi = lines.some((line) => inspectTerminalControls(line).hasControls);
  const framed = plainLines.length >= 2
    && plainLines[0]?.startsWith("┌") && plainLines[0]?.endsWith("┐")
    && plainLines.at(-1)?.startsWith("└") && plainLines.at(-1)?.endsWith("┘");
  const horizontalContinuity = framed
    && /^┌─+┐$/u.test(plainLines[0])
    && /^└─+┘$/u.test(plainLines.at(-1));
  const verticalContinuity = framed && plainLines.slice(1, -1).every(
    (line) => line.startsWith("│") && line.endsWith("│"),
  );
  const topologyValid = framed && horizontalContinuity && verticalContinuity && !borderMisaligned;
  const unicodeWidthValid = lineWidths.every((width) => width === expectedColumns);
  const codes = [];
  if (!topologyValid) codes.push("TUI_TOPOLOGY_INVALID");
  if (!controlSequencesValid) codes.push("TUI_CONTROL_SEQUENCE_INVALID");
  if (!unicodeWidthValid) codes.push("TUI_UNICODE_WIDTH_INVALID");
  const verdict = codes.length === 0 ? "PASS" : "FAIL";
  return {
    command: "tui-check",
    expectedColumns,
    lineCount: lines.length,
    lineWidths,
    maxWidth,
    overflowLines,
    borderMisaligned,
    wideCharColumns: [...wide].sort((left, right) => left - right),
    hasAnsi,
    verdict,
    codes,
    topologyValid,
    horizontalContinuity,
    verticalContinuity,
    controlSequencesValid,
    unicodeWidthValid,
    summary: `${lines.length} line(s); max width ${maxWidth}/${expectedColumns}; ${overflowLines.length} overflow(s).`,
  };
}
