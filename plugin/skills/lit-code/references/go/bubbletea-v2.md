# Bubble Tea v2: Terminal UIs With First-Class CJK and IME Input

Build new terminal UIs on Bubble Tea v2. Version 1 places the visible cursor in software, so the input-method popup for Korean, Japanese and Chinese lands in the wrong place. Version 2 exposes the cursor position to the terminal, which fixes IME composition. This page records the setup that works.

---

## Why v2: the IME story

Bubble Tea v1 draws a block character where the cursor should be (a "virtual cursor") and leaves the terminal's real cursor parked at the top-left corner. An IME candidate window (hangul composition choices, kana to kanji conversion, pinyin lookup) anchors itself to the terminal's real cursor. The result with v1: the popup opens at the top-left of the screen while the user types in the middle of it.

Version 2 solves this with two changes:

1. `View()` returns a `tea.View` that carries a `Cursor`. The framework moves the real terminal cursor to that position after drawing.
2. Text components accept `SetVirtualCursor(false)`, which stops them from painting their own block and lets you read the position they want through `.Cursor()`.

Together they put the IME popup where the user is typing.

Other v2 improvements:

- Typed mouse messages: `tea.MouseClickMsg`, `tea.MouseMotionMsg`, `tea.MouseReleaseMsg` (and wheel events) replace one coarse `MouseMsg`.
- Terminal features are declared on the returned `tea.View` (`AltScreen`, `MouseMode`, window title and similar fields), which replaces imperative option commands.
- Key events split into `tea.KeyPressMsg` and `tea.KeyReleaseMsg`, with `msg.String()` for matching.
- A new renderer with better throughput under heavy message volume.

---

## Modules and install

Version 2 lives under the `charm.land` import path. It deliberately differs from the `github.com/charmbracelet/...` paths of v1 so both can coexist during a migration.

```bash
go get charm.land/bubbletea/v2@latest
go get charm.land/bubbles/v2@latest
go get charm.land/lipgloss/v2@latest
go get github.com/mattn/go-runewidth@latest
```

