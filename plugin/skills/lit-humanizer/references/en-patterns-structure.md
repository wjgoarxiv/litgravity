# English patterns: structure, formatting and source use

Thirty-one entries about the shape of sentences, paragraphs and pages: contrast formulas, triads, rhythm, list and heading habits, decoration, leftover markup, citation problems, chat residue, passive voice and narrator distance. Each merges observations from the sources in `references/en-patterns.md`. An entry is a reason to inspect a passage; most documents need only a few of them.

Entries follow the same layout as the content shard: Sources, What and why, Detect, two before-and-after pairs, Leave it, Evidence.

## EN-S01 | Negative-then-positive contrast
- Sources: HumanInk #9 (6); humanizer 1; stop-slop binary contrast; Wikipedia negative parallelism. Detector: `en-not-x-but-y` (warn when the contrast opens a sentence, or appears twice in a document).
- What and why: "It's not just a tool, it's a movement." The sentence invents a weaker view so it can correct it.
- Detect: Paired negative and positive halves. Ask whether anyone held the negative view.
- Before → after:
> Before: This isn't just a scheduling app. It's a new way to run a clinic.
> After: The app books appointments and sends reminders the day before.
> Before: The issue wasn't the code, it was the process.
> After: The code passed review; the release skipped the staging step.
- Leave it: A contrast that corrects a belief the reader plausibly holds, or one stated once in the middle of a sentence.
- Evidence: weak as authorship evidence; common enough in generated prose to justify the warning.

## EN-S02 | Forced three-part list
- Sources: HumanInk #10 (5); humanizer 6; stop-slop rhythm; Wikipedia rule of three. Detector: `en-forced-triad` (warn on a narrow cluster of generic product adjectives).
- What and why: "Fast, reliable, and scalable." Related ideas are pushed into threes for a feeling of completeness.
- Detect: A triad whose third member is vaguer than the first two, or whose members overlap.
- Before → after:
> Before: The service is fast, reliable, and scalable.
> After: The service answers in under 200 ms and has not missed its uptime target this year.
> Before: We value clarity, transparency, and openness.
> After: We publish our meeting notes every Friday.
- Leave it: A real three-part list (three sites, three steps, three options).
- Evidence: weak.

## EN-S03 | Repeated sentence opening
- Sources: humanizer 7; stop-slop rhythm.
- What and why: "The team… The team… The team…" or "This… This… This…" across neighbouring sentences with no rhetorical purpose.
- Detect: Compare the first two words of adjacent sentences.
- Before → after:
> Before: The team tested the build. The team found two bugs. The team fixed them on Tuesday.
> After: Testing turned up two bugs, which the team fixed on Tuesday.
> Before: This change adds caching. This reduces load. This also lowers cost.
> After: The change adds caching, which reduces load and lowers cost.
- Leave it: Anaphora in a speech; parallel steps in a procedure.
- Evidence: weak.

## EN-S04 | Staged question or false alternative
- Sources: humanizer 4 and 5; stop-slop rhetorical setup; HumanInk #21 (9) for praise framing.
- What and why: "So what does this mean for you?" "Is it speed or accuracy? The answer is both." The question stages a reveal the text could simply state.
- Detect: A question the next sentence answers; an either-or the text then dissolves.
- Before → after:
> Before: So why does this matter? Because the queue doubles every Monday.
> After: The queue doubles every Monday.
> Before: Should you choose speed or accuracy? With this tool, you don't have to.
> After: The tool keeps accuracy at 98% while processing twice as many files.
- Leave it: An FAQ, whose questions are the reader's own, and a real decision question.
- Evidence: weak.

## EN-S05 | Dramatic fragments and negative listing
- Sources: stop-slop structures; humanizer 2 and 5. Related detector: `en-negative-pledge` blocks the document-level form ("This is not intended as a benchmark").
- What and why: "No setup. No fees. No surprises." Fragments build drama before one ordinary point, or a thing is defined by what it lacks.
- Detect: Runs of verbless fragments; three or more "no X" clauses.
- Before → after:
> Before: No forms. No waiting. No hassle. Just results.
> After: You can renew online in about five minutes.
> Before: This table is not a ranking. It is not a benchmark. It makes no claim about vendors.
> After: The table lists the six vendors alphabetically with their published prices.
- Leave it: Advertising copy the user asked for; a short list of real exclusions in a contract or a specification.
- Evidence: weak.

