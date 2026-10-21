# Autoconference provenance

This skill is adapted from an owner-held source identified by these stable, network-neutral values:

- Source identifier: `064_autoconference-skill`
- Source commit: `58a65afc174cd8c2fa162bb0d1953b0a88e5d419`
- Source tree: `8e73d89cefd9ca136f9c45a918517cc5e809fd57`
- License: MIT, preserved verbatim in `LICENSE` (Copyright (c) 2026 wjgoarxiv)

Anonymous retrieval is not claimed. The source is not anonymously public, so this record names no repository or
mirror URL and needs no network access to be checked.

What LitGravity keeps: the seven modes (`core`, `plan`, `resume`, `analyze`, `debate`, `survey`, `ship`), the
protocol, child-brief, logging, convergence, crash-recovery and visualization references, the six scenario templates,
the three report assets, and the scaffold, status and figure-style helpers.

What LitGravity changes: the protocol is rewritten for the agy host. The root conversation is the Chair and owns the
budget, the conference ledger (`conference_events.jsonl`) and every shared file. Children start with
`invoke_subagent` under least-authority agent types and report back with `send_message`; since the host has no wait
or read-result tool, phases close on received reports or recorded failures, and the Chair relays everything one lane
learns from another. Every conference has a hard budget in rounds, children and model calls. State lives under
`.litgravity/conference/<slug>/`. Irreversible actions (merge, delete, push, publish) stay with the user.

What LitGravity leaves out: the source's detached loop script (it depended on background shells, and a conference
here needs a live root conversation to receive child reports), the source's tests, guides, examples, release
automation, caches and generated files.
