# Textual TUI

Textual builds rich, mouse-aware, scrollable terminal applications on top of `rich`, and replaces curses, urwid and blessed for new work. The sections below cover the minimum app, reactive state, workers for I/O, key bindings, CSS and testing.

## Install

```bash
uv add textual
uv add --dev textual-dev   # `textual console` and `textual run --dev` for hot reload
```

## Minimal app

```python
from textual.app import App, ComposeResult
from textual.containers import Vertical
from textual.widgets import Button, Footer, Header, Label


class CounterApp(App[None]):
    """A small counter application."""

    BINDINGS = [("q", "quit", "Quit")]
    CSS = """
    #count {
        height: 3;
        content-align: center middle;
        background: $boost;
    }
    """

    count: int = 0

    def compose(self) -> ComposeResult:
        yield Header()
        with Vertical():
            yield Label("0", id="count")
            yield Button("Increment", id="inc", variant="primary")
            yield Button("Reset", id="reset", variant="warning")
        yield Footer()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        match event.button.id:
            case "inc":
                self.count += 1
            case "reset":
                self.count = 0
            case _:
                return
        self.query_one("#count", Label).update(str(self.count))


if __name__ == "__main__":
    CounterApp().run()
```

Run it:

```bash
uv run python counter.py
uv run textual run --dev counter.py    # hot reload on CSS and code changes
```

`match` on a widget `id` is a string dispatch, so the final arm returns quietly. For closed variants such as enums, use the exhaustive form from `error-handling.md`.

## Reactive attributes

The `reactive()` descriptor watches assignments and re-renders automatically, replacing the manual `query_one(...).update(...)` pattern.

```python
from textual.app import App, ComposeResult
from textual.events import Key
from textual.reactive import reactive
from textual.widgets import Label


class CountWidget(Label):
    count: reactive[int] = reactive(0)

    def render(self) -> str:
        return f"Count: {self.count}"


class CounterApp(App[None]):
    def compose(self) -> ComposeResult:
        yield CountWidget()

    def on_key(self, event: Key) -> None:
        if event.key == "space":
            self.query_one(CountWidget).count += 1
```

Changing a reactive calls `render()`, and defined `watch_<attr>` and `validate_<attr>` methods run as well. Pass `recompose=True` to `reactive(...)` when the whole child tree should be rebuilt on change. Use `var(...)` for state that should not trigger a refresh.

Keep application state in frozen dataclasses (`data-modeling.md`) and put the current snapshot in a single reactive; replace it with `dataclasses.replace(...)` on change. That makes state transitions explicit and testable.

## Async work: workers

Blocking the event loop freezes the interface. Network, disk and CPU work run in workers created with `@work` or `run_worker`.

```python
import httpx2
from textual.app import App, ComposeResult
from textual.widgets import Input, Static
from textual.work import work


class FetchApp(App[None]):
    def compose(self) -> ComposeResult:
        yield Input(placeholder="URL", id="url")
        yield Static(id="result")

    @work(exclusive=True)
    async def fetch(self, url: str) -> None:
        async with create_async_client(timeout=httpx2.Timeout(10.0)) as client:   # factory from httpx2-optimization.md
            response = await client.get(url)
        self.query_one("#result", Static).update(f"{response.status_code} - {len(response.text)} bytes")

    def on_input_submitted(self, event: Input.Submitted) -> None:
        self.fetch(event.value)
```

`exclusive=True` cancels the previous worker when a new request arrives before the first one finishes. Workers follow the app's lifecycle and are cancelled when it exits. `@work(thread=True)` runs a synchronous function in a thread, and UI updates from a thread go through `self.call_from_thread(...)`.

`@work` is built on asyncio underneath. Calling Textual's API does not break the anyio rule, because the project code imports no asyncio. Inside worker bodies use anyio-friendly libraries (the `httpx2` factory client, `anyio.sleep`).

