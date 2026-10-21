AI SLOP REMOVED: <path>
Analysis: found N, fixed M, skipped K
Covering test: <exact command> -> baseline PASS (n) / after PASS (n)   [or: no test covers this file]
Changes:
  1. [Obvious comment] L12-13
     Before: <snippet>   After: <snippet>
     Why slop: <reason>   Why safe: <reason>   Impact: none
Skipped (preserved):
  1. L88 - Q3 context: guard protects a known flaky upstream response
Negative evidence per category:
  Obvious comments: <count>, all explain why
  Unreachable defensiveness: <guards present sit at the external-response boundary at L40>
  Deep nesting: <stays within one level>
Noticed, not touched (for lit-burnoff): <categories outside this skill>
Summary: removed A comments, simplified B defensive patterns, flattened C structures, preserved D look-alikes
Behavior unchanged: yes (covering test identical before and after)
Not done: no commit, tag, push, publish or version bump