`go get` writes the resolved versions into `go.mod`; commit them. Early adopters used release-candidate tags, so read `go list -m -versions charm.land/bubbletea/v2` and pick the newest tag, preferring a stable one. APIs moved between candidates (for example how a view's content is set), so compile against the version you pinned and trust the compiler over memory. When a snippet below fails to build, read the module's `doc.go` and examples with `go doc charm.land/bubbletea/v2 View`.

A project that mixes Charm packages must use v2 of all three (`bubbletea`, `bubbles`, `lipgloss`). A v1 `bubbles` component does not satisfy the v2 `tea.Model` interface.

---

## Minimal app with correct IME handling

```go
package main

import (
    "fmt"
    "os"

    "charm.land/bubbles/v2/textarea"
    tea "charm.land/bubbletea/v2"
)

type model struct {
    width, height int
    ta            textarea.Model
}

func initial() model {
    ta := textarea.New()
    ta.Placeholder = "Type Korean, Japanese or Chinese here"
    ta.SetWidth(60)
    ta.SetHeight(10)
    ta.SetVirtualCursor(false) // the real cursor carries the IME popup
    ta.Focus()
    return model{ta: ta}
}

func (m model) Init() tea.Cmd { return textarea.Blink }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.WindowSizeMsg:
        m.width, m.height = msg.Width, msg.Height
    case tea.KeyPressMsg:
        if msg.String() == "ctrl+c" {
            return m, tea.Quit
        }
    }
    var cmd tea.Cmd
    m.ta, cmd = m.ta.Update(msg)
    return m, cmd
}

func (m model) View() tea.View {
    var view tea.View
    view.AltScreen = true
    view.SetContent(m.ta.View())
    if cursor := m.ta.Cursor(); cursor != nil {
        view.Cursor = cursor // export the real cursor position
    }
    return view
}

func main() {
    if _, err := tea.NewProgram(initial()).Run(); err != nil {
        fmt.Fprintln(os.Stderr, "error:", err)
        os.Exit(1)
    }
}
```

Two lines make IME work, and both are required:

1. `ta.SetVirtualCursor(false)` turns off the painted block.
2. `view.Cursor = m.ta.Cursor()` passes the position to the framework.

### Cursor coordinates are screen coordinates

`textarea.Cursor()` reports a position relative to the textarea. When the textarea sits at an offset inside a larger layout (a border, a title line, a sidebar), add that offset before assigning it to the view, or the popup lands that many cells away from the text:

```go
if c := m.ta.Cursor(); c != nil {
    c.X += originX // left border + sidebar width
    c.Y += originY // title rows above the textarea
    view.Cursor = c
}
```

With several inputs, export the cursor of the focused input only. With no focused input, leave `view.Cursor` nil so the terminal hides it.

---

## Display width: runewidth, not `len`

Hangul, kana, hanzi and fullwidth forms occupy two terminal cells. `len(s)` counts bytes and `utf8.RuneCountInString` counts runes; neither equals the display width.

```go
import "github.com/mattn/go-runewidth"

func displayWidth(s string) int { return runewidth.StringWidth(s) }

func padRight(s string, width int) string {
    if gap := width - displayWidth(s); gap > 0 {
        return s + strings.Repeat(" ", gap)
    }
    return s
}
```

For strings that carry ANSI escapes, measure with `github.com/charmbracelet/x/ansi` (`ansi.StringWidth`), which skips escape sequences. `lipgloss.Width` does the same and handles wide runes: `lipgloss.Width("中文")` is 4.

Handle ambiguous-width characters on purpose. Some East Asian terminals render characters such as box-drawing symbols in two cells. `runewidth.EastAsianWidth` follows the locale, and `RUNEWIDTH_EASTASIAN=0` forces narrow rendering. Pick one value for the app and document it.

Truncation also needs care: cut on rune boundaries by width (`runewidth.Truncate(s, width, "…")`), never at a byte index.

---

## Mouse

```go
case tea.MouseClickMsg:
    return m.handleClick(msg.X, msg.Y, msg.Button)
case tea.MouseMotionMsg:
    return m.handleHover(msg.X, msg.Y)
case tea.MouseReleaseMsg:
    return m.handleRelease(msg.X, msg.Y)
```

Enable it on the view:

```go
view.MouseMode = tea.MouseModeCellMotion // clicks plus motion while a button is held
// tea.MouseModeAllMotion reports every movement; use it only when hover matters
```

Hit-testing happens in cell coordinates, so convert with display widths, not byte offsets, when wide characters sit to the left of the click.

---

## Components from `bubbles/v2`

```go
import (
    "charm.land/bubbles/v2/help"
    "charm.land/bubbles/v2/key"
    "charm.land/bubbles/v2/list"
    "charm.land/bubbles/v2/spinner"
    "charm.land/bubbles/v2/table"
    "charm.land/bubbles/v2/textarea"
    "charm.land/bubbles/v2/textinput"
    "charm.land/bubbles/v2/viewport"
)
```

Components that accept text (`textarea`, `textinput`, and `list` with filtering) take `SetVirtualCursor(false)`. Apply it to every text field, because any user may type CJK text. Use `key.Binding` with `help.Model` so key hints stay in sync with handlers.

---

## Styling with `lipgloss/v2`

```go
import "charm.land/lipgloss/v2"

title := lipgloss.NewStyle().
    Bold(true).
    Foreground(lipgloss.Color("230")).
    Background(lipgloss.Color("62")).
    Padding(0, 1).
    Border(lipgloss.RoundedBorder()).
    BorderForeground(lipgloss.Color("63"))

fmt.Println(title.Render("中文 제목"))
```

Widths and padding account for wide runes. In v2, `lipgloss` is a pure style library: it returns strings, and Bubble Tea owns terminal output, which removes the hidden color-profile detection v1 performed against stdout. Pass the program's color profile into styles when you need adaptive color (see the `lipgloss` v2 docs for `lipgloss.Println` and `HasDarkBackground`).

Compose layouts with `lipgloss.JoinHorizontal`, `JoinVertical` and `Place`. Each join measures cells correctly, so mixed CJK and ASCII columns align.

---

## Model, Update, View

```text
tea.Program event loop
  msg <- queue
  model, cmd = model.Update(msg)
  view = model.View()
  render(view)
  if cmd != nil: run it in a goroutine and push its message to the queue
```

Rules for the loop:

- **The model is a value.** `Update` has a value receiver and returns a new model. Pointer receivers leak mutations across frames.
- **`Update` is quick.** It performs no I/O and starts no goroutines inline. I/O goes into a `tea.Cmd`, which the runtime runs and feeds back as a message.
- **`View` is read-only.** It builds a `tea.View` without touching state.
- **A `tea.Cmd` is `func() tea.Msg`.** It runs once. For repeating work use `tea.Tick` and re-issue it from `Update`.

```go
func loadData() tea.Cmd {
    return func() tea.Msg {
        data, err := fetch()
        if err != nil {
            return errMsg{err}
        }
        return dataLoadedMsg{data}
    }
}

func tickEvery() tea.Cmd {
    return tea.Tick(time.Second, func(t time.Time) tea.Msg { return tickMsg(t) })
}
```

Pass a context into fetch commands (store it in the model, cancel it on quit) so abandoned requests stop, and send errors as messages instead of printing them.

---

## Sub-models

```go
type model struct {
    list    list.Model
    input   textinput.Model
    spinner spinner.Model
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    var cmds []tea.Cmd
    var cmd tea.Cmd

    m.list, cmd = m.list.Update(msg)
    cmds = append(cmds, cmd)
    m.input, cmd = m.input.Update(msg)
    cmds = append(cmds, cmd)
    m.spinner, cmd = m.spinner.Update(msg)
    cmds = append(cmds, cmd)

    return m, tea.Batch(cmds...)
}
```

`tea.Batch` runs commands concurrently; `tea.Sequence` runs them in order. Route key messages only to the focused child, and broadcast window-size messages to all.

When the root model passes 250 pure lines, split per sub-model:

```text
internal/ui/
├── model.go      # root model: focus, layout, routing
├── list.go       # list state, update, view
├── input.go      # input state, update, view
└── spinner.go
```

---

## Testing

```go
import "charm.land/bubbletea/v2/teatest"

func TestModel_typing_cjk_updates_buffer(t *testing.T) {
    // Given
    tm := teatest.NewTestModel(t, initial(), teatest.WithInitialTermSize(80, 24))

    // When
    tm.Send(tea.KeyPressMsg{Code: '中', Text: "中"})
    tm.Send(tea.KeyPressMsg{Code: '文', Text: "文"})
    tm.Send(tea.KeyPressMsg{Code: 'c', Mod: tea.ModCtrl})
    final := tm.FinalModel(t, teatest.WithFinalTimeout(time.Second)).(model)

    // Then
    require.Equal(t, "中文", final.ta.Value())
}
```

Unit-test `Update` directly where possible: feed messages, assert on the returned model, and assert on `View()` output with a golden snapshot (`autogold`). Test cursor placement by calling `m.View().Cursor` after typing wide characters, and check `X` equals the sum of display widths plus offsets. Exact field names of key messages vary between v2 tags, so confirm against the pinned version's `KeyPressMsg` definition.

`teatest` may live in a separate module or path in your pinned version; if the import fails, run `go doc` on the package or fall back to direct `Update` tests.

---

## Antipatterns

| Pattern | Problem | Replacement |
|---|---|---|
| `tea.WithoutSignals()` without a replacement | Ctrl-C stops working | keep default signal handling |
| pointer receivers on the model | state leaks between frames | value receivers returning the new model |
| `time.Sleep` in `Update` | freezes the loop | `tea.Tick` or an async `tea.Cmd` |
| `fmt.Println` while the program runs | corrupts the display | `tea.Printf`, or log to a file |
| `len(s)` for layout | off by a factor of two for CJK | `runewidth.StringWidth(s)` |
| Bubble Tea v1 for any text input | IME popup misplaced | v2 with `SetVirtualCursor(false)` |
| painting a custom block cursor in v2 | fights `view.Cursor` | let the terminal draw the cursor |
| cursor coordinates relative to the widget | popup offset by the widget's origin | add the origin before exporting |
| mixed v1 and v2 Charm modules | type mismatches at compile time | move all three libraries to v2 |

---

## Performance

- Reduce redraw work. If the model changes sixty times a second while the visible text changes once a second, skip recomputation behind a dirty flag.
- Use `viewport.Model` for long scrollable content, so a keystroke does not re-render thousands of lines.
- Batch commands that can run in parallel.
- Cap repaint rate during development with `tea.WithFPS(n)`.
- Cache rendered strings for static panes, and rebuild them only when their inputs change.

---

## Alternatives

- A single prompt with one answer fits `huh` (same maintainers), which has no model-update-view ceremony.
- A daemon with occasional status lines needs `slog` on stderr; add Bubble Tea only when interaction becomes necessary.
- A process with redirected stdin (CI, pipes) cannot run a TUI. Detect with `term.IsTerminal(int(os.Stdin.Fd()))` and take a non-interactive path. In headless agent sessions assume no terminal, and state in the report that interactive behaviour was verified through `teatest` only.

## Sources

- Bubble Tea: https://github.com/charmbracelet/bubbletea
- Bubbles: https://github.com/charmbracelet/bubbles
- Lip Gloss: https://github.com/charmbracelet/lipgloss
- crush (production IME handling): https://github.com/charmbracelet/crush
- go-runewidth: https://github.com/mattn/go-runewidth
- Unicode East Asian Width: https://www.unicode.org/reports/tr11/
