import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN } from './helpers.mjs';
import { activation, THEME_FIRST } from '../plugin/hooks/lib/reentry.mjs';

const DESIGN = ['lit-pptx', 'lit-docx', 'frontend-ui-ux', 'lit-schematic', 'lit-diagram-drawer', 'readme-studio', 'lit-typographic-motion'];

// The first build step after the procedure heading: a numbered step or a command block.
const buildStart = (text) => {
  const head = text.search(/^## (Procedure|#contract\.procedure)/m);
  assert.ok(head >= 0, 'procedure heading');
  const rest = text.slice(head);
  const marks = [rest.search(/^1\. /m), rest.indexOf('```')].filter((i) => i >= 0);
  return head + Math.min(...marks);
};

for (const id of DESIGN) {
  test(`${id}: Theme first asks with ask_question before the build step`, () => {
    const text = readFileSync(join(PLUGIN, 'skills', id, 'SKILL.md'), 'utf8');
    const at = text.indexOf('**Theme first.**');
    assert.ok(at >= 0, 'Theme first step exists');
    assert.ok(at < buildStart(text), 'Theme first sits before the build step');
    assert.match(text.slice(at, at + 900), /ask_question/);
    assert.match(text, /알아서/, 'skip rule');
    assert.match(text, /headless/i, 'headless default');
  });
}

test('router adds the theme note to the seven design routes only', () => {
  assert.deepEqual([...THEME_FIRST].sort(), [...DESIGN].sort());
  for (const route of DESIGN) assert.match(activation({ route }, 'conv-1'), /Theme first: .*ask_question/);
  assert.doesNotMatch(activation({ route: 'lit-loop' }, 'conv-1'), /Theme first/);
});
