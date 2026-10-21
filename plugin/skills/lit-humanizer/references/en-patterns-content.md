# English patterns: content and wording

Twenty entries about what a sentence claims and the words it uses to claim it: inflated importance, borrowed authority, stock vocabulary, filler, hedges and empty conclusions. Each merges overlapping observations from the five sources listed in `references/en-patterns.md`. Use an entry to decide whether a sentence earns its words. It tells you nothing about who wrote the sentence.

Every entry has the same parts: Sources (with the HumanInk weight in parentheses), What and why, Detect, two before-and-after pairs on neutral subjects, Leave it (false-positive conditions) and Evidence.

## EN-C01 | Significance inflation
- Sources: HumanInk #1 (9); humanizer 13; Wikipedia significance and legacy. Detector: `en-testament` blocks the fixed "testament to" formula.
- What and why: A modest event gets a sweeping historical or social claim. The added claim outgrows the fact and is usually unsupported.
- Detect: Look for importance verbs (marks, represents, underscores, stands as) and broad consequence claims. For each clause, ask which source supports it.
- Before → after:
> Before: The library opened a second reading room in 2019, marking a pivotal moment in the town's cultural life.
> After: The library opened a second reading room in 2019.
> Before: The new intake form stands as a testament to the clinic's commitment to patients.
> After: The clinic replaced its paper intake form with a two-page online form.
- Leave it: Importance the source attributes to someone, or importance backed by a measure ("the largest flood since 1952 by river gauge").
- Evidence: weak as authorship evidence; strong as an editing check whenever the clause adds interpretation the source lacks.

## EN-C02 | Coverage and notability padding
- Sources: HumanInk #2 (7); Wikipedia coverage and notability.
- What and why: A list of outlets, followers or awards stands in for what any of them said.
- Detect: An outlet list with no claim, date or context attached.
- Before → after:
> Before: Her research has been featured in numerous outlets, including two national papers and several podcasts.
> After: In a 2023 radio interview, she described how the survey sampled rural households.
> Before: The project has 40,000 stars and wide recognition across the community.
> After: The repository had about 40,000 stars in March 2025.
- Leave it: A bibliography or press page whose job is to list coverage. Do not infer what the coverage proves.
- Evidence: weak. Context-sensitive; ordinary press mentions are not suspicious in themselves.

## EN-C03 | Superficial analysis rider
- Sources: HumanInk #3 (8); humanizer 15; Wikipedia superficial analysis.
- What and why: A trailing "-ing" clause tells the reader what a fact represents ("highlighting", "underscoring", "reflecting") without evidence.
- Detect: A participle clause hung on the end of a complete factual sentence.
- Before → after:
> Before: The bridge reopened on Monday, highlighting the city's dedication to safe infrastructure.
> After: The bridge reopened on Monday after six weeks of deck repairs.
> Before: The logo uses green and white, reflecting the valley's agricultural heritage.
> After: The designer chose green and white to refer to the valley's farms.
- Leave it: An interpretation a named source makes, worded faithfully to that source.
- Evidence: weak. A recognizable habit; it proves nothing about intent.

## EN-C04 | Promotional wording
- Sources: HumanInk #4 (8); humanizer 16; Wikipedia promotional language; no-ai-slop puffery. Detector: `en-lexical-tell` warns on part of this vocabulary.
- What and why: A neutral description turns into brochure copy: vibrant, nestled, breathtaking, world-class, rich history.
- Detect: Clusters of praise words. Replace each with the location, feature or action it stands for.
- Before → after:
> Before: Nestled in the vibrant heart of the old quarter, the museum offers a breathtaking journey through local history.
> After: The museum is on Market Street in the old quarter and has three rooms on the town's mills.
> Before: Our world-class team delivers exceptional results.
> After: The team of six handled 1,140 support tickets last quarter.
- Leave it: Marketing copy the user asked for; quoted reviews; the name of an award.
- Evidence: weak as an authorship clue; useful as a check for unsupported claims.

