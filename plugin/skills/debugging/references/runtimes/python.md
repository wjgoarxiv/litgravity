# Python Debugging

Covers CPython 3.9+, pytest, asyncio, Django, FastAPI: setup commands, attach mechanisms, state-query patterns, gotchas, silent-failure signatures. Run every command here through `run_command`; a debugger prompt is a long-running command, so launch it with `WaitMsBeforeAsync`, read it with `command_status`, and drive it with `send_command_input`.

---

## Environment detection (Phase 0)

```bash
# Which Python actually runs the code?
which python; which python3
python --version

# Is a project env manager in play?
ls poetry.lock uv.lock Pipfile.lock requirements*.txt .python-version 2>/dev/null

# Installed debuggers / profilers in this env?
python -c 'import pdb, sys; print("pdb", "built-in"); print("python", sys.executable)'
pip list 2>/dev/null | grep -iE '^(ipdb|pudb|debugpy|py-spy|memray|rich)\s'

# asyncio debug mode available?
python -c 'import asyncio; print(asyncio.__version__)'
```

**Wrapper gotchas** (these change how flags propagate):

- `poetry run python ...` — args after `python` are fine; args before `poetry run` go to poetry, not python.
- `uv run python ...` — similar; prefer `uv run -- python -X dev` when flags collide.
- `pipenv run` — same story.
- `./manage.py <cmd>` (Django) — shebang resolution; confirm it points at the right venv.
- `pytest` — loads `conftest.py` at collection, so breakpoints inside collection need `pytest --pdb-trace`, not `--pdb`.

---

## The four ways to attach

| Method | When to use | Command |
|---|---|---|
| **`breakpoint()` inline** (3.7+) | You can edit the source and restart. Most reliable. | Add `breakpoint()` to the source, run normally; it invokes `pdb` by default. |
| **`python -m pdb <script>`** | No source edit wanted. Breaks on entry. | `python -m pdb script.py arg1` |
| **post-mortem `pdb.pm()`** | The exception already happened and you want its state | In an exception-caught REPL: `import pdb; pdb.pm()` after the exception propagates. |
| **debugpy (remote / IDE)** | IDE attach, a remote host, a containerized process | `python -m debugpy --listen 5678 --wait-for-client script.py`, then attach from the editor. |

### Prefer `ipdb` or `pudb` over plain `pdb` when available

- **ipdb** — a drop-in replacement with tab completion and syntax highlighting. `pip install ipdb`, then `PYTHONBREAKPOINT=ipdb.set_trace` or `import ipdb; ipdb.set_trace()`.
- **pudb** — a full-screen TUI debugger, much faster for navigating the stack and locals. `pip install pudb`, then `PYTHONBREAKPOINT=pudb.set_trace`.

### Control `breakpoint()` globally

```bash
export PYTHONBREAKPOINT=ipdb.set_trace   # use ipdb instead of pdb
export PYTHONBREAKPOINT=0                 # disable all breakpoint() calls
```

**Journal this env var** and unset it at Phase 9.

---

## pdb / ipdb essentials

At a `(Pdb)` or `ipdb>` prompt (send these with `send_command_input`):

```
l           list source around the current line
ll          list the whole function
s           step into
n           step over (next)
r           step out (return)
c           continue
b           list breakpoints
b <line>    breakpoint at a line
b <func>    breakpoint at a function
cl <n>      clear breakpoint n
w           where (backtrace)
u / d       move up/down the stack
a           args of the current frame
p <expr>    print an expression
pp <expr>   pretty-print
!<stmt>     run a Python statement (e.g. !x = 5)
interact    drop into a full Python REPL with the current frame's locals
q           quit (aborts the program)
```

`interact` is underused: it hands you a full REPL with all locals present, faster than typing `p` for twenty things.

---

## pytest-specific debugging

```bash
pytest --pdb                     # enter pdb on the first failure
pytest --trace                   # enter pdb at the START of each test
pytest --pdb -x -s path/to/test.py::test_name   # just the failing test, -s to show prints
pytest --pdb-trace               # collect-time debugging (conftest.py / fixture setup)
pytest -s                        # disable capture so the breakpoint prompt is visible
```

