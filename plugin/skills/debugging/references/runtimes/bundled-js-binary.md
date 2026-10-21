# Bundled-JS / Embedded-Source Binaries (Bun SEA, Node SEA, Deno compile, pkg, Electron, PyInstaller)

A growing class of "binaries" are a runtime VM glued onto a high-level-language bundle. The bundle is plaintext or trivially decodable inside the binary.

Run the `native-binary.md` workflow (Ghidra -> pwndbg -> hex) on one of these and you will spend hours decompiling a runtime you do not care about while the real logic sits exposed a few megabytes away. The workflow here is fundamentally different. Run commands through `run_command`.

---

## When to use this reference instead of `native-binary.md`

Open this when `file ./target` shows a generic Mach-O / ELF / PE AND any of:

- the size is suspiciously large (50 MB+ for a "simple CLI");
- `strings -n 8 ./target | rg -i "node_modules|webpack|esbuild|bun|pkg/lib|electron|pyinstaller"` returns hits;
- the CLI flags include things like `--inspect`, `--unhandled-rejections`, or npm-style help text;
- vendor docs say it was built with Bun, pkg, nexe, Deno compile, PyInstaller, Electron, or Tauri (a UI shell);
- `head -c 4 ./target | xxd` shows a known runtime magic for an embedded archive section.

Any yes: follow this file instead. Triage and dynamic tracing stay the same; static analysis is completely different.

---

## The workflow

```
  [1] Triage           ->  which bundler? (Bun? pkg? Deno? Electron? PyInstaller?)
  [2] Locate the bundle -> where does the embedded source archive start?
  [3] Extract           -> dump source to disk so you can grep / read it
  [4] Source-level static analysis (rg + read_file, NOT Ghidra)
  [5] Runtime verification -> debug logs, --inspect, partial-evidence patterns
  [6] Fix / report
```

Step 3 is the unlock: with plaintext source on disk, the rest is ordinary codebase exploration.

---

## [1] Identify the bundler — a 30-second fingerprint

```bash
strings -n 12 ./target 2>/dev/null | rg -iE 'bun|node_modules|webpack|esbuild|deno|pkg/lib|electron|pyinstaller|nexe|NODE_SEA_FUSE|NODE_SEA_BLOB|tauri|ESZIP_V2|denort' | head -20
```

| Marker pattern | Bundler | Source format |
|---|---|---|
| `@oven/bun-darwin`, `bun-lockfile-format-v`, `// @bun` | **Bun SEA** (`bun build --compile`) | plaintext JS, one big bundle |
| `NODE_SEA_BLOB` + `NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2:1` | **Node SEA** | plaintext JS, or V8 code cache (`useCodeCache: true`), or a startup snapshot (`useSnapshot: true`) — the latter two are NOT plaintext |
| `pkg/lib/bootstrap.js`, `pkg/prelude`, `PAYLOAD_POSITION` | **pkg** | plaintext or v8 cached data |
| `ESZIP_V2`, `denort`, `deno_runtime` | **Deno compile** | TS/JS in an eszip archive — readable with the `eszip` crate, not pure plaintext |
| `Electron`, `app.asar`, `chrome.dll`, `Squirrel.Mac` | **Electron** | an `app.asar` archive; source is plaintext JS once extracted |
| `PyInstaller`, `pyz`, `_MEIPASS`, `pyi-os-utils` | **PyInstaller** | compressed `.pyc` bytecode — needs `pyinstxtractor` + `decompyle3` |
| `nexe-`, `nexe_compile`, `:::nexe::` | **nexe** | plaintext JS appended to the node binary |
| `Tauri`, `tao`, `wry`, `tauri::generate_context` | **Tauri** (Rust shell + JS UI) | **two worlds**: the JS frontend extracts here; the Rust core is native and needs `native-binary.md` |

When several match (for example Tauri + Bun), the outer shell is the first (Tauri/Electron) and the inner JS is the second's format. For Tauri specifically, expect to use both this reference (the UI bundle) and `native-binary.md` (the Rust side).

> Source-format reality check: only Bun SEA, pkg (without `--public-packages`), nexe, and Electron `.asar` are reliably plaintext. Node SEA with code-cache or snapshot, PyInstaller `.pyc`, and Deno eszip need extra tooling. Verify the bundler before assuming `strings` will find readable code.

---

## [2] Locate the bundle

### Bun SEA — JS is embedded plaintext

The JS source is concatenated into the binary as a giant string; no decoding needed.