## EN-S06 | Colon reveal or announced takeaway
- Sources: humanizer 4; HumanInk #15 (6) for label lists; no-ai-slop colon check. Detector: `en-colon-reveal` (warn).
- What and why: "The result: a 40% drop." "Here's the thing:" A routine fact is staged as a reveal.
- Detect: A short label and a colon before a plain fact.
- Before → after:
> Before: The bottom line: costs fell.
> After: Costs fell 12% in the second quarter.
> Before: Here's the kicker: nobody had read the manual.
> After: None of the five operators had read the manual.
- Leave it: Labels in a specification, a glossary or a form.
- Evidence: weak.

## EN-S07 | Transition-word chain
- Sources: HumanInk #27 (5); stop-slop transitions; Wikipedia signposting.
- What and why: Moreover, Furthermore, Additionally, Consequently at the start of each paragraph. Every relation is announced, including obvious ones.
- Detect: Count paragraph-initial transitions.
- Before → after:
> Before: Furthermore, the tool is free. Moreover, it runs offline. Additionally, it supports PDF.
> After: The tool is free, runs offline and reads PDFs.
> Before: Consequently, the meeting was moved.
> After: The meeting moved to Thursday because the room was booked.
- Leave it: Transitions that mark real logic in an argument.
- Evidence: weak.

## EN-S08 | Repeated one-line closer
- Sources: HumanInk #28 (7); humanizer 2 and 13; no-ai-slop ending review. Manual cue: `manual-fake-profound-kicker`.
- What and why: Each section ends with a one-sentence paragraph that restates or sloganizes: "And that changes everything."
- Detect: Short final paragraphs that add no fact.
- Before → after:
> Before: The rollout reached all 12 sites by June. And that's just the beginning.
> After: The rollout reached all 12 sites by June.
> Before: Small steps, big results.
> After: (Delete; the paragraph above already states the result.)
- Leave it: A closing line in a speech or personal essay that is the writer's own.
- Evidence: weak.

## EN-S09 | Uniform paragraph lengths
- Sources: HumanInk #29 (6); stop-slop rhythm.
- What and why: Every paragraph has three or four sentences of similar length, whatever the subject's weight.
- Detect: Sentence counts per paragraph across a section.
- Before → after:
> Before: (five paragraphs of exactly three sentences each, one of them about a minor formatting change)
> After: The minor change gets one sentence; the migration gets the space it needs.
> Before: Each section opens with context, gives a fact, and closes with an implication.
> After: Drop the implication sentence where the fact speaks for itself.
- Leave it: Templates readers navigate by.
- Evidence: weak.

## EN-S10 | Bold-label vertical list
- Sources: HumanInk #15 (6); humanizer 19; Wikipedia inline-header lists. Detector: `en-bold-deliverable-label` blocks evidence and caveat labels.
- What and why: "- **Speed:** The tool is fast. - **Cost:** The tool is cheap." Each bullet repeats a bold category and then a sentence.
- Detect: Every bullet begins with a bold word and a colon.
- Before → after:
> Before: - **Performance:** Pages load faster. - **Security:** Sessions expire sooner.
> After: Pages load faster, and sessions now expire after 30 minutes.
> Before: **Evidence basis:** the vendor's datasheet.
> After: The vendor's datasheet lists the rating.
- Leave it: Reference lists that readers scan by label (glossaries, option tables).
- Evidence: weak for lists; validated for pasted evidence labels in deliverables.

## EN-S11 | Bullets replacing connected prose
- Sources: HumanInk #34 (5); humanizer 19; Wikipedia list format.
- What and why: An argument is broken into bullets, and the "because" and "so" between them disappear.
- Detect: Bullets that read as one chain of cause and effect.
- Before → after:
> Before: - Traffic rose. - The cache filled. - Requests timed out.
> After: Traffic rose until the cache filled, and then requests started timing out.
> Before: - The form was confusing. - Users abandoned it. - We redesigned it.
> After: Users abandoned the confusing form, so we redesigned it.
- Leave it: Independent items, checklists and slides.
- Evidence: weak.

## EN-S12 | Numbered steps for a simple sequence
- Sources: HumanInk #35 (5); humanizer layout.
- What and why: "Step 1: Open the file. Step 2: Read it." Two easy actions dressed as a procedure.
- Detect: Numbered lists of two or three trivial steps.
- Before → after:
> Before: 1. Open settings. 2. Click Save.
> After: Open settings and click Save.
> Before: Step 1: Read the email. Step 2: Reply.
> After: Reply to the email.
- Leave it: Procedures where order matters and readers will refer back by number.
- Evidence: weak.

