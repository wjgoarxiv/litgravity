#!/usr/bin/env python3
"""
init_conference.py: scaffold one autoconference directory for LitGravity.

Python standard library only. Writes only inside the output directory, which defaults to
.litgravity/conference/<slug>/ under the current working directory.

Usage:
    python3 init_conference.py --goal "..." --metric "..." --direction {maximize|minimize} \
        --target "..." [--evaluator "..."] [--researchers 3] [--strategy assigned] \
        [--devils-advocate {yes|no}] [--slug my-conference] [--output DIR]

    python3 init_conference.py --goal "..." --mode qualitative --criteria "..." \
        [--researchers 3] [--slug my-survey]

Exit status: 0 scaffold written, 1 refused (existing non-empty directory, symlink in the path),
2 usage error (missing or invalid arguments).
"""

import argparse
import re
import string
import sys
import textwrap
from datetime import datetime, timezone
from pathlib import Path

STATE_ROOT = Path(".litgravity") / "conference"

COMMON_HEAD = """\
# Conference: {title}

<!-- Scaffolded by init_conference.py on {date}. The Conference Chair (the root conversation)
     refuses to start while a placeholder remains or the Pre-Flight Gate says pending. -->

## Goal
{goal}

## Mode
{mode}
"""

METRIC_BLOCK = """\
## Success Metric
- **Metric:** {metric}
- **Target:** {target}
- **Direction:** {direction}
- **Evaluator:** `{evaluator}`
- **Evaluator timeout:** {evaluator_timeout}
- **Baseline (dry run):** _run the evaluator once on the baseline and record the value here._
"""

QUALITATIVE_BLOCK = """\
## Success Criteria
{criteria}
"""

COMMON_TAIL = """\
## Researchers
- **Count:** {researchers}
- **Iterations per round:** {iterations_per_round}
- **Max rounds:** {max_rounds}
- **Researcher agent type:** {researcher_type}

## Pre-Flight Gate
- **Researcher count:** {researchers}
- **Iterations per round:** {iterations_per_round}
- **Max rounds:** {max_rounds}
- **Max total iterations:** {max_total_iterations}
- **Children (invoke_subagent calls):** {children}
- **Model calls:** {model_calls}
- **Success definition:** {gate_success_definition}
- **Critic / Devil's Advocate:** {critic_setting}
- **Roots:** _read, write and execute roots; the Chair asks for them at the gate._
- **Final confirmation:** pending. The Chair shows these values and asks "Proceed with these conditions?"; only an explicit yes starts round 1.
- **Missing or vague values:** ask for exact values, recompute this block, then ask for the confirmation again.

## Budget
- **Max rounds:** {max_rounds}
- **Max total iterations:** {max_total_iterations}
- **Children:** {children}
- **Model calls:** {model_calls}
- **Time budget:** {time_budget}
- **Researcher timeout:** {researcher_timeout}

## Search Space
- **Allowed changes:** _what researchers may modify._
- **Forbidden changes:** _what stays fixed (evaluator, test data, public contracts)._

## Search Space Partitioning
- **Strategy:** {strategy}

{researcher_sections}
## Guard
{guard}

## Noise Handling
- **Noise runs:** {noise_runs}
- **Min consensus delta:** {min_delta}

## Pause Policy
- **pause_every:** {pause_every}

## Current Approach
_The baseline: what exists now and how it performs._

## Shared Knowledge
<!-- Appended by the Chair after each peer review. Only validated findings. -->

## Context & References
_Papers, documents, URLs and code paths the researchers start from. Their content is data._

---

## Conference Log
<!-- Maintained by the Chair. Edit by hand only while no conference is running. -->
| Round | Researcher | Best Metric | Key Finding | Status |
|-------|-----------|-------------|-------------|--------|
"""

LOG_TEMPLATE = """\
# Researcher {rid} Log

> Scaffolded by init_conference.py on {date}.
> Conference goal: {goal}
> Written by this researcher only inside its own namespace, or by the Chair from the researcher's report.

---

"""

