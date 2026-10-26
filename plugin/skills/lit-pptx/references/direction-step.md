# The direction step

Every deck starts by choosing how it should look, before a single slide is written. The choice is
a tonality: a pack of colours, type sizes, title treatments, layout families and density that the
engine reads as data. Thirteen tonalities ship with the skill, and four legacy templates remain for
users who name them. Without this step the engine would have nothing to draw with, and the skill
would drift back to one look for every topic, which is the failure this whole design exists to end.

The step is short. It reads the brief and the source, ranks the candidate tonalities for the deck
type, writes a direction card, says the choice and two alternatives in the reply, and records the
card in the build log. It asks the user nothing unless the brief leaves the look open on purpose
(then it renders a compare strip) or a dial has to move further than the skill may move it alone.

## 1. Close the brief

Name four facts before ranking anything. When the brief does not say them, infer them from the
request and the sources, and write the inference on the card so the user can correct it.

- **Deck type.** One of the thirteen below, or "other, nearest to …".
- **Reader.** Who sees it, where, and for how long: a board reading at a desk, a hall watching a
  stage screen, a class that will review the file later.
- **Delivery.** Presented live, sent ahead and read alone, or both.
- **Language.** Korean, English or mixed; it changes glyph budgets and the reading ramp.

## 2. Start from the deck type

Each deck type has an ordered list of two or three candidates, with the density and variance they
start from. The first one is the default when nothing else moves the order.

| Deck type | Candidates in order (density, variance) |
|---|---|
| Pitch (투자·제안 피치) | Signal (10, 6); Studio (10, 7); Atlas (10, 7) when the product is something to look at |
| Launch, demo day or campaign (런칭·데모데이·캠페인) | Neo-Brutalism (10, 7); Signal (10, 6); Studio (10, 7) |
| Engineering or developer review (아키텍처·인프라·장애 리뷰) | Computational Brutalism (10, 7); Night (10, 6) for a stage; Ledger (10, 5) when it is read alone |
| Business review (경영 실적 보고) | Ledger (10, 5); Gazette (10, 4) when it is circulated in Korean and read alone; Night (10, 6) for a stage review |
| Research talk (연구 발표) | Paper (10, 5); Night (10, 5) for a keynote room; Chalk (10, 6) for a tutorial |
| Lecture or teaching (강의) | Chalk (10, 6); Paper (10, 5); Studio (10, 7) for a public lecture |
| Design or culture lecture (디자인·건축·전시·워크숍) | Bauhaus (10, 7); Studio (10, 8); Atlas (10, 7) when the works are the deck |
| Data-heavy review (데이터 리뷰) | Night (10, 6); Ledger (10, 5); Paper (10, 5) for a written analysis |
| Image-led (product, site, portfolio) | Atlas (10, 7); Studio (10, 8); Signal (10, 6) for a launch |
| Korean text briefing (보고서형 덱) | Gazette (10, 4); Ledger (10, 5) |
| Status update (주간·월간 보고) | Ledger (10, 5); Gazette (10, 4); Night (10, 6) |
| Community, culture or education programme (커뮤니티·문화·교육 프로그램) | Riso (10, 7); Studio (10, 7); Bauhaus (10, 7) for a design programme |
| Data story for the public (주민·독자 대상 데이터 브리핑) | Newsroom (10, 6); Gazette (10, 4) when it is read alone; Ledger (10, 5) |

## 3. Measure the source and reorder

Draft the outline first (one message per slide, the visual each message needs), then count on that
outline. The signals below move candidates up or down. Apply them in the order listed; ties keep
the deck-type order, so the same source always gives the same choice.

