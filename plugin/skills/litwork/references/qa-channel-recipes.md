# QA channel recipes

Open this when writing a SURFACE scenario or its cleanup. Every recipe names the invocation, the observable and the teardown, so the receipt can prove absence. Commands run through `run_command`; replace the placeholders with literal values first. Evidence goes under `.litgravity/evidence/<slug>/`. A headless `agy -p` run ends with no output when `run_command` is refused, so state the permission each recipe needs before relying on it.

## HTTP service

```bash
# start (long-running: background it with a pid file, then read the log once)
node server.mjs > .litgravity/evidence/<slug>/server.log 2>&1 & echo $! > /tmp/lit-qa-<id>.pid
# wait for readiness with a bounded loop, then probe
curl -i --max-time 10 -X POST http://127.0.0.1:8080/items -H 'content-type: application/json' -d '{"name":"x"}' \
  > .litgravity/evidence/<slug>/<id>-surface.log
# observable: first line is `HTTP/1.1 201`, body contains "id"
# teardown
kill "$(cat /tmp/lit-qa-<id>.pid)"; sleep 1; kill -0 "$(cat /tmp/lit-qa-<id>.pid)" 2>/dev/null || echo "gone"
lsof -i :8080 || echo "port free"; rm -f /tmp/lit-qa-<id>.pid
```

Probe the failure path as well: a malformed body returns the documented 4xx and writes no record.

## CLI or script

```bash
node bin/tool.mjs status --json > .litgravity/evidence/<slug>/<id>-surface.log 2>&1; echo "exit=$?" >> .litgravity/evidence/<slug>/<id>-surface.log
# observable: exit=0, stdout parses as JSON, field `ok` is true
```

Add one failing invocation (a bad flag, a missing file) and assert the documented exit code.

## Terminal UI

```bash
tmux new-session -d -s lit-qa-<id> -x 120 -y 30 'node bin/tool.mjs ui'
tmux send-keys -t lit-qa-<id> 'q' Enter
tmux capture-pane -t lit-qa-<id> -pS -E - > .litgravity/evidence/<slug>/<id>-surface.log
# teardown
tmux kill-session -t lit-qa-<id>; tmux ls 2>&1 | grep -c lit-qa-<id> || echo "session gone"
```

A pane dump is a boot smoke test. Color, layout and CJK width need a rendered screenshot through `visual-qa`.

## agy-facing behavior

```bash
agy -p "Say hello" --output-format json --print-timeout 170s < /dev/null > .litgravity/evidence/<slug>/<id>-surface.json
```

The observable is a field in the JSON result. Each call draws on the account's model quota, so the scenario names how many calls it makes and the run stops at the budget the plan or the user set. A criterion about hook behavior can use the free listings instead: `agy -p "/hooks" < /dev/null`, `"/skills"`, `"/agents"` and `agy plugin validate plugin --json --strict` cost nothing. A headless run that needs `run_command` fails without output when the command is refused.

## Installed package

```bash
npm pack --silent --pack-destination /tmp/lit-qa-<id>   # prints the tarball name
mkdir -p /tmp/lit-qa-<id>/prefix && npm install --prefix /tmp/lit-qa-<id>/prefix /tmp/lit-qa-<id>/<tarball>
/tmp/lit-qa-<id>/prefix/node_modules/.bin/<bin> --version
# teardown
rm -rf /tmp/lit-qa-<id>; test ! -e /tmp/lit-qa-<id> && echo "removed"
```

`npm install` needs a network approval when the package has dependencies, so record the answer as a `decision`.

## Hook replay

```bash
printf '%s' '{"conversationId":"qa1","transcriptPath":"<fixture path>","invocationNum":0,"workspacePaths":["'"$PWD"'"]}' \
  | node plugin/hooks/pre-invocation.mjs > .litgravity/evidence/<slug>/<id>-surface.json
```

Replay a malformed payload too (`printf '{'`); the observable is the documented fail-open or refusal. Handlers run with the plugin folder as the working directory, so run them from there with `Cwd` set.

## Desktop GUI

OS-level automation against the running application, when the host offers it. Save an action log and a screenshot path. Without that automation the criterion is `BLOCKED:` and a command-line dump does not substitute.

## Cleanup receipt

One line per criterion, written after the checks: what was stopped, what was removed, how absence was verified.

```text
cleanup: killed 12345 (kill -0 fails); tmux kill-session lit-qa-parser (tmux ls clean); removed /tmp/lit-qa-parser (test ! -e); port 8080 free (lsof empty)
```

Append it as a ledger `note` and next to the artifact. A resource that was already running before the run is not the run's to stop.
