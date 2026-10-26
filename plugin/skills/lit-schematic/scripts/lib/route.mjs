// Orthogonal line routing for P&IDs, PFDs and 2D apparatus panels.
//
// Drafting rules it encodes: a line leaves its port straight out along the port's normal
// before it turns; it never enters a symbol other than at its own ports; it turns as little
// as possible; it may cross another line only at a right angle on a straight run, never turn
// on top of another line and never run along one. A failed search throws instead of drawing
// through a symbol, so the caller moves a symbol or gives waypoints.

import { EPS, dist, pointIn, simplify } from "./geom.mjs";

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const dirIndex = ([dx, dy]) => DIRS.findIndex(([x, y]) => Math.abs(x - dx) < EPS && Math.abs(y - dy) < EPS);

class Heap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (less(items[parent], items[i])) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && less(items[l], items[m])) m = l;
        if (r < items.length && less(items[r], items[m])) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    }
    return top;
  }
}
const less = (a, b) => (a.f !== b.f ? a.f < b.f : a.seq < b.seq);

function axisValues(lo, hi, step, extra) {
  const values = new Set();
  const first = Math.ceil(lo / step) * step;
  for (let v = first; v <= hi + EPS; v += step) values.add(Math.round(v * 1000) / 1000);
  for (const v of extra) if (v >= lo - EPS && v <= hi + EPS) values.add(Math.round(v * 1000) / 1000);
  return [...values].sort((a, b) => a - b);
}

// Existing lines as axis-aligned runs, so a candidate move can be classified as a clean
// crossing, an overlap or a turn on a line.
function occupancy(lines) {
  const horizontal = [];
  const vertical = [];
  for (const points of lines) {
    for (let i = 1; i < points.length; i++) {
      const [a, b] = [points[i - 1], points[i]];
      if (Math.abs(a[1] - b[1]) < EPS) horizontal.push({ y: a[1], x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]) });
      else if (Math.abs(a[0] - b[0]) < EPS) vertical.push({ x: a[0], y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) });
    }
  }
  return {
    onHorizontal: ([x, y], margin = 0) => horizontal.some((s) => Math.abs(s.y - y) < margin + EPS && x >= s.x0 - EPS && x <= s.x1 + EPS),
    onVertical: ([x, y], margin = 0) => vertical.some((s) => Math.abs(s.x - x) < margin + EPS && y >= s.y0 - EPS && y <= s.y1 + EPS),
  };
}

