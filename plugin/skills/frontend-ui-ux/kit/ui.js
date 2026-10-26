// frontend-ui-ux kit: behaviour that every build otherwise re-invents. No dependencies, no
// network. Colours come from the locked tokens (CSS custom properties), never from literals.
//   UI.bars(el, { labels, series: [{ name, values, role }], marker, unit, caption })
//   UI.lines(el, { labels, series: [{ name, values, role }], marker, unit, caption })
//   <table data-ui-sortable>  header <button class="ui-sort"> cells sort by data-value or text
//   <div role="tablist" data-ui-tabs>  arrow keys, Home and End move between tabs
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs = {}) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  };
  const roleColor = (role, index) => `var(--c-${role || `chart-${(index % 5) + 1}`})`;
  const niceMax = (value) => {
    if (value <= 0) return 1;
    const power = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 2.5, 5, 10].find((n) => n * power >= value / 4) * power;
    return Math.ceil(value / step) * step;
  };
  const fmt = (value, unit) => `${Number(value).toLocaleString()}${unit ?? ""}`;

  function frame(el, opts, maxValue) {
    el.classList.add("ui-chart");
    el.replaceChildren();
    const width = Math.max(280, Math.round(el.getBoundingClientRect().width) || 640);
    const height = opts.height ?? (width < 480 ? 200 : 240);
    const pad = { top: 16, right: 8, bottom: 28, left: 36 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, width, height, role: "img", "aria-label": opts.caption ?? "Chart" });
    // Whole-number data keeps whole-number ticks: round the top up to a multiple of the four steps.
    const top = opts.integer ? Math.max(4, Math.ceil(niceMax(maxValue) / 4) * 4) : niceMax(maxValue);
    const axis = svg("g", { class: "ui-axis" });
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + plotH - (plotH * i) / 4;
      root.append(svg("line", { class: i === 0 ? "ui-baseline" : "ui-grid-line", x1: pad.left, x2: width - pad.right, y1: y, y2: y }));
      const label = svg("text", { x: pad.left - 8, y: y + 4, "text-anchor": "end" });
      label.textContent = fmt((top * i) / 4, "");
      axis.append(label);
    }
    root.append(axis);
    return { root, axis, width, height, pad, plotW, plotH, top };
  }

  function legendAndTable(el, opts) {
    if (opts.series.length > 1) {
      const legend = document.createElement("div");
      legend.className = "ui-legend";
      opts.series.forEach((series, index) => {
        const item = document.createElement("span");
        const swatch = document.createElement("i");
        swatch.style.setProperty("--swatch", roleColor(series.role, index));
        item.append(swatch, document.createTextNode(series.name));
        legend.append(item);
      });
      el.prepend(legend);
    }
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.className = "ui-meta";
    summary.textContent = opts.tableLabel ?? "Show as table";
    const table = document.createElement("table");
    table.className = "ui-table ui-table--compact";
    const head = document.createElement("tr");
    for (const text of [opts.indexLabel ?? "", ...opts.series.map((s) => s.name)]) {
      const th = document.createElement("th");
      th.textContent = text;
      head.append(th);
    }
    const thead = document.createElement("thead");
    thead.append(head);
    const tbody = document.createElement("tbody");
    opts.labels.forEach((label, row) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = label;
      tr.append(th);
      for (const series of opts.series) {
        const td = document.createElement("td");
        td.className = "is-num";
        td.textContent = fmt(series.values[row], opts.unit);
        tr.append(td);
      }
      tbody.append(tr);
    });
    table.append(thead, tbody);
    details.append(summary, table);
    el.append(details);
  }

  function xLabels(f, labels, step) {
    const every = Math.max(1, Math.ceil(labels.length / (f.plotW / 44)));
    labels.forEach((label, index) => {
      if (index % every) return;
      const text = svg("text", { x: f.pad.left + step * index + (step / 2) * (f.bandCenter ? 1 : 0), y: f.height - 8, "text-anchor": "middle" });
      text.textContent = label;
      f.axis.append(text);
    });
  }

  function marker(f, opts, x) {
    if (!opts.marker) return;
    f.root.append(svg("line", { class: "ui-marker", x1: x, x2: x, y1: f.pad.top - 4, y2: f.pad.top + f.plotH }));
    const text = svg("text", { class: "ui-marker-label", x: x + 4, y: f.pad.top + 6 });
    text.textContent = opts.marker.label;
    f.root.append(text);
  }

  const drawn = new Map();
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { for (const [el, draw] of drawn) draw(); }, 150);
  });
  const remember = (el, draw) => { drawn.set(el, draw); draw(); };

  function bars(el, opts) { remember(el, () => drawBars(el, opts)); }
  function lines(el, opts) { remember(el, () => drawLines(el, opts)); }

  function drawBars(el, opts) {
    const stacked = Boolean(opts.stacked);
    const totals = opts.labels.map((_, i) => opts.series.reduce((sum, s) => sum + (stacked ? s.values[i] : 0), 0));
    const max = stacked ? Math.max(...totals) : Math.max(...opts.series.flatMap((s) => s.values));
    const f = frame(el, { ...opts, integer: opts.series.every((s) => s.values.every(Number.isInteger)) }, max);
    f.bandCenter = true;
    const step = f.plotW / opts.labels.length;
    const groupW = step * 0.64;
    const barW = stacked ? groupW : groupW / opts.series.length;
    opts.labels.forEach((label, i) => {
      let base = 0;
      opts.series.forEach((series, s) => {
        const value = series.values[i];
        const h = (value / f.top) * f.plotH;
        const x = f.pad.left + step * i + (step - groupW) / 2 + (stacked ? 0 : barW * s);
        const y = f.pad.top + f.plotH - h - (stacked ? (base / f.top) * f.plotH : 0);
        const rect = svg("rect", { x, y, width: Math.max(1, barW - (stacked ? 0 : 2)), height: Math.max(0, h), rx: 2, style: `fill: ${roleColor(series.role, s)}` });
        const title = svg("title");
        title.textContent = `${label}: ${series.name} ${fmt(value, opts.unit)}`;
        rect.append(title);
        f.root.append(rect);
        base += stacked ? value : 0;
      });
    });
    xLabels(f, opts.labels, step);
    if (opts.marker) marker(f, opts, f.pad.left + step * opts.marker.index + step / 2);
    el.append(f.root);
    legendAndTable(el, opts);
  }

  function drawLines(el, opts) {
    const max = Math.max(...opts.series.flatMap((s) => s.values));
    const f = frame(el, { ...opts, integer: opts.series.every((s) => s.values.every(Number.isInteger)) }, max);
    const step = f.plotW / Math.max(1, opts.labels.length - 1);
    opts.series.forEach((series, s) => {
      const points = series.values.map((value, i) => `${f.pad.left + step * i},${f.pad.top + f.plotH - (value / f.top) * f.plotH}`);
      f.root.append(svg("polyline", { points: points.join(" "), style: `fill: none; stroke: ${roleColor(series.role, s)}`, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    });
    f.bandCenter = false;
    xLabels(f, opts.labels, step);
    if (opts.marker) marker(f, opts, f.pad.left + step * opts.marker.index);
    el.append(f.root);
    legendAndTable(el, opts);
  }

  function sortable(table) {
    const tbody = table.tBodies[0];
    table.querySelectorAll("thead th .ui-sort").forEach((button) => {
      button.type = "button";
      button.addEventListener("click", () => {
        const th = button.closest("th");
        const index = [...th.parentElement.children].indexOf(th);
        const next = th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
        table.querySelectorAll("thead th[aria-sort]").forEach((cell) => cell.removeAttribute("aria-sort"));
        th.setAttribute("aria-sort", next);
        const key = (row) => {
          const cell = row.children[index];
          const raw = cell?.dataset.value ?? cell?.textContent.trim() ?? "";
          const number = Number(raw);
          return raw !== "" && !Number.isNaN(number) ? number : raw.toLocaleLowerCase();
        };
        const rows = [...tbody.rows].sort((a, b) => {
          const x = key(a);
          const y = key(b);
          const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
          return next === "ascending" ? order : -order;
        });
        tbody.append(...rows);
        table.dispatchEvent(new CustomEvent("ui:sorted", { detail: { index, order: next } }));
      });
    });
  }

  function tabs(list) {
    const items = [...list.querySelectorAll('[role="tab"]')];
    const select = (tab) => {
      for (const item of items) {
        const on = item === tab;
        item.setAttribute("aria-selected", String(on));
        item.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(item.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      }
    };
    items.forEach((tab, index) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (event) => {
        const move = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: items.length - 1 - index }[event.key];
        if (move === undefined) return;
        event.preventDefault();
        const next = items[(index + move + items.length) % items.length];
        next.focus();
        select(next);
      });
    });
    select(items.find((tab) => tab.getAttribute("aria-selected") === "true") ?? items[0]);
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("table[data-ui-sortable]").forEach(sortable);
    document.querySelectorAll("[data-ui-tabs]").forEach(tabs);
  });
  window.UI = { bars, lines, sortable, tabs };
})();