## EN-C05 | Vague authority
- Sources: HumanInk #5 (7); humanizer 17; Wikipedia vague attribution. Detector: `en-weasel-attribution` (warn).
- What and why: "Experts say", "studies show", "many believe". The reader cannot check the claim.
- Detect: An anonymous plural authority attached to a specific claim.
- Before → after:
> Before: Experts agree that four-day weeks improve focus.
> After: A 2022 trial with 61 employers reported fewer sick days during the four-day week.
> Before: Studies have shown the coating lasts longer.
> After: In the supplier's salt-spray test, the coating lasted 1,000 hours. (Or, with no source in the draft: "We expect the coating to last longer; we have not tested it.")
- Leave it: A real consensus the reader can verify in a cited review. When the draft has no source, mark the claim as the writer's view and leave the source blank; a plausible invented source is fabrication.
- Evidence: weak as an authorship cue; a real source-quality concern.

## EN-C06 | Stock challenges-and-outlook paragraph
- Sources: HumanInk #6 (6), #24 (8), #28 (7); humanizer 13; Wikipedia challenges and future headings. Detector: `en-plain-caveat-label` warns on bare caveat headings.
- What and why: A closing paragraph says "despite its successes, X faces challenges" and "the future looks promising", with nothing specific.
- Detect: A challenges or outlook paragraph that names no challenge, owner or date.
- Before → after:
> Before: Despite these achievements, the program faces several challenges. Nevertheless, its future looks bright.
> After: The program loses its grant in June 2026 and has not found a replacement funder.
> Before: Challenges remain, but the outlook is promising.
> After: Two of the five sites still lack a trained operator.
- Leave it: A required risk section filled with real risks. When the draft names none, cut the paragraph; inventing a risk is a fidelity defect.
- Evidence: weak. A useful editorial test.

## EN-C07 | Broad model-associated vocabulary
- Sources: HumanInk #7 (9); humanizer 12; no-ai-slop vocabulary list; Wikipedia language section. Detector: `en-lexical-tell` (warn).
- What and why: Words such as delve, tapestry, intricate, multifaceted, realm, pivotal, foster, showcase, seamless, robust and leverage cluster in generated prose. One of them in a sentence means nothing; a cluster deserves a reread.
- Detect: Count the listed words per paragraph and reread the dense spots.
- Before → after:
> Before: This report delves into the intricate tapestry of factors that foster engagement.
> After: This report looks at four factors that changed how often members logged in.
> Before: The tool showcases a robust, seamless workflow.
> After: The tool exports a draft to PDF in one step.
- Leave it: A listed word that is exactly right ("robust statistics", "an intricate gear train").
- Evidence: weak. Lists differ by genre, time and model; this one prompts review.

## EN-C08 | Avoidance of simple copulas
- Sources: HumanInk #8 (7); humanizer 18; Wikipedia basic copulative.
- What and why: "Serves as", "stands as", "boasts", "features" replace "is" and "has". The sentence gets longer and grander without new meaning.
- Detect: Look for these verbs where "is" or "has" would work.
- Before → after:
> Before: The hall serves as the venue for the annual meeting.
> After: The annual meeting is held in the hall.
> Before: The apartment boasts two bedrooms and a balcony.
> After: The apartment has two bedrooms and a balcony.
- Leave it: "Serves as" when the role is temporary or functional ("the gym serves as a shelter during floods").
- Evidence: weak.

## EN-C09 | Vague relation word
- Sources: HumanInk #5 (7); humanizer 14; Wikipedia connection and association.
- What and why: "Associated with", "linked to", "in connection with" blur whether one thing caused, accompanied or merely sat near another.
- Detect: Relation phrases where the source states a specific relation.
- Before → after:
> Before: Late shipments were associated with the warehouse move.
> After: Shipments ran two days late during the week of the warehouse move.
> Before: The outage was linked to the update.
> After: The outage started four minutes after the update was deployed; the cause is still under review.
- Leave it: Epidemiology and statistics, where "associated with" is the precise, deliberately non-causal term. Clarify only from supplied facts.
- Evidence: weak.

