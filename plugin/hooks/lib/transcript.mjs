import { openSync, readSync, closeSync, fstatSync } from 'node:fs';

const TAIL_BYTES = 512 * 1024;

// The hook payload carries no prompt text. agy writes the conversation to `transcriptPath` (JSONL, one step per line)
// and the newest USER_INPUT step holds the prompt inside a <USER_REQUEST> block.
function tailText(file) {
  const fd = openSync(file, 'r');
  try {
    const { size } = fstatSync(fd);
    const start = Math.max(0, size - TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    const text = buf.toString('utf8');
    // A read that starts mid-file begins with a partial line; drop it.
    return start > 0 ? text.slice(text.indexOf('\n') + 1) : text;
  } finally {
    closeSync(fd);
  }
}

export function extractRequest(content) {
  if (typeof content !== 'string') return null;
  const m = /<USER_REQUEST>\r?\n?([\s\S]*?)\r?\n?<\/USER_REQUEST>/.exec(content);
  return (m ? m[1] : content).trim();
}

// {text, stepIndex} of the newest user prompt, or null when the transcript is absent or has none.
export function lastUserRequest(transcriptPath) {
  if (typeof transcriptPath !== 'string' || !transcriptPath) return null;
  let text;
  try {
    text = tailText(transcriptPath);
  } catch {
    return null;
  }
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!lines[i].includes('"USER_INPUT"')) continue;
    let rec;
    try { rec = JSON.parse(lines[i]); } catch { continue; }
    if (rec && rec.type === 'USER_INPUT') {
      const request = extractRequest(rec.content);
      if (request !== null) return { text: request, stepIndex: Number.isInteger(rec.step_index) ? rec.step_index : null };
    }
  }
  return null;
}
