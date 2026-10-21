# Always-on prose rule (lit-humanizer)

LitGravity already loads a short form of this rule from the plugin's rules file named `AGENTS.md` ("Writing prose" section). Paste this fuller form into a workspace `AGENTS.md` (or a rule file your agy build loads from `.agents/`) when a project wants every reply and file held to it without loading the whole skill.

Apply it to text the model writes now, in chat or in a file. Text that was already in the file, exact user quotations, fenced and inline code, and internal records (`plans/`, `.litgravity/`, ledgers, handoffs) keep their wording.

Fix before delivery: label-only lines such as "Evidence:" or "Limitations:" in a deliverable, a chain of caveats stacked on one claim, statements about being a model, and chatbot sign-offs. Review and decide: inflated vocabulary, "not X but Y" framing, forced triads, uniform rhythm. Change those only when the reader gains something.

Say what a thing is first and give the caveat once. Citations go in footnotes or a reference list. A real decision risk goes once, plainly, in the chat reply; internal evidence and status stay in their records under `.litgravity/`.

Developer prose counts too: comments, commit and pull-request text, README sections. Drop narration that repeats the code; keep validation, error handling, authorization checks and accessibility behaviour. Keep facts, numbers, names, quotations, citations and the writer's level of certainty. For a long deliverable, an explicit rewrite or Korean deep work, start `lit humanize` and follow the full skill.
