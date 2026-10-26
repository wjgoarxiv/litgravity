#!/usr/bin/env node
// lit-typographic-motion render CLI. Every render starts from <out>/treatment.json. The type path is
// `make` (with the stills/sheet/video/perf stages and `gate`); the stage path is `stage`; `sound`
// builds the generated bed and `look` records a look round. Exit codes: 0 OK, 10 no Chrome, 11 no
// WebGL2, 12 no ffmpeg for video, 13 QA gate FAIL, 14 runtime not pre-warmed, 15 font missing or
// hash-mismatched, 16 treatment invalid, 17 stage contract, 18 stage nondeterministic, 19 stage
// network request, 20 sound invalid (2 = usage).
import { realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, EXIT_NAME, CREDIT_LINE } from "../engine/core/constants.mjs";

export const USAGE = `lit-typographic-motion render CLI (LitGravity)

usage:
  motion.mjs styles --out <dir> [--format 16:9|9:16]              the house-style gallery: one demo board per style
  motion.mjs assets --out <dir> --url <link> [--cover]            a named product's real logo, README images and words:
                                                                  <dir>/stage/assets/ (cover/assets/), <dir>/product/, <dir>/product.json
  motion.mjs scaffold --out <dir>                                 writes <dir>/stage/index.html from the treatment
  motion.mjs stage --out <dir> [--round N] [--stills-only]      stage path: renders the page in <dir>/stage/;
                                                                  --stills-only is the board round (storyboard + check)
  motion.mjs cover --out <dir> [--round N] [--window t0,t1]   cover mode: the seamless README loop in <dir>/cover/;
                                                                  --window re-renders only t0-0.5 s .. t1+0.5 s and sheets it
  motion.mjs cover-gate <cover.webp> [--frames d --frames2 d --masks d --title x,y,w,h] [--strict] [--json]
                                                                  the cover gate on a decoded cover file
  motion.mjs make  <brief.json> --out <dir> [--round N] [--stills-only] [--word-timing]
                                                                  type path: the typographic engine
  motion.mjs blender --out <dir> [--final]                        the offline Blender rung (render3d: blender): preview stills of
                                                                  <dir>/stage/scene.py, then with --final the plate in <dir>/stage/plate/
  motion.mjs sound --out <dir>                                    builds <dir>/sound/bed.wav from the treatment
  motion.mjs look  --out <dir> --round N --answers <file>         records one look round in <dir>/look.json
                   (--blocked no-vision-tool when no image tool can be reached)
  motion.mjs gate  <dir>                                          reruns the full type-path gate on a render
  motion.mjs stills|sheet|video|perf <brief.json> --out <dir>     one type-path stage alone

Every render reads <dir>/treatment.json first (exit 16 names the field). A render with --stills-only
writes the beat stills, the transition strips, the contact sheet and the storyboard (stills/board.png),
and on the stage path runs the board check (exit 13 when it fails), then stops; the full render adds
the master, preview, poster, reduced-motion still, determinism re-check, sound and the gate. A
flash-audit FAIL withholds every export in <dir>/withheld/. A cover render (treatment mode: cover)
captures at 2x, encodes cover.webp and gates the decoded file; it exits 13 until every gate reaches
its cover TARGET.

exit codes: 0 OK · 10 BLOCKED_NO_CHROME · 11 BLOCKED_NO_WEBGL2 · 12 BLOCKED_NO_FFMPEG_FOR_VIDEO ·
13 GATE_FAIL_QA · 14 BLOCKED_DEPS_NOT_PREWARMED · 15 BLOCKED_FONT_FETCH · 16 BLOCKED_TREATMENT_INVALID ·
17 STAGE_CONTRACT_ERROR · 18 STAGE_NONDETERMINISTIC · 19 STAGE_NETWORK_REQUEST · 20 SOUND_INVALID ·
21 BLOCKED_NO_COVER_ENCODER · 22 BLOCKED_ASSET_MISSING · 2 usage
${CREDIT_LINE}
`;

function parse(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (["--stills-only", "--word-timing", "--help", "-h", "--foreground", "--worker", "--strict", "--json", "--cover", "--final"].includes(a)) args[a.replace(/^-+/u, "")] = true;
    else if (a.startsWith("--")) {
      args[a.slice(2)] = argv[i + 1];
      i += 1;
    } else args._.push(a);
  }
  return args;
}

