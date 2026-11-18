#!/usr/bin/env node
// Turns a written plan's `## Done when` block into the one goal question lit-plan asks at approval.
//   node goal-propose.mjs plans/<slug>.md [--json]
// Prints `Approve plan, start work and set goal: /goal <cond>? (yes / edit / no)` and writes .litgravity/goal/consent.json.
// A check that cannot be a goal prints `No goal for this plan: <reason>.` plus `Approve plan and start work? (yes / no)`
// and writes a goal-less consent record; an unreadable plan prints `Goal skipped: <reason>.` and writes nothing. Exit 0 either way; 64 on a usage error. It runs the plan's check
// command once (the falsifier dry run: the goal must be false today) from the current folder, which is the workspace.
import { proposeGoal } from '../../../hooks/lib/goal.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const rest = args.filter((a) => a !== '--json');
if (rest.length !== 1 || rest[0].startsWith('-')) {
  process.stderr.write('usage: node goal-propose.mjs plans/<slug>.md [--json]\n');
  process.exit(64);
}
const result = proposeGoal({ workspace: process.cwd(), plan: rest[0] });
process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${result.line}\n`);