| Signal | When it fires | Effect |
|---|---|---|
| The brief names a tonality, or the user chose one earlier | always wins | use it; still write the card |
| The brief names a legacy template (AZURE-PRO, AZURE-A2Z, BOILERPLATE-PRETENDARD, BOILERPLATE-A2Z) | always wins | use it as named; offer two tonalities as alternatives |
| The brief names a style rather than a pack id | 네오 브루탈리즘, neo-brutalism, neo-brutalist; 컴퓨테이셔널 브루탈리즘, computational brutalism, 레트로 퓨처, retro-futurist, terminal look; 바우하우스, Bauhaus; 리소, risograph, zine; 뉴스룸, data journalism, explainer | that pack, as if named; a bare 브루탈리즘 or brutalist takes Neo-Brutalism for a pitch or launch and Computational Brutalism for a technical deck, and the card says which reading it took |
| The deck is read rather than presented (sent ahead, circulated, "보고서") | stated in the brief | Gazette (Korean) or Ledger (other languages) to the front, density 10 |
| Slides with a table | 30 % or more | Ledger or Gazette up one place |
| Slides with a chart | 30 % or more | Ledger, Night or Paper up one place |
| Slides with an image or screenshot | 30 % or more | Atlas or Studio up one place, Gazette down |
| Body text per content slide | 150 Korean glyphs or 300 Latin characters and more | Gazette or Ledger up, Signal down |
| Body text per content slide | 40 Korean glyphs or 80 Latin characters and less | Signal or Studio up; density 10 still (the strip and the basis rows fill short slides) |
| Numbered citations, DOIs or a references slide | present | Paper up one place |
| Equations, definitions, or a how-it-works sequence of three or more steps | present | Chalk or Paper up one place |
| A dark room (keynote, stage, demo day) | stated in the brief | Night up one place |
| Metrics with units, version numbers or identifiers (p99, rps, v3, endpoint names) | on a third of the content slides | Computational Brutalism up one place |
| A young or consumer audience, a sign-up or launch ask | stated in the brief | Neo-Brutalism up one place |
| Works, makers, periods or schools as the subject | on a third of the content slides | Bauhaus up one place |
| Participants, sessions, dates and places for a community or a class | on a third of the content slides | Riso up one place |
| Charts with one point each, for readers outside the field (residents, members, the press) | stated in the brief | Newsroom up one place |
| A board, investor committee, finance or public-sector reader, or a sensitive topic (loss, safety, HR) | stated in the brief | Neo-Brutalism, Computational Brutalism, Bauhaus and Riso drop out |
| A pack would leave a slide role with no family or title it allows | any slide | drop that pack |

The last row matters more than it looks. Atlas, Ledger and Gazette have no statement title, Atlas
has no table family at all, and Signal has neither a full ledger table nor a dashboard. A pack that cannot carry one
of the outline's slides is the wrong pack, however well the rest fits.

Worked case: a ten-slide Korean quarterly review from a spreadsheet. The type gives Ledger, Gazette,
Night. Four of nine content slides hold a chart (44 %), three a table (33 %): both fire, and both
favour Ledger. Bodies average 90 glyphs, so neither text row fires. Nothing says the deck is sent
ahead. Ledger stays first; Gazette and Night are the alternatives, and the card says Gazette would
fit better if the file goes round before the meeting.

## 4. Write the direction card

The card is the record of the choice. Keep it in the build log (below) and summarise it in two or
three sentences in the reply: the chosen tonality, why, the two alternatives, and what would change
the choice.

```text
Direction card
  Deck type        business review (경영 실적 보고)
  Reader           division heads reading on screen in the monthly meeting, about 15 minutes
  Tonality         ledger   alternatives: gazette, night
  Reason           numbers-first review: 44 % chart slides, 33 % table slides; read during the meeting
  Signals fired    chart share, table share
  Dials            density 10, variance 5 (pack defaults)
  Treatments       content top-rule · data top-rule · data-takeaway side-rail · sequence kicker-numeral
  Families planned cover-figures, agenda, kpi-over-chart, chart-insight, ledger-table, comparison,
                   section-rule, dashboard-grid, timeline, closing-decision-box, references-appendix
  Wrong if         the file is sent ahead and read alone; Gazette's band pages and boxed summary fit that better
```

Fill every field. A build that cannot write the tonality and the reason stops and asks; there is no
silent default look. The "wrong if" line is the one a reviewer checks first: if it turns out true,
the direction was mis-chosen and the deck is rebuilt under the alternative.

**Dials.** Density (1-10) sets margins, gaps, body size and how much empty band a slide may leave;
variance (1-10) sets how many title treatments and layout families one deck mixes. Each pack has
defaults. The skill may move either dial by up to 2 without asking, and says so on the card;
a bigger move needs the user's word. Variance below 4 is only for a user who asks for a uniform
deck, and the gate then records the lowered variety instead of passing it silently. See
`density-and-fill.md` for what each step changes.

**Treatments and families.** Copy the role map from the tonality sheet and name one family per
slide from the pack's list. The engine may still pick a different allowed treatment for a slide
when that slide's body fills better under it; the compile log names every such choice.

## 5. Say it and record it

In the reply, before or with the delivered files, say in plain words which direction was chosen
and why, and name the two alternatives. For example: "Ledger로 만들었습니다. 표와 차트가 슬라이드의
절반을 넘고 회의에서 화면으로 읽는 자료라서입니다. 미리 돌려 읽는 자료라면 Gazette, 큰 화면 발표라면
Night도 맞습니다."

