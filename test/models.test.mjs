import test from 'node:test';
import assert from 'node:assert/strict';
import { sandbox, collect } from './helpers.mjs';
import { listModels, models } from '../lib/models.mjs';

test('models come from `agy models`, so a model the host adds tomorrow (an Argon-shaped row) shows up with no release', () => {
  const { env } = sandbox();
  const list = listModels(env);
  assert.deepEqual(list.map((m) => m.id), ['gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'argon-1-preview']);
  assert.equal(list.at(-1).label, 'Gemini 4 Argon (Preview)');
});

test('`litgravity models` prints the catalog and one flag line per model, and fails clearly without agy', async () => {
  const { env } = sandbox();
  const out = collect();
  assert.equal(await models({ env, flags: {}, print: out.print }), 0);
  assert.match(out.text(), /argon-1-preview/);
  assert.match(out.text(), /agy --model argon-1-preview/);
  const json = collect();
  assert.equal(await models({ env, flags: { json: true }, print: json.print }), 0);
  assert.equal(JSON.parse(json.text()).length, 3);
  const none = collect();
  assert.equal(await models({ env: { ...env, LITGRAVITY_AGY_BIN: '/nonexistent/agy' }, flags: {}, print: none.print }), 1);
  assert.match(none.text(), /agy was not found/);
});
