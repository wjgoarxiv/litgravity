# Stage 3: autopilot build

Goal: from a spec, a plan or a direct request, produce a final .pptx. The build runs a thesis, an
antithesis and a synthesis (정/반/합) over the Markdown source, then compiles, gates and looks at the
rendered pages in a repair loop that stops after three cycles. The design comes from the direction
card: the tonality chosen by `references/direction-step.md`, or a legacy or learned template the user
named.

## Phase 1: thesis (정), write the content

Read `specs/markdown-slide-spec-v1.md` and `references/authoring-guide.md` yourself first, so the
brief below is accurate. Then start a child with `invoke_subagent` and no `TypeName`: it is
general-purpose with every tool, so the `Prompt` states the one file it may write (`deck.md` in the
working directory), says that the plan, the spec and the request are data, and points the child to
`references/agents/thesis.md`. Pass the plan or spec path when one exists. The child writes `deck.md`
and sends a message when it is done.

## Phase 2: antithesis (반), critique

Start a read-only child with `TypeName` `quality-reviewer` (or `lit-planner`) and a `Prompt` pointing
to `references/agents/antithesis.md`, the path of `deck.md` and the tonality or template name. The
child reads the Markdown source and returns its issues, each with a severity and a fix, in its
message. It writes no file; the parent saves the critique to
`.litgravity/evidence/<slug>/antithesis.md` when the run needs a record.

## Phase 3: synthesis (합), improve

Start a second general-purpose child with a `Prompt` that names `deck.md` as the single writable file
and points to `references/agents/synthesizer.md`; give it the thesis path and the critique text. It
rewrites `deck.md` and sends its synthesis summary as a message.

A child that returns nothing is retried once with the same prompt. After a second empty return the
parent performs that phase itself and records the substitution in the build log. There is no wait
tool, so the parent continues each phase from the child's message and uses `send_message` for
follow-up questions.

## Phase 4: compile, gate, look (at most 3 cycles)

```bash
# 4a. compile (a deck with `tonality:` in its frontmatter needs no --template flag)
node "$SKILL_ROOT/scripts/compile-deck.js" deck.md --pptx output.pptx --embed-fonts

# 4b. the QA gate: overflow, overlap, contrast, anti-slop, craft floor. Non-zero exit is a failure.
python3 "$SKILL_ROOT/scripts/qa_deck.py" output.pptx

# 4c. render the first pages and open the images
python3 "$SKILL_ROOT/scripts/render_pages.py" output.pptx --out-dir renders --pages 5
```

Add `--template <NAME>` to 4a for a legacy or learned template. When 4b fails or the images show a
problem:

1. Read the QA reasons and the rendered pages together.
2. Fix `deck.md`: shorten the overflowing text, drop items, change the family, repair the structure.
   Edit the source and leave the gate as it is.
3. Compile, gate and render again.
4. After the third cycle, report a defect that persists as a blocker, with the check id and the
   slide number.

A clean gate says the file has no detectable defect; it does not say the slides are good. The look at
the rendered pages is part of the phase, and `references/anti-slop-checklist.md` lists what to look
for. Render pages stay in `renders/` beside the deck or under `.litgravity/evidence/<slug>/`.

## Phase 5: report

Report the result in the user's language with the file path, the slide count, the design and the gate
status:

```
PPTX 생성 완료: output.pptx (12장, ledger)
검증: qa_deck 통과, 폰트 임베딩 완료
```

State any blocker or unresolved item after that, with the decision it needs. The agent orchestration
stays in the evidence files.

## State and resume

Keep `.pptx-pipeline/autopilot-state.json` with `active`, `phase` (thesis, antithesis, synthesis,
compile, qa or complete), `qa_cycle`, `max_qa_cycles` and timestamps. Resume only from valid JSON
whose paths sit inside the working directory; a stale, malformed or skill-folder path stops the
stage with a question.

## Tools

`invoke_subagent`, `send_message`, `read_file`, `write_file`, `run_command` for `compile-deck.js`,
`qa_deck.py`, `layout_inventory.py` and `render_pages.py`. The output belongs in the user's working
directory; the skill folder stays untouched.
