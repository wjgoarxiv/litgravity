# lit-loop: adversarial classes and the probe that closes each

HEAVY work probes the classes that apply and writes one line of reason for each class that does not. A class is closed by an artifact, never by a statement that it was considered. Save artifacts next to the criterion's other evidence as `<id>-adv-<class>.<ext>`.

| Class | Probe | What closes it |
| --- | --- | --- |
| malformed input | feed the entry point empty, oversized, wrongly typed, truncated and wrongly encoded input, plus the one shape the code assumes cannot occur | a log where each input ends in a clear error or a defined fallback, never a crash, a hang or silent acceptance |
| prompt injection | put instruction-shaped text in every data field the code reads: file contents, issue bodies, filenames, environment values | a log showing the text treated as inert data: no command run, no prompt altered, no setting changed |
| cancel and resume | interrupt the operation midway, then run it again | the second run finishes the work once, with no duplicate, no half-written file and no stuck lock |
| stale state | change the input a cache, generated file, manifest or payload was built from, then run the feature | the stale artifact fails loudly or is regenerated on purpose; or one written sentence says why staleness is impossible |
| dirty worktree | start with unrelated modified and untracked files present | `git status` before and after differs only by this task's files |
| hung or long commands | run the slowest command with a timeout | the timeout fires, the child process is gone, the receipt says so |
| flaky tests | run the deciding test three times in a row | three passes, or the flake is named and quarantined with a `decision` line |
| misleading success output | read the artifact the success line talks about, not the line | the artifact exists and holds what the line claimed |
| repeated interruptions | send two corrections while work is running | the ledger shows each correction applied to the right criterion, with no orphaned work |

## Choosing classes

- Anything that parses text, paths, URLs or serialized data: malformed input and prompt injection.
- Anything that runs for more than a few seconds, spawns children or holds a lock: cancel and resume, hung commands.
- Anything generated, cached or copied into a package: stale state.
- Any change in a repository the user is also editing: dirty worktree.
- Any change whose evidence is a count or a green line: misleading success output.

## Reporting

The HEAVY review lane receives this table with the artifact paths filled in and is asked to falsify it. A class the lane cannot falsify stays closed; a class it falsifies reopens the criterion it belongs to.
