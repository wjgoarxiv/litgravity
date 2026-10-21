# Cleanup receipts

A browser run starts processes, writes files and may hold sessions. The receipt shows that all of it is gone. A close command asks for that; the receipt is what the machine says afterwards.

## Register at the start

Before the first action, write `cleanup-plan.txt` in the evidence folder:

```text
processes_before: <output of: pgrep -fl 'agent-browser|chrom|playwright' | sort>
owned_paths: <temporary profile dirs, download dirs, storage-state copies the run will create>
sessions: <names of agent-browser sessions the run will open>
servers_started: <commands the run started, with ports>
```

The process list before the run matters because other work on the same machine may run its own browsers. Comparing before and after isolates what this run left behind; a name match alone claims other people's processes.

## Close in this order

1. The driver's own stop: `agent-browser close` for every session named in the plan, or the script's `finally` block (trace stop, then `browser.close()`).
2. Servers the run started: stop them with the command or signal that matches how they were started, then confirm the port is free (`lsof -nP -iTCP:<port> -sTCP:LISTEN` prints nothing).
3. Paths in `owned_paths`: remove them. A storage-state copy, a download directory outside the evidence folder and scratch scripts all go.
4. Evidence files stay.

## Write the receipt

Write `cleanup.txt`:

```text
processes_after: <same command, sorted>
new_processes: <lines present after and absent before>
ports_free: <port: yes|no>
paths_removed: <path list>
result: CLEAN | BLOCKED
```

`CLEAN` requires `new_processes` empty, every port free and every owned path removed. Anything else is `BLOCKED: cleanup unconfirmed` with the survivors named. A new process that belongs to another tool (a build watcher the user started during the run) is listed and explained in one line; judging whether it is the run's responsibility is the reader's call.

## Surviving processes

Report the pid and the command line. The user decides whether to stop it. Killing a process that the run did not start crosses the boundary of this skill; killing one the run started is allowed with the matching signal (`kill <pid>` first, `kill -9 <pid>` after a pause if it ignores the first).

## Cancel path

On cancel, produce the same receipt before replying: the run may have stopped halfway, which makes a leaked session more likely. The ledger line reads `canceled: cleanup CLEAN` or `canceled: cleanup BLOCKED (<what survived>)`.

## Pitfalls

- `pkill chrome` removes browsers that belong to other work. Compare lists and name pids.
- A headless Chrome child can outlive its parent after a crash; the before and after comparison catches it.
- A persistent browser profile (the user's own) is never a cleanup target and never a driver profile. The driver starts a fresh temporary profile each run.
- A receipt written before the final screenshot was read proves nothing about what happened after; write it last.
