#!/usr/bin/env bash
# check_conference.sh: read-only progress box for one LitGravity autoconference.
#
# Usage: check_conference.sh [conference_dir]
#   With no argument: the only directory under .litgravity/conference/, or a list to choose from.
# Reads conference.md, conference_results.tsv and conference_events.jsonl; writes nothing.
# Exit status: 0 printed, 1 more than one conference and none named, 2 directory missing or a symlink.

set -u

STATE_ROOT=".litgravity/conference"
CONF_DIR="${1:-}"

if [[ -z "$CONF_DIR" ]]; then
    if [[ -d "$STATE_ROOT" ]]; then
        candidates=()
        for d in "$STATE_ROOT"/*/; do
            [[ -f "${d}conference.md" ]] && candidates+=("${d%/}")
        done
        if [[ ${#candidates[@]} -eq 1 ]]; then
            CONF_DIR="${candidates[0]}"
        elif [[ ${#candidates[@]} -gt 1 ]]; then
            echo "More than one conference; name one:" >&2
            for c in "${candidates[@]}"; do echo "  $c" >&2; done
            exit 1
        fi
    fi
    [[ -z "$CONF_DIR" ]] && CONF_DIR="."
fi
CONF_DIR="${CONF_DIR%/}"

if [[ -L "$CONF_DIR" ]]; then
    echo "check_conference: '$CONF_DIR' is a symlink; refusing to read it." >&2
    exit 2
fi
if [[ ! -d "$CONF_DIR" ]]; then
    echo "check_conference: '$CONF_DIR' is not a directory." >&2
    exit 2
fi

CONF_MD="$CONF_DIR/conference.md"
RESULTS_TSV="$CONF_DIR/conference_results.tsv"
EVENTS_JSONL="$CONF_DIR/conference_events.jsonl"
SYNTHESIS_MD="$CONF_DIR/synthesis.md"

# Value after a bold "**Label:**" on the first matching line of conference.md.
_field() {
    grep -m1 -F "**$1:**" "$CONF_MD" 2>/dev/null \
        | sed "s/.*\*\*$1:\*\*[[:space:]]*//" \
        | sed 's/[[:space:]]*$//'
}
_first_int() { grep -oE '[0-9]+' | head -1; }

# ── conference.md ────────────────────────────────────────────────────────────

goal="?"; max_rounds="?"; researcher_count="?"; direction="maximize"; target="?"
budget_children="?"; budget_calls="?"; gate="?"
if [[ -f "$CONF_MD" ]]; then
    goal=$(awk '/^## Goal/{found=1; next} found && /[^[:space:]]/{print; exit}' "$CONF_MD")
    max_rounds=$(_field "Max rounds" | _first_int)
    researcher_count=$(_field "Count" | _first_int)
    direction=$(_field "Direction" | tr '[:upper:]' '[:lower:]')
    target=$(_field "Target")
    budget_children=$(_field "Children" | _first_int)
    [[ -z "$budget_children" ]] && budget_children=$(_field "Children (invoke_subagent calls)" | _first_int)
    budget_calls=$(_field "Model calls" | _first_int)
    gate=$(_field "Final confirmation" | awk '{print $1}' | tr -d '.,')
fi
[[ -z "$goal" ]] && goal="?"
[[ -z "$max_rounds" ]] && max_rounds="?"
[[ -z "$researcher_count" ]] && researcher_count="?"
[[ "$direction" != "minimize" ]] && direction="maximize"
[[ -z "$target" ]] && target="?"
[[ -z "$budget_children" ]] && budget_children="?"
[[ -z "$budget_calls" ]] && budget_calls="?"
[[ -z "$gate" ]] && gate="?"

# ── conference_results.tsv ───────────────────────────────────────────────────
# Columns: round, researcher, iteration, metric_value, delta, delta_pct, status, description,
#          evaluator_source, peer_review_verdict, timestamp. Failed, challenged and overturned rows
#          do not count toward the best value.

best_metric="?"; best_researcher="?"; failed_rows=0
if [[ -f "$RESULTS_TSV" ]]; then
    # awk keeps empty fields, so a failed row with no metric does not shift the columns.
    read -r best_metric best_researcher failed_rows < <(
        awk -F'\t' -v dir="$direction" '
            NR == 1 || NF < 2 { next }
            $7 == "failed" { failed++; next }
            $10 == "challenged" || $10 == "overturned" { next }
            $4 ~ /^-?[0-9]+(\.[0-9]+)?$/ {
                v = $4 + 0
                if (!seen || (dir == "minimize" && v < best) || (dir != "minimize" && v > best)) {
                    best = v; who = $2; raw = $4; seen = 1
                }
            }
            END { printf "%s %s %d\n", (seen ? raw : "?"), (seen ? who : "?"), failed }
        ' "$RESULTS_TSV"
    )
