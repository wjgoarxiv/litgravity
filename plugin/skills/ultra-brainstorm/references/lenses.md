# ultra-brainstorm: the 32 lenses

The workflow script hands idea agent `i` the lens at position `i mod 32` (zero-based) and the seed `i`, so two
neighbouring agents never look through the same lens, and a 100-agent run uses every lens three or four times with
different seeds. Pass the lines below as `args.lenses`, in this order, without the numbers. Each line must work alone:
an idea agent sees its one lens and nothing else from this page. Add lenses at the end; never reorder them, because a
saved `result.json` records which lens index produced which idea.

1. Flip the goal: describe the opposite outcome, then keep the part of it that is secretly useful.
2. Delete a rule everyone treats as fixed; keep what still stands once the rule comes back.
3. Borrow a mechanism from a distant field (biology, logistics, games, finance) and say exactly what carries over.
4. Serve the hardest person: a total beginner, an expert in a hurry, or someone on a bad connection.
5. Take something away until the rest gets better.
6. Join two things in this space that are never joined today.
7. Ask how it was done before computers, and how it will be done when today's tools look quaint.
8. Swap the scarce input (time, money, attention, data) for one that is plentiful.
9. Write the worst possible answer, then reverse the single trait that makes it worst.
10. Replace the question with a better one and answer that.
11. The version that ships tomorrow for almost nothing.
12. The version that is ten times better, and the one thing it would need.
13. Do nothing on purpose: when is that the right call, and what makes it safe?
14. Let it run itself: what could happen with no one deciding each time?
15. Make it social: what changes when two people, a team or a crowd do it together?
16. Make it solitary and private: what changes when no one else can see it?
17. Move the work to a different moment: before, during, long after, or never.
18. Change the unit: one item instead of a batch, or a thousand instead of one.
19. Pay for it differently: free, subscription, per use, traded, or paid by someone else.
20. Remove the screen: voice, paper, a physical object, or a habit instead of a tool.
21. Make failure cheap: how would you design this if mistakes cost nothing to undo?
22. Make it measurable first: what single number would prove it works, and what idea serves that number?
23. Start from the boring middle step everyone skips and make it the product.
24. Design for the edge case and let the common case fall out of it.
25. Ask a rival: how would the strongest competitor or critic attack this, and what survives the attack?
26. Copy nature: how does a living system handle the same pressure?
27. Make it a ritual: something done at a fixed time, in a fixed way, with a clear end.
28. Make it a game: a goal, a rule, feedback and a reason to come back.
29. Strip it to a single sentence a stranger understands, and build only what that sentence promises.
30. Hand it to someone else: what if a different person, role or machine owned this?
31. Make it local: one street, one lab, one repository, one week.
32. Make it permanent: what would still be right in twenty years?
