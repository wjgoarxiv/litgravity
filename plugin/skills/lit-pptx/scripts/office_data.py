#!/usr/bin/env python3
"""Data-driven numbers for lit-pptx decks and lit-docx documents.

A deck or report that quotes the same figures on several pages drifts: a total on one
slide stops matching its parts on another, a ratio is rounded by hand. This module keeps
the numbers in one small data file next to the Markdown source, computes every derived
value (ratios, totals, growth) from it, checks the relations the author declares, and
writes the formatted numbers into the Markdown before it is compiled.

Frontmatter key (one path or a comma-separated list, relative to the Markdown file):

    data: numbers.json

A CSV file becomes a table named after its stem (first row = headers, first column =
row keys). A JSON file may hold:

    {
      "values": {"revenue": 1262, "op_income": 124, "op_margin": "=op_income / revenue * 100"},
      "tables": {
        "quarterly": {"csv": "quarterly.csv", "derive": {"이익률": "=영업이익 / 매출 * 100"},
                      "total": "합계", "format": {"이익률": ".1f"}},
        "segments": {"columns": ["부문", "매출"], "rows": [["클라우드", 900], ["라이선스", 362]]}
      },
      "checks": ["sum(segments.매출) == revenue", "quarterly.매출['3Q26'] == revenue"]
    }

Expressions start with "=" in "values" and "derive"; "checks" are plain expressions. They
allow numbers, + - * / ** %, parentheses, comparisons, and/or/not, value names,
`table.column` (a list, total row excluded), `table.column['row key']` (one cell),
`table['column name']` for a column whose name is not an identifier, and the functions
sum, avg, min, max, abs, round, len, growth(new, old) = (new / old - 1) * 100,
share(part, whole) = part / whole * 100, approx(a, b, tol). Inside "derive", bare names
are the same row's columns and row['column name'] reaches any column. `==` compares with
a floating-point tolerance. Nothing else is evaluated.

Markdown placeholders, resolved before compiling:

    {{ revenue }}                    1,262        (integers get thousands separators)
    {{ op_margin | .1f }}            9.8          (any Python format spec)
    {{ growth(revenue, 1022) | +.1f }}%   +23.5%
    {{ table:quarterly }}            the whole table as a Markdown pipe table (derived
                                     columns and the total row included)
    {{ table:quarterly | columns=매출,영업이익 no-total }}
                                     the chart-ready form inside a `::: chart` block

compile-deck.js and convert_md_to_docx.py resolve a source with a `data:` key on their
own; this CLI shows the numbers and the check results:

    python3 office_data.py check deck.md          # JSON report; exit 1 on a failed check or a bad name
    python3 office_data.py resolve deck.md [-o resolved.md]

Standard library only, so it runs before the office runtime exists.
"""

from __future__ import annotations

import argparse
import ast
import csv
import json
import math
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # the installed plugin directory stays read-only

PLACEHOLDER = re.compile(r"\{\{\s*(.+?)\s*\}\}")
FRONTMATTER = re.compile(r"\A---[ \t]*\n(.*?)\n---[ \t]*(?:\n|\Z)", re.S)


class DataError(Exception):
    """A bad data file, an unknown name, a failed check or an unsafe expression."""


# ── Loading ────────────────────────────────────────────────────────────────────


def number(cell):
    """'1,262' → 1262, '9.8%' → 9.8, '−3' → -3; anything else stays text."""
    if isinstance(cell, bool) or cell is None:
        return cell
    if isinstance(cell, (int, float)):
        return cell
    text = str(cell).strip().replace(",", "").replace("−", "-").rstrip("%").strip()
    if re.fullmatch(r"[-+]?\d+(?:\.\d+)?", text):
        value = float(text)
        return int(value) if value.is_integer() and "." not in text else value
    return str(cell).strip()


class Table:
    def __init__(self, name: str, columns: list[str], rows: list[list], spec: dict | None = None):
        spec = spec or {}
        if not columns:
            raise DataError(f"table '{name}' has no columns")
        self.name = name
        self.columns = [str(c).strip() for c in columns]
        self.rows = [[number(c) for c in row] + [None] * (len(self.columns) - len(row)) for row in rows]
        self.derive = spec.get("derive") or {}
        self.total_label = spec.get("total")
        self.formats = spec.get("format") or {}
        self.total = None

    def column(self, name: str) -> list:
        if name not in self.columns:
            raise DataError(f"table '{self.name}' has no column '{name}' (columns: {', '.join(self.columns)})")
        i = self.columns.index(name)
        return [row[i] for row in self.rows]

    def cell(self, column: str, key) -> object:
        i = self.columns.index(column) if column in self.columns else self.column(column)
        for row in self.rows + ([self.total] if self.total else []):
            if str(row[0]) == str(key):
                return row[i]
        keys = ", ".join(str(r[0]) for r in self.rows + ([self.total] if self.total else []))
        raise DataError(f"table '{self.name}' has no row '{key}' (rows: {keys})")