fi

# ── conference_events.jsonl (the conference ledger) ──────────────────────────

_count() { grep -cE "$1" "$EVENTS_JSONL" 2>/dev/null || true; }
_ids() { grep -E "$1" "$EVENTS_JSONL" 2>/dev/null | grep -oE '"report_id"[[:space:]]*:[[:space:]]*"[^"]+"' | sed 's/.*"\([^"]*\)"$/\1/' | sort -u; }

completed_rounds=0; stuck_count=0; dispatched=0; reported=0; failed=0
last_event_type="?"; last_event_ts=""; outstanding=""; finished="no"; calls_used="?"
if [[ -f "$EVENTS_JSONL" ]]; then
    completed_rounds=$(_count '"round\.completed"')
    stuck_count=$(_count '"researcher\.stuck"')
    dispatched=$(_count '"child\.dispatched"')
    reported=$(_count '"child\.reported"')
    failed=$(_count '"child\.failed"')
    [[ $(_count '"conference\.completed"') -gt 0 ]] && finished="yes"
    calls_used=$(grep -oE '"model_calls_used"[[:space:]]*:[[:space:]]*[0-9]+' "$EVENTS_JSONL" 2>/dev/null | tail -1 | _first_int)
    [[ -z "$calls_used" ]] && calls_used="?"
    outstanding=$(comm -23 <(_ids '"child\.dispatched"') <(_ids '"child\.(reported|failed)"') | tr '\n' ' ' | sed 's/[[:space:]]*$//')
    last_line=$(grep -v '^[[:space:]]*$' "$EVENTS_JSONL" | tail -1)
    if [[ -n "$last_line" ]]; then
        last_event_type=$(printf '%s' "$last_line" | grep -oE '"(event|type)"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
        last_event_ts=$(printf '%s' "$last_line" | grep -oE '"(timestamp|ts|time)"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
    fi
fi
[[ -z "$last_event_type" ]] && last_event_type="?"

# ── status ───────────────────────────────────────────────────────────────────

if [[ "$finished" == "yes" ]]; then
    run_status="COMPLETE"
elif [[ -f "$SYNTHESIS_MD" ]]; then
    run_status="synthesis saved, completion event missing"
elif [[ -n "$outstanding" ]]; then
    run_status="waiting on reports"
elif [[ -f "$EVENTS_JSONL" ]] && [[ -s "$EVENTS_JSONL" ]]; then
    run_status="running"
elif [[ "$gate" == "pending" ]]; then
    run_status="gate pending"
else
    run_status="no events yet"
fi

# ── box ──────────────────────────────────────────────────────────────────────

inner_w=58
val_w=42

_trunc() {
    local s="$1" max="${2:-$val_w}"
    if [[ ${#s} -gt $max ]]; then printf '%s' "${s:0:$((max-3))}..."; else printf '%s' "$s"; fi
}
_row() {
    local content="  $1$(_trunc "$2")"
    local pad=$(( inner_w - ${#content} ))
    [[ $pad -lt 0 ]] && pad=0
    printf '|%s%*s|\n' "$content" "$pad" ""
}
_rule() { printf '+%s+\n' "$(printf -- '-%.0s' $(seq 1 $inner_w))"; }

researchers_display="$researcher_count"
[[ "$stuck_count" -gt 0 ]] && researchers_display="$researcher_count ($stuck_count stuck events)"
last_display="$last_event_type"
[[ -n "$last_event_ts" ]] && last_display="$last_event_type @ $last_event_ts"
[[ -z "$outstanding" ]] && outstanding="none"

_rule
_row "autoconference " ""
_rule
_row "Conference:   " "$CONF_DIR/"
_row "Goal:         " "$goal"
_row "Gate:         " "$gate"
_row "Round:        " "$completed_rounds / $max_rounds completed"
_row "Researchers:  " "$researchers_display"
_row "Best metric:  " "$best_metric ($best_researcher), $direction"
_row "Target:       " "$target"
_row "Children:     " "$dispatched / $budget_children dispatched"
_row "Reports:      " "$reported received, $failed failed"
_row "Outstanding:  " "$outstanding"
_row "Failed rows:  " "$failed_rows"
_row "Model calls:  " "$calls_used / $budget_calls (at last round.completed)"
_row "Status:       " "$run_status"
_row "Last event:   " "$last_display"
_rule
exit 0
