#!/usr/bin/env bash
# check_progress.sh - read-only progress report for an autoresearch research directory.
# Usage: check_progress.sh [research_dir]     (default: current directory)
#   research_dir is normally .litgravity/evidence/<slug>/autoresearch/
# Reads research.md, autoresearch-results.tsv, autoresearch_events.jsonl and final_report.md.
# Writes nothing. Needs bash and node (NODE_BINARY overrides the node path).
# Exit: 0 status printed, 2 not initialised or usage, 3 node missing or failed,
#       4 terminal event present but inconsistent with the results table.

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi
if [[ $# -gt 1 ]]; then
    printf 'usage: check_progress.sh [research_dir]\n' >&2
    exit 2
fi

RESEARCH_DIR="${1:-.}"
RESEARCH_DIR="${RESEARCH_DIR%/}"  # strip trailing slash

RESEARCH_MD="$RESEARCH_DIR/research.md"
TSV_FILE="$RESEARCH_DIR/autoresearch-results.tsv"
EVENTS_JSONL="$RESEARCH_DIR/autoresearch_events.jsonl"
FINAL_REPORT="$RESEARCH_DIR/final_report.md"

for candidate in "$RESEARCH_DIR" "$RESEARCH_MD" "$TSV_FILE" "$EVENTS_JSONL" "$FINAL_REPORT"; do
    if [[ -L "$candidate" ]]; then
        printf 'Status:     refused symlink %s\n' "$candidate"
        exit 2
    fi
done

if [[ ! -d "$RESEARCH_DIR" || ! -f "$RESEARCH_MD" ]]; then
    printf 'Status:     not initialized\n'
    exit 2
fi

NODE_BINARY="${NODE_BINARY:-node}"
if ! command -v "$NODE_BINARY" >/dev/null 2>&1; then
    printf 'Status:     BLOCKED_NODE_UNAVAILABLE\n'
    exit 3
fi

# ── Parse research.md ────────────────────────────────────────────────────────

if [[ -f "$RESEARCH_MD" ]]; then
    max_iter=$(grep -m1 '\*\*Max iterations:\*\*' "$RESEARCH_MD" \
               | sed 's/.*\*\*Max iterations:\*\*[[:space:]]*//' \
               | awk '{print $1}')
    target=$(grep -m1 '\*\*Target:\*\*' "$RESEARCH_MD" \
             | sed 's/.*\*\*Target:\*\*[[:space:]]*//' \
             | sed 's/[[:space:]]*$//')
    direction=$(grep -m1 '\*\*Direction:\*\*' "$RESEARCH_MD" \
                | sed 's/.*\*\*Direction:\*\*[[:space:]]*//' \
                | awk '{print $1}')
    metric=$(grep -m1 '\*\*Metric:\*\*' "$RESEARCH_MD" \
             | sed 's/.*\*\*Metric:\*\*[[:space:]]*//' \
             | sed 's/[[:space:]]*$//')
    # First non-empty line after "## Goal"
    goal=$(awk '/^## Goal/{found=1; next} found && /[^[:space:]]/{print; exit}' \
           "$RESEARCH_MD")
else
    max_iter="?"; target="?"; direction="?"; metric="?"; goal="?"
fi

[[ -z "$max_iter"  ]] && max_iter="?"
[[ -z "$target"    ]] && target="?"
[[ -z "$direction" ]] && direction="?"
[[ -z "$metric"    ]] && metric="?"
[[ -z "$goal"      ]] && goal="?"

# ── Parse autoresearch-results.tsv ───────────────────────────────────────────

cur_iter="?"; best_score="?"; last_status="?"; last_desc="?"

if [[ -f "$TSV_FILE" ]]; then
    # Skip header row (first line), collect data lines portably (bash 3.2 safe)
    data_count=0
    best_score=""
    while IFS=$'\t' read -r f1 f2 f3 f4 f5 f6 f7 rest; do
        [[ -z "$f1" ]] && continue
        [[ "$f2" == "TBD" || "$f2" == "TODO" || "$f2" == "?" || "$f2" == "-" ]] && continue
        data_count=$(( data_count + 1 ))
        cur_iter="$f1"
        last_status="$f5"
        last_desc="$f6"
        val="$f2"
        # Track best score; skip non-numeric values (e.g. "-")
        if [[ "$val" =~ ^-?[0-9]+(\.[0-9]+)?$ ]]; then
            if [[ -z "$best_score" ]]; then
                best_score="$val"
            else
                if [[ "$direction" == "minimize" ]]; then
                    better=$(awk -v a="$val" -v b="$best_score" 'BEGIN{print (a<b)?1:0}')
                else
                    better=$(awk -v a="$val" -v b="$best_score" 'BEGIN{print (a>b)?1:0}')
                fi
                [[ "$better" == "1" ]] && best_score="$val"
            fi
        fi
    done < <(tail -n +2 "$TSV_FILE" | grep -v '^[[:space:]]*$')

    [[ -z "$best_score" ]] && best_score="?"
fi

terminal_event_state="none"
if ! terminal_event_state=$("$NODE_BINARY" - "$EVENTS_JSONL" "$TSV_FILE" "$max_iter" <<'NODE'
const fs = require("node:fs");

const [eventsPath, tsvPath, maxIterationsRaw] = process.argv.slice(2);
const maxIterations = Number(maxIterationsRaw);
const allowedReasons = new Set(["TARGET_MET", "BUDGET_EXHAUSTED", "PLATEAU", "CANCELLED", "BLOCKED"]);
const allowedStatuses = new Set(["baseline", "kept", "reverted", "guard_violation", "reference"]);
const allowedEvaluators = new Set(["mechanical", "agent", "manual"]);
const expectedHeader = ["iteration", "metric_value", "delta", "delta_pct", "status", "description", "evaluator_source", "timestamp"];

function validTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)) return false;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return false;
  const normalized = value.includes(".") ? value : value.replace(/Z$/u, ".000Z");
  return parsed.toISOString() === normalized;
}