def read_csv(path: Path) -> tuple[list[str], list[list]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = [row for row in csv.reader(handle) if any(cell.strip() for cell in row)]
    if not rows:
        raise DataError(f"{path.name} is empty")
    return rows[0], rows[1:]


def load_data(paths: list[Path]) -> tuple[dict, dict, list]:
    values: dict = {}
    tables: dict[str, Table] = {}
    checks: list = []
    for path in paths:
        if not path.is_file():
            raise DataError(f"data file not found: {path}")
        if path.suffix.lower() == ".csv":
            columns, rows = read_csv(path)
            tables[path.stem] = Table(path.stem, columns, rows)
            continue
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise DataError(f"{path.name}: invalid JSON ({exc})") from exc
        if not isinstance(doc, dict):
            raise DataError(f"{path.name}: the top level must be an object")
        values.update(doc.get("values") or {})
        for name, spec in (doc.get("tables") or {}).items():
            if isinstance(spec, str):
                spec = {"csv": spec}
            if spec.get("csv"):
                columns, rows = read_csv(path.parent / spec["csv"])
            else:
                columns, rows = spec.get("columns") or [], spec.get("rows") or []
            tables[name] = Table(name, columns, rows, spec)
        checks.extend(doc.get("checks") or [])
    return values, tables, checks


# ── Safe evaluation ────────────────────────────────────────────────────────────


def _close(a, b) -> bool:
    return math.isclose(float(a), float(b), rel_tol=1e-9, abs_tol=1e-9)


def _numbers(seq) -> list:
    out = [v for v in seq if isinstance(v, (int, float)) and not isinstance(v, bool)]
    if not out:
        raise DataError("no numbers to aggregate")
    return out


FUNCTIONS = {
    "sum": lambda seq: sum(_numbers(seq)),
    "avg": lambda seq: sum(_numbers(seq)) / len(_numbers(seq)),
    "min": lambda *a: min(_numbers(a[0]) if len(a) == 1 else a),
    "max": lambda *a: max(_numbers(a[0]) if len(a) == 1 else a),
    "abs": abs,
    "round": lambda x, n=0: round(x, int(n)),
    "len": lambda seq: len(seq),
    "growth": lambda new, old: (new / old - 1) * 100,
    "share": lambda part, whole: part / whole * 100,
    "approx": lambda a, b, tol=1e-6: abs(a - b) <= tol,
}

BINARY = {ast.Add: lambda a, b: a + b, ast.Sub: lambda a, b: a - b, ast.Mult: lambda a, b: a * b,
          ast.Div: lambda a, b: a / b, ast.Pow: lambda a, b: a ** b, ast.Mod: lambda a, b: a % b}
COMPARE = {ast.Eq: _close, ast.NotEq: lambda a, b: not _close(a, b), ast.Lt: lambda a, b: a < b,
           ast.LtE: lambda a, b: a < b or _close(a, b), ast.Gt: lambda a, b: a > b,
           ast.GtE: lambda a, b: a > b or _close(a, b)}


class ColumnRef(list):
    """A table column as a list that still knows its table, so `t.col['key']` finds a cell."""

    def __init__(self, table: Table, name: str):
        super().__init__(table.column(name))
        self.table, self.name = table, name


class Evaluator:
    def __init__(self, lookup):
        self.lookup = lookup

    def run(self, source: str):
        text = source.strip()
        if text.startswith("="):
            text = text[1:]
        try:
            tree = ast.parse(text, mode="eval")
        except SyntaxError as exc:
            raise DataError(f"cannot parse '{source}': {exc.msg}") from exc
        return self.node(tree.body, source)

    def node(self, n, source):
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float, str)) and not isinstance(n.value, bool):
            return n.value
        if isinstance(n, ast.Name):
            return self.lookup(n.id)
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.USub, ast.UAdd, ast.Not)):
            value = self.node(n.operand, source)
            return -value if isinstance(n.op, ast.USub) else (not value if isinstance(n.op, ast.Not) else +value)
        if isinstance(n, ast.BinOp) and type(n.op) in BINARY:
            left, right = self.node(n.left, source), self.node(n.right, source)
            try:
                return BINARY[type(n.op)](left, right)
            except ZeroDivisionError as exc:
                raise DataError(f"division by zero in '{source}'") from exc
            except TypeError as exc:
                raise DataError(f"'{source}': {exc}") from exc
        if isinstance(n, ast.BoolOp):
            results = [self.node(v, source) for v in n.values]
            return all(results) if isinstance(n.op, ast.And) else any(results)
        if isinstance(n, ast.Compare):
            left = self.node(n.left, source)
            for op, comparator in zip(n.ops, n.comparators):
                if type(op) not in COMPARE:
                    raise DataError(f"operator not allowed in '{source}'")
                right = self.node(comparator, source)
                if not COMPARE[type(op)](left, right):
                    return False
                left = right
            return True
        if isinstance(n, ast.Attribute):
            base = self.node(n.value, source)
            if isinstance(base, Table):
                return ColumnRef(base, n.attr)
            raise DataError(f"'{ast.unparse(n)}' is not a table column in '{source}'")
        if isinstance(n, ast.Subscript):
            base = self.node(n.value, source)
            key = self.node(n.slice, source)
            if isinstance(base, Table):
                return ColumnRef(base, str(key))
            if isinstance(base, ColumnRef):
                return base.table.cell(base.name, key)
            if isinstance(base, RowView):
                return base[str(key)]
            raise DataError(f"cannot index '{ast.unparse(n.value)}' in '{source}'")
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in FUNCTIONS and not n.keywords:
            args = [self.node(a, source) for a in n.args]
            try:
                return FUNCTIONS[n.func.id](*args)
            except ZeroDivisionError as exc:
                raise DataError(f"division by zero in '{source}'") from exc
        raise DataError(f"'{ast.unparse(n)}' is not allowed in '{source}'")