## EN-C10 | Throat-clearing and filler
- Sources: HumanInk #22 (6), #30 (7); humanizer 4, 12; no-ai-slop list; stop-slop phrases. Detectors: `en-throat-clearing` (warn), `en-lets-dive` and `en-chatbot-opener` (block).
- What and why: "It is important to note that", "When it comes to", "Let's dive in", "Certainly!" Words before the point that add nothing.
- Detect: Delete the opening phrase and see whether the sentence loses anything.
- Before → after:
> Before: It is important to note that the deadline moved to Friday.
> After: The deadline moved to Friday.
> Before: Let's dive in. When it comes to budgets, the team spent 82% of its allocation.
> After: The team spent 82% of its budget.
- Leave it: A transition that marks a real shift for a listener (a spoken talk, a long tutorial).
- Evidence: validated for exact pasted service and filler residue; weak for general word lists.

## EN-C11 | Empty conclusion
- Sources: HumanInk #24 (8), #28 (7); humanizer 2, 13; no-ai-slop ending review. Detector: `en-conclusion-opener` (warn).
- What and why: "In conclusion", "Overall", "Ultimately" followed by a restatement or a slogan.
- Detect: Compare the last paragraph with the body. If it adds no decision, action or new relation, it is a recap.
- Before → after:
> Before: In conclusion, the migration was a success that sets the stage for future growth.
> After: The migration finished on 4 March. The old database will be shut down on 1 April.
> Before: Overall, these findings highlight the importance of planning.
> After: Teams that wrote a plan finished an average of nine days earlier.
- Leave it: A summary a long document needs for readers who skip to the end. Keep it factual.
- Evidence: weak.

## EN-C12 | False range or synonym cycling
- Sources: HumanInk #11 (6), #12 (5); humanizer 7; no-ai-slop repetition check.
- What and why: "From small startups to global enterprises" names a range nobody measured. Cycling synonyms (the app, the platform, the solution, the tool) makes readers wonder whether four things exist.
- Detect: "From X to Y" where X and Y are not endpoints of a real scale; different nouns for one referent in adjacent sentences.
- Before → after:
> Before: The guide helps everyone from beginners to seasoned experts.
> After: The guide assumes no prior experience.
> Before: The app syncs notes. The platform also stores images, and the solution encrypts both.
> After: The app syncs notes, stores images and encrypts both.
- Leave it: A real range ("from 4 °C to 9 °C") and deliberate variation in literary prose.
- Evidence: weak.

## EN-C13 | Rubber-stamp adjectives
- Sources: HumanInk #32 (5); no-ai-slop importance check. Detector: `en-lexical-tell` covers some of them.
- What and why: Crucial, essential, key, vital and significant pinned to every noun. When everything is key, nothing is.
- Detect: Remove the adjective and check whether the sentence changes meaning.
- Before → after:
> Before: Key stakeholders will attend a crucial meeting about essential changes.
> After: The three department heads will meet to approve the schedule change.
> Before: Testing plays a vital role in the process.
> After: Each release waits for the test suite to pass.
- Leave it: "Significant" in its statistical sense; "critical" for a system that can fail dangerously.
- Evidence: weak. Context decides whether the modifier carries information.

## EN-C14 | Stacked hedging
- Sources: HumanInk #23 (7); humanizer 9; no-ai-slop qualifier check. Detectors: `en-stacked-hedges` (warn), `en-stacked-limitation-chain` (block).
- What and why: "Could potentially perhaps suggest". Several hedges on one claim blur how uncertain the writer is.
- Detect: Count qualifiers per sentence. The write guard treats two per sentence or four per paragraph as stacked.
- Before → after:
> Before: This could potentially suggest that the filter might possibly reduce noise.
> After: The filter may reduce noise.
> Before: It seems that the results arguably indicate a likely trend.
> After: The results suggest a trend; three data points are too few to confirm it.
- Leave it: Medical, legal, scientific and forecast text where each qualifier has a job. Keep the qualifier that sets the claim's strength.
- Evidence: weak. Strong meaning-preservation exceptions.

## EN-C15 | Source-gap speculation and model-limit wrappers
- Sources: HumanInk #20 (8); humanizer 23; Wikipedia knowledge cutoff and source gaps. Detectors: `en-knowledge-cutoff`, `en-ai-self-disclaimer`, `en-standalone-scope-disclaimer` (block); `en-epistemic-negation`, `en-not-performed` (warn).
- What and why: "As of my last update", "while specific details are limited", "it is likely that X, although no sources confirm it". The text speculates to fill a gap, or carries a model's status note into an authored document.
- Detect: Model-status phrases; speculation introduced by a missing-information clause.
- Before → after:
> Before: As of my last knowledge update, the bridge was scheduled to reopen in spring.
> After: The council's March notice scheduled the bridge to reopen in May.
> Before: While specific details are scarce, the founder likely studied engineering.
> After: (Remove the guess. If the gap matters, say so: "The sources do not say where the founder studied.")
- Leave it: A careful statement of what the sources cover, placed once where it matters.
- Evidence: validated for pasted model-limit wrappers; weak for careful source-gap statements.

