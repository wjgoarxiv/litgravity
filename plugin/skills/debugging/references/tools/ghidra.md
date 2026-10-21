# Ghidra — Decompile Binaries Into Readable C

**https://github.com/NationalSecurityAgency/ghidra**

Ghidra is an open-source reverse-engineering suite whose defining feature is a decompiler that turns machine code back into readable C. For any binary you lack source for, it is the right starting point, ahead of `strings`, hex-staring, or `objdump -d`.

Reach for Ghidra for closed-source libraries, suspect vendored binaries whose behavior contradicts their docs, CTF challenges, firmware, and any time you need to read compiled code.

---

## Install

```bash
# macOS
brew install --cask ghidra
# OR download the release ZIP from the repo and ./ghidraRun

# Linux: download from the releases page, needs JDK 21+
./ghidraRun

java -version    # must be 21+
```

Ghidra is a Java Swing app: dated-looking, works well. Launch it through `run_command` with `WaitMsBeforeAsync`, since it is long-running.

---

## First-time workflow (memorize it — it is not obvious)

1. Start Ghidra: `ghidraRun`.
2. Create a project: File -> New Project -> Non-Shared -> name it `debug-<binary-name>` (journal the path so you can remove it at Phase 9 if disposable).
3. Import the binary: File -> Import File -> pick the target, accept the default format detection.
4. Double-click the imported binary. Ghidra offers to analyze it: say yes, accept defaults for the first pass. Seconds for a small binary, tens of minutes for a large one.
5. When analysis finishes, you are in the CodeBrowser view.

Two panels do 95% of the work: the **Listing** (middle) with the disassembly and Ghidra's inferred labels and types, and the **Decompiler** (right) with the reconstructed C — the real value.

---

## Find the right function fast

Do not read the whole binary. Narrow:

### Symbol Tree (left panel)

- `Functions` — every detected function. Stripped binaries show `FUN_00401234`; unstripped show real names.
- `Imports` — dynamically-linked functions, good for "does this call `system()`, `strcpy`, `curl_easy_perform`?"
- `Exports` — for a library.

Click to jump; the Decompiler updates instantly.

### String search

`Search -> For Strings` lists every string. Right-click one -> `References -> Show References to Address` jumps to the code that references it. This is how you find the function that handles the error message you saw at runtime.

### Memory search for bytes

`Search -> Memory` searches hex or text: known magic bytes, file-format signatures, constants.

### Cross-references (XREF)

Right-click a function or address -> `References -> Find References to` shows every caller. Walk the call graph backward from interesting functions.

---

## Make the decompiler output readable

Ghidra's decompiler is good and needs hints. Three actions improve it sharply:

1. **Rename variables.** Click a variable in the Decompiler -> `L` -> type a better name. Ghidra propagates the rename.
2. **Set types.** A variable showing as `undefined4` or `void *` is unhelpful. Click it -> `Ctrl+L` -> set the type. For pointers to structs from headers you have, `File -> Parse C Source` -> paste the header to auto-create the struct types, then assign the struct type to the pointer and Ghidra resolves field accesses.
3. **Retype function signatures.** Click the function name in the Decompiler -> `F` (Edit Function Signature) -> set the return and argument types. It propagates through callers.

Do these three on the 3-5 most relevant functions and the output reads close to source.

---

## Patterns for specific bug types

### Integer / buffer overflow

```
Listing: LEA -> CMP patterns on sizes; memcpy/strcpy/sprintf with non-constant sizes
Decompiler: arithmetic on size_t without a bounds check; `+ user_input` in a length calc
```

### A missing auth check

Navigate from the handler entry (found via Strings or Imports) and read the control flow: does the function return early or jump to the error handler when a flag is unset? An absent check is the bug.

### Hardcoded URLs / keys / paths

`Search -> For Strings`, filter `http:` / `https:` / `/etc/` / `bearer ` / `api_key`.

### Dispatch / plugin loading

`Imports` -> `dlopen`, `LoadLibrary`, `dlsym`, `GetProcAddress`. Strings referenced near those calls are often plugin names.

---

## Scripting (headless Ghidra)

To automate analysis across many binaries, or repeat a workflow:

```bash
$GHIDRA_INSTALL_DIR/support/analyzeHeadless \
  <project-dir> <project-name> \
  -import <binary> \
  -postScript <script.py or script.java>
```

Ghidra runs Python 3 scripts (via a Jython-compatible API) and Java. Useful scripts dump all function signatures to JSON, find all calls to `system()` with constant arguments, or auto-rename `FUN_xxx` from string refs and call patterns. The community collection lives in the repo under `Ghidra/Features/Base/ghidra_scripts`.

---

## Bookmarks and notes

Ghidra has built-in bookmarks and comments; use them as the journal inside the project. Right-click an address -> `Set Bookmark` -> tag it `Note`. Right-click -> `Comments -> Set EOL Comment` shows inline in the decompiler. When you promote the project (keep it after the session), these comments become durable documentation.

---

## Gotchas

- **Large binaries need more Java heap.** Edit `support/launch.properties` and raise `VMARGS=-Xmx8G` (the default 2G is often too small).
- **Save often.** Autosave is not instant; a crash loses uncommitted analysis.
- **The decompiler has timeouts.** For a complex function it prints `/* WARNING: ... */`; raise the timeout in `Edit -> Tool Options -> Decompiler`.
- **Archs beyond x86/ARM/MIPS** sometimes need Sleigh processor-module tweaks. Rare, possible.
- **Signed vs unsigned decompilation** is frequently wrong; retype manually when integer behavior matters.

---

## When Ghidra is the wrong tool

- You have the source. Read it.
- The bug is in your own freshly compiled binary. Rebuild with `-g` and use gdb/pwndbg (`pwndbg.md`).
- You only need to know which libs a binary links: `ldd` / `otool -L` / `readelf -d` are faster.
- You only need strings: `strings -n 8` is faster.

Ghidra earns its place when you need to read the logic of a binary you lack source for.

---

## Phase 9 cleanup specifics

```bash
ls ~/ghidra-projects/ 2>/dev/null
# rm -rf ~/ghidra-projects/debug-<binary-name>   # only if the journal says it was disposable
# A promoted project is not cleanup; note it in the final summary to the user.
pkill -f 'analyzeHeadless' || true
```
