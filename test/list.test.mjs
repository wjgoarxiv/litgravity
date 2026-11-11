import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { collect, PLUGIN } from './helpers.mjs';
import { list, routeRows } from '../lib/list.mjs';
import { MOVED_SKILLS } from '../plugin/hooks/lib/routes.mjs';
import { agentNames } from '../lib/bundle.mjs';

test('list: every shipped skill appears once with its words and purpose, a moved one with its new home, and the agents follow', () => {
  const out = collect();
  assert.equal(list({ flags: {}, print: out.print }), 0);
  const shipped = readdirSync(join(PLUGIN, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const rows = routeRows();
  assert.deepEqual(rows.map((r) => r.id).sort(), shipped);
  for (const id of shipped) assert.match(out.text(), new RegExp(`^${id}( \\[moved: wjgoarxiv-skills [a-z-]+\\])?$`, 'm'), id);
  assert.match(out.text(), new RegExp(`Agents: ${agentNames().join(', ')}`));
  assert.match(out.text(), /^lit-typographic-motion \[moved: wjgoarxiv-skills video-covers\]$/m);
  assert.match(out.text(), /lit film/);
});

test('list --json carries the same rows for tools, and every moved row names its family', () => {
  const out = collect();
  list({ flags: { json: true }, print: out.print });
  const doc = JSON.parse(out.text());
  assert.equal(doc.skills.length, 42);
  assert.equal(doc.agents.length, 11);
  for (const r of doc.skills) assert.equal(r.moved, MOVED_SKILLS[r.id] ?? null, r.id);
});
