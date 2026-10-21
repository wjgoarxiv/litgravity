// One render session: the page served from the skill directory and the runtime cache, headless
// Chrome on the first WebGL2 rung, and frame egress. The WebSocket on 127.0.0.1:0 is the primary
// path; when `listen` is refused (a sandbox), frames are pulled over CDP from the same readback
// buffer instead (the sanctioned MO-A-02 variant). The screencast path is never used.
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { APP_ORIGIN, launchWithLadder, findChrome } from "./chrome.mjs";
import { startFrameServer } from "./ws-server.mjs";
import { ENGINE_ROOT, loadFontManifest, fontLocation, opentypeModule } from "./runtime.mjs";

function faultListen(env) {
  if (env.LITGRAVITY_MOTION_FAULT !== "listen-eperm") return null;
  return () => {
    const error = new Error("listen EPERM: operation not permitted 127.0.0.1");
    error.code = "EPERM";
    throw error;
  };
}

/** Plan sent to the page: shots, timing, preset, fonts and the egress endpoint. */
function pagePlan(plan, { fontKeys, ws }) {
  const manifest = loadFontManifest();
  return {
    presetId: plan.presetId, signalHue: plan.signalHue, fps: plan.fps, seed: plan.seed, frameCount: plan.frameCount,
    durationSec: plan.durationSec, label: plan.label, passParams: plan.passParams, post: plan.post,
    shots: plan.shots.map((s) => ({ ...s, reading: undefined })),
    fonts: fontKeys.map((key) => ({ key, format: manifest.fonts[key].format, weight: manifest.fonts[key].weight, scripts: manifest.fonts[key].scripts, file: path.basename(manifest.fonts[key].path ?? manifest.fonts[key].file) })),
    egress: { ws },
  };
}

export async function openSession({ plan, fontKeys, runDir, env = process.env, softwareOnly = false, log = () => {} }) {
  mkdirSync(runDir, { recursive: true });
  const manifest = loadFontManifest();
  let planJson = "{}";
  const routes = (pathname) => {
    if (pathname === "/run/plan.json") return { body: planJson, type: "application/json" };
    if (pathname === "/vendor/opentype.mjs") return opentypeModule(env);
    if (pathname.startsWith("/fonts/")) {
      const key = pathname.slice("/fonts/".length);
      return manifest.fonts[key] ? fontLocation(key, manifest.fonts[key], env) : null;
    }
    if (pathname.startsWith("/web/") || pathname.startsWith("/core/")) {
      const file = path.resolve(ENGINE_ROOT, `.${pathname}`);
      if (!file.startsWith(path.join(ENGINE_ROOT, path.sep)) || !existsSync(file)) return null;
      return file;
    }
    return null;
  };

  // Egress first: a refused listen selects the CDP pull and says why.
  const queue = [];
  const waiters = [];
  let pendingMeta = null;
  let server = null;
  let listenError = null;
  try {
    server = await startFrameServer({
      onText: (text) => { pendingMeta = JSON.parse(text); },
      onBinary: (bytes) => {
        queue.push({ meta: pendingMeta, bytes });
        pendingMeta = null;
        const w = waiters.shift();
        if (w) w();
      },
      listen: faultListen(env),
    });
  } catch (error) {
    listenError = error;
    log(`egress: listen failed (${error.message}); using CDP pull of the readback buffer`);
  }

  const chrome = findChrome(env);
  let launched;
  try {
    launched = await launchWithLadder({ chrome, profileRoot: path.join(runDir, "chrome"), routes, softwareOnly, log });
  } catch (error) {
    await server?.close();
    throw error;
  }
  const { session, flags, renderer } = launched;
  planJson = JSON.stringify(pagePlan(plan, { fontKeys, ws: server?.url ?? null }));
  await session.navigate(`${APP_ORIGIN}/web/index.html`);
  const deadline = Date.now() + 120000;
  let state;
  for (;;) {
    state = await session.evaluate("({ ready: window.__litMotion?.ready ?? false, error: window.__litMotion?.error ?? null })").catch(() => ({ ready: false, error: null }));
    if (state.ready || state.error) break;
    if (Date.now() > deadline) {
      state.error = `page did not become ready: ${session.logs.slice(0, 5).join(" | ")}`;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (state.error) {
    await session.close();
    await server?.close();
    throw new Error(`engine page failed: ${state.error}\n${session.logs.slice(0, 20).join("\n")}`);
  }
  const info = await session.evaluate("window.__litMotion.info()");
  if (server && info.egress !== "websocket") log("egress: page could not open the WebSocket; using CDP pull");

  /**
   * Render frames [from, to) and hand each (meta, bytes) to `onFrame` in order. In WebSocket mode
   * the ack is sent after onFrame resolves, which bounds how far the page runs ahead.
   */
  async function render({ from, to, fps, samples, shutter, stillOverrides = null, tag }, onFrame) {
    const opts = JSON.stringify({ from, to, fps, samples, shutter, stillOverrides, tag });
    if (info.egress === "websocket") {
      let failure = null;
      const streaming = session.evaluate(`window.__litMotion.stream(${opts})`).catch((error) => {
        failure = error;
        while (waiters.length) waiters.shift()();
      });
      for (let n = from; n < to; n++) {
        while (queue.length === 0 && !failure) await new Promise((r) => waiters.push(r));
        if (failure) throw failure;
        const frame = queue.shift();
        await onFrame(frame.meta, frame.bytes);
        server.ack("ok");
      }
      await streaming;
      if (failure) throw failure;
      return;
    }
    for (let n = from; n < to; n++) {
      await session.evaluate(`window.__litMotion.frame(${JSON.stringify({ n, fps, samples, shutter, stillOverrides, tag })})`);
      const pulled = await session.evaluate("window.__litMotion.pull()");
      await onFrame(pulled.meta, Buffer.from(pulled.b64, "base64"));
    }
  }

  return {
    session, flags, renderer, info,
    egress: info.egress === "websocket" ? "websocket (127.0.0.1:0, pipe-driven Chrome)" : `CDP pull of the readback buffer${listenError ? ` (listen refused: ${listenError.message})` : ""}`,
    listenError,
    render,
    perf: (frames, fps) => session.evaluate(`window.__litMotion.perf(${JSON.stringify({ frames, fps })})`),
    async close() {
      await session.close();
      await server?.close();
      rmSync(path.join(runDir, "chrome"), { recursive: true, force: true });
    },
  };
}
