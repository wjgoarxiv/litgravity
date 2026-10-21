import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { collect, PLUGIN } from './helpers.mjs';
import { list, routeRows, SHARED_ENGINES } from '../lib/list.mjs';
import { runtimeModules } from '../lib/runtime.mjs';
import { agentNames } from '../lib/bundle.mjs';

test('list: every shipped skill appears once with its words, purpose and engine, and the agents follow', () => {
  const out = collect();
  assert.equal(list({ flags: {}, print: out.print }), 0);
  const shipped = readdirSync(join(PLUGIN, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const rows = routeRows();
  assert.deepEqual(rows.map((r) => r.id).sort(), shipped);
  for (const id of shipped) assert.match(out.text(), new RegExp(`^${id}( \\[engine: \\w+\\])?$`, 'm'), id);
  assert.match(out.text(), new RegExp(`Agents: ${agentNames().join(', ')}`));
  assert.match(out.text(), /^lit-typographic-motion \[engine: motion\]$/m);
  assert.match(out.text(), /lit film/);
});

test('list --json carries the same rows for tools, and every engine named belongs to a shipped runtime', () => {
  const out = collect();
  list({ flags: { json: true }, print: out.print });
  const doc = JSON.parse(out.text());
  assert.equal(doc.skills.length, 39);
  assert.equal(doc.agents.length, 11);
  const runtimes = new Set(runtimeModules().map((m) => m.name));
  for (const r of doc.skills) if (r.engine) assert.ok(runtimes.has(r.engine), `${r.id} → ${r.engine}`);
  for (const engine of Object.values(SHARED_ENGINES)) assert.ok(runtimes.has(engine), engine);
});
