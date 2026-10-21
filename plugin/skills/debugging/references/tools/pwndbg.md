# pwndbg — GDB With the Useful Views Always On

**https://github.com/pwndbg/pwndbg**

pwndbg is a GDB plugin that turns GDB into something a human can actually use for binary debugging. It is a strict superset: every vanilla GDB command still works, and pwndbg adds views and commands that make you productive.

Whenever you would reach for plain `gdb`, reach for pwndbg instead. The one reason to skip it is that it is not installed, and that is a two-minute fix. Drive the prompt through `send_command_input` on a long-running `run_command`, and read it with `command_status`.

---

## Install

```bash
# macOS
brew install pwndbg
# Or from source:
git clone https://github.com/pwndbg/pwndbg
cd pwndbg && ./setup.sh

# Linux: apt/dnf/pacman install pwndbg (where packaged), or the git + ./setup.sh route

gdb --version
gdb ./any-binary        # the pwndbg banner + the context view should appear
```

Once installed, pwndbg auto-loads every time you start `gdb`; there is nothing to source manually.

---

## The `context` view — the one feature that changes everything

Plain GDB needs `info registers`, then `bt`, then `x/10xw $rsp`, then `disas` — four commands to see what is going on. pwndbg shows all of it with `context` (and auto-shows it at every break):

```
──── registers ────
 RAX  0x0
 RBX  0x7ffffffde158
 RCX  0x7fffff7abf10
──── disasm ────
 ► 0x401234  mov rdi, rax
   0x401237  call 0x401190
──── stack ────
 00:0000│ rsp 0x7ffffffde0a0 → 0x7fffff7c4000
 01:0008│     0x7ffffffde0a8 → 0x0
──── backtrace ────
 ► f 0  0x401234 parse_input+0x3c
   f 1  0x401180 main+0x120
   f 2  0x7fffff7a5083 __libc_start_main+0xf3
```

You always know where you are, the CPU state, the stack, and how you got here. That is why pwndbg is the default.

---

## Launch recipes

```bash
gdb ./target
gdb --args ./target arg1 arg2
gdb -p $(pgrep target)                    # attach to a running process
gdb ./target ./core                       # with a core dump
gdbserver :2345 ./target                  # headless / remote, on the target box
gdb ./target                              # on your box, then:
(gdb) target remote <host>:2345
```

---

## Essential commands (pwndbg additions)

### Layout / view

```
context                        # reprint the context view (usually auto)
context regs stack              # only registers + stack
tel $rsp 20                     # telescope — walk pointers at $rsp for 20 slots (KEY)
tel $rdi 10                     # walk pointers at $rdi (e.g. dump a struct)
stack 20                        # 20 entries of stack
vmmap                           # virtual memory map
```

`telescope` is the killer command: given an address, it walks pointers recursively and resolves 80% of "what is at this address" questions:

```
00:0000│   0x7ffd... → 0x601010  (heap) → 0x2a (the number 42)
01:0008│   0x7ffd... → 0x7fff... (stack) → 'hello world'
```

### Heap debugging

```
heap                            # overview of chunks
bins                            # tcache / fastbin / unsorted / smallbin / largebin
malloc_chunk <addr>             # inspect a specific chunk
find_fake_fast <addr>           # fake-fast overlap candidates
vis_heap_chunks                 # visualize the heap layout
```

For use-after-free, double-free or heap-overflow hypotheses, `heap` + `bins` usually shows the corruption.

### Exploitation-adjacent (also useful for understanding a bug)

```
checksec                        # NX, PIE, RELRO, canary
rop --grep 'pop rdi'            # find ROP gadgets
ni                              # step over one instruction
si                              # step into one instruction
```

### Search

```
search -t byte 0x41             # find a byte anywhere in memory
search -t string "admin"        # find a string
search -p <addr>                # find pointers to <addr>
```

---

## Standard GDB commands still work

```
break main
b *0x401234
b file.c:42
c                               # continue
n                               # next (source-level step over)
s                               # step (source-level step into)
finish                          # step out
info breakpoints
delete <n>
watch <var>                     # break on write
rwatch <var>                    # break on read
awatch <var>                    # break on access
p <expr>                        # print
p/x <expr>                      # print in hex
x/20xw <addr>                   # examine 20 words as hex
bt
frame <n>
disassemble <func>
```

---

## Python scripting inside GDB

pwndbg exposes a full Python API, useful for automating observations across breakpoints:

```python
(gdb) python
import gdb
def on_break():
    frame = gdb.selected_frame()
    pc = frame.read_register('pc')
    print(f'hit at {hex(int(pc))}')
end
```

Scripted from outside: `gdb -batch -ex 'source script.gdb' -ex 'run' ./target`.

---

## Common workflows by bug type

### Segfault / crash

```bash
gdb ./target
(gdb) run <args>
(gdb) context                    # the crash site
(gdb) bt                         # how we got here
(gdb) info registers
(gdb) tel $rsp 20
```

### "Function returns the wrong value"

```bash
(gdb) break <function>
(gdb) run <args>
(gdb) finish                     # run to the return; pwndbg shows RAX in context
```

### "Variable has an unexpected value at point X"

```bash
(gdb) break <point-X>
(gdb) run
(gdb) p <var>
(gdb) watch <var>                # break when it changes
(gdb) c                          # the next stop is where it was modified
```

### "Memory corruption / heap bug"

```bash
(gdb) run
# crash at free():
(gdb) heap
(gdb) bins                       # often shows the corruption
(gdb) vis_heap_chunks
(gdb) malloc_chunk <suspicious-addr>
```

---

## Gotchas

- **`bt` looks odd on stripped binaries** — function names become offsets. Map them back with Ghidra's labels (`ghidra.md`).
- **PIE binaries randomize the base address.** Ghidra addresses are unslid; pwndbg addresses are slid. `vmmap` shows the base, and `piebase` gives the offset.
- **Optimized builds inline functions.** A breakpoint on `my_function` may never hit because it was inlined; disable optimization or break on the caller.
- **Stack canaries trigger `__stack_chk_fail`.** See it in a backtrace and a stack smash caused it; look one frame up.

---

## Phase 9 cleanup specifics

```bash
pkill -f 'gdb' || true
pkill -f 'gdbserver' || true
rm -f ./core ./core.* ~/core.*
rm -f /tmp/debug-*.gdb
```
