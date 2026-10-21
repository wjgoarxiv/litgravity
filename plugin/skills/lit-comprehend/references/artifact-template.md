# Artifact template: sections, diagrams, quiz markup

Read this file with `read_file` while composing the explainer. It pairs with `assets/explainer-scaffold.html`, which already holds the stylesheet, the diagram classes, the micro-world container styles and the quiz engine. Copy the scaffold, fill the five placeholders and write only the content. Rebuilding the boilerplate on every run burns tokens and produces a different-looking page each time; one scaffold keeps every explainer recognizable.

## Copying the scaffold

The skill folder is the folder of the SKILL.md path the activation note gave you. Run this through `run_command` from the workspace root (replace the angle-bracket parts):

```bash
SKILL_DIR="<absolute folder of lit-comprehend/SKILL.md>"
OUT_DIR=".litgravity/drafts/comprehend"
OUT="$OUT_DIR/$(date +%F)-<slug>.html"
mkdir -p "$OUT_DIR"
cp "$SKILL_DIR/assets/explainer-scaffold.html" "$OUT"
```

When `run_command` is refused, read the scaffold with `read_file` and write the filled page with `write_file` in one go. A user-named output path replaces `OUT` entirely.

Placeholders:

| Placeholder | Fill with |
| --- | --- |
| `__LANG__` | the prose language code: `ko` for Korean, `en` for English, the matching code otherwise |
| `__TITLE__` | the one idea as a short title, in the reader's language ("원장이 크래시를 견디게 된 이유") |
| `__SUBTITLE__` | scope and date in one line: range or path, file count, date |
| `__TOC__` | `<li><a href="#s1">한눈에</a></li>` per section, ids `s1` to `s7` |
| `__CONTENT__` | the seven sections below, each an `<h2 id="sN">` followed by its body |

The verifier fails a page that still contains any placeholder.

## Section contract

Heading text is fixed and stays in Korean whatever language the body uses. Readers learn the shape once; the verifier looks for these exact strings.

### 1. 한눈에

One paragraph, five sentences at most. A reader who stops here is already better off: what changed, why it was done, and where to look first. Skip any confidence badge or verification panel; those details belong in the internal ledger.

### 2. 이미 알고 있던 것

The delta anchor. Restate the reader's last clear position in their own terms. Quote the objective from `.litgravity/goals/<slug>.json` verbatim when a goal record exists, since it is literally their sentence, and name the state the system was in at that moment. Background the reader may never have met goes into a skippable block:

```html
<div class="skippable">
  <p><strong>배경: 이미 아는 내용이면 건너뛰세요.</strong> 토큰 버킷은 일정한 속도로 채워지는 통입니다. …</p>
</div>
```

### 3. 직관

One `<h3>` per theme. Each starts with the problem, then one piece of toy data passing through, then why the obvious alternative fails. Introduce the toy data once and reuse it everywhere: three requests from two users, one malformed payload, a bucket of five tokens. The reader then refines one mental model instead of building four.

### 4. 바뀐 것

The literate walkthrough in conceptual order. Prose leads, and each excerpt appears right after the sentence that gives the reader a reason to look at it. Five to fifteen lines per excerpt; elide with `// …`.

Every `<pre>` carries `data-src` with a repo-relative path and, when it helps navigation, a line range. Escape `<`, `>` and `&` inside the excerpt:

```html
<pre data-src="src/limit/bucket.mjs:41-55">export function take(bucket, now) {
  refill(bucket, now);
  <span class="del">if (bucket.tokens &lt;= 0) throw new LimitError();</span>
  <span class="add">if (bucket.tokens &lt; 1) return { ok: false, retryAfter: wait(bucket) };</span>
  bucket.tokens -= 1;
  return { ok: true };
}</pre>
```

`.add` shades inserted lines. `.del` shades removed lines, and the verifier skips them when it compares the excerpt with the current file, because removed lines are correctly absent. At least 60 percent of the remaining quoted lines (eight characters or longer) must appear verbatim in the cited file.

### 5. 직접 만져보기

The micro-world; patterns live in `micro-worlds.md` beside this file. Omit the whole section for a rename, a move or a formatting pass. The verifier then prints a WARN, which is the expected outcome for a structural change.

### 6. 퀴즈

Open with one sentence that frames the quiz as a throttle: a question the reader cannot answer marks the place to slow down. Then the questions, then the score line:

```html
<div class="quiz-q" data-answer="1">
  <p class="q"><span class="n">1.</span> 토큰이 0.4개 남은 버킷에 요청이 오면 <code>take()</code>는 무엇을 돌려주나요?</p>
  <button class="opt" data-i="0">LimitError 예외를 던진다</button>
  <button class="opt" data-i="1">ok:false와 대기 시간을 준다</button>
  <button class="opt" data-i="2">토큰을 음수로 만들고 통과시킨다</button>
  <button class="opt" data-i="3">refill 없이 바로 ok:true를 준다</button>
  <div class="fb" data-i="0">이전 동작입니다. 예외 대신 값을 돌려주도록 바뀐 것이 이번 변경의 핵심입니다.</div>
  <div class="fb" data-i="1">정답입니다. 1개 미만이면 거절하고, 다음 토큰까지의 시간을 retryAfter로 알려 줍니다.</div>
  <div class="fb" data-i="2">차감은 검사를 통과한 뒤에만 일어나므로 토큰은 음수가 되지 않습니다.</div>
  <div class="fb" data-i="3">take()는 항상 refill()을 먼저 부릅니다. 그 순서가 시간 경과를 반영합니다.</div>
</div>
<p class="quiz-score" id="quiz-score" data-fmt="{answered}/{total} 응답, {correct}개 정답. 틀린 문항이 다시 읽을 곳입니다.">문항을 눌러 확인하세요.</p>
```