## EN-S13 | Heading repeats title or body
- Sources: humanizer 20 and 24; Wikipedia headings and titles.
- What and why: The page title appears again as an H1, or a heading is followed by a sentence that restates it.
- Detect: Compare each heading with the line after it.
- Before → after:
> Before: ## Installation / This section explains how to install the tool.
> After: ## Installation / Run `npm install` in the project folder.
> Before: # Quarterly Report (page title "Quarterly Report")
> After: Start with the first section heading.
- Leave it: Formats that require both (some document templates).
- Evidence: weak.

## EN-S14 | Title Case and heading-level decoration
- Sources: HumanInk #16 (4); Wikipedia title case, skipped levels, many top-level headings, thematic breaks.
- What and why: Every Word Capitalized, H2 jumping to H4, or horizontal rules between every section.
- Detect: Heading case inconsistent with the house style; skipped levels; rules used as decoration.
- Before → after:
> Before: ## How To Configure The Proxy Server
> After: ## How to configure the proxy server (in a sentence-case house style)
> Before: ## Setup / --- / #### Options
> After: ## Setup / ### Options
- Leave it: A house style that uses title case.
- Evidence: weak.

## EN-S15 | Bold used as decoration
- Sources: HumanInk #14 (4); humanizer 19; Wikipedia boldface.
- What and why: Many phrases bolded per paragraph, so emphasis loses contrast.
- Detect: More than one or two bold spans per paragraph in body text.
- Before → after:
> Before: The **new policy** applies to **all staff** from **1 May**.
> After: The new policy applies to all staff from **1 May**.
> Before: **Please note** that **access** is **restricted**.
> After: Access is restricted.
- Leave it: Quick-reference cards and UI labels the reader must find fast.
- Evidence: weak.

## EN-S16 | Emoji as professional formatting
- Sources: HumanInk #17 (5); Wikipedia emoji.
- What and why: 🚀, ✅, 💡 stand in for headings or emphasis in a report.
- Detect: Emoji at line starts in professional prose.
- Before → after:
> Before: 💡 Key insight: users prefer email.
> After: Most users chose email over SMS (64% to 36%).
> Before: ✅ Done: migration.
> After: The migration is complete.
- Leave it: Chat, social posts and team channels where emoji are the norm.
- Evidence: weak.

## EN-S17 | Em dash as a default connector
- Sources: HumanInk #13 (5); humanizer 8; Wikipedia em dash; stop-slop punctuation. Detector: `en-em-dash-cluster` (warn).
- What and why: Dashes bridge clause after clause without saying how they relate.
- Detect: Several em dashes in one line or paragraph.
- Before → after:
> Before: The fix — which took two days — worked — mostly.
> After: The fix took two days and worked for all but one client.
> Before: There's one problem — cost.
> After: The problem is cost.
- Leave it: A writer's established style, and a single dash for a real aside.
- Evidence: weak. A single dash is ordinary punctuation.

## EN-S18 | Hyphenated compound overuse
- Sources: humanizer 10; no-ai-slop hyphen check.
- What and why: "Data-driven, user-centric, future-proof, best-in-class." Compound modifiers pile up as buzzwords or break the house style.
- Detect: Clusters of hyphenated modifiers.
- Before → after:
> Before: A data-driven, user-centric, future-proof approach.
> After: An approach based on last year's usage logs.
> Before: The well-designed, easy-to-use, feature-rich app.
> After: The app has a search bar and offline mode.
- Leave it: Standard compounds ("long-term loan", "real-time clock").
- Evidence: weak.

## EN-S19 | Parentheses and tables as a holding bin
- Sources: Wikipedia unusual tables; humanizer format rules; stop-slop trust the reader.
- What and why: Details the sentence should state are dumped into parentheses or into a table with one column of prose.
- Detect: Several parentheticals per sentence; tables whose cells are full sentences.
- Before → after:
> Before: The test (run twice) passed (with one warning) on Linux (Ubuntu 22.04).
> After: The test passed twice on Ubuntu 22.04, with one warning.
> Before: (a two-column table of "Item" and a paragraph of text per row)
> After: A short paragraph per item.
- Leave it: Units, abbreviations defined once, citations, and comparison tables with real columns.
- Evidence: weak.

## EN-S20 | Broken or unexplained markup
- Sources: Wikipedia markup and template; humanizer 25; detector-research synthesis. Detectors: `en-bracket-status-tag` and `en-plain-meta-label` (block).
- What and why: Leftover `[citation needed]`, `{{template}}`, `[unverified]`, stray HTML, or a bare "Source:" footer in the middle of prose.
- Detect: Bracketed keys, curly templates and markup that do not render.
- Before → after:
> Before: The bridge is 40 m long [unverified].
> After: The design drawing lists the bridge at 40 m; nobody has measured it on site.
> Before: Source: annual report.
> After: The annual report gives the figure in table 4.
- Leave it: Markup in a source file that renders correctly, and a plain attribution directly under a table or figure.
- Evidence: validated for status keys in deliverables.