export async function main(argv, { env = process.env, stdout = process.stdout, stderr = process.stderr } = {}) {
  const args = parse(argv);
  const [mode, target] = args._;
  if (args.help || args.h || !mode) {
    stdout.write(USAGE);
    return mode || args.help || args.h ? EXIT.OK : EXIT.USAGE;
  }
  const log = (line) => stderr.write(`lit-motion: ${line}\n`);
  const { BlockedError } = await import("../engine/node/chrome.mjs");
  const pipeline = await import("../engine/node/pipeline.mjs");
  try {
    let result;
    if (["stage", "cover", "sound", "look", "scaffold", "styles", "assets", "blender"].includes(mode)) {
      if (!args.out) throw new BlockedError(EXIT.USAGE, `${mode} needs --out <dir>`);
      const out = path.resolve(args.out);
      if (mode === "assets") {
        if (!args.url) throw new BlockedError(EXIT.USAGE, "assets needs --url <link>");
        const { fetchAssets } = await import("../engine/node/assets.mjs");
        result = await fetchAssets({ out, url: String(args.url), into: args.cover ? "cover" : "stage" });
      } else if (mode === "scaffold") {
        const { scaffoldCommand } = await import("../engine/node/scaffold.mjs");
        const { asBlocked } = pipeline;
        result = asBlocked(() => scaffoldCommand({ out }));
      } else if (mode === "styles") {
        const { stylesCommand } = await import("../engine/node/gallery.mjs");
        result = await stylesCommand({ out, format: args.format ?? "16:9", env, log });
      } else if (mode === "cover") {
        const cover = await import("../engine/node/cover.mjs");
        const round = Number(args.round ?? 1);
        const run = () => cover.renderCover({ out, round, env, log });
        if (args.worker) return await detachedWorker({ run, out, BlockedError });
        if (args.window) {
          const span = String(args.window).split(",").map(Number);
          if (span.length !== 2) throw new BlockedError(EXIT.USAGE, "--window takes t0,t1 in seconds");
          result = await cover.renderCoverWindow({ out, round, window: span, env, log });
        } else if (args.foreground || env.LITGRAVITY_MOTION_FOREGROUND === "1") result = await run();
        else {
          const { renderStageDetached } = await import("../engine/node/stage.mjs");
          result = await renderStageDetached({ out, round, cli: fileURLToPath(import.meta.url), mode: "cover", env, log });
          if (result.blocked) throw new BlockedError(result.code, result.message);
        }
      } else if (mode === "stage") {
        const stage = await import("../engine/node/stage.mjs");
        const round = Number(args.round ?? 1);
        const stillsOnly = Boolean(args["stills-only"]);
        if (args.worker) return await detachedWorker({ run: () => stage.renderStage({ out, round, stillsOnly: false, env, log }), out, BlockedError });
        // A full render runs detached with a progress file, so a tool timeout never kills it.
        if (stillsOnly || args.foreground || env.LITGRAVITY_MOTION_FOREGROUND === "1") result = await stage.renderStage({ out, round, stillsOnly, env, log });
        else {
          result = await stage.renderStageDetached({ out, round, cli: fileURLToPath(import.meta.url), env, log });
          if (result.blocked) throw new BlockedError(result.code, result.message);
        }
      } else if (mode === "blender") {
        const { blenderCommand } = await import("../engine/node/blender.mjs");
        const final = Boolean(args.final);
        if (args.worker) {
          const progress = (frame, frameCount) => writeProgress(out, { phase: "plate", frame, frameCount });
          return await detachedWorker({ run: () => blenderCommand({ out, final: true, env, log, progress }), out, BlockedError });
        }
        // The final plate can take most of an hour, so it runs detached like a full stage render.
        if (!final || args.foreground || env.LITGRAVITY_MOTION_FOREGROUND === "1") result = await blenderCommand({ out, final, env, log });
        else {
          const { renderStageDetached } = await import("../engine/node/stage.mjs");
          result = await renderStageDetached({ out, round: 1, cli: fileURLToPath(import.meta.url), mode: "blender", env, log });
          if (result.blocked) throw new BlockedError(result.code, result.message);
        }
      } else if (mode === "sound") {
        const { soundCommand } = await import("../engine/node/sound-cli.mjs");
        result = await soundCommand({ out, env, log });
      } else {
        const look = await import("../engine/node/look.mjs");
        if (!args.answers && !args.blocked) throw new BlockedError(EXIT.USAGE, "look needs --round N and --answers <file> (or --blocked no-vision-tool)");
        result = look.lookCommand({ out, round: Number(args.round), answersFile: args.answers ? path.resolve(args.answers) : null, blocked: args.blocked ?? null });
      }
    } else if (mode === "cover-gate") {
      if (!target) throw new BlockedError(EXIT.USAGE, "cover-gate needs the cover file (cover.webp, cover.gif) or a PNG frame directory");
      const { coverGate, formatCoverReport } = await import("../engine/node/cover-gate.mjs");
      const strict = Boolean(args.strict);
      const r = coverGate(path.resolve(target), {
        frames: args.frames ? path.resolve(args.frames) : null, frames2: args.frames2 ? path.resolve(args.frames2) : null, masks: args.masks ? path.resolve(args.masks) : null,
        title: args.title ? String(args.title).split(",").map(Number) : null, fps: Number(args.fps ?? 16), env,
      });
      const { diffs, kept, durations, ...rest } = r;
      const ok = r.pass && (!strict || r.target);
      result = { code: ok ? EXIT.OK : EXIT.GATE_FAIL_QA, message: args.json ? JSON.stringify(rest, null, 1) : formatCoverReport(r, { strict }).trimEnd() };
    } else if (mode === "gate") {
      if (!target) throw new BlockedError(EXIT.USAGE, "gate needs the output directory");
      result = await pipeline.gateOnly({ out: path.resolve(target), viewed: Number(args.viewed ?? 0), env, log });
    } else {
      if (!target || !args.out) throw new BlockedError(EXIT.USAGE, `${mode} needs <brief.json> and --out <dir>`);
      const common = { briefPath: path.resolve(target), out: path.resolve(args.out), env, log };
      if (mode === "make") result = await pipeline.make({ ...common, round: Number(args.round ?? 1), stillsOnly: Boolean(args["stills-only"]), viewed: Number(args.viewed ?? 0), wordTiming: Boolean(args["word-timing"]) });
      else if (mode === "video") result = await pipeline.make({ ...common, gate: false });
      else if (["stills", "sheet", "perf"].includes(mode)) result = await pipeline.partial({ ...common, mode });
      else throw new BlockedError(EXIT.USAGE, `unknown mode: ${mode}`);
    }
    stdout.write(`${result.message}\n`);
    stdout.write(`exit ${result.code} ${EXIT_NAME[result.code] ?? ""}\n`);
    return result.code;
  } catch (error) {
    if (error instanceof BlockedError) {
      stderr.write(`${error.message}\n`);
      stdout.write(`exit ${error.code} ${EXIT_NAME[error.code] ?? ""}\n`);
      return error.code;
    }
    stderr.write(`lit-motion: ${error.stack ?? error.message}\n`);
    return 1;
  }
}

const writeProgress = (out, p) => {
  try {
    writeFileSync(path.join(out, ".run", "progress.json"), JSON.stringify(p));
  } catch {
    // The waiting caller only logs progress; a missed write costs nothing.
  }
};

/** The detached side of a full stage or cover render: run it and leave the result for the waiting caller. */
async function detachedWorker({ run, out, BlockedError }) {
  let result;
  try {
    const r = await run();
    result = { code: r.code, message: r.message };
  } catch (error) {
    result = error instanceof BlockedError ? { code: error.code, message: error.message, blocked: true } : { code: 1, message: `lit-motion: ${error.stack ?? error.message}`, blocked: true };
  }
  writeFileSync(path.join(out, ".run", "result.json"), `${JSON.stringify(result)}\n`);
  return result.code;
}

// Compare real paths: reached through a symlink (/var -> /private/var, a linked plugin dir) a plain
// string compare would treat the script as imported and silently exit 0.
const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) process.exitCode = await main(process.argv.slice(2));
