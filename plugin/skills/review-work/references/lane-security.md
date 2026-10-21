# Lane 4: security

This lane reviews for security only and ignores style unless style creates risk. The default agent is `quality-reviewer` with the security brief below, since the roster has no separate security agent. A change to hooks, installers, shell construction, prompt handling or external data cannot pass review without this lane.

## Categories

1. **Input validation.** Injection (shell, SQL, template, prompt), path traversal, SSRF, unbounded input size, regex with catastrophic backtracking.
2. **Authentication and authorization.** Missing checks, checks in the wrong layer, privilege widening, default-open settings.
3. **Secrets and credentials** in code, config, logs, test fixtures, ledger lines and evidence files.
4. **Data exposure.** Personal data in error messages, logs, handoffs and crash output.
5. **Dependencies.** New packages, install scripts, licenses, pinning, lockfile consistency, typosquat names, packages pulled from a URL.
6. **Cryptography.** Home-made schemes, weak hashes, fixed seeds or IVs, comparison that leaks timing.
7. **File and path handling.** Symlink following, partial writes, world-writable modes, temp files with predictable names, writes outside the intended root.
8. **Network.** TLS verification disabled, CORS wide open, missing rate limits, redirects followed blindly.
9. **Error and information leakage.** Stack traces and internal paths returned to callers.
10. **Trust boundaries.** Hook JSON parsing, prompt injection from fetched pages, issue bodies and tool output, destructive or install and update operations triggered by text, host configuration writes (`~/.gemini`, settings files, credentials).

## Method

Trace each piece of untrusted input from entry to effect and write the path as a chain of `path:line` anchors. Separate three kinds of result:

- **Exploitable defects**: the attacker, the input and the effect can all be named. BLOCKER.
- **Defense-in-depth gaps**: no exploit path today, a missing layer for tomorrow. MAJOR or MINOR by blast radius.
- **Documentation inaccuracies**: docs claim a protection the code lacks. MAJOR, because readers rely on it.

Each finding says what an attacker could do and what the remediation is. A hunch without a trace stays an open question in the lane's limitations.

## agy-specific checks

- A hook that answers every call with an empty object is read by agy as a denial, and a hook that answers `allow` broadly may lift the user's own approval prompts. Review matcher scope and the decision each branch returns.
- Hook scripts parse stdin defensively and treat transcript text as data. A prompt-derived string never reaches a shell, a path join or a regular expression compiled from user text.
- Installers write only inside their documented folders, refuse symlinked or foreign destinations, and leave `~/.gemini` credentials alone.
- Ledger and evidence writers redact keys, tokens and environment values before writing.
- Skills that read pages or issues declare them data, and an example of hostile text is labeled as such.

## Output

The fixed lane schema, with a `trust_boundaries` list at the end naming each boundary the change crosses and how it is guarded. A PASS lane lists the categories it examined, so silence about a category reads as "examined, nothing found".
