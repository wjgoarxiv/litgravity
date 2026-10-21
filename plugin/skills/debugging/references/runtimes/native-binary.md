# Native Binary Debugging (No Source / Reverse Engineering)

For binaries where you lack trustworthy source: stripped production builds, third-party closed libraries, suspect vendored binaries, CTF challenges, firmware, vendored libraries whose docs contradict their behavior. The order of work is specific, and doing it out of order costs days. Run every command through `run_command`; a debugger prompt is a long-running command driven with `send_command_input` and read with `command_status`.

This reference coordinates the triage and dynamic work. The heavy tools each have their own reference:

- Static decompilation -> `../tools/ghidra.md`
- Interactive debugging -> `../tools/pwndbg.md`
- Scripted interaction -> `../tools/pwntools.md`

Read those before you use them, Ghidra especially, which has a surprising amount of non-obvious workflow.

---

## Stop — is this actually a stripped C/C++ binary?

A growing share of "binaries" are bundled high-level apps: Bun SEA, Node SEA, Deno compile, pkg, nexe, Electron, Tauri, PyInstaller. Their workflow is entirely different: the high-level source is recoverable with the right per-bundler tool, and Ghidra against the runtime VM wastes hours.

Quick check:

```bash
file ./target                                                    # Mach-O / ELF / PE — inconclusive
du -h ./target                                                   # 50 MB+ for a "simple CLI" is suspect
strings -n 12 ./target | rg -iE 'bun|node_modules|webpack|esbuild|deno|pkg/lib|electron|pyinstaller|nexe|NODE_SEA_FUSE|tauri' | head -5
```

Any hits mean bundled: open `bundled-js-binary.md` instead. The Ghidra path on a bundled-app binary wastes hours on the runtime VM while the app-level bundle is recoverable (plaintext for Bun, pkg, nexe and Electron-asar; eszip, V8 cache or `.pyc` for Deno, Node SEA and PyInstaller).

When `file` says Mach-O or ELF, `du` is under 20 MB, and the strings check is empty, continue here.

---

## The workflow (in order)

Every step's output feeds the next. Skipping a step means guessing later.

```
  [1] Triage           ->  what kind of binary is this?
  [2] Dynamic tracing  ->  what syscalls / libcalls does it make?
  [3] Static analysis  ->  what does it DO, readably? (Ghidra)
  [4] Dynamic debug    ->  confirm hypotheses at runtime (pwndbg)
  [5] Scripted repro   ->  lock the bug with a pwntools script
  [6] TDD + fix / report
```

Steps 1 and 2 take minutes; step 3 takes tens of minutes to hours. The triage output tells you what to focus on inside Ghidra, so run 1 and 2 first.

---

## [1] Triage — a five-minute fingerprint

```bash
file ./target                          # elf / mach-o / pe? 32/64-bit? dynamically linked? stripped?
readelf -h ./target                    # ELF header: entry point, arch, type
lipo -info ./target 2>/dev/null        # macOS: universal binary?

strings -n 8 ./target | head -100
strings -n 8 ./target | grep -iE '(http|/api/|error|debug|version)'

nm -D ./target 2>/dev/null              # dynamic symbols
objdump -T ./target 2>/dev/null
readelf -d ./target                     # dynamic section (NEEDED libs)
ldd ./target 2>/dev/null                # resolved library paths

checksec --file=./target                # NX, PIE, RELRO, stack canary, FORTIFY
nm ./target 2>/dev/null | head          # empty = stripped
```

### `strings -n N` silently drops short content

`strings` prints runs of printable characters of length at least N. With `-n 8`, anything shorter than 8 chars between non-printable bytes is dropped without a word: short identifier interpolations (`${x}`, `${i}`, `${R}`), short embedded constants (`v3`, `null`), short error codes between padding.

Real example: a template literal `<INSTRUCTIONS>\n${x}\n</INSTRUCTIONS>` came out of `strings -n 8` as `<INSTRUCTIONS>\n</INSTRUCTIONS>` — the `${x}` (4 chars) was dropped, and a reader would conclude the template was empty. It was not.

Use `strings` for fingerprinting only. For any extraction whose correctness matters, read bytes directly:

```bash
LC_ALL=C grep -aoc 'NEEDLE' ./target                 # count occurrences
LC_ALL=C grep -aob 'NEEDLE' ./target | head          # find offsets
python3 -I -c "
data = open('./target','rb').read()
needle = b'NEEDLE'
pos = data.find(needle)
print(repr(data[max(0,pos-100):pos+200]))
"
```

When you must keep `strings`, lower the threshold (`strings -n 1 -t x ./target | rg ...`); the signal-to-noise drops sharply, and short content survives.