## EN-S21 | Citation integrity problems
- Sources: Wikipedia citation categories (broken links, invalid identifiers, unrelated references, incomplete book details, unused references, tracking parameters).
- What and why: A citation that looks right but does not support the claim, or does not exist.
- Detect: Open each cited link or identifier with `read_url_content` when the host offers it; check that it says what the sentence claims. Remove tracking parameters.
- Before → after:
> Before: Rainfall rose 30% (Smith 2021). (Smith 2021 is about temperature.)
> After: Rainfall rose 30% according to the regional weather service's 2022 summary. (Or flag the claim as unsupported.)
> Before: https://example.org/report?utm_source=newsletter
> After: https://example.org/report
- Leave it: A citation you cannot check because the source is offline; say so once.
- Evidence: validated for invalid identifiers and dead links.

## EN-S22 | Placeholder text and pseudo-citations
- Sources: Wikipedia phrasal templates and placeholders; HumanInk #20.
- What and why: "[Insert statistic here]", "(Author, Year)", "according to recent studies [1]" with no reference list.
- Detect: Brackets with instructions; citation markers with no target.
- Before → after:
> Before: The program reached [NUMBER] families in [YEAR].
> After: Ask the writer for the numbers, or remove the sentence.
> Before: Adoption is growing rapidly [1]. (no reference [1] exists)
> After: Remove the marker and the unsupported claim, or ask for the source.
- Leave it: Templates the user is still filling in.
- Evidence: validated.

## EN-S23 | Process-heavy edit narration
- Sources: Wikipedia edit summaries; humanizer 25; local workflow vocabulary. Detectors: `en-left-in-narration`, `workflow-jargon`, `en-demo-self-disclaimer` (block).
- What and why: "I've revised the section below", "This version preserves the original meaning", "per the evidence lane". The artifact describes the editing instead of the subject.
- Detect: First-person editing verbs; internal stage names; self-labels such as "demo synthesis".
- Before → after:
> Before: I've updated the summary to reflect the latest numbers.
> After: The summary now uses the March numbers.
> Before: This demo synthesis proposes three controls.
> After: The pilot proposes three controls; none has been tested.
- Leave it: Change notes and pull request descriptions, where describing the change is the job.
- Evidence: validated for first-person narration in deliverables.

## EN-S24 | Abrupt style shift
- Sources: Wikipedia pronounced style shift; humanizer voice preservation.
- What and why: One section suddenly reads differently (formal, list-heavy, full of stock vocabulary) from the sections around it.
- Detect: Read the document in one pass; mark where the voice changes.
- Before → after:
> Before: (a plain, first-person field report with one paragraph that suddenly reads like marketing)
> After: Rewrite that paragraph in the voice of the rest.
> Before: We checked the pumps. Furthermore, it is imperative to underscore the criticality of maintenance.
> After: We checked the pumps. Two need new seals before winter.
- Leave it: Quoted material and deliberate shifts (an appendix, a legal notice).
- Evidence: weak.

## EN-S25 | Internal citation or editor marker in published prose
- Sources: Wikipedia tool-specific citation residue and comment indicators; source-synthesis workflow keys. Detectors: `workflow-jargon`, `en-plain-meta-label` (block).
- What and why: `[C003]`, `[SRC001]`, `oaicite`, `【4†source】`, editor comments. Machine keys appear as if they were citations.
- Detect: Bracketed codes, odd Unicode brackets, internal IDs.
- Before → after:
> Before: Output rose 12% [C003][SRC001].
> After: Output rose 12% (plant report, table 2). The key-to-source map stays in the ledger.
> Before: The policy started in 2021【4†source】.
> After: The policy started in 2021.¹
- Leave it: Internal records, where the keys are the point.
- Evidence: validated.

## EN-S26 | Chat residue and reflexive agreement
- Sources: HumanInk #19 (10), #21 (9), #33 (8); humanizer chatbot residue; no-ai-slop conversation residue. Detectors: `en-chatbot-opener`, `en-hope-helps`, `en-chatbot-closer`, `en-ai-self-disclaimer` (block); `en-closer-offer` (warn).
- What and why: "Great question!", "Certainly! Here is…", "I hope this helps", "Let me know if you'd like another version". The text addresses a chat user instead of the document's reader.
- Detect: Greetings, praise for the question, offers, sign-offs.
- Before → after:
> Before: Great question! Here's a summary of the survey results.
> After: (Start with the summary.)
> Before: I hope this helps! Let me know if you'd like a shorter version.
> After: (End after the last fact.)
- Leave it: A real chat reply, where a brief offer can be useful. Never in the artifact.
- Evidence: validated.

