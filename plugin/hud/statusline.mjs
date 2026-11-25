#!/usr/bin/env node
// Optional LitGravity status line. agy pipes one JSON object to stdin on every refresh and shows what this prints.
// agy turns a status line off after a run of failures, so this always prints a line and exits 0: unreadable input
// renders as an empty payload, and an error anywhere prints the brand alone.
import { openSync, readFileSync } from 'node:fs';
import { WriteStream } from 'node:tty';
import { fallbackLine, renderStatus } from './render.mjs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  input = {};
}
// agy's payload carries the width but not the height; the controlling terminal knows both.
let size = { columns: process.stdout.columns };
try {
  const tty = new WriteStream(openSync('/dev/tty', 'w'));
  size = { columns: size.columns ?? tty.columns, rows: tty.rows };
  tty.destroy();
} catch {
  // no controlling terminal (Windows, a pipe): the width comes from the payload
}
let line;
try {
  line = renderStatus(input, size);
} catch {
  line = fallbackLine();
}
process.stdout.write(`${line}\n`);