Write the build log beside the deck source. It holds the card, then the compile output's `note:`
and `fill:` lines, then the gate result. It is working evidence: it stays out of the slides and is
delivered only when the user wants the audit trail.

```text
<deck>.md            the source, with tonality: in its frontmatter
<deck>.build.md      the direction card, compile notes, fill lines, gate result
<deck>.pptx          the compiled deck
```

## 6. The compare strip

When the user asks to compare looks, or the brief leaves the look open on purpose ("어떤 느낌이
좋을지 모르겠다", "show me a few options"), build the same first three slides under the chosen
tonality and the two alternatives, render them, and show the three rows before writing the rest.
Same content and order in every row; only the tonality changes. The strip is evidence, and the
user's pick is the decision.

```bash
# strip.md holds the deck's frontmatter and its first three slides
for t in ledger gazette night; do
  sed "s/^tonality: .*/tonality: $t/" strip.md > "strip-$t.md"
  node    "$SKILL_ROOT/scripts/compile-deck.js" "strip-$t.md" --pptx "strip-$t.pptx"
  python3 "$SKILL_ROOT/scripts/render_pages.py" "strip-$t.pptx" --out-dir "strip-$t" --pages 3
done
```

Show the nine pages as three labelled rows. Do not argue for one row in the message beyond the
card's reason; let the pages carry the difference. When the user picks, update the card (the
reason becomes "chosen by the user from the strip") and build the deck.

## 7. Legacy templates

AZURE-PRO, AZURE-A2Z, BOILERPLATE-PRETENDARD and BOILERPLATE-A2Z keep their names and their single
look. They are used only when the user names one or when an existing deck source already says
`template:`. They are never chosen silently. When one is used, the card names it, the reply still
offers two tonalities as alternatives, and the gate reports the variety and median-band checks as
advisories, because a named template is a request for that one look.

## 8. Failure patterns

- Choosing by topic alone ("a startup, so Signal") without counting the outline.
- Naming one tonality in the reply with no alternatives, or none at all.
- A card whose reason restates the deck type instead of the signals.
- Moving density or variance by three or more without asking.
- A pack that forces a slide into a family it does not have; the compile notes say so, and the fix
  is a different family for that slide or a different pack.
- Building all slides, disliking the look, and swapping the tonality at the end without updating
  the card and the reply.

## The example library

Each file in `examples/` compiles under its tonality and passes the gate; read the one closest to
the job before writing a new deck.

| File | Deck type | Tonality | Alternatives |
|---|---|---|---|
| `01-pitch-signal-ko.md` | pitch | Signal | Studio, Atlas |
| `02-pitch-studio-ko.md` | pitch for a visual product | Studio | Signal, Atlas |
| `03-business-review-ledger-ko.md` | business review | Ledger | Gazette, Night |
| `04-business-review-night-en.md` | business review on a stage screen | Night | Ledger, Gazette |
| `05-research-talk-paper-en.md` | research talk | Paper | Night, Chalk |
| `06-lecture-chalk-ko.md` | lecture | Chalk | Paper, Studio |
| `07-data-review-night-en.md` | data-heavy review | Night | Ledger, Paper |
| `08-image-led-atlas-ko.md` | image-led report | Atlas | Studio, Signal |
| `09-briefing-gazette-ko.md` | Korean text briefing | Gazette | Ledger |
| `10-status-update-ledger-ko.md` | status update | Ledger | Gazette, Night |
| `11-portfolio-studio-en.md` | image-led portfolio | Studio | Atlas, Signal |
| `12-research-tutorial-chalk-en.md` | research tutorial | Chalk | Paper, Night |
| `13-engineering-review-computational-brutalism-ko.md` | engineering review | Computational Brutalism | Night, Ledger |
| `14-launch-pitch-neo-brutalism-ko.md` | launch pitch | Neo-Brutalism | Signal, Studio |
| `15-design-lecture-bauhaus-ko.md` | design lecture | Bauhaus | Studio, Atlas |
| `16-community-programme-riso-ko.md` | community programme | Riso | Studio, Bauhaus |
| `17-public-data-briefing-newsroom-ko.md` | data story for residents | Newsroom | Gazette, Ledger |

The examples that place pictures name `assets/example-a.png`, `assets/example-b.png` and
`assets/example-c.png`; supply real images under those names (or change the paths) before
compiling one.