Handle worker failures: set `@work(exit_on_error=False)` and react to `Worker.StateChanged` events so a failed request shows a message instead of closing the app.

## Actions and key bindings

Bind keys to `action_*` methods with `BINDINGS`.

```python
from textual.app import App
from textual.binding import Binding


class Editor(App[None]):
    BINDINGS = [
        Binding("ctrl+s", "save", "Save"),
        Binding("ctrl+r", "reload", "Reload", priority=True),
    ]

    def action_save(self) -> None:
        ...

    def action_reload(self) -> None:
        ...
```

`priority=True` lets a binding fire before the focused child handles the key. Bindings show up in the footer automatically. Textual also supports a command palette (`ctrl+p`), where `Provider` subclasses expose application commands.

## CSS

Textual's CSS supports selectors, variables (`$primary`, `$boost`), layouts and animation. Inline it with `CSS = "..."` or load an external file with `CSS_PATH = "app.tcss"`.

```css
Screen {
    background: $surface;
    color: $text;
    layout: vertical;
}

#sidebar {
    width: 30;
    background: $boost;
}

Button.danger {
    background: $error;
}
```

Edits to the stylesheet reload live under `textual run --dev`. Prefer theme variables over hard-coded colors, so light and dark themes both work, and test narrow terminals (80 columns) as well as wide ones.

## Screens and navigation

```python
from textual.screen import ModalScreen


class ConfirmScreen(ModalScreen[bool]):
    def compose(self) -> ComposeResult:
        yield Label("Delete this item?")
        yield Button("Yes", id="yes", variant="error")
        yield Button("No", id="no")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        self.dismiss(event.button.id == "yes")
```

Push it with `self.push_screen(ConfirmScreen(), callback)`, where the callback receives the dismissed value. Screens keep large applications modular: one screen per file, with its own bindings and CSS.

## Testing

```python
import pytest

from myapp import CounterApp

pytestmark = pytest.mark.anyio


async def test_counter_increments() -> None:
    app = CounterApp()
    async with app.run_test() as pilot:
        await pilot.click("#inc")
        await pilot.click("#inc")
        assert app.count == 2
```

`pilot.click(selector)`, `pilot.press("q")` and `pilot.pause()` (wait for the next frame) drive the app. Assert on application state and on widget content (`app.query_one("#count", Label).renderable`), and use `app.run_test(size=(80, 24))` to fix the terminal size. Snapshot tests with `pytest-textual-snapshot` catch visual regressions.

Headless environments (CI, agent sessions) have no interactive terminal. `run_test()` runs the app without one, so tests work there. Real-terminal behaviour can be checked by launching the app inside `tmux` and capturing the pane, which is optional and skipped when `tmux` is unavailable.

## When Textual is the wrong tool

| Need | Use |
|---|---|
| One-off CLI with structured output | `typer` and `rich` |
| Progress bar in a script | `rich.progress` |
| Tabular display of query results | `rich.table` |
| Full-screen app with state, input and mouse | Textual |

A pretty CLI is not a TUI. Choose Textual when the user navigates an interface, and choose Rich when color is the goal.

## Pitfalls

| Pattern | Problem | Replacement |
|---|---|---|
| `time.sleep()` or blocking I/O in a handler | frozen UI | `@work` workers, `anyio.sleep` |
| updating widgets from a thread directly | race conditions | `self.call_from_thread(...)` |
| querying widgets before mount | `NoMatches` errors | use `on_mount` or `compose` |
| hard-coded colors | breaks themes | CSS variables |
| state spread over widget attributes | hard to test | one frozen state object in a reactive |
| catching `Exception` in handlers | hides defects behind a blank screen | specific exceptions plus `self.notify(..., severity="error")` |

## Sources

- Textual documentation: <https://textual.textualize.io>
- Tutorial: <https://textual.textualize.io/tutorial/>
- API reference: <https://textual.textualize.io/api/>
- Testing guide: <https://textual.textualize.io/guide/testing/>
