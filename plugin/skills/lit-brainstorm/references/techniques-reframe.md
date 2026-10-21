# Reframing techniques

These run in Phase 0 and again whenever the board shows that the frame is the problem.

## How might we

A how-might-we statement turns a complaint into an invitation: "How might we <verb> <who or what> so that <outcome>?"

1. Take the problem sentence and list the pains, constraints and surprising facts inside it.
2. Write one statement per item at three altitudes. Narrow addresses one symptom, medium addresses the user's stated goal, broad addresses the larger aim.
3. Strip any solution hidden in the verb. "How might we add a dashboard" names an answer; "How might we let people see progress" asks a question.
4. Check the statement against two failure modes: answerable in one step (too small) and needing magic (too large).

Example for "builds are slow". Narrow: how might we shorten the slowest step? Medium: how might we shorten the wait for feedback? Broad: how might we make the wait stop mattering?

Show the three altitudes and let the user pick one. The pick fixes the scope of every later round.

## Five whys upward

Ask "so that what?" up to five times. Faster builds, so that feedback arrives sooner, so that mistakes are cheap to fix, so that releases are safer. Each rung is a candidate frame. Climb until the user's ownership ends and stop there; a frame above that line asks for decisions the user cannot make.

## Assumption reversal

1. List five to eight assumptions about how the thing works ("users sign in first", "someone reviews every change").
2. Negate each one and ask what a solution looks like in the negated world.
3. Keep every reversal that yields at least one concrete idea and tag it `[reverse]`.

## Jobs to be done

Write job statements in the form "When <situation>, I want to <motivation>, so I can <outcome>". Cover the main job, one related job and one emotional or social job. An idea may serve a job without resembling today's product, so judge ideas by the job they serve.