class RowView(dict):
    pass


# ── Resolution ─────────────────────────────────────────────────────────────────


class Numbers:
    """Values, tables with derived columns and total rows, and checks, all evaluated."""

    def __init__(self, values: dict, tables: dict, checks: list):
        self.raw = values
        self.tables = tables
        self.values: dict = {}
        self._busy: set = set()
        for table in tables.values():
            self._complete_table(table)
        for name in values:
            self.value(name)
        self.checks = [self._check(c) for c in checks]

    def lookup(self, name: str):
        if name in self.tables:
            return self.tables[name]
        return self.value(name)

    def value(self, name: str):
        if name in self.values:
            return self.values[name]
        if name not in self.raw:
            known = sorted(set(self.raw) | set(self.tables))
            raise DataError(f"unknown name '{name}' (defined: {', '.join(known) or 'nothing'})")
        if name in self._busy:
            raise DataError(f"'{name}' refers to itself")
        self._busy.add(name)
        raw = self.raw[name]
        if isinstance(raw, str) and raw.strip().startswith("="):
            result = Evaluator(self.lookup).run(raw)
        else:
            result = number(raw)
        self._busy.discard(name)
        self.values[name] = result
        return result

    def _complete_table(self, table: Table) -> None:
        for column, formula in table.derive.items():
            if column not in table.columns:
                table.columns.append(column)
                for row in table.rows:
                    row.append(None)
        numeric = [i for i, _ in enumerate(table.columns) if i > 0 and table.columns[i] not in table.derive
                   and any(isinstance(r[i], (int, float)) for r in table.rows)]
        if table.total_label:
            total = [table.total_label] + [None] * (len(table.columns) - 1)
            for i in numeric:
                total[i] = sum(r[i] for r in table.rows if isinstance(r[i], (int, float)))
            table.total = total
        for row in table.rows + ([table.total] if table.total else []):
            view = RowView(zip(table.columns, row))
            for column, formula in table.derive.items():
                def row_lookup(name, view=view):
                    if name == "row":
                        return view
                    if name in view:
                        return view[name]
                    return self.lookup(name)
                try:
                    view[column] = Evaluator(row_lookup).run(formula)
                except DataError as exc:
                    raise DataError(f"table '{table.name}', row '{row[0]}', column '{column}': {exc}") from exc
                row[table.columns.index(column)] = view[column]

    def _check(self, check) -> dict:
        expr = check.get("expr") if isinstance(check, dict) else str(check)
        note = check.get("note") if isinstance(check, dict) else None
        result = {"expr": expr, "pass": bool(Evaluator(self.lookup).run(expr))}
        tree = ast.parse(expr.lstrip("="), mode="eval").body
        if isinstance(tree, ast.Compare) and len(tree.ops) == 1:
            ev = Evaluator(self.lookup)
            result["left"], result["right"] = ev.node(tree.left, expr), ev.node(tree.comparators[0], expr)
        if note:
            result["note"] = note
        return result


def fmt(value, spec: str | None = None, column_spec: str | None = None) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    spec = spec or column_spec
    if spec:
        try:
            return format(value, spec)
        except ValueError as exc:
            raise DataError(f"format '{spec}' does not apply to {value!r}") from exc
    if isinstance(value, bool):
        return str(value)
    if float(value).is_integer() and abs(value) < 1e15:
        return f"{int(round(value)):,}"
    return f"{value:,.1f}"