Common failure: `breakpoint()` hangs inside a pytest test because pytest captures stdout and stderr by default. Add `-s` whenever you debug with breakpoints inside pytest.

---

## asyncio gotchas

Async is where most Python debug sessions go sideways. Know these before attaching.

### Breakpoints inside coroutines

`breakpoint()` works inside an async function, but stepping into another coroutine from `pdb` is awkward. Put the breakpoint above the await rather than inside the awaited call:

```python
async def handler():
    result = await some_async_fn()  # breakpoint ABOVE, not inside, when possible
    breakpoint()
    return result
```

To inspect a coroutine without advancing time, at the breakpoint:

```
!import asyncio
!loop = asyncio.get_event_loop()
!task = asyncio.ensure_future(some_async_fn())
p task
```

### PYTHONASYNCIODEBUG

```bash
PYTHONASYNCIODEBUG=1 python script.py
```

Surfaces coroutines that were never awaited, slow callbacks, and unhandled task exceptions. Turn it on whenever the bug is timing- or async-related.

### `asyncio.gather` swallows the first exception

By default `asyncio.gather(t1, t2)` raises the first exception and cancels the rest. To see all of them, use `gather(..., return_exceptions=True)`.

### Unhandled task exceptions stay quiet

```python
async def main():
    task = asyncio.create_task(broken_coroutine())
    # If the task raises and is never awaited, the exception is eaten at gc time.
    await asyncio.sleep(10)
```

Catch these with `loop.set_exception_handler(...)`, or move to Python 3.12+, which warns louder by default.

---

## debugpy — remote / IDE / container attach

```bash
python -m debugpy --listen 0.0.0.0:5678 --wait-for-client script.py
```

Programmatic attach point in code:

```python
import debugpy
debugpy.listen(5678)
debugpy.wait_for_client()  # blocks until attached
debugpy.breakpoint()
```

**Journal** the port (5678) and the listener file; unset at Phase 9.

---

## Sampling profilers for "why is it slow or stuck"

When the problem is performance or a hang rather than a crash, a profiler that samples a running process beats pdb (pdb alters the timing):

```bash
py-spy top --pid <pid>                       # live top-like view
py-spy record -o profile.svg --pid <pid>     # flamegraph
py-spy dump --pid <pid>                      # stack traces of all threads right now
memray run script.py                         # memory allocation tracking
memray flamegraph output.bin
memray stats output.bin
```

`py-spy dump` on a stuck process often finds the hung call with no breakpoints at all.

---

## Silent-failure patterns in Python

Add these to the Phase 8 silent-failure check:

| Pattern | Why it stays quiet |
|---|---|
| `except Exception: pass` or `except: pass` | catches and discards every error, including KeyboardInterrupt |
| `logging.exception(...)` with no handlers configured | "logs" but writes nowhere |
| `asyncio.create_task(coro)` without storing the task | the task is GC'd before completion and the exception is swallowed |
| `return x.get("key")` for a missing key | returns None quietly; the caller often skips the check |
| `subprocess.run(..., check=False)` with the returncode ignored | a non-zero exit is treated as success |
| Django `transaction.atomic()` inside a broader `except` | rolls back quietly |
| `contextlib.suppress(Exception)` | an explicit silencer, easy to leave wider than intended |
| `queue.get(block=False)` with `except queue.Empty: pass` | polling that quietly drops the work |

---

## Phase 9 cleanup specifics

```bash
# Remove breakpoint() / ipdb / pudb lines from source
git diff | grep -E '(breakpoint\(\)|import ipdb|import pudb|import pdb; pdb\.set_trace)'
git checkout <file>   # for any file the grep flags

unset PYTHONBREAKPOINT
pkill -f 'debugpy' || true
lsof -iTCP:5678 -sTCP:LISTEN -nP 2>/dev/null
```
