#!/usr/bin/env node
// Golden cases for ko-metrics.mjs (fixtures/ko-metrics-golden.json) plus the pinned warning thresholds.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeKoText, thresholds } from './ko-metrics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, '..', 'fixtures', 'ko-metrics-golden.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const item of fixture.cases) {
  const result = analyzeKoText(item.text);
  if (item.warning) assert.ok(result.warnings.includes(item.warning), item.id + ': expected ' + item.warning);
  if (item.absent) assert.ok(!result.warnings.includes(item.absent), item.id + ': unexpected ' + item.absent);
  for (const [key, minimum] of Object.entries(item.minimum || {})) {
    if (Array.isArray(minimum)) assert.deepEqual(result.metrics[key], minimum, item.id + ': ' + key);
    else assert.ok(result.metrics[key] >= minimum, item.id + ': ' + key + ' below ' + minimum);
  }
  process.stdout.write('PASS ' + item.id + ' warnings=' + (result.warnings.join(',') || 'none') + '\n');
}

assert.equal(thresholds.conclusionPivotMin, 4);
assert.equal(thresholds.cleftMin, 2);
assert.equal(thresholds.connectiveOpenersPerParagraph, 3);
assert.equal(thresholds.connectiveEndingCommaMin, 3);
process.stdout.write('PASS thresholds; ' + fixture.cases.length + ' golden cases\n');
