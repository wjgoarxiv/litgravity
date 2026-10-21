import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PLUGIN_ROOT, sessionPath, safeId } from './common.mjs';

// The route a `lit` prompt finds already active in this conversation. A damaged, journal-only or odd-shaped state
// counts as nothing active, so the prompt gets the full activation and rewrites the state.
export function liveRoute(state) {
  if (!state || state.corrupt || state.fromJournal) return null;
  return typeof state.route === 'string' && state.route && Number.isFinite(state.activatedAt) ? state.route : null;
}

// Work a bare `lit` can pick up: a plan under plans/ that still has an open row and was already started with
// start-work in some conversation of this workspace (the hooks journal every route change).
export function resumablePlan(workspace) {
  const probe = sessionPath(workspace, 'probe');
  if (!probe) return null;
  const dir = dirname(probe);
  try {
    const started = readdirSync(dir).some((f) => f.endsWith('.journal') && readFileSync(join(dir, f), 'utf8').includes('"route":"start-work"'));
    if (!started) return null;
  } catch {
    return null;
  }
  const plans = join(workspace, 'plans');
  if (!existsSync(plans)) return null;
  let best = null;
  for (const name of readdirSync(plans).filter((f) => f.endsWith('.md'))) {
    const row = /^- \[ \] (\d+|F\d+)\./m.exec(readFileSync(join(plans, name), 'utf8'));
    const mtime = statSync(join(plans, name)).mtimeMs;
    if (row && (!best || mtime > best.mtime)) best = { file: `plans/${name}`, row: row[1], mtime };
  }
  return best;
}

// D1 as one pure function. `hit` comes from detectRoute, `previous` is the stored conversation state, `plan` is
// what resumablePlan found. The answer names the kind of prompt and the route the state moves to.
//   continue  the same discipline is active: a short note, state kept
//   resume    a bare `lit` picks up a started plan
//   ignite    first activation, `lit new`, or start-work: the full text
//   switch    another discipline was named: the full text for the new one
//   confirm   a bare `lit` with nothing active and nothing to resume: the full text plus one question
export function decide(hit, previous, plan) {
  if (!hit) return { kind: 'none' };
  const active = hit.restart ? null : liveRoute(previous);
  const startsWork = hit.route === 'start-work' && !hit.bare && !hit.resume;
  if (active && !startsWork && (hit.bare || hit.resume || hit.route === active)) return { kind: 'continue', route: active };
  if (!hit.restart && (hit.bare || hit.resume) && plan) return { kind: 'resume', route: 'start-work', plan };
  const idle = hit.bare || (hit.restart && hit.empty);
  if (idle) return { kind: 'confirm', route: hit.route };
  return { kind: active && active !== hit.route && !hit.restart ? 'switch' : 'ignite', route: hit.route };
}

const skillPath = (route) => join(PLUGIN_ROOT, 'skills', route, 'SKILL.md');
// Probed on 1.4.3: a headless `agy -p` run auto-denies run_command and write_file, and the denial ends the run with no
// output, so the model is told up front to read first and to report the permission it needs.
const HEADLESS_NOTE = 'Read first: use read_file (and list_dir or grep_search when your tool list offers them) before any run_command or write_file. A headless `agy -p` run cannot prompt for permission, so a refused command or file write ends it with no output; when the work needs one, name the permission and report BLOCKED instead of trying again.';
const PLAN_REMINDER = 'This is a planning turn: write only under plans/ or .litgravity/, and end after plans/<slug>.md exists.';

export function continueNote(route) {
  const lines = [
    `LitGravity: the \`${route}\` route is already active in this conversation, so this prompt continues it.`,
    `Begin your reply with the line \`🔥 LIT CONTINUES · ${route}\` once. Keep the criteria, plan and ledger you hold; reload no skill and start no new run, plan or goal.`,
  ];
  if (route === 'lit-plan') lines.push('Still a planning turn: write only under plans/ or .litgravity/.');
  return lines.join('\n');
}

export function resumeNote(plan) {
  return [
    `LitGravity: resuming \`start-work\`${plan ? ` on ${plan.file}, next open row ${plan.row}` : ''}.`,
    'Begin your reply with the line `🔥 LIT CONTINUES · start-work` once. Carry on from the first unticked row; write no new plan, run or goal. If you no longer hold the skill, read it again first:',
    `read_file ${skillPath('start-work')}`,
  ].join('\n');
}

export function activation(hit, conversationId, kind = 'ignite') {
  const id = safeId(conversationId);
  const lines = [
    `LitGravity activation: the prompt starts with the lit keyword, so this turn runs the \`${hit.route}\` route${kind === 'switch' ? ' (switched from the route that was active)' : ''}.`,
    `Before any other tool, read the skill with your file-reading tool (read_file; older builds call it view_file) and follow it: ${skillPath(hit.route)}`,
    `Begin your reply with the line \`🔥 LIT IGNITED · ${hit.route}\` exactly once, then work. The task is the rest of the prompt after the keyword${hit.keyword ? ` "${hit.keyword}"` : ''}.`,
    id
      ? `Conversation ${id}: hooks record tool events in .litgravity/ledger/${id}.jsonl while the route is active; add your own note, evidence and decision lines there. Route state is kept by the hooks outside the workspace.`
      : 'Hooks record tool events in .litgravity/ledger/ while the route is active.',
  ];
  lines.push(HEADLESS_NOTE);
  if (hit.route === 'lit-plan') lines.push(PLAN_REMINDER);
  if (hit.reviewMode) lines.push(`The user forced the ${hit.reviewMode} review mode.`);
  if (kind === 'confirm') {
    lines.push('The prompt has no task text after the keyword and nothing is active or resumable. After reading the skill, ask the user in one line what to run (a task for lit-loop, or a route such as plan or review) and wait for the answer before any other tool.');
  }
  return lines.join('\n');
}
