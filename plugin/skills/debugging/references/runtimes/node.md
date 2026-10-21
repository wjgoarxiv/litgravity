# Node.js / tsx / ts-node / Bun / Deno Debugging

Covers Node 18+, tsx, ts-node, Bun, Deno: launch recipes, inspector-protocol usage, the `node inspect` CLI, and the tsx source-map silent failure that costs people days. Run every command through `run_command`; the inspector client is a long-running command, so start it with `WaitMsBeforeAsync`, read it with `command_status`, and drive it with `send_command_input`.

---

## Environment detection (Phase 0)

```bash
node --version
cat package.json | head -40

# Which JS runtime launches the app? (first match wins)
ls node_modules/.bin/tsx 2>/dev/null         && echo 'has tsx'
ls node_modules/.bin/ts-node 2>/dev/null     && echo 'has ts-node'
ls node_modules/.bin/vitest 2>/dev/null      && echo 'has vitest'
which bun 2>/dev/null                        && bun --version
which deno 2>/dev/null                       && deno --version

# Source-map situation
grep -E '"sourceMap"|"inlineSources"' tsconfig.json 2>/dev/null
grep -l '//# sourceMappingURL' dist/*.js 2>/dev/null | head -3

# Debug-relevant ports
lsof -iTCP:9229 -sTCP:LISTEN -nP 2>/dev/null
lsof -iTCP:9230 -sTCP:LISTEN -nP 2>/dev/null
```

---

## The tsx + `node inspect` CLI silent failure (read this first)

`tsx` transpiles each `.ts` file on the fly and emits an inline source map. V8 Inspector registers the module with its `.ts` path, so it shows up in the debugger's `scripts` list, but the `node inspect` CLI REPL does not resolve source-map line numbers reliably. `sb('session.ts', 285)` shows a "pending" breakpoint that never fires even after the module loads.

The breakpoint list displays it, so it looks set. It is not.

### Three reliable workarounds

| Workaround | When to use | Downside |
|---|---|---|
| **`debugger;` statement in source** | CLI required, you can edit the source | needs a source edit and revert |
| **Chrome DevTools GUI** (`chrome://inspect`) | CLI not required, faster iteration | unavailable when the user asked specifically for the CLI |
| **Debug the built `dist/` JS** | source maps work end to end | needs a build on every source change |

The `debugger;` statement is the most reliable. Journal the edit and revert it at Phase 9.

---

## Launch recipes by runtime

### Node (plain JS / compiled TS)

```bash
node --inspect-brk=9229 dist/index.js        # break on first line, wait for attach
node --inspect=9229 dist/index.js             # attach, do not block startup (pair with debugger; statements)
node --inspect-wait=9229 dist/index.js        # wait for attach, THEN run (Node 20.15+)
node --enable-source-maps --inspect dist/index.js   # source maps in stack traces
```

### tsx

```bash
node --inspect-brk=9229 --import tsx index.ts
node --inspect=9229 --import tsx index.ts
NODE_OPTIONS='--inspect-brk=9229' npx tsx index.ts   # if invoking tsx directly
# tsx watch reloads the inspector per file change; debug without watch:
node --inspect=9229 --import tsx index.ts
```

### ts-node

```bash
node --inspect-brk -r ts-node/register src/index.ts
node --inspect --loader ts-node/esm src/index.ts     # ESM loader is fragile; prefer tsx
```

### Bun (WebKit Inspector Protocol)

```bash
bun --inspect src/index.ts                    # opens a debug.bun.sh URL
bun --inspect-brk src/index.ts                # break on start
bun --inspect-wait src/index.ts               # wait for attach
bun test --inspect-brk                        # debug the test runner
```

Bun uses the WebKit Inspector Protocol, so `chrome://inspect` will not connect directly. Use `debug.bun.sh`.

### Deno (native V8)

```bash
deno run --inspect-brk --allow-all src/main.ts
deno test --inspect-brk --filter "auth"
```

Deno is the smoothest TS debugging experience: native V8 inspector, no source-map workarounds.

### Vitest

```bash
vitest --inspect-brk --no-file-parallelism
vitest --inspect-brk --browser --no-file-parallelism
```

Without `--no-file-parallelism` the breakpoints stay silent, because Vitest spawns workers in a process other than the one listening on the inspector port.

---

## Attaching with the `node inspect` CLI

```bash
node inspect 127.0.0.1:9229         # attach to an existing --inspect process
```

