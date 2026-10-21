# Session walkthrough: what each phase leaves on disk

Read this when resuming a session or when unsure what a phase should have written. The board is the single source of truth, and a compacted conversation continues from it.

## After Phase 0 (frame)

The board holds the frame block filled in, the chosen how-might-we statement and the list of hard and soft constraints. A ledger `decision` line records the altitude the user picked, or the default taken when nobody answered. The round log is empty.

## After each divergent round

- The round heading with its technique names.
- Ideas numbered continuously, each with its tag and source.
- The variety check line: mechanism and count.
- A `decision` line only when the user answered the invitation with a steer (for example "go weirder").

Resume rule: count the ideas, read the last round heading, and continue with the next technique in the rotation. A half-written round is completed from its heading by listing ideas up to the target.

## After Phase 2 (cluster)

- The cluster table, merged links and orphans with their second looks.
- Any mini-round ideas, tagged `[gap]`.
- The compact cluster list shown to the user.

## After Phase 3 (criteria)

- The criteria block with weights and gates and the line "Confirmed by: user" or "Confirmed by: default (provisional)".
- A ledger `decision` line with the criteria and weights.

## After Phase 4 (converge)

- The screen section with every removal and its reason.
- The score table with evidence labels, weighted and unweighted columns, and the secondary views.
- `<slug>-shortlist.md`.
- A ledger `decision` line with the user's pick or keep-alive list.

## After Phase 5 (hand off)

- `<slug>-handoff.md` with the seven headings.
- A ledger `decision` line with the destination and the packet path.
- The reply: shortlist lines, destination, packet path, provisional notes and one action.

## Resuming after a long gap

1. Read the board top to bottom and note the last completed phase from the sections that exist.
2. Re-open any file the frame cites, because the repository may have moved on.
3. Say "resuming at phase N" in one line.
4. When the user's goal changed, start a new slug and link the old board in the frame under "Already tried or rejected".

## Checking a packet before reporting done

Search the packet for the seven headings and confirm that `Direction the user leaned toward` contains `A`, `B` or `none`. A packet with a heading missing or renamed is repaired before the reply goes out, because the interview route matches headings by name.

## Common edge cases

- The user adds an idea during clustering: add it as a new id with `[user]`, place it in a cluster and note it in the cluster table.
- The user rejects the whole field: ask one question about what is missing, run one lens pass on that answer, and cluster again. The extra round is allowed once.
- Two ideas tie after the duel: report the tie, name the tie-break and let the user pick.
- The shortlist has one entry: say so. A single survivor after the screen means the constraints were tight, and the report names the constraint that did the work.