def table_markdown(table: Table, options: str | None) -> str:
    """Options, space-separated: `no-total`, `columns=a,b` (first column always kept),
    and at most one format spec applied to numeric cells without a column format."""
    spec, total, keep = None, True, None
    for option in (options or "").split():
        if option == "no-total":
            total = False
        elif option.startswith("columns="):
            keep = [c.strip() for c in option[8:].split(",") if c.strip()]
            for name in keep:
                table.column(name)
        else:
            spec = option
    index = [0] + [i for i, c in enumerate(table.columns) if i and (keep is None or c in keep)]

    def cells(row, bold=False):
        out = []
        for i in index:
            column, value = table.columns[i], row[i]
            text = fmt(value, None, table.formats.get(column) or spec) if not isinstance(value, str) else value
            out.append(f"**{text}**" if bold and text else text)
        return "| " + " | ".join(out) + " |"

    lines = ["| " + " | ".join(table.columns[i] for i in index) + " |", "|" + "|".join("---" for _ in index) + "|"]
    lines += [cells(row) for row in table.rows]
    if table.total and total:
        lines.append(cells(table.total, bold=True))
    return "\n".join(lines)


def split_frontmatter(text: str) -> tuple[dict, str]:
    match = FRONTMATTER.match(text)
    if not match:
        return {}, text
    front = {}
    for line in match.group(1).splitlines():
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*?)\s*$", line)
        if m:
            front[m.group(1)] = m.group(2).strip().strip("'\"")
    return front, text


def data_paths(front: dict, base: Path) -> list[Path]:
    raw = front.get("data", "").strip().strip("[]")
    return [base / p.strip().strip("'\"") for p in raw.split(",") if p.strip()]


def resolve_text(text: str, base: Path) -> tuple[str, dict]:
    """Resolve every placeholder in a Markdown source whose frontmatter names `data:`.
    Returns the source unchanged (and an empty report) when there is no `data:` key."""
    front, _ = split_frontmatter(text)
    paths = data_paths(front, base)
    if not paths:
        return text, {}
    numbers = Numbers(*load_data(paths))
    failed = [c for c in numbers.checks if not c["pass"]]
    if failed:
        lines = "; ".join(f"{c['expr']}" + (f" (left {c['left']!r}, right {c['right']!r})" if "left" in c else "")
                          for c in failed)
        raise DataError(f"data check failed: {lines}")

    count = 0

    def replace(match):
        nonlocal count
        body = match.group(1)
        expr, _, spec = body.partition("|")
        expr, spec = expr.strip(), spec.strip() or None
        count += 1
        if expr.startswith("table:"):
            name = expr[6:].strip()
            if name not in numbers.tables:
                raise DataError(f"unknown table '{name}' in '{{{{{body}}}}}' (tables: {', '.join(numbers.tables)})")
            return table_markdown(numbers.tables[name], spec)
        try:
            value = Evaluator(numbers.lookup).run(expr)
        except DataError as exc:
            raise DataError(f"in '{{{{{body}}}}}': {exc}") from exc
        if isinstance(value, list):
            raise DataError(f"'{{{{{body}}}}}' is a whole column; name one cell, e.g. {expr}['row key']")
        return fmt(value, spec)

    resolved = PLACEHOLDER.sub(replace, text)
    report = {
        "data_files": [str(p) for p in paths],
        "values": numbers.values,
        "tables": {n: {"columns": t.columns, "rows": len(t.rows), "total_row": bool(t.total)} for n, t in numbers.tables.items()},
        "checks": numbers.checks,
        "placeholders_resolved": count,
    }
    return resolved, report


def resolve_file(path: Path) -> tuple[str, dict]:
    return resolve_text(path.read_text(encoding="utf-8"), path.parent)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Resolve data placeholders in a lit-pptx / lit-docx Markdown source.")
    parser.add_argument("command", choices=["check", "resolve"])
    parser.add_argument("source")
    parser.add_argument("-o", "--out", help="resolve: write here instead of stdout")
    args = parser.parse_args(argv)
    source = Path(args.source).expanduser().resolve()
    try:
        resolved, report = resolve_file(source)
    except (DataError, OSError) as exc:
        if args.command == "check":
            print(json.dumps({"pass": False, "error": str(exc)}, ensure_ascii=False, indent=2))
        else:
            print(f"office_data: {exc}", file=sys.stderr)
        return 1
    if args.command == "check":
        print(json.dumps({"pass": True, **report}, ensure_ascii=False, indent=2, default=str))
        return 0
    if args.out:
        Path(args.out).write_text(resolved, encoding="utf-8")
    else:
        sys.stdout.write(resolved)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
