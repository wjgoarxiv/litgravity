// Plane geometry shared by the router, the label placer and the QA gate.
// Boxes are [x0, y0, x1, y1] with x0 <= x1 and y0 <= y1; points are [x, y].

export const EPS = 1e-6;

export const boxOf = (points) => {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
export const grow = ([x0, y0, x1, y1], by) => [x0 - by, y0 - by, x1 + by, y1 + by];
export const union = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
export const area = ([x0, y0, x1, y1]) => Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
export const boxesOverlap = (a, b, by = 0) => a[0] < b[2] - by && a[2] > b[0] + by && a[1] < b[3] - by && a[3] > b[1] + by;
export const overlapArea = (a, b) => area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);
export const contains = (outer, inner, by = 0) =>
  inner[0] >= outer[0] - by && inner[1] >= outer[1] - by && inner[2] <= outer[2] + by && inner[3] <= outer[3] + by;
export const pointIn = ([x, y], [x0, y0, x1, y1], by = 0) => x > x0 + by && x < x1 - by && y > y0 + by && y < y1 - by;
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function pointSegmentDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const span = dx * dx + dy * dy;
  const t = span > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / span)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

// Proper intersection point of two segments, or null. Touching at endpoints counts only when
// `touch` is true; collinear overlaps are reported separately by `collinearOverlap`.
export function segmentIntersection(a, b, c, d, touch = false) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const denom = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(denom) < EPS) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / denom;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / denom;
  const lo = touch ? -EPS : 1e-4;
  const hi = touch ? 1 + EPS : 1 - 1e-4;
  if (t < lo || t > hi || u < lo || u > hi) return null;
  return { point: [a[0] + t * r[0], a[1] + t * r[1]], t, u };
}

export function collinearOverlap(a, b, c, d, tolerance = 0.05) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const length = Math.hypot(r[0], r[1]);
  if (length < EPS) return 0;
  const cross = (p) => Math.abs((p[0] - a[0]) * r[1] - (p[1] - a[1]) * r[0]) / length;
  if (cross(c) > tolerance || cross(d) > tolerance) return 0;
  const along = (p) => ((p[0] - a[0]) * r[0] + (p[1] - a[1]) * r[1]) / length;
  const lo = Math.max(0, Math.min(along(c), along(d)));
  const hi = Math.min(length, Math.max(along(c), along(d)));
  return Math.max(0, hi - lo);
}

// Length of a segment that lies strictly inside a box (Liang–Barsky clip).
export function insideLength(a, b, [x0, y0, x1, y1]) {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
    if (Math.abs(p) < EPS) {
      if (q <= 0) return 0;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  }
  return t1 > t0 ? (t1 - t0) * Math.hypot(dx, dy) : 0;
}

export const segmentsOf = (points) => points.slice(1).map((point, index) => [points[index], point]);

export function pathLength(points) {
  return segmentsOf(points).reduce((sum, [a, b]) => sum + dist(a, b), 0);
}

export function pointAlong(points, at) {
  let left = at;
  for (const [a, b] of segmentsOf(points)) {
    const length = dist(a, b);
    if (left <= length) {
      const t = length ? left / length : 0;
      return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], direction: length ? [(b[0] - a[0]) / length, (b[1] - a[1]) / length] : [1, 0] };
    }
    left -= length;
  }
  const [a, b] = segmentsOf(points).at(-1);
  const length = dist(a, b) || 1;
  return { point: b, direction: [(b[0] - a[0]) / length, (b[1] - a[1]) / length] };
}

// Removes repeated points and merges collinear runs, keeping the polyline's corners only.
export function simplify(points) {
  const out = [];
  for (const point of points) {
    const last = out.at(-1);
    if (last && dist(last, point) < EPS) continue;
    if (out.length >= 2) {
      const prev = out.at(-2);
      const cross = (last[0] - prev[0]) * (point[1] - last[1]) - (last[1] - prev[1]) * (point[0] - last[0]);
      const dot = (last[0] - prev[0]) * (point[0] - last[0]) + (last[1] - prev[1]) * (point[1] - last[1]);
      if (Math.abs(cross) < EPS && dot > 0) {
        out[out.length - 1] = point;
        continue;
      }
    }
    out.push(point);
  }
  return out;
}