Write the triage summary to the journal:

```markdown
## Binary triage
- Type: <ELF 64-bit, dynamically linked, stripped>
- Arch: <x86_64 | arm64 | ...>
- Libs: <libc, openssl, libcurl>
- Security: <NX, PIE, Partial RELRO, no canary>
- Interesting strings: <short list>
- First hypothesis surface: <the function or area that looks most relevant>
```

---

## [2] Dynamic tracing — what does it actually call?

Cheap; run them before Ghidra to orient yourself.

### Linux: strace + ltrace

```bash
strace -f -o trace.out ./target arg1 arg2
strace -f -e trace=network ./target
strace -f -e trace=file ./target
ltrace -f -o ltrace.out ./target
ltrace -f -e 'str*+mem*' ./target
```

### macOS: Mach-O specifics

**SIP reality check.** With System Integrity Protection on (the default), `dtruss` and `dtrace` silently fail to attach to anything in `/usr`, `/bin`, `/sbin`, `/System`, to Apple-signed binaries, and to notarized vendor binaries. `dtruss ./target` appears to run yet produces zero events. That is the SIP design, not a bug. Disabling SIP needs a Recovery Mode reboot, usually not worth it; use the alternatives below.

```bash
sudo dtruss -f ./target 2>&1 | head -20   # works only where SIP allows (your own unsigned binaries)
# Suspiciously empty output = SIP blocked it. Switch to lldb or app-level logging.
```

Mach-O metadata inspection (no SIP issues, no debugger):

```bash
file ./target                                    # arm64 / x86_64 / universal
lipo -info ./target
lipo -thin arm64 ./target -output ./target-arm64
otool -h ./target                                # Mach header
otool -l ./target | head -100                    # load commands
otool -L ./target                                # linked dylibs with versions
dyld_info ./target                               # macOS 13+, more detail than otool -L
otool -tv ./target | head -200                   # quick disassembly
otool -tV ./target                               # symbol-resolved branches
nm -u ./target                                   # undefined references = imports
nm -gU ./target                                  # external defined = exports
codesign -dv --entitlements :- ./target 2>&1     # signature + entitlements XML
spctl --assess --type execute -vv ./target       # Gatekeeper assessment
otool -s __TEXT __cstring ./target               # C strings section
```

To extract the cert chain without creating files named `-0`/`-1` in cwd:

```bash
tmp=$(mktemp -d)
codesign -dvv --extract-certificates="$tmp/cert" ./target 2>&1
ls -la "$tmp"
# rm -rf "$tmp"  # journal first, clean up later
```

**Interactive debugging on macOS uses `lldb`.** GDB on macOS needs a self-signed code-signing certificate and is unreliable on arm64; lldb ships with the command-line tools and works with no configuration.

```bash
lldb ./target
(lldb) settings set target.run-args arg1 arg2
(lldb) breakpoint set --name function_name
(lldb) breakpoint set --address 0x1000034c0
(lldb) breakpoint set --regex '.*decode.*'
(lldb) run
(lldb) bt
(lldb) frame variable
(lldb) register read
(lldb) memory read --size 8 --format x --count 16 $sp
(lldb) disassemble --frame
(lldb) image list
(lldb) image lookup -a 0x1000034c0
(lldb) process attach --pid 12345
(lldb) process attach --name target
(lldb) image dump sections ./target
(lldb) image dump symtab ./target
```

**Function interception via `DYLD_INSERT_LIBRARIES`** (the macOS `LD_PRELOAD`):

```bash
DYLD_INSERT_LIBRARIES=./shim.dylib DYLD_FORCE_FLAT_NAMESPACE=1 ./target
```

It works in the unrestricted case and is blocked in three distinct scenarios. Distinguish them when a shim does not load:

1. **SIP / restricted process** (the target has a `__RESTRICT,__restrict` section, is setuid/setgid, or is platform/Apple-signed): dyld strips all `DYLD_*` env vars before the process starts, so nothing you set reaches the target.
2. **Hardened runtime + library validation** (`CS_RUNTIME` set, `com.apple.security.cs.disable-library-validation` absent): the process accepts `DYLD_INSERT_LIBRARIES` and rejects any dylib not signed by the same Team ID or Apple. Symptom: the shim is found yet unloaded; check `log show --predicate 'eventMessage CONTAINS "library validation failed"'`.
3. **Notarization / Gatekeeper translocation**: the binary runs from a translocated path, so relative paths in `DYLD_INSERT_LIBRARIES` fail to resolve. Use absolute paths.

Check each:

```bash
otool -l ./target | grep -A2 __RESTRICT                                     # case 1
codesign -d --verbose=4 ./target 2>&1 | grep -iE 'flags=|CodeDirectory'      # case 2 (look for runtime flag)
codesign -d --entitlements :- ./target 2>&1 | grep disable-library-validation
```

