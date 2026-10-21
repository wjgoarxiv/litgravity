#!/usr/bin/env node
// Optional LitGravity status line. agy pipes one JSON object to stdin on every refresh and shows what this prints.
// agy turns a status line off after a run of failures, so this always prints one line and exits 0: unreadable input
// renders as an empty payload, and an error anywhere prints the brand alone.
import { readFileSync } from 'node:fs';
import { fallbackLine, renderStatus } from './render.mjs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  input = {};
}
let line;
try {
  line = renderStatus(input);
} catch {
  line = fallbackLine();
}
process.stdout.write(`${line}\n`);