function finiteNumber(value) {
  return typeof value === "string"
    && /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(value)
    && Number.isFinite(Number(value));
}

function parseResults() {
  if (!fs.existsSync(tsvPath)) return { valid: false, count: 0 };
  const lines = fs.readFileSync(tsvPath, "utf8").split(/\r?\n/u);
  if (lines.at(-1) === "") lines.pop();
  if (lines.length === 0 || lines[0] !== expectedHeader.join("\t")) {
    return { valid: false, count: 0 };
  }
  const iterations = new Set();
  let count = 0;
  let baselineState = "missing";
  for (const line of lines.slice(1)) {
    if (line === "") return { valid: false, count };
    const fields = line.split("\t");
    if (fields.length !== expectedHeader.length) return { valid: false, count };
    const [iterationRaw, metric, delta, deltaPct, status, description, evaluator, timestamp] = fields;
    if (metric === "TBD") {
      if (baselineState !== "missing" || iterations.has(0) || iterationRaw !== "0" || delta !== "-" || deltaPct !== "-"
        || status !== "baseline" || description.trim() === "" || evaluator !== "agent"
        || !/^\d{4}-\d{2}-\d{2}$/u.test(timestamp)) return { valid: false, count };
      baselineState = "placeholder";
      iterations.add(0);
      continue;
    }
    if (!/^\d+$/u.test(iterationRaw) || !finiteNumber(metric) || !(delta === "-" || finiteNumber(delta))
      || !(deltaPct === "-" || /^-?(?:\d+(?:\.\d+)?|\.\d+)%$/u.test(deltaPct))
      || !allowedStatuses.has(status) || description.trim() === "" || !allowedEvaluators.has(evaluator)
      || !validTimestamp(timestamp)) return { valid: false, count };
    const iteration = Number(iterationRaw);
    if (!Number.isSafeInteger(iteration) || iterations.has(iteration)
      || (Number.isSafeInteger(maxIterations) && iteration > maxIterations)) return { valid: false, count };
    if (iteration === 0) {
      if (status !== "baseline" || delta !== "-" || deltaPct !== "-") return { valid: false, count };
      baselineState = "valid";
    } else {
      if (status === "baseline") return { valid: false, count };
      count += 1;
    }
    iterations.add(iteration);
  }
  return { valid: true, count, baselineState };
}

const results = parseResults();
if (!results.valid) {
  process.stdout.write("invalid");
  process.exit(0);
}
const resultCount = results.count;

