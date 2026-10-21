// swiss-grid (MO-SH-10): layout arithmetic plus a batch of GPU hairline rules. It carries no seed.
// Scenes place type on its columns and baseline; the pass draws the rules that make the grid
// visible (a top rule, a bottom rule and column ticks) through one instanced LineBatch draw, which
// is what the render log counts. Full column guides draw only when showGuides is on, which is a
// debug aid and a gate FAIL in any export.
import { hexToLinear } from "../../core/util.mjs";
import { LineBatch } from "../lines.mjs";
import { W, H } from "../scale.mjs";

export class SwissGrid {
  constructor(glw, { params, palette }) {
    this.id = "swiss-grid";
    this.category = "layout";
    this.params = { ...params };
    this.lines = new LineBatch(glw, 128);
    this.ruleColor = hexToLinear(palette.dim ?? palette.type);
    const { columns, gutterPx, marginPx } = this.params;
    this.colWidth = (W - 2 * marginPx - (columns - 1) * gutterPx) / columns;
  }
  /** Left x of column `i` (0-based). */
  col(i) {
    const { gutterPx, marginPx } = this.params;
    return marginPx + i * (this.colWidth + gutterPx);
  }
  /** Width spanned by columns a..b inclusive. */
  span(a, b) {
    return this.col(b) + this.colWidth - this.col(a);
  }
  /** Snap a y to the baseline grid (moduleSnap). */
  baseline(y) {
    return this.params.moduleSnap ? Math.round(y / this.params.baselinePx) * this.params.baselinePx : y;
  }
  shotState() {
    return { seed: null };
  }
  draw(target, f, record) {
    const { marginPx, columns, hairlineWidthPx, showGuides } = this.params;
    const top = 72;
    const bottom = H - 72;
    const l = this.lines;
    l.clear();
    const alpha = 0.55;
    const drawn = Math.min(1, f.lt / 0.3);
    l.segment(marginPx, top, marginPx + (W - 2 * marginPx) * drawn, top, hairlineWidthPx, this.ruleColor, alpha);
    l.segment(W - marginPx - (W - 2 * marginPx) * drawn, bottom, W - marginPx, bottom, hairlineWidthPx, this.ruleColor, alpha);
    for (let i = 0; i <= columns; i++) {
      const x = i === columns ? W - marginPx : this.col(i);
      l.segment(x, top - 8, x, top, hairlineWidthPx, this.ruleColor, alpha);
    }
    if (showGuides) for (let i = 0; i < columns; i++) l.segment(this.col(i), top, this.col(i), bottom, 1, this.ruleColor, 0.25);
    l.draw(target, { pass: this.id });
    if (record) {
      record.elements.push({ elementId: "swiss-grid/top-rule", kind: "rule", bbox: [marginPx, top - 8, W - marginPx, top + 1] });
      record.elements.push({ elementId: "swiss-grid/bottom-rule", kind: "rule", bbox: [marginPx, bottom - 1, W - marginPx, bottom + 1] });
    }
  }
  manifestParams() {
    const { columns, gutterPx, marginPx, baselinePx, showGuides } = this.params;
    return { columns, gutterPx, marginPx, baselinePx, showGuides };
  }
}
