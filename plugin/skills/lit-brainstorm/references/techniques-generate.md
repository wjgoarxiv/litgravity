# Generative techniques

## SCAMPER

Seven mutation prompts for something that already exists. Write at least one idea per prompt and up to three where the prompt fits well.

| Letter | Prompt | Example |
| --- | --- | --- |
| Substitute | What can be replaced: a material, a rule, a person, a step? | swap the nightly batch for an on-change trigger |
| Combine | What can merge with something else? | merge the report and the alert |
| Adapt | What else resembles this, and what can be borrowed from it? | borrow queue discipline from a restaurant kitchen |
| Modify | What if it were ten times bigger or smaller, more or less frequent? | run it yearly instead of daily |
| Put to other use | Who else could use it? | hand it to support instead of engineering |
| Eliminate | What can disappear entirely? | drop the approval step |
| Reverse | What if the order or the roles flipped? | the user writes the check and the system writes the feature |

Tag as `[SCAMPER:substitute]` and so on.

## Analogy

1. State the shape of the problem abstractly: "many small requests compete for a scarce slot".
2. Name three to five fields with the same shape: airport gates, restaurant seating, network congestion control, ant foraging.
3. For each field, write the mechanism it uses and transplant it into the frame as an idea.
4. Keep the source in the tag: `[analogy:airport-gates]`.

## Constraint flips

Push one constraint to an extreme and solve again:

- budget at zero, budget a hundred times larger;
- one day of time, one year of time;
- a team of one, a team of fifty;
- must work offline, must serve a million users;
- must be invisible to the user, must be the whole product.

The extreme answer often contains a portable piece. Extract that piece as its own idea.

## Worst-idea inversion

1. Write eight to ten of the worst ways to handle the problem: harmful, expensive, annoying, embarrassing. Vivid is better.
2. Invert each one. Ask for the opposite, or for the part that is secretly good.
3. Add the inversions as ideas tagged `[worst:inverted]`. Keep the bad originals in a collapsed list so the reasoning stays visible.

## Random stimulus

Draw a concrete noun from a fixed outside list (lighthouse, ledger, hinge, tide, orchestra, spice rack, bridge, compass). A fixed list matters because the model's favourite nouns repeat. Force three connections between the noun and the problem, keep those that produce a real mechanism, and score none of them on plausibility during the round.

## Crazy eights

Eight ideas in eight short bursts, one line each, each deliberately unlike the one before. A Quick shape runs two sets of eight under two different frames.
