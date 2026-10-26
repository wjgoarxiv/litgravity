// Stage serving without a listening socket: every request the page makes is paused by CDP Fetch
// interception and either fulfilled from disk on the synthetic origin http://lit.stage, or failed
// with BlockedByClient and recorded (exit 19). Only files whose real path lies inside the stage
// directory are served, plus the kit and font routes. A static pre-flight scan runs before Chrome
// starts: the page, its local assets, raster limits and external URLs.
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT } from "../core/constants.mjs";
import { readPlate } from "./blender.mjs";
import { BlockedError } from "./chrome.mjs";
import { checkFont, fontLocation, fontsDir, loadFontManifest } from "./runtime.mjs";

export const STAGE_ORIGIN = "http://lit.stage";
export const KIT_FILE = fileURLToPath(new URL("../stage/stage-kit.js", import.meta.url));
export const INIT_FILE = fileURLToPath(new URL("../stage/init.js", import.meta.url));
export const LOOP_KIT_FILE = fileURLToPath(new URL("../stage/loop-kit.js", import.meta.url));
export const COVER_INIT_FILE = fileURLToPath(new URL("../stage/cover-init.js", import.meta.url));
// The pinned three.js build and its few addons (engine/vendor/three, MIT), served at /lit/three/ for
// the 3D route (references/depth.md). Pages import them through an import map; nothing is fetched.
export const THREE_DIR = fileURLToPath(new URL("../vendor/three/", import.meta.url));

export const CONTENT_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".wav": "audio/wav", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".otf": "font/otf", ".json": "application/json",
});
export const RASTER = Object.freeze([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
export const RASTER_LIMITS = Object.freeze({ count: 24, bytes: 8 * 1024 * 1024, flipbook: 10 });

// The product's verified faces as CSS families. Archivo's widths are one family at three stretches.
const FAMILIES = [
  ["pretendard-400", "Pretendard", 400, "normal"], ["pretendard-700", "Pretendard", 700, "normal"],
  ["archivo-75-400", "Archivo", 400, "75%"], ["archivo-75-700", "Archivo", 700, "75%"], ["archivo-75-900", "Archivo", 900, "75%"],
  ["archivo-100-400", "Archivo", 400, "100%"], ["archivo-100-700", "Archivo", 700, "100%"], ["archivo-100-900", "Archivo", 900, "100%"],
  ["archivo-125-400", "Archivo", 400, "125%"], ["archivo-125-700", "Archivo", 700, "125%"], ["archivo-125-900", "Archivo", 900, "125%"],
  ["vt323", "VT323", 400, "normal"], ["silkscreen-400", "Silkscreen", 400, "normal"], ["silkscreen-700", "Silkscreen", 700, "normal"],
  ["galmuri9", "Galmuri9", 400, "normal"], ["meslo-400", "MesloLGS NF", 400, "normal"],
  ["jetbrains-mono", "JetBrains Mono", "100 800", "normal"],
];
export const STAGE_FAMILIES = Object.freeze([...new Set(FAMILIES.map((f) => f[1]))]);

/**
 * Verify every stage face against its pinned hash. An unwarmed cache (the fonts directory absent)
 * is exit 14; a missing or mismatched file in a warmed cache is exit 15.
 */
export function stageFonts(env = process.env) {
  const manifest = loadFontManifest();
  const faces = [];
  for (const [key, family, weight, stretch] of FAMILIES) {
    const font = manifest.fonts[key];
    const check = checkFont(key, font, env);
    if (!check.ok) {
      if (font.source !== "bundled" && !existsSync(fontsDir(env))) {
        throw new BlockedError(EXIT.BLOCKED_DEPS_NOT_PREWARMED, `BLOCKED_DEPS_NOT_PREWARMED: the stage fonts are not in the LitGravity cache (${fontsDir(env)}); run npx @litfamily/litgravity runtime install motion outside this session`);
      }
      throw new BlockedError(EXIT.BLOCKED_FONT_FETCH, `BLOCKED_FONT_FETCH: font ${key} is ${check.problem} (${check.path}); run npx @litfamily/litgravity runtime install motion outside this session`);
    }
    const file = fontLocation(key, font, env);
    const format = { ".otf": "opentype", ".woff2": "woff2" }[path.extname(file)] ?? "truetype";
    faces.push({ key, family, weight, stretch, file, route: `/lit/fonts/${key}${path.extname(file)}`, format });
  }
  return faces;
}

export function fontsCss(faces) {
  return `${faces.map((f) => `@font-face {\n  font-family: "${f.family}";\n  src: url("${f.route}") format("${f.format}");\n  font-weight: ${f.weight};\n  font-style: normal;\n  font-stretch: ${f.stretch};\n  font-display: block;\n}`).join("\n")}\n`;
}

const inside = (root, target) => target === root || target.startsWith(`${root}${path.sep}`);

/** List every file under the stage dir (symlinks resolved and checked, never followed out). */
export function listStage(stageDir) {
  const root = realpathSync(stageDir);
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const st = lstatSync(full);
      if (st.isSymbolicLink()) {
        let real;
        try {
          real = realpathSync(full);
        } catch {
          throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: broken symlink ${path.relative(stageDir, full)}`);
        }
        if (!inside(root, real)) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: symlink escapes the stage dir: ${path.relative(stageDir, full)}`);
        if (statSync(real).isDirectory()) continue;
        files.push({ rel: path.relative(stageDir, full), real, bytes: statSync(real).size });
      } else if (st.isDirectory()) walk(full);
      else if (st.isFile()) files.push({ rel: path.relative(stageDir, full), real: realpathSync(full), bytes: st.size });
    }
  };
  walk(stageDir);
  return files;
}

