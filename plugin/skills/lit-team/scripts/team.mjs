#!/usr/bin/env node
// team.mjs: durable local team packet for the LitGravity lit-team skill.
//
// Why a script: a child agent is one-shot and stateless. After a compaction nothing records who the members were,
// what each owned, which had reported, or whether the team was ever cleaned up. Prose cannot enforce that and a
// hand-written team.json drifts silently, so this script owns the packet. The root conversation (the leader) is the
// only writer; members are children started with invoke_subagent and never touch the packet.
//
// Node builtins only. All state is local under <project>/.litgravity/team/<team-id>/. There is no network path.
//
// Usage (run with run_command; <skill-folder> is the folder of the SKILL.md that was read):
//   node <skill-folder>/scripts/team.mjs init --name <team> [--objective "<text>"] [--worktree] [--base-branch <b>]
//   node <skill-folder>/scripts/team.mjs add-member --team <id> --id A --focus "<slice>" --deliverable "<artifact>"
//        [--lens area|ownership|perspective] [--agent <TypeName>] [--paths "src/a,src/b"] [--branch <b>] [--cwd <dir>]
//   node <skill-folder>/scripts/team.mjs prompt --team <id> --id A [--return-mode reader|technical|audit]   (alias: member-prompt)
//   node <skill-folder>/scripts/team.mjs bind-agent --team <id> --id A --agent-id <child id the host returned> [--cwd <dir>]
//   node <skill-folder>/scripts/team.mjs set-status --team <id> --id A --status pending|active [--note "<text>"]
//   node <skill-folder>/scripts/team.mjs report --team <id> --id A --evidence "<path>" [--note "<text>"]
//   node <skill-folder>/scripts/team.mjs block --team <id> --id A --reason "<text>"
//   node <skill-folder>/scripts/team.mjs status --team <id> [--json]
//   node <skill-folder>/scripts/team.mjs archive --team <id> [--note "<text>"]
//   node <skill-folder>/scripts/team.mjs delete --team <id> [--force]
//
// Exit codes: 0 done, 64 usage or rule violation, 65 unsafe or corrupt state, 75 lock busy, 1 internal error.

import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { acquireOwnerLock, OwnerLockError, releaseOwnerLock } from "./owner-lock.mjs";
import { pathIdentity, samePathIdentity } from "./secure-path.mjs";
import { ensureStateDirIgnored, PROJECT_STATE_DIR, resolveProjectStateRoot } from "./state-root.mjs";

const MIN_MEMBERS = 2;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/u;
const TEAM_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,50}$/u;
const MAX_TEAM_STATE_BYTES = 1024 * 1024;
const RETURN_MODES = new Set(["reader", "technical", "audit"]);
const LENSES = new Set(["area", "ownership", "perspective"]);
const SETTABLE_STATUSES = new Set(["pending", "active"]);
const STATE_SEGMENTS = [PROJECT_STATE_DIR, "team"];

// Agent type names a member can run as. Read-only types may not own write paths; write-capable types must.
const READ_ONLY_AGENTS = new Set([
  "lit-planner",
  "librarian-researcher",
  "lit-verifier",
  "quality-reviewer",
  "korean-style-analyzer",
  "korean-prose-editor",
  "meaning-preservation-auditor",
  "native-flow-reviewer",
  "polish-orchestrator",
]);
const WRITE_AGENTS = new Set(["lit-executor"]);
// qa-runner holds the shell and writes only the evidence paths its brief names.
const SHELL_AGENTS = new Set(["qa-runner"]);
// A child started without a TypeName is general-purpose with every tool.
const GENERAL_PURPOSE = "general-purpose";
const KNOWN_AGENTS = new Set([...READ_ONLY_AGENTS, ...WRITE_AGENTS, ...SHELL_AGENTS, GENERAL_PURPOSE]);

export class TeamError extends Error {
  constructor(message, status = 64) {
    super(message);
    this.name = "TeamError";
    this.status = status;
  }
}