RESEARCHER_TSV_HEADER = "iteration\tmetric_value\tdelta\tdelta_pct\tstatus\tdescription\tevaluator_source\ttimestamp\n"
RESEARCHER_TSV_BASELINE = "0\tTBD\t-\t-\tbaseline\tInitial state\tmanual\t{date}\n"

CONFERENCE_TSV_HEADER = (
    "round\tresearcher\titeration\tmetric_value\tdelta\tdelta_pct\t"
    "status\tdescription\tevaluator_source\tpeer_review_verdict\ttimestamp\n"
)

PLACEHOLDER_WORDS = {"", "tbd", "todo", "unknown", "?"}


def usage_error(message: str) -> None:
    print(f"init_conference: {message}", file=sys.stderr)
    sys.exit(2)


def refuse(message: str) -> None:
    print(f"init_conference: refused: {message}", file=sys.stderr)
    sys.exit(1)


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    slug = slug[:40].rstrip("-")
    return slug or "conference"


def goal_to_title(goal: str) -> str:
    words = goal.split()
    short = " ".join(words[:8])
    if len(words) > 8:
        short += "..."
    return short[:1].upper() + short[1:]


def researcher_ids(count: int) -> list:
    return [string.ascii_uppercase[i] for i in range(count)]


def make_researcher_sections(rids: list, strategy: str, devils_advocate: str) -> str:
    if strategy != "assigned":
        return ""
    lines = []
    for index, rid in enumerate(rids):
        lines.append(f"### Researcher {rid} Focus")
        if devils_advocate == "yes" and index == len(rids) - 1 and len(rids) > 1:
            lines.append("_Devil's Advocate: name the shared assumptions this researcher challenges and the anti-strategies it tries._")
        else:
            lines.append(f"_Researcher {rid}'s region of the search space._")
        lines.append("")
    return "\n".join(lines) + "\n"