For an English body, put the English sentence in `data-fmt` and keep the `{answered}`, `{total}` and `{correct}` tokens.

Two tells to design out, because readers pick them up faster than the material:

- **Position.** Spread the correct slot across questions; the verifier fails three in a row in one slot and a quiz with one slot throughout.
- **Length.** Keep the options of a question within a few characters of each other. When the correct one is the longest most of the time, the verifier warns. Put the explanation in the feedback, where the reader is already looking.

Every option gets a feedback block, the correct one included, and every block says why. A wrong click is the only moment where you know exactly what the reader misread.

### 7. 다음

Three entry points, each concrete enough to act on today: a file and line to open, a question worth asking the team, a risk worth closing (name the missing test, such as "`bucket.test.mjs` has no case for a clock that moves backwards").

## Diagram families

Choose two or three per document and reuse them. A new visual vocabulary per section costs more attention than it pays back.

**Pipeline.** Stages and data flow, with the toy datum visibly changing at each stage:

```html
<figure>
  <div class="pipe">
    <div class="box"><span class="t">요청</span><span class="d">user=a</span></div>
    <span class="arrow">→</span>
    <div class="box hi"><span class="t">refill</span><span class="d">0.4 → 1.2</span></div>
    <span class="arrow">→</span>
    <div class="box"><span class="t">take</span><span class="d">1.2 → 0.2</span></div>
  </div>
  <figcaption>요청 하나가 버킷을 지나는 길. 강조된 단계가 이번에 순서가 바뀐 곳입니다.</figcaption>
</figure>
```

**Before and after.** Usually the right first diagram: the same structure twice with only the changed element marked.

```html
<figure>
  <div class="ba">
    <div class="side"><h4>이전</h4>
      <div class="pipe"><div class="box">take</div><span class="arrow">→</span><div class="box gone">throw</div></div>
    </div>
    <div class="side after"><h4>이후</h4>
      <div class="pipe"><div class="box">take</div><span class="arrow">→</span><div class="box hi">retryAfter</div></div>
    </div>
  </div>
  <figcaption>거절이 예외에서 값으로 바뀌어, 호출자가 기다릴 시간을 알게 됐습니다.</figcaption>
</figure>
```

**State table.** For anything ordering-sensitive, a table with one row per step reads better than boxes. Mark the step under discussion with `<tr class="now">`.

**Simplified UI.** For changes the user sees: a `.ui-frame` with two or three `.box` elements and a `.bar` placeholder for chrome. A sketch you can draw beats a screenshot you cannot take.

Inline SVG works for arrows and curves; keep its colors on the CSS variables so dark mode stays legible. Box-drawing characters and `+----+` sketches outside a `<pre>` fail the verifier, because they break when the line wraps and carry no emphasis.

## Language

Write the body in the language the user wrote in; Korean is the default for a Korean request and for an ambiguous one. Paths, commands, identifiers, versions and error strings stay verbatim in every language so the reader can search for them. Translate the toy data labels with the prose; keep the code in the excerpts untouched.

## Browser check

The verifier reads the file; this step proves the page renders and its scripts run. With `browser_subagent` offered, give it the `file://` URL and ask it to click one option per quiz question, move every micro-world control once, report console errors and save a desktop and a phone-width screenshot. Otherwise use headless Chrome through `run_command`, from the workspace root:

```bash
CHROME="<path to Chrome or Chromium>"   # macOS: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
PAGE="file://$PWD/.litgravity/drafts/comprehend/<file>.html"
EV=".litgravity/evidence/<slug>"
PROFILE="$(mktemp -d)"
mkdir -p "$EV"
FLAGS=(--headless=new --disable-gpu --use-mock-keychain --password-store=basic --user-data-dir="$PROFILE")
"$CHROME" "${FLAGS[@]}" --window-size=1280,2400 --screenshot="$EV/explainer-desktop.png" "$PAGE"
"$CHROME" "${FLAGS[@]}" --window-size=500,2400 --screenshot="$EV/explainer-phone.png" "$PAGE"
"$CHROME" "${FLAGS[@]}" --dump-dom "$PAGE" > "$EV/explainer-dom.html"
rm -rf "$PROFILE"
```

The mock keychain and basic password store keep a fresh profile from raising an OS keychain prompt on the user's screen. Headless Chrome lays pages out at least 500 px wide whatever `--window-size` says; a narrower size only crops the screenshot and makes text look cut off. Use 500 for the narrow shot, and leave true phone widths to `browser_subagent` or a device-emulating driver. Look at both screenshots with `read_file`: headings readable, no horizontal scroll at phone width, diagrams intact, code on separate lines. In the DOM dump, every micro-world `.out` element should hold text; an empty one means its script threw on load. Note the deletion of the temporary profile in the internal ledger as the cleanup receipt. When neither channel exists, the reply carries `BLOCKED: browser check (<reason>)` and asks the user to open the file and click through the quiz.

## Markdown fallback

For `--md`, or when the reader cannot open HTML, write `YYYY-MM-DD-<slug>.md` with the same seven headings as `##` lines. Put a `source: <path>:<lines>` line directly above each fenced excerpt so the verifier can check the quote. Each quiz question becomes a `<details>` block whose summary is the question and whose body lists every option with its feedback. A micro-world becomes a worked example that writes out every intermediate value.