const requireTeamId = (teamId) => {
  if (typeof teamId !== "string" || !TEAM_ID_PATTERN.test(teamId)) {
    throw new TeamError(`invalid team id: ${teamId}`);
  }
  return teamId;
};

export const teamsRoot = (cwd = resolveProjectStateRoot()) => join(resolveProjectStateRoot(cwd), ...STATE_SEGMENTS);
export const teamDir = (cwd, teamId) => join(teamsRoot(cwd), requireTeamId(teamId));
export const teamStatePath = (cwd, teamId) => join(teamDir(cwd, teamId), "team.json");

const optionValue = (args, flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return !value || value.startsWith("--") ? "" : value;
};

const requireOption = (args, flag) => {
  const value = optionValue(args, flag);
  if (!value) throw new TeamError(`missing ${flag.slice(2)}`);
  return value;
};

const slug = (value) =>
  value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 48) || "team";

const isSameOrChildPath = (parentPath, childPath) => {
  const rel = relative(parentPath, childPath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const safeDirectory = (cwd, components, { create }) => {
  const root = resolveProjectStateRoot(cwd);
  const rootStats = lstatSync(root);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) throw new TeamError("workspace root is not a safe directory", 65);
  const realRoot = realpathSync.native(root);
  let current = root;
  for (const component of components) {
    current = join(current, component);
    let stats;
    try {
      stats = lstatSync(current);
    } catch (error) {
      if (error?.code !== "ENOENT" || !create) throw error;
      mkdirSync(current, { mode: 0o700 });
      stats = lstatSync(current);
    }
    if (stats.isSymbolicLink()) throw new TeamError(`refused symlinked team state path: ${current}`, 65);
    if (!stats.isDirectory()) throw new TeamError(`team state path is not a directory: ${current}`, 65);
    if (!isSameOrChildPath(realRoot, realpathSync.native(current))) {
      throw new TeamError(`team state path escapes the workspace: ${current}`, 65);
    }
  }
  if (create) ensureStateDirIgnored(current);
  return current;
};

const safeTeamsRoot = (cwd, { create }) => safeDirectory(cwd, STATE_SEGMENTS, { create });
const safeTeamDir = (cwd, teamId, { create }) => safeDirectory(cwd, [...STATE_SEGMENTS, requireTeamId(teamId)], { create });

const assertSafeTarget = (path) => {
  try {
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) throw new TeamError(`refused symlinked team state target: ${path}`, 65);
    if (!stats.isFile()) throw new TeamError(`team state target is not a file: ${path}`, 65);
    return true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return false;
  }
};

const writeAtomic = (directory, filename, content, { refuseExisting = false } = {}) => {
  const target = join(directory, filename);
  if (assertSafeTarget(target) && refuseExisting) throw new TeamError(`refused to overwrite existing team state: ${target}`, 65);
  const temporary = join(directory, `.${filename}.${process.pid}.${Date.now()}.tmp`);
  let fd;
  try {
    fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    writeFileSync(fd, content);
    closeSync(fd);
    fd = undefined;
    if (refuseExisting) {
      try {
        linkSync(temporary, target);
      } catch (error) {
        if (error?.code === "EEXIST") throw new TeamError(`refused to overwrite existing team state: ${target}`, 65);
        throw error;
      }
    } else {
      renameSync(temporary, target);
    }
  } finally {
    if (fd !== undefined) closeSync(fd);
    rmSync(temporary, { force: true });
  }
};

