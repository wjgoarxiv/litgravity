# Micro-worlds: small simulations the reader can poke

A micro-world is a widget inside the explainer that lets the reader push on a mechanism and watch it respond. "Requests over the limit now get a wait time instead of an error" is a sentence the reader can repeat. Dragging a slider until the third request turns amber, then watching the wait shrink as simulated time passes, gives them a model they can reason with on the next input.

Build each one inside the scaffold's `.world` container; its styles are already in `assets/explainer-scaffold.html`. Keep the script under about forty lines. The widget teaches one idea, and every extra line is a line that can drift away from the real code.

## Pick the pattern from what you teach

| The reader needs a feel for | Pattern |
| --- | --- |
| how output follows input in one function | faithful miniature |
| how behavior responds to one number (limit, timeout, batch size) | slider |
| an ordered pipeline, a state machine, a retry sequence | step-through |
| why the change was needed, old and new side by side | old/new toggle |
| a rename, a move, a formatting pass | none; omit 직접 만져보기 |

Use one micro-world for a normal session and at most two for a large one. The examples below share one toy world (a token bucket that holds 3 tokens and refills 1 token per second, with two users `a` and `b`) so you can see how a document keeps its toy data stable across sections. Replace it with the toy data from your own 직관 section.

## Conventions every pattern follows

- Prefix element ids with `mw1-`, `mw2-` so two widgets never collide.
- Wrap each script in an immediately invoked function and use `var`; the page has no build step and should run in any browser from the last several years.
- Render text with `textContent`; the page never needs `innerHTML` for output.
- End with a `.model-note` line that says what the widget simplifies and where it departs from the code, and cite the real function with `<code>`.
- Start the controls at the values the real code uses, so the first view shows real behavior.

## 1. Faithful miniature

Port the changed function to a few lines of JavaScript, connect it to an input, and print the result as the reader types.

```html
<div class="world">
  <span class="label">직접 해보기: 요청 순서를 바꿔 보세요</span>
  <input type="text" id="mw1-in" value="a a b a a">
  <div class="out" id="mw1-out"></div>
  <p class="model-note">실제 <code>take()</code>를 줄인 모형입니다. 요청 사이 간격은 0.2초로 고정했고, 사용자별 버킷은 3토큰에서 시작합니다.</p>
</div>
<script>
(function () {
  var inp = document.getElementById('mw1-in'), out = document.getElementById('mw1-out');
  function run() {
    var buckets = {}, t = 0, lines = [];
    inp.value.trim().split(/\s+/).filter(Boolean).forEach(function (u) {
      var b = buckets[u] || (buckets[u] = { tokens: 3, at: 0 });
      b.tokens = Math.min(3, b.tokens + (t - b.at)); b.at = t;
      if (b.tokens < 1) {
        lines.push(t.toFixed(1) + 's ' + u + ' 거절, ' + (1 - b.tokens).toFixed(1) + 's 뒤 재시도');
      } else {
        b.tokens -= 1;
        lines.push(t.toFixed(1) + 's ' + u + ' 통과, 남은 토큰 ' + b.tokens.toFixed(1));
      }
      t += 0.2;
    });
    out.textContent = lines.join('\n') || '(요청 없음)';
  }
  inp.addEventListener('input', run); run();
})();
</script>
```

The note carries the honesty. A reader who mistakes the miniature for the implementation will later be sure about behavior the code does not have, which leaves them worse off than plain confusion.

## 2. Slider

For a number whose interesting effect is how the output bends as it moves. Park the default where the behavior is about to change.

```html
<div class="world">
  <span class="label">직접 해보기: 버킷 크기</span>
  <div class="row">
    <label for="mw2-cap">용량</label>
    <input type="range" id="mw2-cap" min="1" max="8" value="3" style="flex:1">
    <output id="mw2-cap-v">3</output>
  </div>
  <div class="out" id="mw2-out"></div>
  <p class="model-note">1초에 요청 6개가 한꺼번에 오는 경우만 계산합니다. 실제 기본값은 <code>DEFAULT_CAPACITY</code>입니다.</p>
</div>
<script>
(function () {
  var cap = document.getElementById('mw2-cap'), v = document.getElementById('mw2-cap-v'),
      out = document.getElementById('mw2-out');
  function run() {
    var c = +cap.value, rows = [];
    for (var i = 1; i <= 6; i++) rows.push(i + '번째 요청: ' + (i <= c ? '통과' : '거절 (' + (i - c) + 's 대기)'));
    v.textContent = c;
    out.textContent = rows.join('\n') + '\n통과 ' + Math.min(c, 6) + ' / 거절 ' + Math.max(0, 6 - c);
  }
  cap.addEventListener('input', run); run();
})();
</script>
```