```bash
strings -n 8 ./target | rg "function|var |let |const |async function" | head -5
LC_ALL=C grep -aob '"use strict"' ./target | head -5
LC_ALL=C grep -aob '#!/usr/bin/env bun' ./target | head -5
```

### Node SEA — `NODE_SEA_BLOB` + an activated fuse

A Node-built SEA contains a resource/section/note named `NODE_SEA_BLOB` and the fuse string `NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2:1` (`:1` injected, `:0` a node binary with no blob yet).

```bash
LC_ALL=C grep -aob 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2:1' ./target | head -1
LC_ALL=C grep -aob 'NODE_SEA_BLOB' ./target | head
otool -l ./target | grep -A4 'NODE_SEA'      # Mach-O
```

Walking the blob by hand is non-trivial. Carve the section bytes (postject in reverse), or read it via the `node:sea` API from a debug build of the same binary. Plain `strings` gets the JS only when the SEA was built without `useCodeCache` and without `useSnapshot`.

### Deno compile — eszip archive section

```bash
LC_ALL=C grep -aob 'ESZIP_V2' ./target | head -3
LC_ALL=C grep -aob 'denort' ./target | head -1
```

Extract with the `eszip` Rust crate (or the `@deno/eszip` JS port) after carving the archive at the offset above. No stable Deno CLI inspects compiled-executable eszip contents; `deno info` works on source files only.

### pkg — a `PAYLOAD_POSITION` marker

```bash
LC_ALL=C grep -aob 'PAYLOAD_POSITION' ./target | head
LC_ALL=C grep -aob 'pkg/prelude' ./target | head
```

Carve based on the offset the `PAYLOAD_POSITION:<n>` value reports, or use a community `pkg-extract` tool.

### Electron — `app.asar` is usually a separate file

Most Electron apps ship `app.asar` next to the binary rather than inside it:

```bash
ls -la /Applications/MyApp.app/Contents/Resources/app.asar
npx @electron/asar extract app.asar ./extracted/
```

For single-file builds where the asar is embedded, do not pattern-match arbitrary 4-byte sequences (the asar format starts with a Pickle-encoded uint32 header size + JSON metadata, and the same bytes recur). Use a Pickle-aware extractor that validates the JSON header before claiming a match: the `asar` npm package's `extractAll()` does this. Scan for a candidate Pickle header (4-byte size + 4-byte payload size + `{"files":` prefix), confirm the JSON parses, then feed the carved buffer to `extractAll()`.

### PyInstaller — use `pyinstxtractor`, not runtime self-extraction

```bash
python3 -I pyinstxtractor.py ./target     # -> ./target_extracted/ with .pyc files
decompyle3 ./target_extracted/main.pyc    # Python 3.7+
uncompyle6 ./target_extracted/main.pyc    # older Python
```

When `pyinstxtractor` cannot read the archive, use PyInstaller's own `pyi-archive_viewer`. Keep away from the "run the binary and snoop `/tmp/_MEI*`" approach: it catches only what runs in the window between extraction and cleanup, and it runs potentially untrusted code.

---

## [3] Extract source to disk — do this before reading

The biggest mistake with bundled-JS reverse engineering is reading source out of `strings` output or `xxd` dumps, which loses data (see Gotchas). Read bytes, find the JS section, and save to a `.js` file.

### For Bun SEA / nexe / single-string-blob bundlers

```python
# extract_bundled_js.py — run with: python3 -I extract_bundled_js.py ./target > extracted-bundle.js
import sys
if len(sys.argv) < 2:
    raise SystemExit("usage: extract_bundled_js.py <target>")
with open(sys.argv[1], 'rb') as f:
    data = f.read()
markers = [b'// @bun', b'"use strict"', b"'use strict'", b'#!/usr/bin/env']
start = -1
for m in markers:
    p = data.find(m)
    if p != -1 and (start == -1 or p < start):
        start = p
if start == -1:
    raise SystemExit("no bundle marker found — may not be Bun/nexe, or markers were stripped.")
# Heuristic end: a long null run AFTER start. Verify the tail looks like JS before trusting it.
end = data.find(b'\x00' * 1024, start)
if end == -1:
    end = len(data)
bundle = data[start:end]
print(f'Extracted {len(bundle)} bytes from offset {start} to {end}', file=sys.stderr)
sys.stdout.buffer.write(bundle)
```

```bash
python3 -I extract_bundled_js.py ./target > extracted-bundle.js
wc -c extracted-bundle.js
tail -c 200 extracted-bundle.js      # sanity-check the tail is JS, not random binary
```