**App-level debug logging (always works, ignores SIP).** When the debugger attach is blocked, maximize the app's own logging:

```bash
APP_DEBUG=1 APP_LOG_LEVEL=debug APP_LOG_FILE=/tmp/trace.log ./target
NSDebugEnabled=YES ./target
OS_ACTIVITY_MODE=debug ./target
log stream --predicate 'process == "target"' --level debug
log show --predicate 'process == "target"' --last 1h --info --debug
```

This is the partial-runtime-evidence path for macOS; see `../methodology/partial-runtime-evidence.md` for combining app-level logs with static analysis when a wire-level capture is blocked.

**Network capture on macOS (TLS-decrypted):**

```bash
# 1. Find the active network service (do not assume "Wi-Fi"):
networksetup -listallnetworkservices
DEFAULT_IF=$(route -n get default 2>/dev/null | awk '/interface:/ {print $2}')
echo "Default-route interface: $DEFAULT_IF"
SERVICE=$(networksetup -listallhardwareports | awk -v iface="$DEFAULT_IF" '
  /^Hardware Port:/ { hp = substr($0, index($0,$3)) }
  /^Device:/        { if ($2 == iface) print hp }
')
[ -z "$SERVICE" ] && { echo "Pick a service from -listallnetworkservices manually." >&2; false; }

# 2. JOURNAL the original proxy state before changing it (required for safe rollback):
networksetup -getwebproxy "$SERVICE"
networksetup -getsecurewebproxy "$SERVICE"

# 3. Start mitmproxy with a persistent CA at ~/.mitmproxy/
mitmproxy --listen-host 127.0.0.1 --listen-port 8888 &

# 4. Trust the CA system-wide if the target uses URLSession (most macOS-native apps do):
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem

# 5a. Apps that honor env vars (most CLIs):
HTTPS_PROXY=http://127.0.0.1:8888 SSL_CERT_FILE=~/.mitmproxy/mitmproxy-ca-cert.pem ./target ...
# 5b. Apps that use the system network config (most GUI apps, some CLIs):
networksetup -setwebproxy "$SERVICE" 127.0.0.1 8888
networksetup -setsecurewebproxy "$SERVICE" 127.0.0.1 8888

# 6. Cleanup — RESTORE the original state from the journal, untrust the CA:
networksetup -setwebproxystate "$SERVICE" off
networksetup -setsecurewebproxystate "$SERVICE" off
sudo security delete-certificate -c "mitmproxy" /Library/Keychains/System.keychain
```

Step 6 matters: skipping it leaves all later traffic mis-routed and open to interception. Journal every step.

### What to look for

| Observation | Hypothesis |
|---|---|
| `open("/etc/secret-config", ...)` | reads an unexpected config; look at what it does with the contents |
| `connect(... 1.2.3.4:443)` | phones home or depends on an external service |
| `getenv("FOO")` returning NULL | an env var is expected and unset |
| repeated `poll`/`epoll_wait` with no progress | stuck on I/O; check downstream |
| `SIGSEGV` caught by a signal handler | custom crash recovery that often hides the real bug |
| `dlopen("libfoo.so.42")` | dynamic plugin loading; check the plugin path |

### Linux function interception with `LD_PRELOAD`

When a libc or library call is the suspect, shim it rather than patching the binary. Build a small override, log the arguments, then forward to the real symbol:

```c
// shim.c — build: cc -shared -fPIC -ldl shim.c -o /tmp/debug-shim.so
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <string.h>
static size_t (*real_read)(int, void *, size_t);
ssize_t read(int fd, void *buf, size_t n) {
    if (!real_read) real_read = dlsym(RTLD_NEXT, "read");
    ssize_t r = real_read(fd, buf, n);
    fprintf(stderr, "[shim] read(fd=%d, n=%zu) -> %zd\n", fd, n, r);
    return r;
}
```

```bash
LD_PRELOAD=/tmp/debug-shim.so ./target arg1 2>/tmp/debug-shim.log
```

Journal the `.so` path and the log. It is the Linux twin of the macOS `DYLD_INSERT_LIBRARIES` path above; the same library-validation blocks do not apply, though a setuid target strips `LD_PRELOAD`.

### Core dumps — post-mortem without reproducing live

When the crash is rare or slow to trigger, let it drop a core and analyze that:

```bash
ulimit -c unlimited                              # allow core dumps in this shell (journal it)
cat /proc/sys/kernel/core_pattern                # where the core lands (often systemd-coredump)
coredumpctl list ./target                        # systemd: list captured dumps
coredumpctl gdb ./target                         # open the latest in gdb/pwndbg
# Or, with a plain core file:
gdb ./target ./core
(gdb) bt                                          # the crash backtrace
(gdb) info registers
```