// ---- raster headers: size and animation, from the bytes ----
function pngInfo(b) {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  let animated = false;
  for (let o = 8; o + 8 <= b.length;) {
    const len = b.readUInt32BE(o);
    const type = b.toString("latin1", o + 4, o + 8);
    if (type === "acTL") animated = true;
    if (type === "IDAT" || type === "IEND") break;
    o += 12 + len;
  }
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), animated };
}
function jpegInfo(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let o = 2; o + 9 < b.length;) {
    if (b[o] !== 0xff) return null;
    const marker = b[o + 1];
    const len = b.readUInt16BE(o + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: b.readUInt16BE(o + 7), height: b.readUInt16BE(o + 5), animated: false };
    o += 2 + len;
  }
  return null;
}
function webpInfo(b) {
  if (b.length < 30 || b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WEBP") return null;
  const kind = b.toString("latin1", 12, 16);
  if (kind === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3), animated: Boolean(b[20] & 0x02) || b.includes("ANMF", 12, "latin1") };
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff), animated: false };
  }
  if (kind === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff, animated: false };
  return null;
}
function gifInfo(b) {
  if (b.length < 13 || b.toString("latin1", 0, 3) !== "GIF") return null;
  let frames = 0;
  let o = 13;
  if (b[10] & 0x80) o += 3 * (1 << ((b[10] & 0x07) + 1));
  while (o < b.length) {
    const sep = b[o];
    if (sep === 0x3b) break;
    if (sep === 0x2c) {
      frames += 1;
      if (frames > 1) break;
      let p = o + 10;
      if (b[o + 9] & 0x80) p += 3 * (1 << ((b[o + 9] & 0x07) + 1));
      p += 1;
      while (p < b.length && b[p] !== 0) p += b[p] + 1;
      o = p + 1;
    } else if (sep === 0x21) {
      let p = o + 2;
      while (p < b.length && b[p] !== 0) p += b[p] + 1;
      o = p + 1;
    } else break;
  }
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8), animated: frames > 1 };
}
export function rasterInfo(file) {
  const b = readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return pngInfo(b);
  if (ext === ".jpg" || ext === ".jpeg") return jpegInfo(b);
  if (ext === ".webp") return webpInfo(b);
  if (ext === ".gif") return gifInfo(b);
  return null;
}