### For PyInstaller

`pyinstxtractor`, then `uncompyle6` / `decompyle3` on the `.pyc` files.

### For Electron .asar

```bash
npx @electron/asar extract app.asar ./extracted/   # -> a normal node_modules + source layout
```

### For Deno compile

Use the `eszip` crate (or `@deno/eszip`) to walk the archive after carving the eszip section at the offset the `ESZIP_V2` magic search reports.

---

## [4] Source-level static analysis — `rg` + `read_file`, not Ghidra

With the source on disk, treat it as a normal codebase:

```bash
rg -n "^function |^const \w+ = (function|\(.*\) =>)" extracted-bundle.js | head
rg -n "model-name|reasoning_effort|api_key" extracted-bundle.js
rg -aoP 'var \w+="[^"]+"' extracted-bundle.js | head -50   # resolve minified identifiers
```

For minified bundles, use a template-literal-aware parser to extract specific functions or template strings:

```python
def find_template_end(data, start):
    """Walk a JS template literal, preserving ${...} interpolation depth.
    Returns the position of the closing backtick."""
    i = start
    while i < len(data):
        c = data[i:i+1]
        if c == b'\\':
            i += 2; continue
        if c == b'$' and data[i+1:i+2] == b'{':
            depth = 1; i += 2
            while i < len(data) and depth > 0:
                cc = data[i:i+1]
                if cc == b'\\': i += 2; continue
                if cc == b'`':
                    j = find_template_end(data, i+1)
                    i = j + 1; continue
                if cc == b'{': depth += 1
                elif cc == b'}': depth -= 1
                elif cc in (b'"', b"'"):
                    q = cc; i += 1
                    while i < len(data) and data[i:i+1] != q:
                        if data[i:i+1] == b'\\': i += 2
                        else: i += 1
                    i += 1; continue
                i += 1
            continue
        if c == b'`': return i
        i += 1
    return -1