export function routeOrthogonal({
  from,
  to,
  obstacles = [],
  lines = [],
  bounds,
  grid = 2.5,
  clearance = 2,
  stub = 5,
  bendCost = 9,
  crossCost = 4,
  nearCost = 3,
  exempt = [],
}) {
  if (!bounds) throw new Error("routeOrthogonal: bounds are required");
  const startDir = dirIndex(from.dir ?? [1, 0]);
  const endDir = dirIndex(to.dir ?? [-1, 0]);
  if (startDir < 0 || endDir < 0) throw new Error("routeOrthogonal: port directions must be axis-aligned unit vectors");
  const inflated = obstacles.map((box) => [box[0] - clearance, box[1] - clearance, box[2] + clearance, box[3] + clearance]);
  const blockedPoint = (p) => inflated.some((box) => pointIn(p, box, EPS));
  // The stub runs out along the port normal until it clears every symbol's clearance zone,
  // its own included: a nozzle on a curved head sits inside its vessel's bounding box.
  const stubEnd = (port, d, label) => {
    for (let k = stub; k <= stub + 80; k += 0.5) {
      const p = [port.x + DIRS[d][0] * k, port.y + DIRS[d][1] * k];
      if (!blockedPoint(p)) return p;
    }
    throw new Error(`routeOrthogonal: the ${label} port at (${port.x}, ${port.y}) faces into another symbol; turn the port or move the symbol`);
  };
  // Two ports that face each other on one axis with nothing between them join straight.
  if ((startDir + 2) % 4 === endDir) {
    const along = [to.x - from.x, to.y - from.y];
    const straight = DIRS[startDir][0] === 0 ? Math.abs(along[0]) < EPS : Math.abs(along[1]) < EPS;
    const ahead = along[0] * DIRS[startDir][0] + along[1] * DIRS[startDir][1] > 0;
    if (straight && ahead) {
      let clear = true;
      const length = Math.hypot(along[0], along[1]);
      for (let k = 0.5; k < length - 0.5 && clear; k += 0.5) {
        const p = [from.x + DIRS[startDir][0] * k, from.y + DIRS[startDir][1] * k];
        if (obstacles.some((box) => !exempt.includes(box) && pointIn(p, box, EPS))) clear = false;
      }
      if (clear) return [[from.x, from.y], [to.x, to.y]];
    }
  }
  const s = stubEnd(from, startDir, "start");
  const t = stubEnd(to, endDir, "end");
  const xs = axisValues(bounds[0], bounds[2], grid, [s[0], t[0], from.x, to.x]);
  const ys = axisValues(bounds[1], bounds[3], grid, [s[1], t[1], from.y, to.y]);
  const xi = new Map(xs.map((v, i) => [v, i]));
  const yi = new Map(ys.map((v, i) => [v, i]));
  const key = (ix, iy) => iy * xs.length + ix;
  const occ = occupancy(lines);
  const sx = xi.get(Math.round(s[0] * 1000) / 1000);
  const sy = yi.get(Math.round(s[1] * 1000) / 1000);
  const tx = xi.get(Math.round(t[0] * 1000) / 1000);
  const ty = yi.get(Math.round(t[1] * 1000) / 1000);
  const arrive = (endDir + 2) % 4;
  const heap = new Heap();
  const best = new Map();
  const came = new Map();
  let seq = 0;
  const h = (ix, iy) => Math.abs(xs[ix] - t[0]) + Math.abs(ys[iy] - t[1]);
  heap.push({ ix: sx, iy: sy, d: startDir, g: 0, f: h(sx, sy), seq: seq++ });
  best.set(`${key(sx, sy)}:${startDir}`, 0);
  let goal = null;
  while (heap.size) {
    const cur = heap.pop();
    const stateKey = `${key(cur.ix, cur.iy)}:${cur.d}`;
    if (cur.g > (best.get(stateKey) ?? Infinity) + EPS) continue;
    if (cur.ix === tx && cur.iy === ty) {
      const finalCost = cur.g + (cur.d === arrive ? 0 : bendCost);
      if (!goal || finalCost < goal.cost) goal = { state: stateKey, cost: finalCost };
      if (cur.d === arrive) break;
      continue;
    }
    const here = [xs[cur.ix], ys[cur.iy]];
    for (let d = 0; d < 4; d++) {
      if (d === (cur.d + 2) % 4) continue;
      const nx = cur.ix + DIRS[d][0];
      const ny = cur.iy + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue;
      const next = [xs[nx], ys[ny]];
      const mid = [(here[0] + next[0]) / 2, (here[1] + next[1]) / 2];
      if (blockedPoint(next) || blockedPoint(mid)) continue;
      const horizontalMove = d % 2 === 0;
      // Running along an existing line, or turning on top of one, is never allowed.
      if (horizontalMove ? occ.onHorizontal(mid) : occ.onVertical(mid)) continue;
      const turning = d !== cur.d;
      const isEndpoint = (cur.ix === sx && cur.iy === sy);
      if (turning && !isEndpoint && (occ.onHorizontal(here) || occ.onVertical(here))) continue;
      let step = dist(here, next);
      if (horizontalMove ? occ.onVertical(next) : occ.onHorizontal(next)) {
        const atGoal = nx === tx && ny === ty;
        if (atGoal) continue;
        step += crossCost;
      }
      if (horizontalMove ? occ.onHorizontal(mid, grid * 0.99) : occ.onVertical(mid, grid * 0.99)) step += nearCost;
      const g = cur.g + step + (turning ? bendCost : 0);
      const nextKey = `${key(nx, ny)}:${d}`;
      if (g + EPS < (best.get(nextKey) ?? Infinity)) {
        best.set(nextKey, g);
        came.set(nextKey, stateKey);
        heap.push({ ix: nx, iy: ny, d, g, f: g + h(nx, ny), seq: seq++ });
      }
    }
  }
  if (!goal) {
    throw new Error(`routeOrthogonal: no clear route from (${from.x}, ${from.y}) to (${to.x}, ${to.y}); move a symbol, widen the gap, or pass waypoints`);
  }
  const cells = [];
  for (let k = goal.state; k; k = came.get(k)) {
    const index = Number(k.split(":")[0]);
    cells.push([xs[index % xs.length], ys[Math.floor(index / xs.length)]]);
    if (!came.has(k)) break;
  }
  cells.reverse();
  return simplify([[from.x, from.y], ...cells, [to.x, to.y]]);
}

// Checks a hand-given polyline: every leg axis-aligned and the first and last legs on the
// port normals. Returns the simplified corners.
export function orthogonal(points, { from, to } = {}) {
  const out = simplify(points);
  for (let i = 1; i < out.length; i++) {
    const [a, b] = [out[i - 1], out[i]];
    if (Math.abs(a[0] - b[0]) > EPS && Math.abs(a[1] - b[1]) > EPS) {
      throw new Error(`orthogonal: leg ${i} from (${a}) to (${b}) is diagonal; P&ID lines run horizontally or vertically`);
    }
  }
  const check = (port, a, b, label) => {
    if (!port?.dir) return;
    const d = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
    if (d[0] !== Math.sign(port.dir[0]) || d[1] !== Math.sign(port.dir[1])) {
      throw new Error(`orthogonal: the ${label} leg must leave its port along the port's normal`);
    }
  };
  if (out.length >= 2) {
    check(from, out[0], out[1], "first");
    check(to, out.at(-1), out.at(-2), "last");
  }
  return out;
}
