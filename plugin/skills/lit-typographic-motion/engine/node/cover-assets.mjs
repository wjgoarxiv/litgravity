// Cover assets: every raster a cover page loads (base art, logo, wordmark, texture) is listed in
// `<out>/assets.json` with its path, role, source (user or generated) and SHA-256, and the renderer
// checks the list before any capture. A listed file that is missing is BLOCKED_ASSET_MISSING
// (exit 22): the art is supplied or generated, never replaced by a drawn stand-in. The painted-light
// recipe needs its base art listed. After the render, frame 0 must show that art: the SSIM of its
// check box in the decoded frame 0 against the source scaled into the art box.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { COVER, EXIT } from "../core/constants.mjs";
import { BlockedError } from "./chrome.mjs";
import { crop, lanczosResize, ssim } from "./cover-image.mjs";

export const ASSETS_FILE = "assets.json";
export const ASSET_ROLES = Object.freeze(["base-art", "logo", "wordmark", "texture"]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const invalid = (field, message) => new BlockedError(EXIT.BLOCKED_TREATMENT_INVALID, `BLOCKED_TREATMENT_INVALID: assets.json: ${field}: ${message}`);
const isBox = (b) => Array.isArray(b) && b.length === 4 && b.every((v) => typeof v === "number" && v >= 0 && v <= 1) && b[2] > 0 && b[3] > 0 && b[0] + b[2] <= 1 + 1e-9 && b[1] + b[3] <= 1 + 1e-9;

/**
 * Check `<out>/assets.json` against the cover folder before capture. `rasters` are the static scan's
 * rasters (paths relative to the cover folder). Returns { assets } (empty when there is no list and
 * the recipe needs none). Exit 22 for a missing listed file or a painted recipe without base art,
 * exit 17 for an unlisted raster or a file that no longer matches its hash, exit 16 for a bad entry.
 */
export function checkAssets({ out, treatment, rasters, coverDir = "cover" }) {
  const file = path.join(out, ASSETS_FILE);
  const needsArt = treatment.recipe === "painted-light";
  const blockedArt = new BlockedError(EXIT.BLOCKED_ASSET_MISSING, "BLOCKED_ASSET_MISSING: the painted-light recipe needs its base art listed in assets.json ({ path, role: base-art, source: user or generated, sha256, box }); supply or generate the art, never draw a stand-in");
  let assets = [];
  if (existsSync(file)) {
    let doc;
    try {
      doc = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      throw invalid("assets.json", `not valid JSON (${error.message})`);
    }
    if (!doc || !Array.isArray(doc.assets)) throw invalid("assets", "must be an array of { path, role, source, sha256 }");
    assets = doc.assets.map((a, i) => {
      const f = `assets[${i}]`;
      if (!a || typeof a !== "object") throw invalid(f, "must be an object");
      if (typeof a.path !== "string" || !a.path.startsWith(`${coverDir}/`) || a.path.split("/").includes("..")) throw invalid(`${f}.path`, `must be a path inside ${coverDir}/, relative to the output directory`);
      if (!ASSET_ROLES.includes(a.role)) throw invalid(`${f}.role`, `must be one of ${ASSET_ROLES.join(", ")}`);
      if (!["user", "generated"].includes(a.source)) throw invalid(`${f}.source`, "must be user (supplied) or generated");
      if (!/^[0-9a-f]{64}$/u.test(a.sha256 ?? "")) throw invalid(`${f}.sha256`, "must be the file's SHA-256 (64 hex)");
      if ("box" in a && !isBox(a.box)) throw invalid(`${f}.box`, "must be [x, y, w, h], fractions of the cover, inside it");
      if ("checkBox" in a) {
        if (!isBox(a.checkBox)) throw invalid(`${f}.checkBox`, "must be [x, y, w, h], fractions of the cover, inside it");
        if (!a.box) throw invalid(`${f}.checkBox`, "needs the art's box");
        const [bx, by, bw, bh] = a.box;
        const [cx, cy, cw, ch] = a.checkBox;
        if (cx < bx - 1e-9 || cy < by - 1e-9 || cx + cw > bx + bw + 1e-9 || cy + ch > by + bh + 1e-9) throw invalid(`${f}.checkBox`, "must lie inside the art's box");
        if (cw * ch < COVER.artMinShare * bw * bh) throw invalid(`${f}.checkBox`, `must cover at least ${COVER.artMinShare * 100} % of the art's box`);
      }
      if (a.role === "base-art" && !a.box) throw invalid(`${f}.box`, "base art needs the box it fills on the cover");
      return { path: a.path, role: a.role, source: a.source, sha256: a.sha256, box: a.box ?? null, checkBox: a.checkBox ?? null, title: a.title === true };
    });
    for (const a of assets) {
      const real = path.join(out, a.path);
      if (!existsSync(real)) throw new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: ${a.path} is listed in assets.json and missing; supply it, never draw a stand-in`);
      if (sha256(readFileSync(real)) !== a.sha256) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${a.path} does not match its sha256 in assets.json; list it again after changing it`);
    }
  }
  if (needsArt && !assets.some((a) => a.role === "base-art")) throw blockedArt;
  const listed = new Set(assets.map((a) => a.path));
  for (const r of rasters) {
    const rel = `${coverDir}/${r.rel.split(path.sep).join("/")}`;
    if (!listed.has(rel)) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${rel} is a raster the page can load but assets.json does not list; list it with its role, source and sha256`);
  }
  return { assets };
}

const px = (box, W, H) => box.map((v, k) => Math.round(v * (k % 2 ? H : W)));

/**
 * Frame 0 shows the base art: crop the check box (default: the art box) out of decoded frame 0 and
 * compare it with the same region of the source scaled into the art box. `art` is { rgba, width,
 * height }; boxes are fractions of the cover.
 */
export function artCheck({ frame0, width, height, art, box, checkBox = null }) {
  const [bx, by, bw, bh] = px(box, width, height);
  const scaled = lanczosResize(art.rgba, art.width, art.height, bw, bh);
  const [cx, cy, cw, ch] = px(checkBox ?? box, width, height);
  const a = crop(frame0, width, [cx, cy, cw, ch]);
  const b = crop(scaled, bw, [cx - bx, cy - by, cw, ch]);
  const value = ssim(a, b, cw, ch);
  return { ssim: value, pass: value >= COVER.artSsim, box: [bx, by, bw, bh], checked: [cx, cy, cw, ch] };
}

/** The reply labels a generated asset needs (the Stop hook's finished-cover notice carries them). */
export function generatedLabels(out) {
  const file = path.join(out, ASSETS_FILE);
  if (!existsSync(file)) return [];
  try {
    const doc = JSON.parse(readFileSync(file, "utf8"));
    return (doc.assets ?? []).filter((a) => a?.source === "generated" && typeof a.path === "string")
      .map((a) => `the ${String(a.role ?? "asset").replace("-", " ")} ${a.path} is generated, not supplied: label it as generated in the reply`);
  } catch {
    return [];
  }
}