```

For function-body extraction, track the parameter list separately before the body braces; the naive approach miscounts a destructuring `function f({a, b, ...c})` as the body `{` and exits early.

### Worked example: resolve a minified constant

A minified bundle holds `var Q9="smart",eF=["low","medium","high"];` and a function that reads them. To learn what a mode actually maps to, trace the assignment chain rather than guessing from the call site:

```bash
# 1. Find the symbol used at the call site
rg -n 'effort\s*[:=]' extracted-bundle.js | head
# -> ...reasoning_effort: eF[k9(Q9)]...

# 2. Resolve each identifier by its assignment
rg -ao 'var Q9="[^"]*"' extracted-bundle.js        # Q9 = "smart"
rg -ao 'eF=\[[^]]*\]' extracted-bundle.js           # eF = ["low","medium","high"]
rg -n 'function k9' extracted-bundle.js             # read k9 to see the index it returns for "smart"
```

Record the resolved value in the journal as a captured observation (Phase 3 evidence discipline), then confirm it with a runtime trace (Phase 5) before you treat it as fact. A static reading of a minified bundle is a hypothesis until the runtime agrees.

### Carve a Node SEA blob with postject

When the SEA is plaintext (no `useCodeCache`/`useSnapshot`) but `strings` is lossy, carve the `NODE_SEA_BLOB` section and read it as a file:

```bash
# macOS: the blob lives in the NODE_SEA segment
SEG=$(otool -l ./target | awk '/NODE_SEA/{f=1} f&&/segname/{print $2; exit}')
# Dump the section bytes with the offset/size otool -l reports, then:
node -e 'const {readFileSync}=require("fs"); process.stdout.write(readFileSync("/tmp/sea-blob.bin"))' | head -c 400
```

For an embedded Electron asar, carve a candidate Pickle header and validate it before trusting the match (see [2] above); feed the carved buffer to the `asar` package's `extractAll()` rather than writing raw bytes to disk.

---

## [5] Runtime verification

You usually cannot single-step JS inside a Bun-compiled binary the way `node --inspect` allows. Workarounds:

### Bun-compiled

```bash
./target --inspect                       # ws://localhost:6499/<auto-prefix> -> paste into debug.bun.sh
./target --inspect=localhost:9229/dbg
BUN_INSPECT=localhost:9229/dbg ./target  # env-var form

# HTTP request tracing without an interactive debugger (high value, Bun-specific):
BUN_CONFIG_VERBOSE_FETCH=curl ./target ...   # every fetch() / node:http request as a curl command
BUN_CONFIG_VERBOSE_FETCH=true ./target ...

APP_DEBUG=1 APP_LOG_LEVEL=debug APP_LOG_FILE=/tmp/trace.log ./target
```

### Node SEA / pkg / nexe

```bash
./target --inspect                       # usually accepted since these are real Node
```

### Electron

```bash
./target.app/Contents/MacOS/target --inspect=9229 --remote-debugging-port=9223
```

### When you cannot make a real call

The target may need credentials, network, or paid quota you lack. You are not stuck; see `../methodology/partial-runtime-evidence.md`.

---

## Gotchas — read these before extracting

### G1. `strings -n N` silently drops short identifier interpolations

`strings` outputs runs of printable characters of length at least N. With `-n 8`, short template interpolations (`${x}`, `${i}`, `${R}`) are dropped, because they are 4 chars surrounded by non-printable bytes:

```text
expected:  <INSTRUCTIONS>\n${x}\n</INSTRUCTIONS>
strings:   <INSTRUCTIONS>\n</INSTRUCTIONS>      <- ${x} is gone, no warning
```

A reader of the strings output would conclude the template is empty. Use `strings` for fingerprinting (Phase 1 triage) only. For extraction, read the binary as bytes with `python3 -I -c "open('./target','rb').read()"` and parse from there. When you must use `strings`, try `strings -n 1 -t x ./target` and post-filter — byte-level reads stay more reliable.

### G2. A stale cached binary is not the latest features

Bundled-app installers often skip the download when a cached binary exists. When you reverse-engineered an old version and the user reports behavior you do not see in the source, re-run the installer (or fetch the version manifest) before assuming the source is current.

### G3. APFS / NTFS case-insensitivity overwrites files

Saving many minified function bodies (`cVR`, `CVR`, `dpr`, `DPR`) one per file, macOS APFS and Windows NTFS treat `cVR.txt` and `CVR.txt` as one file, so the second write overwrites the first. Prefix filenames with something case-distinguishing (`mode-cVR.txt`, `mode-CVR.txt`) or add a hash suffix.

### G4. Bun's runtime adds 30-50 MB of unrelated symbols

A 70 MB Bun binary is mostly Bun runtime (~50 MB) plus the app (~20 MB). Fingerprinting surfaces thousands of strings the app does not use. Filter the runtime noise:

```bash
strings -n 8 ./target | rg -v 'node_modules|@oven/bun|package-lock|tree-sitter|ffmpeg-installer' | head
```

### G5. Source maps are usually absent

Bundled apps strip source maps for production, so identifiers are minified to `T`, `R`, `a`, `r`. Treat the bundle like an obfuscated codebase: identify constants by tracing assignments (`var T="actual-name"`) and resolve interpolations by hand.

### G6. The extracted file is the vendor's IP

When reverse-engineering proprietary software, the extracted source belongs to the vendor. Use it to understand behavior; keep it out of git and out of public issues, and clean up the `extracted-bundle.js` files in Phase 9.

---

## Silent-failure patterns specific to bundled JS

| Pattern | Why it stays quiet |
|---|---|
| unreachable dead code from a tree-shaking failure | you read code that never runs — confirm with a runtime trace |
| `process.env.X` resolved at BUILD time, not runtime | setting the env var at runtime has no effect; the value is baked in |
| `import.meta.url` in a compiled binary returns `bun://...` | file-relative resolution breaks quietly |
| worker threads spawned from embedded code | workers may carry their own copy of dependencies in a sub-bundle |
| minified identifiers with case variants in one module | easy to confuse `cVR` with `CVR` when reading fast |

---

## Phase 9 cleanup specifics for bundled-JS work

```bash
rm -f /tmp/extracted-bundle.js /tmp/extracted-*.js   # may contain proprietary source
rm -rf /tmp/asar-extracted/
rm -rf /tmp/_MEI*
rm -f /tmp/*-strings.txt /tmp/*-strings-v*.txt
rm -f /tmp/extract_bundled_js.py /tmp/parse_template.py
ls /Users/$USER/local-workspaces/*-extracted/ 2>/dev/null
# rm -rf only after a journal review confirms nothing important is there
```

---

## When to escalate back to `native-binary.md`

When extraction reveals the "bundle" is V8 cached data (pkg with `--public-packages`, or PyInstaller in bytecode-only mode) and decompilation is non-trivial, switch back to the `native-binary.md` workflow (Ghidra against the runtime plus careful tracing). The bundled-JS workflow helps only when the high-level source recovers as readable text.