## EN-S27 | Context-free modern-world opener
- Sources: HumanInk #25 (8), #7 (9); Wikipedia generalization and significance.
- What and why: "In today's fast-paced digital world…" A sweeping claim about the era delays the topic.
- Detect: Openers about "today's world", "the modern era", "an increasingly connected society".
- Before → after:
> Before: In today's fast-paced world, efficient scheduling is more important than ever.
> After: Clinic staff spend about six hours a week rescheduling appointments.
> Before: In an era of rapid technological change, libraries must adapt.
> After: The library added e-book lending in 2024; loans doubled in a year.
- Leave it: An essay whose subject is the era itself, with dates and specifics.
- Evidence: weak.

## EN-S28 | Passive voice that hides a needed actor
- Sources: stop-slop passive structures; Wikipedia communication and attribution.
- What and why: "Mistakes were made." The passive hides who acted when the reader needs to know.
- Detect: Passives without an agent where responsibility matters.
- Before → after:
> Before: The data was deleted.
> After: The nightly cleanup job deleted the data.
> Before: It was decided to postpone the launch.
> After: The steering group postponed the launch.
- Leave it: Scientific methods sections, unknown actors, and sentences where the object is the topic. Never invent an actor.
- Evidence: weak. Passive voice is correct English.

## EN-S29 | Quote-style mixing
- Sources: HumanInk #18 (3); document typography conventions.
- What and why: Straight and curly quotes, or single and double quotes, mixed without a house-style reason.
- Detect: Both styles in one document.
- Before → after:
> Before: She called it "urgent" and the memo said “final”.
> After: She called it “urgent” and the memo said “final”.
> Before: The 'beta' and "preview" labels.
> After: The “beta” and “preview” labels.
- Leave it: Code, where straight quotes are required, and quoted source text.
- Evidence: weak. The lowest-weight HumanInk item.

## EN-S30 | False agency in objects and abstractions
- Sources: stop-slop false agency; Wikipedia communication; humanizer active voice.
- What and why: "The data tells us", "The report decided", "The market wants". An object acts in place of the person or system that did.
- Detect: Inanimate subjects with verbs of judgment or desire.
- Before → after:
> Before: The data tells us customers prefer weekends.
> After: Weekend bookings were 60% of the total.
> Before: The policy decided to exclude contractors.
> After: The board excluded contractors from the policy.
- Leave it: Conventional figures of speech that are clear ("the study found").
- Evidence: weak.

## EN-S31 | Distant narrator and rhetorical setup
- Sources: stop-slop narrator distance and sentence starters; humanizer direct openings.
- What and why: "It is interesting to consider", "One might argue", "Let us now turn to". The text tells readers an explanation is coming.
- Detect: Sentences with no content beyond announcing the next one.
- Before → after:
> Before: Let us now turn to the question of cost.
> After: The upgrade costs 14,000 a year.
> Before: One might argue that the delay was avoidable.
> After: The delay was avoidable: the parts were in stock a week earlier.
- Leave it: Academic prose that signposts a long argument, used sparingly.
- Evidence: weak.

## Order of passes for a long document

Structural tells interact, so the order of passes saves rework.

1. **Residue first.** Remove EN-S26 chat residue, EN-S23 edit narration, EN-S25 internal keys and EN-S20 status tags. These are blocks; they come out before anything else is judged, because they distort the rhythm counts that follow.
2. **Citations second.** Check EN-S21 and EN-S22. A broken citation changes what the paragraph may claim, which changes every later edit in it.
3. **Page shape third.** Decide headings (EN-S13, EN-S14), lists versus prose (EN-S10, EN-S11, EN-S12) and decoration (EN-S15, EN-S16). Converting a list into prose is the biggest structural move; do it before polishing sentences inside the list.
4. **Sentence shape last.** Contrast (EN-S01), triads (EN-S02), openings (EN-S03, EN-S27, EN-S31), reveals (EN-S04, EN-S06), transitions (EN-S07), closers (EN-S08), dashes (EN-S17), passives and false agency (EN-S28, EN-S30).
5. **One read for voice.** EN-S24 can only be judged with the whole document in view. Read it once from top to bottom after the other passes.

Stop when the remaining hits are warnings you have read and decided to keep. A page with a few deliberate contrasts and a passive or two is normal English.