## 3. Step-through

For ordering. A button advances one step and a state table shows what is true afterwards. The reader sets the pace; six clicks get attention that a six-stage static diagram does not.

```html
<div class="world">
  <span class="label">직접 해보기: 요청 하나를 따라가기</span>
  <table><thead><tr><th>단계</th><th>상태</th></tr></thead><tbody id="mw3-rows"></tbody></table>
  <button id="mw3-next">다음 단계</button><button id="mw3-reset">처음부터</button>
  <p class="model-note">한 사용자, 한 요청의 경로만 보여 줍니다. 잠금과 저장소 왕복은 생략했습니다.</p>
</div>
<script>
(function () {
  var steps = [
    ['도착', 'user=a, 버킷 토큰 0.4, 마지막 갱신 0.0s'],
    ['refill', '0.8s 경과, 토큰 0.4 → 1.2'],
    ['검사', '1.2 ≥ 1 이므로 통과 판정'],
    ['차감', '토큰 1.2 → 0.2, 마지막 갱신 0.8s'],
    ['응답', '{ ok: true } 반환'],
  ];
  var i = 0, body = document.getElementById('mw3-rows');
  function draw() {
    body.textContent = '';
    steps.slice(0, i + 1).forEach(function (s, n) {
      var tr = document.createElement('tr');
      if (n === i) tr.className = 'now';
      [s[0], s[1]].forEach(function (x) { var td = document.createElement('td'); td.textContent = x; tr.appendChild(td); });
      body.appendChild(tr);
    });
  }
  document.getElementById('mw3-next').addEventListener('click', function () { if (i < steps.length - 1) i++; draw(); });
  document.getElementById('mw3-reset').addEventListener('click', function () { i = 0; draw(); });
  draw();
})();
</script>
```

## 4. Old/new toggle

When the change itself is the lesson, run one input through both versions and show the difference. This is the interactive form of the before-and-after diagram and the strongest way to show why the change had to happen.

```html
<div class="world">
  <span class="label">직접 해보기: 이전과 이후</span>
  <div class="row">
    <label><input type="radio" name="mw4-v" value="old" checked> 이전 (예외)</label>
    <label><input type="radio" name="mw4-v" value="new"> 이후 (retryAfter)</label>
  </div>
  <div class="row" style="margin-top:.5rem">
    <label for="mw4-tok">남은 토큰</label>
    <input type="range" id="mw4-tok" min="0" max="20" value="4" style="flex:1">
  </div>
  <div class="out" id="mw4-out"></div>
  <p class="model-note">호출자 쪽 처리는 단순화했습니다. 이전 코드에서는 예외가 상위 핸들러까지 올라가 500 응답이 됐습니다.</p>
</div>
<script>
(function () {
  var tok = document.getElementById('mw4-tok'), out = document.getElementById('mw4-out');
  function mode() { var r = document.querySelector('input[name="mw4-v"]:checked'); return r ? r.value : 'old'; }
  function run() {
    var t = +tok.value / 10, ok = t >= 1;
    if (ok) { out.textContent = '토큰 ' + t.toFixed(1) + ': 두 버전 모두 통과'; return; }
    out.textContent = mode() === 'old'
      ? '토큰 ' + t.toFixed(1) + ': LimitError → 호출자가 잡지 않으면 500'
      : '토큰 ' + t.toFixed(1) + ': { ok:false, retryAfter: ' + (1 - t).toFixed(1) + 's } → 429와 Retry-After';
  }
  tok.addEventListener('input', run);
  document.querySelectorAll('input[name="mw4-v"]').forEach(function (r) { r.addEventListener('change', run); });
  run();
})();
</script>
```

## Keeping a micro-world honest

- **Say it is a model.** The `.model-note` names what was simplified. That line is the difference between building intuition and planting a false belief.
- **Match the code on the taught dimension.** Simplify everything around it freely, but if the reader leaves with a rule about when a request is refused, that rule must match the real comparison (`< 1` in this toy world).
- **Check it against the real code.** Before shipping, run the same two or three inputs through the real function (a test, a REPL line or the example program under `.litgravity/evidence/<slug>/example/`) and compare. Record the comparison in the internal ledger.
- **Reuse the document's toy data.** The users, rows and malformed record from 직관 appear here too.
- **Inline everything.** No network, no library; the page must work from a file on a laptop with Wi-Fi off.
- **Prove it renders.** A headless browser `--dump-dom` run executes the scripts; the dumped DOM should show each `.out` element filled. An empty `.out` means the widget threw on load.
- **Degrade honestly in Markdown.** In `--md` mode a micro-world becomes a worked example with every intermediate value written out, step by step, the way the step-through table would show it.