On macOS, cores land under `/cores/` once `sudo sysctl kern.coredump=1` and `ulimit -c unlimited` are set; open one with `lldb -c /cores/core.<pid> ./target`. A core gives you the register and stack state at the crash with no live repro, which is the fastest path for an intermittent native crash.

---

## [3] Static analysis with Ghidra

Once triage and tracing have narrowed you to "something in function X" or "the crypto routine is odd", open Ghidra. Read `../tools/ghidra.md` first; the import / analyze / decompile workflow is not obvious and first-time users lose an hour to it. Stay in the Decompiler view (readable-ish C); drop to the Listing only when the decompiler punts.

---

## [4] Dynamic debugging with pwndbg

Once static analysis gives you a hypothesis ("the branch at 0x401234 is where validation fails"), confirm it at runtime with pwndbg. Read `../tools/pwndbg.md` first; the context view (registers, stack, disassembly and code at once) is what makes binary debugging workable.

```
$ gdb ./target
pwndbg> break *0x401234
pwndbg> run arg1 arg2
pwndbg> context
pwndbg> telescope $rdi
pwndbg> x/20xw $rsp
pwndbg> ni / si
```

---

## [5] Scripted reproduction with pwntools

With a concrete repro input, lock it down with pwntools; this is the failing-test equivalent for binaries. Read `../tools/pwntools.md` for the Process/Remote/ELF/context APIs.

```python
from pwn import *
context.binary = elf = ELF('./target')
p = process('./target')
p.sendlineafter(b'> ', b'<trigger input that reproduces the bug>')
result = p.recvall(timeout=3)
assert b'expected-output-when-fixed' in result, f'bug repro: {result}'
```

This script is your red test; when the fix lands, it passes (or invert the assertion for a negative test).

---

## [6] Fixing a binary bug you cannot recompile

In preference order:

### Option A: patch at the source (when you have it)

The bug is in your own code and source is available: fix and rebuild. Standard TDD path.

### Option B: binary patch

For tiny fixes (one byte, one branch inversion):

```bash
# Ghidra says the bug is at 0x401234 = file offset 0x1234
printf '\x90\x90' | dd of=./target bs=1 seek=$((0x1234)) conv=notrunc
```

Journal the exact `dd` command and the original bytes so you can revert.

### Option C: wrap / shim

When you cannot patch the binary, write a shim library (LD_PRELOAD on Linux, DYLD_INSERT_LIBRARIES on macOS) that overrides the buggy function; pwntools has examples.

### Option D: report upstream

For a third-party binary where none of the above fits, the "fix" is a high-quality bug report: the full triage summary, a reproducible pwntools script, the Ghidra decompilation of the buggy function, the root-cause hypothesis, and a recommended patch sketch in C or pseudocode.

---

## Silent-failure patterns in native binaries

| Pattern | Why it stays quiet |
|---|---|
| ignored libc return codes (`read`, `write`, `malloc`) | the bug continues with garbage data, unchecked |
| a signal handler that swallows SIGSEGV | a crash turns into "something did not work", no log |
| `setjmp`/`longjmp` unwinding over cleanup | resources leak quietly |
| thread-local error state never read (`errno`, `GetLastError`) | the error happened; nobody asked |
| a recovered assertion in a release build | `assert` is compiled out; precondition violations corrupt quietly |
| dangling pointer reads after free | often looks like valid data until it does not |

---

## Phase 9 cleanup specifics

```bash
pkill -f 'gdb' || true
pkill -f 'lldb' || true

ls -la ~/ghidra-projects/ 2>/dev/null
# rm -rf ~/ghidra-projects/debug-scratch         # only if the journal says to

rm -f ./core ./core.* ~/core.*
rm -f trace.out ltrace.out
# Binary patch (Option B): restore the original bytes from the journal:
# printf '<original-bytes>' | dd of=./target bs=1 seek=<offset> conv=notrunc
rm -f /tmp/debug-*.bin /tmp/debug-*.strace /tmp/debug-*.ltrace

# macOS: restore proxy settings (critical) — use the SAME $SERVICE from the journal
[ -n "$SERVICE" ] && {
  networksetup -setwebproxystate "$SERVICE" off 2>/dev/null
  networksetup -setsecurewebproxystate "$SERVICE" off 2>/dev/null
}
pkill -f 'mitmproxy' 2>/dev/null
rm -f /tmp/*-shim.dylib
rm -f /tmp/*-strings*.txt                 # may contain secrets
scutil --dns | head -20                   # confirm resolution returned to normal
```