## EN-C16 | Dead metaphor
- Sources: HumanInk #26 (6); humanizer 3; stop-slop quotable and metaphor checks.
- What and why: Game-changer, paradigm shift, double-edged sword, north star, journey. The image is worn out and stands in for the thing itself.
- Detect: Metaphors that could describe any project.
- Before → after:
> Before: The new scheduler is a game-changer for the support team.
> After: The new scheduler fills weekend shifts automatically, which used to take two hours each Friday.
> Before: Automation is a double-edged sword.
> After: Automation removed the copy step but made errors harder to spot.
- Leave it: Metaphors in an essay or speech that belong to the writer's voice.
- Evidence: weak. Metaphor frequency depends strongly on genre.

## EN-C17 | False analytical depth
- Sources: HumanInk #3 (8); stop-slop interpretation check; no-ai-slop portability check.
- What and why: A sentence sounds insightful but would fit any topic: "This reflects broader shifts in how we think about work."
- Detect: Portability test. If the sentence could be pasted into a different report unchanged, it says nothing specific.
- Before → after:
> Before: This trend reflects a broader transformation in how communities engage with public space.
> After: Weekend visits to the park rose from 900 to 1,400 after the café opened.
> Before: The data reveal deeper truths about consumer behaviour.
> After: Repeat buyers spent 30% more per order than first-time buyers.
- Leave it: A real interpretive claim supported by the analysis around it.
- Evidence: weak. Resolve against the source; do not guess the writer's motive.

## EN-C18 | Exhaustive feature inventory
- Sources: HumanInk #31 (6); no-ai-slop proportionality; stop-slop detail check.
- What and why: Every feature, option and edge case gets equal space, so the one thing the reader needs is buried.
- Detect: Compare the space given to each item with its importance to the stated reader.
- Before → after:
> Before: The release adds dark mode, keyboard shortcuts, a new icon set, export to CSV, faster search, localized dates and an updated font.
> After: The release makes search about three times faster and adds CSV export. Smaller changes are in the changelog.
> Before: (a twelve-row table of every configuration flag in a getting-started guide)
> After: The two flags a new user must set, with a link to the full reference.
- Leave it: Reference documentation and changelogs whose job is completeness.
- Evidence: weak. Completeness can be the assignment.

## EN-C19 | Announced point and emphasis filler
- Sources: stop-slop throat-clearing and emphasis phrases; no-ai-slop filler review; HumanInk #22 (6), #30 (7).
- What and why: "Here's what matters", "The real question is", "Make no mistake", "It's worth emphasizing". The sentence promises a point instead of making it.
- Detect: Phrases that announce importance or candour.
- Before → after:
> Before: Here's what really matters: the backup failed twice.
> After: The backup failed twice.
> Before: Make no mistake, the budget is tight.
> After: The budget leaves 3% for contingencies.
- Leave it: Spoken drafts and op-eds where the writer's voice uses the move deliberately and sparingly.
- Evidence: weak. Phrase lists depend on genre.

## EN-C20 | Sweeping intensifiers and absolutes
- Sources: stop-slop adverb and lazy-extreme checks; no-ai-slop precision review; humanizer word-choice guidance.
- What and why: Truly, incredibly, extremely, always, never, every, completely. Absolutes overclaim; intensifiers replace a measure.
- Detect: Ask what number or exception the word hides.
- Before → after:
> Before: The new process is incredibly fast and always accurate.
> After: The new process takes about 40 seconds; in 500 test runs it made two errors.
> Before: Everyone loves the redesign.
> After: In the feedback form, 41 of 50 users rated the redesign 4 or 5.
- Leave it: An absolute that is literally true ("the field is always required") and intensity in personal writing.
- Evidence: weak. Individual adverbs and absolutes are ordinary language.