let latest;
const eventLines = fs.existsSync(eventsPath) ? fs.readFileSync(eventsPath, "utf8").split(/\r?\n/u) : [];
for (const line of eventLines) {
  if (line.trim() === "") continue;
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    continue;
  }
  if (event !== null && typeof event === "object" && !Array.isArray(event) && event.event === "autoresearch.completed") {
    latest = event;
  }
}

if (latest === undefined) {
  process.stdout.write("none");
  process.exit(0);
}

const valid = validTimestamp(latest.timestamp)
  && allowedReasons.has(latest.terminal_reason)
  && latest.final_report_path === "final_report.md"
  && latest.results_path === "autoresearch-results.tsv"
  && Number.isInteger(latest.total_iterations)
  && latest.total_iterations >= 0
  && latest.total_iterations === resultCount
  && results.baselineState === "valid";
process.stdout.write(valid ? "valid" : "invalid");
NODE
); then
    printf 'Status:     BLOCKED_NODE_RUNTIME_ERROR\n'
    exit 3
fi

# ── Determine run status ──────────────────────────────────────────────────────

if [[ -f "$RESEARCH_MD" ]] && grep -q 'Scaffold status:[[:space:]]*INCOMPLETE' "$RESEARCH_MD"; then
    run_status="incomplete scaffold"
elif [[ "$terminal_event_state" == "invalid" ]]; then
    run_status="terminal invalid"
elif [[ "$terminal_event_state" == "valid" ]] && [[ -s "$FINAL_REPORT" ]] && [[ "${data_count:-0}" -gt 0 ]]; then
    run_status="COMPLETE"
elif [[ "$terminal_event_state" == "valid" ]]; then
    run_status="terminal incomplete"
elif [[ -f "$TSV_FILE" ]] && [[ "${data_count:-0}" -gt 0 ]]; then
    run_status="progress recorded"
else
    run_status="ready; no progress recorded"
fi

# ── Build display strings ─────────────────────────────────────────────────────

iter_display="$cur_iter / ${max_iter}"
target_display="$target ($direction)"

# Truncate long strings to keep box tidy (max ~44 chars for value column)
_trunc() {
    local s="$1" max="${2:-44}"
    if [[ ${#s} -gt $max ]]; then
        printf '%s…' "${s:0:$((max-1))}"
    else
        printf '%s' "$s"
    fi
}

label_w=12   # width of label column including trailing spaces
val_w=44     # max width of value column

research_val=$(_trunc "$RESEARCH_DIR/" $val_w)
goal_val=$(_trunc "$goal" $val_w)
iter_val=$(_trunc "$iter_display" $val_w)
score_val=$(_trunc "$best_score" $val_w)
target_val=$(_trunc "$target_display" $val_w)
status_val=$(_trunc "$run_status" $val_w)
last_val=$(_trunc "$last_desc" $val_w)

# ── Box drawing ───────────────────────────────────────────────────────────────

# Compute box inner width from widest row
_row_len() { printf '%s' "  ${1}${2}" | wc -c | tr -d ' '; }

inner_w=54  # fixed inner width for clean alignment
border=$(printf '─%.0s' $(seq 1 $inner_w))

_pad_row() {
    local label="$1" value="$2"
    local content="  ${label}${value}"
    local pad=$(( inner_w - ${#content} ))
    if [[ $pad -lt 0 ]]; then
        # truncate value
        local max_val=$(( inner_w - ${#label} - 2 ))
        value="${value:0:$((max_val-1))}…"
        content="  ${label}${value}"
        pad=0
    fi
    printf '│%s%*s│\n' "$content" "$pad" ""
}

printf '┌─ autoresearch progress ─%s┐\n' "$(printf '─%.0s' $(seq 1 $((inner_w - 26))))"
_pad_row "Research:   " "$research_val"
_pad_row "Goal:       " "$goal_val"
_pad_row "Iteration:  " "$iter_val"
_pad_row "Best score: " "$score_val"
_pad_row "Target:     " "$target_val"
_pad_row "Status:     " "$status_val"
_pad_row "Last:       " "$last_val"
printf '└%s┘\n' "$border"

if [[ "$run_status" == "terminal invalid" ]]; then
    exit 4
fi
exit 0