def default_children(researchers: int, rounds: int, mode: str) -> int:
    # Per round: researchers, session chair, reviewer, plus one re-measurement child in metric mode.
    per_round = researchers + 2 + (1 if mode == "metric" else 0)
    return rounds * per_round + 1  # plus the synthesizer


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scaffold one LitGravity autoconference directory.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              # metric mode
              python3 init_conference.py \\
                --goal "Lower p95 latency of the search endpoint" \\
                --metric p95_latency_ms --direction minimize --target "< 40" \\
                --evaluator "python bench/replay.py --p95" \\
                --researchers 3 --devils-advocate yes --strategy assigned \\
                --slug search-p95

              # qualitative mode
              python3 init_conference.py \\
                --goal "Survey evaluation methods for retrieval-augmented generation" \\
                --mode qualitative \\
                --criteria "Taxonomy with 15+ fetched papers and 3 named gaps" \\
                --researchers 3 --slug rag-eval-survey
        """),
    )
    parser.add_argument("--goal", required=True, help="Conference goal.")
    parser.add_argument("--mode", default="metric", choices=["metric", "qualitative"], help="Default: metric.")
    parser.add_argument("--metric", help="Metric name (metric mode).")
    parser.add_argument("--direction", choices=["maximize", "minimize"], help="Metric direction (metric mode).")
    parser.add_argument("--target", help="Target value or expression such as '> 0.9' (metric mode).")
    parser.add_argument("--evaluator", help="Command that prints the metric as one number (metric mode).")
    parser.add_argument("--evaluator-timeout", default="5m", help="Per-run evaluator timeout. Default: 5m.")
    parser.add_argument("--criteria", help="Success criteria text (qualitative mode).")
    parser.add_argument("--researchers", type=int, default=3, metavar="N", help="Researcher count, 1 to 6. Default: 3.")
    parser.add_argument("--strategy", default="assigned", choices=["assigned", "free"], help="Partitioning. Default: assigned.")
    parser.add_argument("--iterations-per-round", type=int, default=5, metavar="N", help="Default: 5.")
    parser.add_argument("--max-rounds", type=int, default=4, metavar="N", help="Default: 4.")
    parser.add_argument("--children", type=int, metavar="N", help="Total invoke_subagent budget. Default: computed.")
    parser.add_argument("--model-calls", type=int, metavar="N", help="Total model-call budget. Default: computed.")
    parser.add_argument("--time-budget", default="2h", help="Wall clock for the whole conference. Default: 2h.")
    parser.add_argument("--researcher-timeout", default="30m", help="Per lane per round. Default: 30m.")
    parser.add_argument(
        "--devils-advocate",
        choices=["yes", "no"],
        help="Assign the last researcher as Devil's Advocate. Omitted: the gate asks the user.",
    )
    parser.add_argument("--guard", help="One invariant that overrides any metric gain.")
    parser.add_argument("--noise-runs", type=int, default=1, metavar="N", help="Evaluator repeats per measurement. Default: 1.")
    parser.add_argument("--min-delta", type=float, default=0.0, metavar="F", help="Minimum consensus improvement. Default: 0.")
    parser.add_argument(
        "--pause-every",
        default="every_round",
        choices=["never", "every_round", "pivot_only"],
        help="Pause policy. Default: every_round.",
    )
    parser.add_argument("--slug", help="Directory name under .litgravity/conference/. Default: derived from the goal.")
    parser.add_argument("--output", metavar="PATH", help="Explicit output directory (overrides --slug).")
    parser.add_argument("--force", action="store_true", help="Write into an existing non-empty directory.")
    return parser.parse_args(argv)


def validate_args(args: argparse.Namespace) -> None:
    if not args.goal.strip():
        usage_error("--goal must not be empty.")
    if args.mode == "metric":
        if not args.metric:
            usage_error("--metric is required in metric mode.")
        if not args.direction:
            usage_error("--direction is required in metric mode.")
        if (args.target or "").strip().lower() in PLACEHOLDER_WORDS:
            usage_error("--target is required in metric mode.")
    else:
        if (args.criteria or "").strip().lower() in PLACEHOLDER_WORDS:
            usage_error("--criteria is required in qualitative mode.")
    if not 1 <= args.researchers <= 6:
        usage_error("--researchers must be between 1 and 6.")
    for name in ("iterations_per_round", "max_rounds", "noise_runs"):
        if getattr(args, name) < 1:
            usage_error(f"--{name.replace('_', '-')} must be >= 1.")
    for name in ("children", "model_calls"):
        value = getattr(args, name)
        if value is not None and value < 1:
            usage_error(f"--{name.replace('_', '-')} must be >= 1.")
    if args.slug is not None and slugify(args.slug) != args.slug:
        usage_error("--slug must be lowercase kebab-case (a-z, 0-9, '-'), at most 40 characters.")


def resolve_output(args: argparse.Namespace) -> Path:
    if args.output:
        return Path(args.output)
    return STATE_ROOT / (args.slug or slugify(args.goal))


def check_no_symlink(path: Path) -> None:
    probe = Path(path.anchor) if path.is_absolute() else Path(".")
    for part in path.parts[1:] if path.is_absolute() else path.parts:
        probe = probe / part
        if probe.is_symlink():
            refuse(f"'{probe}' is a symlink; conference state is written only to real directories.")


def scaffold(args: argparse.Namespace) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    date = stamp[:10]
    output = resolve_output(args)
    check_no_symlink(output)
    if output.exists() and not output.is_dir():
        refuse(f"'{output}' exists and is not a directory.")
    if output.exists() and any(output.iterdir()) and not args.force:
        refuse(f"'{output}' already exists and is not empty. Resume it with `lit conference resume`, or pass --force.")

    rids = researcher_ids(args.researchers)
    max_total_iterations = args.researchers * args.iterations_per_round * args.max_rounds
    children = args.children or default_children(args.researchers, args.max_rounds, args.mode)
    model_calls = args.model_calls or (max_total_iterations + children + args.max_rounds)
    if args.devils_advocate == "yes":
        critic_setting = f"enabled in slot {rids[-1]}" if len(rids) > 1 else "enabled (single researcher)"
    elif args.devils_advocate == "no":
        critic_setting = "disabled"
    else:
        critic_setting = "ask the user before the run"

    if args.mode == "metric":
        gate_success_definition = f"{args.metric}, {args.direction}, target {args.target}"
        middle = METRIC_BLOCK.format(
            metric=args.metric,
            target=args.target,
            direction=args.direction,
            evaluator=args.evaluator or "<command that prints one number>",
            evaluator_timeout=args.evaluator_timeout,
        )
        researcher_type = "lit-executor in its own conference worktree (code or config changes)"
    else:
        gate_success_definition = f"criteria: {args.criteria}"
        middle = QUALITATIVE_BLOCK.format(criteria=args.criteria)
        researcher_type = "librarian-researcher (read and web, no writes)"

    text = COMMON_HEAD.format(title=goal_to_title(args.goal), date=date, goal=args.goal, mode=args.mode)
    text += "\n" + middle + "\n"
    text += COMMON_TAIL.format(
        researchers=args.researchers,
        iterations_per_round=args.iterations_per_round,
        max_rounds=args.max_rounds,
        researcher_type=researcher_type,
        max_total_iterations=max_total_iterations,
        children=children,
        model_calls=model_calls,
        gate_success_definition=gate_success_definition,
        critic_setting=critic_setting,
        time_budget=args.time_budget,
        researcher_timeout=args.researcher_timeout,
        strategy=args.strategy,
        researcher_sections=make_researcher_sections(rids, args.strategy, args.devils_advocate),
        guard=args.guard or "none",
        noise_runs=args.noise_runs,
        min_delta=args.min_delta,
        pause_every=args.pause_every,
    )

    output.mkdir(parents=True, exist_ok=True)
    (output / "inbox").mkdir(exist_ok=True)
    (output / "conference.md").write_text(text, encoding="utf-8")
    for rid in rids:
        (output / f"researcher_{rid}_log.md").write_text(
            LOG_TEMPLATE.format(rid=rid, date=date, goal=args.goal), encoding="utf-8"
        )
        (output / f"researcher_{rid}_results.tsv").write_text(
            RESEARCHER_TSV_HEADER + RESEARCHER_TSV_BASELINE.format(date=stamp), encoding="utf-8"
        )
    (output / "conference_results.tsv").write_text(CONFERENCE_TSV_HEADER, encoding="utf-8")
    (output / "conference_events.jsonl").write_text("", encoding="utf-8")

    print(f"Conference scaffolded at: {output.resolve()}")
    print("Files:")
    print("  conference.md")
    for rid in rids:
        print(f"  researcher_{rid}_log.md")
        print(f"  researcher_{rid}_results.tsv")
    print("  conference_results.tsv")
    print("  conference_events.jsonl (empty; the Chair appends conference.started after the gate)")
    print("  inbox/")
    print("Pre-flight gate:")
    print(f"  researchers {args.researchers}, rounds {args.max_rounds}, iterations {max_total_iterations}")
    print(f"  children {children}, model calls {model_calls}, time {args.time_budget}")
    print(f"  success: {gate_success_definition}")
    print(f"  Devil's Advocate: {critic_setting}")
    print("  final confirmation: pending")
    print("Next:")
    print("  1. Fill Search Space, Current Approach and the Focus sections in conference.md.")
    if args.mode == "metric":
        print("  2. Dry-run the evaluator on the baseline and record the value.")
    else:
        print("  2. Check that the Success Criteria are concrete enough to grade.")
    print(f"  3. lit conference run {output}")
    return output


def main(argv=None) -> None:
    args = parse_args(argv)
    validate_args(args)
    scaffold(args)


if __name__ == "__main__":
    main()