Core commands at the `debug>` prompt:

```
cont, c                  resume until the next break / debugger;
next, n                  step over
step, s                  step into
out, o                   step out
pause                    pause a running process
bt                       backtrace
scripts                  list all modules V8 has loaded (incl. tsx-transpiled .ts)
sb(N)                    set breakpoint at line N of the current file
sb('file', N)            set breakpoint at line N of a matching file (unreliable with tsx)
sb(func)                 set breakpoint at a function reference
cb(N), cb('file', N)     clear a breakpoint
breakpoints              list breakpoints (shows pending ones without saying they will not fire)
watch('expr')            persistent watch expression
watchers                 show watchers
exec('expr')             evaluate an expression in the paused frame's scope
repl                     drop into a full REPL with the frame's scope
restart                  restart the debuggee
kill                     kill the debuggee
```

`exec('expr')` is the most powerful tool in this CLI: it evaluates any JS in the paused frame and returns the value. Use it heavily.

---

## `exec()` patterns that resolve hypotheses fast

At a breakpoint, these queries settle most LLM / agent / async bugs in one line each:

```js
// Agent / LLM state
exec('this.agent.state.messages.length')
exec('this.agent.state.messages.map(m => m.role)')
exec('JSON.stringify(this.agent.state.messages.at(-1)).substring(0, 500)')
exec('this.agent.state.messages.at(-1).errorMessage')      // silent-error sentinel
exec('this.agent.state.messages.at(-1).stopReason')
exec('JSON.stringify(this.agent.state.usage)')             // undefined / all-zero = failed call
exec('this.agent.state.model.baseUrl')                     // catch hardcoded vs env-var

// Env / config at runtime
exec('process.env.RELEVANT_VAR')
exec('Object.keys(process.env).filter(k => k.startsWith("SERVICE"))')
exec('this.config')

// Async / timing
exec('Date.now() - this._turnStartedAt')
exec('this._activePromises?.size')

// HTTP request/response in flight
exec('JSON.stringify(req.body).length')
exec('res.statusCode')
exec('res.headersSent')

// What is actually running
exec('process.version')
exec('process.cwd()')
exec('process.argv')
```

---

## Silent-failure patterns in Node

Check these whenever a response is "too fast" or "too empty":

| Signal | What it means |
|---|---|
| HTTP 200 + `content: ""` | a silent error was swallowed |
| HTTP 200 + a sub-second response for an LLM call | too fast for a real model call; something short-circuited |
| `usage: { totalTokens: 0 }` | the SDK returned a stub without making the call |
| `stopReason: "error" + content: []` | the SDK packaged an error into a "success" message |
| an unhandled promise rejection with no log | a missing `await`, or `.catch(() => {})` |
| `try { await x(); } catch {}` | the error is eaten, no log |
| `void somePromise()` | an explicit opt-out of error propagation, often a bug |
| a callback-style API whose callback never fires | the error happened before the callback was scheduled |
| a handler that calls `res.json(...)` twice | the second call is silent on some Express versions |

When you find one, add a temporary `console.error('[DEBUG-<slug>]', ...)` to make it loud; journal it and revert at Phase 9.

---

## Two-pane terminal layout

```bash
# Long-running inspected process (start with WaitMsBeforeAsync so run_command returns)
node --inspect=9229 --import tsx index.ts

# Interactive debugger client, read with command_status and driven with send_command_input
node inspect 127.0.0.1:9229
```

When tmux is installed, a two-session layout keeps the process and the client readable; otherwise two long-running `run_command` handles do the same. Journal both and stop both at Phase 9.

---

## When to switch from the CLI to Chrome DevTools

The user's preference for the CLI is valid. Suggest a switch in one short sentence only when source-map resolution fails (`sb('file', line)` not firing) and the fix is time-sensitive, when you need to watch many values at once, or when CLI step semantics get murky across microtask boundaries. Phrase it as a note: "I can push through with `debugger;` statements in the CLI. If we hit three of these in a row, `chrome://inspect` would cut cycle time in half — your call."

---

## Phase 9 cleanup specifics

```bash
git diff | grep -E '(debugger;|console\.log\(.*DEBUG|\[DEBUG)'
git checkout <file>   # for any matching file

pkill -f 'node --inspect' || true
pkill -f 'bun --inspect' || true
pkill -f 'deno.*--inspect' || true
lsof -iTCP:9229 -sTCP:LISTEN -nP 2>/dev/null
```
