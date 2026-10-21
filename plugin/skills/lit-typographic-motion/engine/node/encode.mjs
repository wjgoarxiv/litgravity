// ffmpeg is always the last stage and always a separately installed host binary (MO-A-03): the
// master is one pinned encode (BT.709 matrix and tags, tv range, CRF 16, tune grain). The preview
// walks the MO-A-38 encoder ladder (ffmpeg libwebp_anim, then img2webp, then GIF) over PNG frames
// the renderer wrote and audited itself.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { ENCODE_ARGS, PREVIEW } from "../core/constants.mjs";
import { firstLine, resolveOnPath } from "../../../../lib/host-exec.mjs";

// PATH is searched in JavaScript: `where` prints CRLF lines and never tries PATHEXT, so ffmpeg.exe was never found on Windows.
export function which(name, env = process.env) {
  return resolveOnPath(name, { env });
}

export const findFfmpeg = (env = process.env) => (env.FFMPEG_PATH && existsSync(env.FFMPEG_PATH) ? env.FFMPEG_PATH : which("ffmpeg", env));
export const findFfprobe = (env = process.env) => (env.FFPROBE_PATH && existsSync(env.FFPROBE_PATH) ? env.FFPROBE_PATH : which("ffprobe", env));
export const findImg2webp = (env = process.env) => which("img2webp", env);

export function ffmpegVersion(ffmpeg) {
  const probe = spawnSync(ffmpeg, ["-version"], { encoding: "utf8" });
  return probe.status === 0 ? firstLine(probe.stdout) : null;
}

/** The preview-encoder rungs available on this host, in ladder order. */
export function previewRungs(ffmpeg, env = process.env) {
  const rungs = [];
  if (ffmpeg) {
    const list = spawnSync(ffmpeg, ["-hide_banner", "-encoders"], { encoding: "utf8" }).stdout ?? "";
    if (/\blibwebp_anim\b/u.test(list)) rungs.push("libwebp_anim");
  }
  if (findImg2webp(env)) rungs.push("img2webp");
  if (ffmpeg) rungs.push("gif");
  return rungs;
}

/** Start the master encode; returns { write(bytes), finish() }. Writes respect stdin backpressure. */
export function startMaster({ ffmpeg, width, height, fps, out, audio = null }) {
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${width}x${height}`, "-r", String(fps), "-i", "pipe:0"];
  if (audio) args.push("-i", audio);
  args.push(...ENCODE_ARGS);
  // The track is prepared to the film's exact sample count, so nothing is cut to the shorter stream.
  if (audio) args.push("-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "256k");
  args.push(out);
  const child = spawn(ffmpeg, args, { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (d) => { stderr += d.toString(); });
  const exited = new Promise((resolve) => child.on("close", (code) => resolve(code)));
  child.stdin.on("error", () => {});
  return {
    args,
    async write(bytes) {
      if (!child.stdin.write(bytes)) await new Promise((resolve) => child.stdin.once("drain", resolve));
    },
    async finish() {
      child.stdin.end();
      const code = await exited;
      return { code, stderr: stderr.trim() };
    },
  };
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, stderr: (r.stderr || r.error?.message || "").trim() };
}

/** Encode one preview rung from numbered PNGs (00000.png ...) with one encoder. */
export function encodePreview({ encoder, ffmpeg, img2webp, dir, fps, out }) {
  const frames = readdirSync(dir).filter((f) => /^\d{5}\.png$/u.test(f)).sort();
  if (encoder === "libwebp_anim") {
    return run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "%05d.png"), "-c:v", "libwebp_anim", "-lossless", "0", "-q:v", String(PREVIEW.webpQuality), "-loop", "0", out]);
  }
  if (encoder === "img2webp") {
    const args = ["-loop", "0", "-lossy", "-q", String(PREVIEW.webpQuality), "-m", "4"];
    let elapsed = 0;
    frames.forEach((f, i) => {
      const next = Math.round(((i + 1) * 1000) / fps);
      args.push("-d", String(next - elapsed), path.join(dir, f));
      elapsed = next;
    });
    args.push("-o", out);
    return run(img2webp, args);
  }
  return run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "%05d.png"),
    "-vf", "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", "-loop", "0", out]);
}

/** ffprobe the first video stream. Returns null when ffprobe is missing or fails. */
export function probeVideo(file, env = process.env) {
  const ffprobe = findFfprobe(env);
  if (!ffprobe || !existsSync(file)) return null;
  const r = spawnSync(ffprobe, ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries",
    "stream=width,height,r_frame_rate,pix_fmt,color_space,color_range,color_transfer,color_primaries,nb_read_frames,codec_name:format=duration,size",
    "-of", "json", file], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const j = JSON.parse(r.stdout);
  const s = j.streams?.[0] ?? {};
  const [num, den] = String(s.r_frame_rate ?? "0/1").split("/").map(Number);
  return {
    codec: s.codec_name, width: s.width, height: s.height, fps: den ? num / den : 0, pixFmt: s.pix_fmt, colorSpace: s.color_space,
    colorRange: s.color_range, colorTransfer: s.color_transfer, colorPrimaries: s.color_primaries, frames: Number(s.nb_read_frames ?? 0),
    duration: Number(j.format?.duration ?? 0), bytes: statSync(file).size,
  };
}