// ---- the static pre-flight scan ----
const TEXT = new Set([".html", ".js", ".mjs", ".css", ".svg", ".json"]);
const NAMESPACES = /^http:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink|1999\/xhtml|XML\/1998\/namespace|2000\/xmlns\/?)$/u;
const ABSOLUTE_URL = /\b(?:https?|wss?|ftp):\/\/[^\s"'`<>)\\]+/giu;
const PROTOCOL_RELATIVE = [
  /\b(?:src|href|action|poster|data|srcset|xlink:href)\s*=\s*["']\s*\/\/[^"'\s]+/giu,
  /url\(\s*["']?\s*\/\/[^)"'\s]+/giu,
  /@import\s+(?:url\()?\s*["']\s*\/\/[^"'\s]+/giu,
  /["'`]\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?\//giu,
];
const HINT_LINK = /\brel\s*=\s*["'][^"']*\b(preconnect|prefetch|dns-prefetch|prerender)\b/iu;
const FORBIDDEN_ELEMENT = /<\s*(video|audio|iframe|object|embed|frame)\b/iu;
const FORBIDDEN_CREATE = /createElement(?:NS)?\s*\([^)]*["'`](video|audio|iframe|object|embed|frame)["'`]/iu;
const FORBIDDEN_API = /\bnew\s+(Audio|AudioContext|webkitAudioContext|OfflineAudioContext|Worker|SharedWorker)\s*\(|navigator\.serviceWorker\.register/u;
const NETWORK_API = /\bnew\s+(WebSocket|WebTransport|RTCPeerConnection|EventSource)\s*\(/u;

/**
 * Scan the stage dir before launch. Throws exit 17 (contract) or 19 (network) naming the file and
 * the thing found; returns { files, rasters, warnings, plate } otherwise (plate: the Blender plate, or null).
 */
export function scanStage(stageDir) {
  if (!existsSync(path.join(stageDir, "index.html"))) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${path.join(stageDir, "index.html")} is missing; write the stage page first (references/stage.md)`);
  const files = listStage(stageDir);
  const warnings = [];
  const rasters = [];
  // A Blender plate and its preview stills are frames the runner wrote and plate.json lists by name
  // and size; they are not page rasters. Anything not listed is held to the raster limits.
  const plate = readPlate(stageDir, "plate");
  const preview = readPlate(stageDir, "plate-preview");
  const listed = new Set([plate, preview].filter(Boolean).flatMap((p) => p.frames.map((f) => path.join(p.dir, f.name))));
  for (const f of files) {
    const ext = path.extname(f.rel).toLowerCase();
    if (!CONTENT_TYPES[ext] && f.rel !== "scene.py") warnings.push(`${f.rel}: not a servable type; the page cannot load it`);
    if (RASTER.includes(ext) && !listed.has(f.rel)) {
      const info = rasterInfo(f.real);
      if (!info) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${f.rel} is not a readable ${ext.slice(1)} image`);
      if (info.animated) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${f.rel} is an animated image; rasters are textures and stills, never a frame sequence`);
      rasters.push({ ...f, ...info });
    }
    if (!TEXT.has(ext)) continue;
    const text = readFileSync(f.real, "utf8");
    const where = (m) => `${f.rel}:${text.slice(0, m.index).split("\n").length}`;
    for (const m of text.matchAll(ABSOLUTE_URL)) {
      if (NAMESPACES.test(m[0].replace(/[.,;]+$/u, ""))) continue;
      throw new BlockedError(EXIT.STAGE_NETWORK_REQUEST, `STAGE_NETWORK_REQUEST: ${where(m)} names ${m[0].slice(0, 120)}; everything on the stage is local`);
    }
    for (const re of PROTOCOL_RELATIVE) {
      const m = re.exec(text);
      re.lastIndex = 0;
      if (m) throw new BlockedError(EXIT.STAGE_NETWORK_REQUEST, `STAGE_NETWORK_REQUEST: ${where(m)} names a protocol-relative URL (${m[0].slice(0, 120)})`);
    }
    const hint = HINT_LINK.exec(text);
    if (hint) throw new BlockedError(EXIT.STAGE_NETWORK_REQUEST, `STAGE_NETWORK_REQUEST: ${where(hint)} has a ${hint[1]} link`);
    const net = NETWORK_API.exec(text);
    if (net) throw new BlockedError(EXIT.STAGE_NETWORK_REQUEST, `STAGE_NETWORK_REQUEST: ${where(net)} opens a ${net[1]}`);
    const el = FORBIDDEN_ELEMENT.exec(text) ?? FORBIDDEN_CREATE.exec(text);
    if (el) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${where(el)} uses <${el[1].toLowerCase()}>, which a stage page may not contain`);
    const api = FORBIDDEN_API.exec(text);
    if (api) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${where(api)} uses ${api[1] ?? "a service worker"}, which a stage page may not use`);
    if ((ext === ".js" || ext === ".mjs") && (f.bytes > 150 * 1024 || /@license\b|\/\*!/u.test(text))) warnings.push(`${f.rel} looks like a third-party library; the stage uses the kit and its own code`);
  }
  if (rasters.length > RASTER_LIMITS.count) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${rasters.length} raster images (at most ${RASTER_LIMITS.count})`);
  const total = rasters.reduce((s, r) => s + r.bytes, 0);
  if (total > RASTER_LIMITS.bytes) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${(total / 1048576).toFixed(1)} MB of rasters (at most 8 MB)`);
  const bySize = new Map();
  for (const r of rasters) bySize.set(`${r.width}x${r.height}`, [...(bySize.get(`${r.width}x${r.height}`) ?? []), r.rel]);
  for (const [size, names] of bySize) {
    if (names.length >= RASTER_LIMITS.flipbook) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${names.length} rasters of ${size} look like a flipbook; animate the page, not a frame sequence`);
  }
  return { files, rasters, warnings, plate };
}

/**
 * The request router for one stage run. Returns { kind: "file", file, type } | { kind: "body", body,
 * type } | { kind: "blocked", reason } | { kind: "missing" }, and records every refusal.
 */
export function stageRouter({ stageDir, faces, style = null }) {
  const root = realpathSync(stageDir);
  const css = fontsCss(faces);
  const byRoute = new Map(faces.map((f) => [f.route, f.file]));
  const refused = [];
  const missing = [];
  const route = (url) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      refused.push({ url, reason: "unparsable URL" });
      return { kind: "blocked" };
    }
    if (parsed.origin !== STAGE_ORIGIN) {
      refused.push({ url, reason: "outside the stage origin" });
      return { kind: "blocked" };
    }
    const pathname = decodeURIComponent(parsed.pathname);
    // Chrome asks for a favicon on its own; the page did not, so it is not a missing file of the page.
    if (pathname === "/favicon.ico") return { kind: "missing" };
    if (pathname === "/lit/stage-kit.js") return { kind: "file", file: KIT_FILE, type: CONTENT_TYPES[".js"] };
    if (pathname === "/lit/loop-kit.js") return { kind: "file", file: LOOP_KIT_FILE, type: CONTENT_TYPES[".js"] };
    if (pathname === "/lit/fonts.css") return { kind: "body", body: css, type: CONTENT_TYPES[".css"] };
    if (pathname.startsWith("/lit/three/")) {
      const rel = pathname.slice("/lit/three/".length);
      const file = path.join(THREE_DIR, rel);
      if (rel.split("/").includes("..") || !rel.endsWith(".js") || !existsSync(file)) {
        missing.push({ url, reason: "not a vendored three.js file" });
        return { kind: "missing" };
      }
      return { kind: "file", file, type: CONTENT_TYPES[".js"] };
    }
    // The film's house style (references/studio.md): type, colour and zone tokens, and the shot timeline.
    if (style && pathname === "/lit/style.css") return { kind: "body", body: style.css, type: CONTENT_TYPES[".css"] };
    if (style && pathname === "/lit/style.js") return { kind: "body", body: style.js, type: CONTENT_TYPES[".js"] };
    if (byRoute.has(pathname)) return { kind: "file", file: byRoute.get(pathname), type: CONTENT_TYPES[path.extname(pathname)] };
    const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/u, "");
    if (rel.split("/").includes("..")) {
      missing.push({ url, reason: "path traversal" });
      return { kind: "missing" };
    }
    const target = path.join(stageDir, rel);
    let real;
    try {
      real = realpathSync(target);
    } catch {
      missing.push({ url, reason: "not found" });
      return { kind: "missing" };
    }
    if (!inside(root, real)) {
      missing.push({ url, reason: "resolves outside the stage dir" });
      return { kind: "missing" };
    }
    const type = CONTENT_TYPES[path.extname(real).toLowerCase()];
    if (!type || !statSync(real).isFile()) {
      missing.push({ url, reason: "not a servable file" });
      return { kind: "missing" };
    }
    return { kind: "file", file: real, type };
  };
  return { route, refused, missing, css };
}