const readTeamText = (directory) => {
  const path = join(directory, "team.json");
  let fd;
  try {
    const pathStats = lstatSync(path);
    if (pathStats.isSymbolicLink() || !pathStats.isFile() || pathStats.size > MAX_TEAM_STATE_BYTES) {
      throw new TeamError(`corrupt team state: ${path}`, 65);
    }
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const openedStats = fstatSync(fd);
    if (
      !openedStats.isFile()
      || !samePathIdentity(pathIdentity(openedStats), pathIdentity(pathStats))
      || openedStats.size !== pathStats.size
    ) throw new TeamError(`team state changed during read: ${path}`, 65);
    return readFileSync(fd, "utf8");
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
};

const readTeam = (cwd, teamId) => {
  requireTeamId(teamId);
  let directory;
  try {
    directory = safeTeamDir(cwd, teamId, { create: false });
  } catch (error) {
    if (error?.code === "ENOENT") throw new TeamError(`unknown team: ${teamId}`, 65);
    throw error;
  }
  const path = join(directory, "team.json");
  try {
    const team = JSON.parse(readTeamText(directory));
    if (team?.team_id !== teamId) throw new TeamError(`team id mismatch: requested ${teamId}, found ${team?.team_id}`, 65);
    if (!Array.isArray(team.members)) throw new TeamError(`corrupt team state: ${path}`, 65);
    return team;
  } catch (error) {
    if (error instanceof TeamError) throw error;
    throw new TeamError(`corrupt team state: ${path}`, 65);
  }
};

const memberOf = (team, memberId) => {
  const member = team.members.find(({ id }) => id === memberId);
  if (!member) throw new TeamError(`unknown member: ${memberId}`, 65);
  return member;
};

const isSettled = (member) => member.status === "reported" || member.status === "blocked";
const outstandingOf = (team) => team.members.filter((member) => !isSettled(member));

// Ownership paths are workspace-relative, never absolute, never climbing out.
const normalizeOwnedPath = (value) => {
  const cleaned = normalize(value.trim()).split(sep).join("/").replace(/\/+$/u, "");
  if (!cleaned || cleaned === "." || isAbsolute(cleaned) || cleaned === ".." || cleaned.startsWith("../")) {
    throw new TeamError(`owned path must be a workspace-relative path below the project root: ${value}`);
  }
  return cleaned;
};
const pathsOverlap = (left, right) => left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
const parsePaths = (raw) =>
  raw ? [...new Set(raw.split(",").map((part) => part.trim()).filter(Boolean).map(normalizeOwnedPath))] : [];

/** The field manual rewritten on every mutation, so a member always reads current state. */
const renderGuide = (team) => {
  const rows = team.members
    .map((m) => `| ${m.id} | ${m.lens} | ${m.focus} | ${m.agent} | ${m.paths.join(", ") || "read-only"} | ${m.deliverable} | ${m.status} | ${m.evidence ?? "-"} |`)
    .join("\n");
  const worktree = team.worktree.enabled
    ? `Isolation intent: separate worktrees from \`${team.worktree.base_branch}\`. This packet records paths; it does not create, merge or delete a worktree.`
    : "Isolation: shared checkout. Stay inside your owned paths; if an edit would collide, mark yourself blocked and tell the leader.";
  return `# Team: ${team.name}

Objective: ${team.objective || "(not set)"}
Team id: ${team.team_id}
Status: ${team.status}

| Member | Lens | Owns | Agent | Write paths | Deliverable | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows || "| - | - | - | - | - | - | - | - |"}

${worktree}

Rules this packet enforces:
- At least ${MIN_MEMBERS} members before the team leaves \`forming\`.
- Every member owns a distinct slice; duplicate focus and overlapping write paths are rejected.
- A member is \`reported\` only with an evidence path that exists inside the workspace.
- The team is not done until every member is \`reported\` or explicitly \`blocked\`, and the team is archived.
  A forgotten active team is a cleanup leak.
- Only the leader writes this packet. Members send WORKING:, BLOCKED: and DONECLAIM: messages and write their own
  deliverables under \`artifacts/\` or their owned paths.
`;
};

const persist = (cwd, team, { refuseExistingState = false } = {}) => {
  const teamId = requireTeamId(team.team_id);
  const directory = safeTeamDir(cwd, teamId, { create: true });
  safeDirectory(cwd, [...STATE_SEGMENTS, teamId, "artifacts"], { create: true });
  if (assertSafeTarget(join(directory, "team.json")) && refuseExistingState) {
    throw new TeamError(`refused to overwrite existing team state: ${join(directory, "team.json")}`, 65);
  }
  assertSafeTarget(join(directory, "guide.md"));
  writeAtomic(directory, "team.json", `${JSON.stringify(team, null, 2)}\n`, { refuseExisting: refuseExistingState });
  writeAtomic(directory, "guide.md", renderGuide(team));
  return team;
};

const withTeamLock = (cwd, teamId, work) => {
  const id = requireTeamId(teamId);
  const directory = safeTeamDir(cwd, id, { create: false });
  const lockDir = join(directory, ".lock");
  let owner;
  try {
    owner = acquireOwnerLock(lockDir, { timeoutMs: 5000, staleMs: 30_000 });
  } catch (error) {
    if (error instanceof OwnerLockError) throw new TeamError(`team ${error.message}`, error.status);
    throw error;
  }
  try {
    return work(directory);
  } finally {
    if (!releaseOwnerLock(lockDir, owner)) throw new TeamError("team state lock release failed", 75);
  }
};

const mutateTeam = (cwd, teamId, mutate) =>
  withTeamLock(cwd, teamId, () => {
    const team = readTeam(cwd, teamId);
    if (team.status === "archived") throw new TeamError(`team ${teamId} is archived; start a new team`, 65);
    mutate(team);
    return persist(cwd, team);
  });

const nowIso = () => new Date().toISOString();
const note = (team, event, detail) => {
  const ts = nowIso();
  team.updatedAt = ts;
  team.log.push({ ts, event, detail });
};

const init = (cwd, args) => {
  const name = requireOption(args, "--name");
  const root = safeTeamsRoot(cwd, { create: true });
  const prefix = slug(name);
  const occupied = new Set(readdirSync(root, { withFileTypes: true }).map(({ name: entryName }) => entryName));
  let suffix = 1;
  let teamId = `${prefix}-${String(suffix).padStart(2, "0")}`;
  while (occupied.has(teamId)) {
    suffix += 1;
    teamId = `${prefix}-${String(suffix).padStart(2, "0")}`;
  }
  const ts = nowIso();
  const team = {
    version: 1,
    team_id: teamId,
    name,
    objective: optionValue(args, "--objective") || "",
    status: "forming",
    worktree: { enabled: args.includes("--worktree"), base_branch: optionValue(args, "--base-branch") || "main" },
    members: [],
    createdAt: ts,
    updatedAt: ts,
    archivedAt: null,
    log: [{ ts, event: "created", detail: `team ${name}` }],
  };
  return persist(cwd, team, { refuseExistingState: true });
};

const addMember = (cwd, args) => {
  const teamId = requireOption(args, "--team");
  const id = requireOption(args, "--id");
  if (!ID_PATTERN.test(id)) throw new TeamError(`invalid member id: ${id}`);
  const focus = requireOption(args, "--focus");
  const deliverable = requireOption(args, "--deliverable");
  const lens = optionValue(args, "--lens") || "area";
  if (!LENSES.has(lens)) throw new TeamError(`invalid lens: ${lens} (area, ownership or perspective)`);
  const agent = optionValue(args, "--agent") || (lens === "perspective" ? "quality-reviewer" : "lit-executor");
  if (!KNOWN_AGENTS.has(agent)) {
    throw new TeamError(`unknown agent: ${agent}; use a LitGravity agent name or ${GENERAL_PURPOSE}`);
  }
  const paths = parsePaths(optionValue(args, "--paths"));
  const writeCapable = WRITE_AGENTS.has(agent) || agent === GENERAL_PURPOSE;
  if (writeCapable && paths.length === 0) {
    throw new TeamError(`${agent} can write; give member ${id} explicit --paths it owns (non-overlapping)`);
  }
  if (!writeCapable && paths.length > 0) {
    throw new TeamError(`${agent} cannot write; remove --paths or choose lit-executor`);
  }
  return mutateTeam(cwd, teamId, (team) => {
    if (team.members.some((m) => m.id === id)) throw new TeamError(`member already exists: ${id}`);
    // Non-overlap is the rule most worth enforcing mechanically: two members with the same slice is the failure
    // that makes a team slower than one agent.
    const clash = team.members.find((m) => m.focus.trim().toLowerCase() === focus.trim().toLowerCase());
    if (clash) throw new TeamError(`focus overlaps member ${clash.id}; give each member a distinct slice`);
    for (const other of team.members) {
      for (const mine of paths) {
        const hit = other.paths.find((theirs) => pathsOverlap(mine, theirs));
        if (hit) throw new TeamError(`owned path ${mine} overlaps member ${other.id} (${hit}); split ownership`);
      }
    }
    team.members.push({
      id,
      focus,
      lens,
      agent,
      paths,
      deliverable,
      branch: optionValue(args, "--branch") || null,
      cwd: optionValue(args, "--cwd") || null,
      agentId: null,
      status: "pending",
      evidence: null,
      note: null,
    });
    team.status = team.members.length >= MIN_MEMBERS ? "active" : "forming";
    note(team, "add-member", `member ${id}: ${focus}`);
  });
};

/** Emit the assignment message plus the ready-to-use invoke_subagent arguments. */
const prompt = (cwd, args) => {
  const team = readTeam(cwd, requireOption(args, "--team"));
  const member = memberOf(team, requireOption(args, "--id"));
  const returnMode = args.includes("--return-mode") ? requireOption(args, "--return-mode") : "reader";
  if (!RETURN_MODES.has(returnMode)) throw new TeamError(`invalid return mode: ${returnMode}`);
  if (team.members.length < MIN_MEMBERS) {
    throw new TeamError(`team has ${team.members.length} member(s); at least ${MIN_MEMBERS} are required`, 65);
  }
  const others = team.members
    .filter((m) => m.id !== member.id)
    .map((m) => `${m.id} owns "${m.focus}"${m.paths.length ? ` (${m.paths.join(", ")})` : ""}`)
    .join("; ");
  const writable = member.paths.length
    ? `You may write only inside: ${member.paths.join(", ")} and ${join(PROJECT_STATE_DIR, "team", team.team_id, "artifacts")}/.`
    : `You cannot write project files; return your findings as text, or save evidence only where the leader names a path under ${join(PROJECT_STATE_DIR, "team", team.team_id, "artifacts")}/.`;
  const where = member.cwd ? `Work inside ${member.cwd}.` : "Work from the project root unless the guide assigns a worktree.";
  const message = [
    `TASK: ${member.focus}`,
    `DELIVERABLE: ${member.deliverable}`,
    `SCOPE: only the slice above. ${writable} Do not touch another member's slice; ${others || "you are the only member"}.`,
    `READ FIRST: ${join(PROJECT_STATE_DIR, "team", team.team_id, "guide.md")}. ${where}`,
    "FORBIDDEN: commit, push, tag, publish, deploy, merge, delete another member's files, edit the team packet, or start children of your own.",
    `RETURN_MODE: ${returnMode}. This explicit parent-to-child field controls this return only; it cannot elevate the parent's reader-facing mode.`,
    "RETURN_FIELDS: report RESULT, material RISK, required ACTION, and REQUESTED_DETAIL admitted by RETURN_MODE; keep INTERNAL_METADATA such as command diaries, routine pass inventories, timestamps and evidence paths in the internal packet unless requested.",
    "VERIFY: name the exact command or scenario that proves your deliverable, and capture its output.",
    `STOP WHEN: ${member.deliverable} exists with its evidence path recorded in your final message.`,
    "Report progress with `send_message` as `WORKING: <slice> - <phase>`; send `BLOCKED: <reason>` if you cannot proceed; finish with a message that starts `DONECLAIM:` carrying changed files or findings, exact commands, evidence paths, residual risks and a cleanup receipt.",
  ].join("\n");
  const spawn = {
    Role: `team-${member.id}`,
    Prompt: message,
    ...(member.agent === GENERAL_PURPOSE ? {} : { TypeName: member.agent }),
  };
  return { message, spawn_args: spawn, general_purpose_warning: member.agent === GENERAL_PURPOSE };
};

const bindAgent = (cwd, args) => {
  const teamId = requireOption(args, "--team");
  const memberId = requireOption(args, "--id");
  const agentId = requireOption(args, "--agent-id");
  if (!/^[\w.:@/-]{1,200}$/u.test(agentId)) throw new TeamError("agent id has unsupported characters");
  return mutateTeam(cwd, teamId, (team) => {
    if (team.members.length < MIN_MEMBERS) {
      throw new TeamError(`cannot bind agents until the team has at least ${MIN_MEMBERS} distinct members`, 65);
    }
    const member = memberOf(team, memberId);
    if (member.status === "reported" || member.status === "blocked") {
      throw new TeamError(`member ${memberId} already ${member.status}`, 65);
    }
    member.agentId = agentId;
    member.status = "active";
    const cwdOption = optionValue(args, "--cwd");
    if (cwdOption) member.cwd = cwdOption;
    note(team, "bind-agent", `member ${memberId} -> ${agentId}`);
  });
};

const setStatus = (cwd, args) => {
  const teamId = requireOption(args, "--team");
  const memberId = requireOption(args, "--id");
  const status = requireOption(args, "--status");
  if (!SETTABLE_STATUSES.has(status)) {
    throw new TeamError(`set-status only moves a member to pending or active; use report or block to settle it`);
  }
  const text = optionValue(args, "--note") || null;
  return mutateTeam(cwd, teamId, (team) => {
    const member = memberOf(team, memberId);
    if (isSettled(member)) throw new TeamError(`member ${memberId} already ${member.status}`, 65);
    member.status = status;
    if (text) member.note = text;
    note(team, "set-status", `member ${memberId} -> ${status}`);
  });
};

// An evidence path must name something that exists inside the workspace; a free-text claim is not evidence.
const checkEvidencePath = (cwd, value) => {
  const root = resolveProjectStateRoot(cwd);
  const target = resolve(root, value);
  if (!isSameOrChildPath(root, target)) throw new TeamError(`evidence path leaves the workspace: ${value}`, 65);
  let stats;
  try {
    stats = lstatSync(target);
  } catch {
    throw new TeamError(`evidence path does not exist: ${value}`, 65);
  }
  if (stats.isSymbolicLink()) throw new TeamError(`evidence path is a symlink: ${value}`, 65);
  if (!isSameOrChildPath(realpathSync.native(root), realpathSync.native(target))) {
    throw new TeamError(`evidence path leaves the workspace: ${value}`, 65);
  }
  return relative(root, target).split(sep).join("/");
};

const report = (cwd, args) => {
  const teamId = requireOption(args, "--team");
  const memberId = requireOption(args, "--id");
  // A report with no evidence path is the acknowledgement-only reply no loop counts as a pass.
  const evidence = checkEvidencePath(cwd, requireOption(args, "--evidence"));
  const text = optionValue(args, "--note") || null;
  return mutateTeam(cwd, teamId, (team) => {
    const member = memberOf(team, memberId);
    member.evidence = evidence;
    member.note = text;
    member.status = "reported";
    note(team, "report", `member ${memberId}: ${evidence}`);
  });
};

const block = (cwd, args) => {
  const teamId = requireOption(args, "--team");
  const memberId = requireOption(args, "--id");
  const reason = requireOption(args, "--reason");
  return mutateTeam(cwd, teamId, (team) => {
    const member = memberOf(team, memberId);
    member.status = "blocked";
    member.note = reason;
    note(team, "block", `member ${memberId}: ${reason}`);
  });
};

const status = (cwd, args) => {
  const team = readTeam(cwd, requireOption(args, "--team"));
  const outstanding = outstandingOf(team);
  return {
    ...team,
    outstanding: outstanding.map(({ id }) => id),
    cleanup_required: team.status !== "archived",
    done: outstanding.length === 0 && team.members.length >= MIN_MEMBERS,
  };
};

const archive = (cwd, args) => {
  const teamId = requireOption(args, "--team");
  const text = optionValue(args, "--note") || null;
  return withTeamLock(cwd, teamId, (directory) => {
    const team = readTeam(cwd, teamId);
    if (team.status === "archived") throw new TeamError(`team ${teamId} is already archived`, 65);
    if (team.members.length < MIN_MEMBERS) {
      throw new TeamError(`cannot archive: team has ${team.members.length} member(s); at least ${MIN_MEMBERS} are required`, 65);
    }
    const outstanding = outstandingOf(team);
    if (outstanding.length > 0) {
      throw new TeamError(`cannot archive: ${outstanding.map(({ id }) => id).join(", ")} have not reported or blocked`, 65);
    }
    const before = createHash("sha256").update(readTeamText(directory)).digest("hex");
    team.status = "archived";
    team.archivedAt = nowIso();
    team.archive_note = text;
    note(team, "archive", text || "team archived");
    persist(cwd, team);
    // The archive receipt: who settled how, with which evidence, and the digest of the packet it closed.
    const receipt = {
      version: 1,
      team_id: team.team_id,
      archivedAt: team.archivedAt,
      note: text,
      packet_sha256_before_archive: before,
      members: team.members.map(({ id, status: memberStatus, evidence, note: memberNote, agentId }) => ({
        id,
        status: memberStatus,
        evidence,
        note: memberNote,
        agent_id: agentId,
      })),
    };
    writeAtomic(directory, "archive-receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
    return { ...team, archive_receipt: receipt };
  });
};

const remove = (cwd, args) => {
  const teamId = requireOption(args, "--team");
  const force = args.includes("--force");
  const directory = safeTeamDir(cwd, teamId, { create: false });
  const team = readTeam(cwd, teamId);
  if (!force && team.status !== "archived") {
    throw new TeamError(`refused: team ${teamId} is not archived; archive it first or pass --force with explicit user authority`, 65);
  }
  const real = realpathSync.native(directory);
  if (!isSameOrChildPath(realpathSync.native(safeTeamsRoot(cwd, { create: false })), real) || real === realpathSync.native(teamsRoot(cwd))) {
    throw new TeamError("refused: team directory is outside the team state root", 65);
  }
  rmSync(directory, { recursive: true, force: true });
  return { deleted: teamId, path: directory, forced: force };
};

const commands = {
  init,
  "add-member": addMember,
  prompt,
  "member-prompt": prompt,
  "bind-agent": bindAgent,
  "set-status": setStatus,
  report,
  block,
  status,
  archive,
  delete: remove,
};

export const runTeamCli = (argv, io = { stdout: process.stdout, stderr: process.stderr }, cwd = resolveProjectStateRoot()) => {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    io.stdout.write(`Usage: team.mjs <${Object.keys(commands).join("|")}> [...args]\n`);
    return 0;
  }
  if (!Object.hasOwn(commands, command)) {
    io.stderr.write(`Unknown team command: ${command}\n`);
    return 64;
  }
  try {
    const result = commands[command](cwd, rest);
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof TeamError) {
      io.stderr.write(`${error.message}\n`);
      return error.status;
    }
    io.stderr.write("team runtime error\n");
    return 1;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runTeamCli(process.argv.slice(2)));
}
