import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, dirname, sep, basename } from 'node:path';
import { run, deny, activeRoute, toolName, toolArgs, workspacesOf, stateRoot, PLUGIN_ROOT } from './lib/common.mjs';
import {
  SHELL_TOOLS, BLOCKED_IN_PLAN, READ_ONLY_AGENTS, isWriteCall, targetPaths, writeEdits, childAgent, shellReadOnly,
} from './lib/policy.mjs';
import {
  PROSE_FILE, addedNegationCluster, addedHedgeCluster, NEGATION_MESSAGE, HEDGE_MESSAGE, DICTATED_NOTE,
} from './lib/prose.mjs';

// agy requires a decision from every PreToolUse answer: an empty object is read as a denial with no reason (observed on
// 1.4.3, where it blocked every tool of a planning turn). So the hook either denies with a reason or passes the call
// through explicitly.
const PASS = { decision: 'allow' };

// Resolves the real location a write would land on, following any symlink in the existing part of the path.
function realTarget(base, p) {
  let abs = resolve(base, p);
  const rest = [];
  while (!existsSync(abs) && dirname(abs) !== abs) {
    rest.unshift(basename(abs));
    abs = dirname(abs);
  }
  let real;
  try { real = realpathSync(abs); } catch { real = abs; }
  return resolve(real, ...rest);
}

function within(target, root) {
  return target === root || target.startsWith(root + sep);
}

function insideWorkspace(workspaces, p, dirs) {
  const target = realTarget(workspaces[0], p);
  return workspaces.some((ws) => {
    let root;
    try { root = realpathSync(ws); } catch { root = resolve(ws); }
    return dirs.some((d) => within(target, resolve(root, d)));
  });
}

function underState(workspaces, p) {
  return within(realTarget(workspaces[0], p), realTarget(workspaces[0], stateRoot()));
}

const PLAN_HINT = 'Write the plan under plans/; implementation waits for `lit start`.';

function planningDenial(tool, args, workspaces) {
  if (isWriteCall(tool, args)) {
    const targets = targetPaths(args);
    if (!targets.length) return `LitGravity lit-plan could not see where ${tool} writes, so it is held. ${PLAN_HINT}`;
    const outside = targets.find((t) => !insideWorkspace(workspaces, t, ['plans', '.litgravity']));
    return outside ? `LitGravity lit-plan is a planning turn: write the plan under plans/ (or notes under .litgravity/) and leave ${outside} for start-work.` : null;
  }
  if (SHELL_TOOLS.has(tool)) {
    if (tool === 'send_command_input' || !shellReadOnly(args.CommandLine, { pluginRoot: PLUGIN_ROOT })) {
      return `LitGravity lit-plan is a planning turn: shell is limited to one plain read-only command (ls, cat, head, tail, wc, pwd, rg, git log/status/diff/show, or lit-plan's own check-plan.mjs) with listed flags and no ; & | < > \` $ or line breaks. Refused: ${tool}. ${PLAN_HINT}`;
    }
    return null;
  }
  if (tool === 'invoke_subagent') {
    const roster = Array.isArray(args.Subagents) ? args.Subagents.map((s) => childAgent(s ?? {})) : [childAgent(args)];
    const bad = roster.find((a) => !READ_ONLY_AGENTS.has(a));
    return bad === undefined ? null : `LitGravity lit-plan is a planning turn: a child agent must be a read-only LitGravity agent (${[...READ_ONLY_AGENTS].join(', ')}). Refused: ${bad || 'general-purpose'}.`;
  }
  if (BLOCKED_IN_PLAN.has(tool)) return `LitGravity lit-plan is a planning turn: ${tool} starts work outside the plan and waits for start-work. ${PLAN_HINT}`;
  return null;
}

run((payload) => {
  const tool = toolName(payload);
  if (!tool) return PASS;
  const args = toolArgs(payload);
  const workspaces = workspacesOf(payload);
  const writes = isWriteCall(tool, args);

  // Hook-owned state is never a model write target, on any route.
  if (writes) {
    const hit = targetPaths(args).find((t) => underState(workspaces, t));
    if (hit) return deny(`LitGravity keeps route state for its hooks; ${hit} is not writable by tools.`);
  }

  const state = activeRoute(payload);
  if (!state) return PASS;

  if (state.route === 'lit-plan') {
    const reason = planningDenial(tool, args, workspaces);
    if (reason) return deny(reason);
  }

  if (state.route === 'lit-humanizer' || !writes) return PASS;
  const file = targetPaths(args)[0];
  if (!file || !PROSE_FILE.test(file) || insideWorkspace(workspaces, file, ['.litgravity'])) return PASS;
  let current = '';
  try {
    const abs = resolve(workspaces[0], file);
    current = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
  } catch { current = ''; }
  const wholeFile = !Array.isArray(args.ReplacementChunks) && !writeEdits(args).some((e) => e.existing);
  for (const edit of writeEdits(args)) {
    const existing = wholeFile ? current : edit.existing;
    const negation = addedNegationCluster(edit.added, existing);
    if (negation) {
      return deny(`LitGravity write guard: this write adds a paragraph with stacked negations ("${negation.snippet}..."). ${NEGATION_MESSAGE} ${DICTATED_NOTE}`);
    }
    const hedge = insideWorkspace(workspaces, file, ['plans', 'evidence']) ? null : addedHedgeCluster(edit.added, existing);
    if (hedge) {
      return deny(`LitGravity write guard: this write adds stacked hedges to a deliverable ("${hedge.snippet}..."). ${HEDGE_MESSAGE} ${DICTATED_NOTE}`);
    }
  }
  return PASS;
}, PASS);
