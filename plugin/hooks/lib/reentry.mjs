import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PLUGIN_ROOT, sessionPath, safeId } from './common.mjs';
import { MOVED_SKILLS, extensionLines, extensionCommand } from './routes.mjs';
import { answerGuide } from './goal-guide.mjs';

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

// A moved skill's route reads its pointer stub; the note says so up front, with the install line, so the turn gives
// that line (or hands over to the installed copy) and builds nothing from memory.
const movedNote = (id) => `\`${id}\` is a LitFamily extension now, kept in wjgoarxiv-skills (variants/litgravity/${id}/); the file above is its pointer stub. If the stub finds no installed copy, make nothing and give the user the one command that installs it from a terminal (it prints its plan without --yes), \`${extensionCommand(id)}\`, or these four lines pasted in order:\n${extensionLines(id).join('\n')}`;

// The goal question of a run with no plan (lit-loop, litwork, lit-hijack). agy gives a prompt-time hook no way to show
// the user text, so the question reaches them through the model: advisory, never typed or sent as /goal by the model.
// With a test command the hook already recorded the question and hands the model its exact line; without one the model
// runs goal-propose --loop once a failing check exists.
const goalScript = () => join(PLUGIN_ROOT, 'skills', 'lit-plan', 'scripts', 'goal-propose.mjs');
export const loopGoalNote = (offer) => (offer
  ? `LitGravity goal question (advisory: a prompt hook cannot draw text for the user in agy, so you show it): end your first reply with this exact line, then the answer guide right under it, once, and say nothing else about the goal. Render the guide in the user's language; the answer words stay \`yes\` and \`no\`:\n${offer.line}\n${answerGuide('loop', offer.condition)}\nOnly the user's exact \`yes\` on a later prompt arms it, and then LitGravity starts no start-work run. Never type or send /goal yourself, and do not ask the question again.`
  : `Native goal: LitGravity can arm a goal for this run. Once one failing check proves the objective (after the RED test), run \`node ${goalScript()} --loop --check "<check>" <objective>\` and end that reply with what it prints: the line unchanged, then its answer guide in the user's language (the answer words stay \`yes\` and \`no\`); only the user's exact \`yes\` on a later prompt arms it. If it prints \`Goal skipped: <reason>.\`, or no single check proves the objective, go on without a goal and keep the ledger authoritative. Never type or send /goal yourself.`);

export function activation(hit, conversationId, kind = 'ignite', { loopGoal } = {}) {
  const id = safeId(conversationId);
  const lines = [
    `LitGravity activation: the prompt ${hit.trailing ? 'ends' : 'starts'} with the lit keyword, so this turn runs the \`${hit.route}\` route${kind === 'switch' ? ' (switched from the route that was active)' : ''}.`,
    `Before any other tool, read the skill with your file-reading tool (read_file; older builds call it view_file) and follow it: ${skillPath(hit.route)}`,
    `Begin your reply with the line \`🔥 LIT IGNITED · ${hit.route}\` exactly once, then work. ${hit.trailing ? 'The task is the prompt before the keyword.' : `The task is the rest of the prompt after the keyword${hit.keyword ? ` "${hit.keyword}"` : ''}.`}`,
    id
      ? `Conversation ${id}: hooks record tool events in .litgravity/ledger/${id}.jsonl while the route is active; add your own note, evidence and decision lines there. Route state is kept by the hooks outside the workspace.`
      : 'Hooks record tool events in .litgravity/ledger/ while the route is active.',
  ];
  lines.push(HEADLESS_NOTE);
  if (hit.route === 'lit-plan') lines.push(PLAN_REMINDER);
  if (loopGoal !== undefined) lines.push(loopGoalNote(loopGoal));
  if (MOVED_SKILLS[hit.route]) lines.push(movedNote(hit.route));
  // `go` reads the step the brief offered for this conversation, so the collector needs its id.
  if (hit.route === 'lit-adhd' && id) {
    const mode = hit.recap ? ` --recap${hit.recapOf ? ` --of ${hit.recapOf}` : ''}${hit.recapMoved ? ' --moved' : ''}` : hit.detail ? ' --detail' : '';
    lines.push(`Run the collector for this conversation: node ${dirname(skillPath('lit-adhd'))}/scripts/rewind.mjs --brief --lang ${hit.lang === 'en' ? 'en' : 'ko'} --session ${id}${mode}`);
  }
  if (hit.route === 'lit-adhd' && hit.recapMoved) lines.push('lit-recap moved into lit-adhd: this is its recap view (`lit adhd recap [conversation]`). The collector prints that note as the first line of the recap view; put its output right after the ignition line, unchanged, with nothing before the note.');
  if (hit.reviewMode) lines.push(`The user forced the ${hit.reviewMode} review mode.`);
  if (kind === 'confirm') {
    lines.push('The prompt has no task text after the keyword and nothing is active or resumable. After reading the skill, ask the user in one line what to run (a task for lit-loop, or a route such as plan or review) and wait for the answer before any other tool.');
  }
  return lines.join('\n');
}
