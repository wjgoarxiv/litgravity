# Zero-Cost Safety: Explicit Control Inside Safe Rust

Rust already owns memory safety. This reference adds the patterns that give systems-language control without leaving the Rust toolchain: explicit allocation scope, compile-time computation, APIs with no hidden cost, bit-level layout and deterministic cleanup.

**Open this file for:** arena, allocator, `bumpalo`, `const fn`, const generics, compile-time tables, zero-allocation APIs, slice-based APIs, `#[repr]`, packed structs, bitfields, `zerocopy`, `scopeguard`, error-path rollback, RAII cleanup.

---

## 1. Explicit allocation: arenas

A function that allocates should let the caller decide where the memory lives and when it dies. On stable Rust the tool for that is an arena crate: allocation scope becomes visible and freeing happens in one step.

### `bumpalo`: the default arena

```rust
use bumpalo::Bump;

fn parse_tokens<'a>(arena: &'a Bump, input: &str) -> Vec<&'a str> {
    // Every string copy lands in `arena`; the caller controls its lifetime.
    input.split_whitespace().map(|word| &*arena.alloc_str(word)).collect()
}

let arena = Bump::new();
let tokens = parse_tokens(&arena, "alpha beta gamma");
println!("{tokens:?}");
drop(arena); // one release frees everything; `tokens` can no longer be used
```

The returned `Vec` itself sits on the heap while its elements point into the arena; use `bumpalo::collections::Vec::new_in(&arena)` (feature `collections`) to place the vector there too. A reset is available for loops: `arena.reset()` reclaims the whole region between iterations while keeping the first chunk.

When it fits: parsers, compilers, game frame allocators, request-scoped handlers, any hot loop where per-object allocation and free show in a profile.

`Bump` skips destructors for values placed inside it, so store plain data there, or use `bumpalo::boxed::Box`, which runs `Drop` when it goes out of scope.

### `typed-arena`: homogeneous arena

```rust
use typed_arena::Arena;

struct Node<'a> {
    kind: u8,
    children: std::cell::RefCell<Vec<&'a Node<'a>>>,
}

let nodes: Arena<Node<'_>> = Arena::new();
let root = nodes.alloc(Node { kind: 0, children: Default::default() });
let leaf = nodes.alloc(Node { kind: 1, children: Default::default() });
root.children.borrow_mut().push(leaf);
// All nodes share the arena's lifetime and drop together, destructors included.
```

When it fits: trees and graphs whose nodes share one type and one lifetime. Unlike `Bump`, `typed-arena` runs destructors.

### `allocator_api` (nightly)

```rust
#![feature(allocator_api)]

// Collections parameterised by an allocator
let arena = bumpalo::Bump::new();
let mut v: Vec<u8, &bumpalo::Bump> = Vec::new_in(&arena);
v.push(1);
```

`bumpalo` implements the allocator trait under its `allocator_api` feature on nightly, and `allocator-api2` gives a stable stand-in. Reach for the trait when containers must be generic over allocators. Stable code uses `bumpalo` directly.

### Decision tree

```text
Need arena allocation?
|- Same type, same lifetime, destructors matter -> typed-arena
|- Mixed types, same lifetime                   -> bumpalo
|- Containers generic over the allocator        -> allocator_api (nightly)
`- Only want fewer allocations                  -> SmallVec / ArrayVec / tinyvec (stack first)
```

### Cargo.toml

```toml
bumpalo = { version = "3", features = ["collections"] }
typed-arena = "2"
smallvec = { version = "1", features = ["union", "const_generics"] }
tinyvec = { version = "1", features = ["alloc"] }
```

---

## 2. Compile-time computation: `const fn`, const generics, proc macros

Rust splits compile-time work across three mechanisms.

### `const fn`: pure functions evaluated by the compiler

```rust
const fn fibonacci(n: u32) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

const FIB_20: u64 = fibonacci(20); // 6765, computed during compilation

// A table built at compile time
const LOOKUP: [u8; 256] = {
    let mut table = [0u8; 256];
    let mut i = 0;
    while i < 256 {
        table[i] = (i as u8).wrapping_mul(7);
        i += 1;
    }
    table
};
```

`const fn` accepts `match`, `if`, `while` loops, references, and (since 1.83) mutable references. `for` loops and trait-method calls on generic types remain unavailable, which is why the loops above are written with `while`. Inline `const { .. }` blocks (stable since 1.79) host assertions that fail the build:

```rust
fn process<const N: usize>(data: &[u8; N]) -> usize {
    const { assert!(N > 0, "N must be positive") }; // compile error when N == 0
    data.iter().map(|b| usize::from(*b)).sum()
}
```

### Const generics: values in types

```rust
#[derive(Debug)]
pub struct BufferFull;

pub struct Buffer<const N: usize> {
    data: [u8; N],
    len: usize,
}

impl<const N: usize> Buffer<N> {
    #[must_use]
    pub const fn new() -> Self {
        Self { data: [0; N], len: 0 }
    }

    pub fn push(&mut self, byte: u8) -> Result<(), BufferFull> {
        let slot = self.data.get_mut(self.len).ok_or(BufferFull)?;
        *slot = byte;
        self.len += 1;
        Ok(())
    }
}

// Buffer<16> and Buffer<1024> are different types, sized at compile time.
let small: Buffer<16> = Buffer::new();
let large: Buffer<1024> = Buffer::new();
```

The `get_mut` call keeps the lint set (`indexing_slicing`) satisfied and turns the capacity check into the bounds check.

### Procedural macros: generated code

When `const fn` cannot produce the result (new struct fields, impl blocks, derive logic), a procedural macro can. They live in a separate crate with `proc-macro = true`:

```rust
// in the proc-macro crate
use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput};

#[proc_macro_derive(Describe)]
pub fn derive_describe(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;
    let text = name.to_string();
    quote! {
        impl #name {
            pub const NAME: &'static str = #text;
        }
    }
    .into()
}
```

Decision guide:

```text
Compile-time value computation?        -> const fn
A type parameterised by a value?       -> const generics
New types or impls from a description? -> proc macro (derive or attribute)
Compile-time string processing?        -> proc macro, or const fn over bytes
Type-level arithmetic?                 -> typenum / generic-array (rare)
```

---

## 3. Zero-allocation API design: costs stay visible

No hidden allocation, no surprise copies: the signature shows what the call costs.

### Slice APIs: the caller owns memory

```rust
// Hidden allocation in the return type
fn process_owned(input: &str) -> String {
    input.to_uppercase()
}

// The caller provides the output buffer; no allocation happens
fn process_into(input: &[u8], output: &mut [u8]) -> usize {
    let len = input.len().min(output.len());
    for (dst, src) in output.iter_mut().zip(input.iter()).take(len) {
        *dst = src.to_ascii_uppercase();
    }
    len // bytes written
}

// Borrowed results need no allocation either
fn first_token(input: &str) -> Option<&str> {
    input.split_whitespace().next()
}
```

### `try_*` APIs: allocation that can fail

```rust
let mut v: Vec<u8> = Vec::new();
v.try_reserve(1_000_000)?; // returns Result instead of aborting
```

Fallible `Box` allocation (`Box::try_new`) needs the nightly `allocator_api`. Use `try_reserve` on stable for growth that comes from untrusted sizes.

### Stack-first collections

```rust
use arrayvec::ArrayVec;
use smallvec::SmallVec;

// Stays on the stack up to eight elements, spills to the heap beyond
let mut tags: SmallVec<[u8; 8]> = SmallVec::new();
tags.push(1);

// Fixed capacity, never touches the heap
let mut buf: ArrayVec<u8, 64> = ArrayVec::new();
buf.try_push(42).map_err(|_| "buffer full")?;
```

### `Cow`: defer allocation until mutation

```rust
use std::borrow::Cow;

fn normalize(input: &str) -> Cow<'_, str> {
    if input.contains('\t') {
        Cow::Owned(input.replace('\t', "    ")) // allocates only when needed
    } else {
        Cow::Borrowed(input) // zero-cost pass-through
    }
}
```

### The `#![no_std]` discipline

For maximum control, build with `#![no_std]` and opt in to the heap:

```rust
#![no_std]
extern crate alloc;

use alloc::string::String; // explicit: this code chooses to allocate
use alloc::vec::Vec;
```

Code that keeps `std` still adopts the habit: `&[T]` over `Vec<T>`, `&str` over `String`, `&Path` over `PathBuf` in parameter position.

### Clippy lints for hidden allocation

```toml
[lints.clippy]
unnecessary_to_owned = "warn"  # .to_string() or .to_vec() where a borrow suffices
redundant_clone = "warn"       # a clone that is consumed immediately
large_stack_arrays = "warn"    # accidental large stack usage
vec_init_then_push = "warn"    # Vec::new() followed by push instead of vec![]
```

---

## 4. Bit-level layout: `repr`, packed structs, bitfields, `zerocopy`

### `#[repr(C)]`: guaranteed layout

```rust
#[repr(C)]
struct Header {
    magic: [u8; 4],
    version: u16,
    flags: u16,
    length: u32,
}
// Fields appear in declaration order with C padding rules (12 bytes here).
```

`repr(C)` gives a stable layout for FFI and for byte-level parsing through `zerocopy`. Without it, field order is unspecified. `#[repr(u8)]` and `#[repr(i32)]` fix an enum's discriminant size; `#[repr(transparent)]` gives a newtype the layout of its field.

### `#[repr(C, packed)]`: no padding

```rust
#[repr(C, packed)]
struct WireHeader {
    tag: u8,
    length: u16, // may sit at an odd address
    checksum: u32,
}
// Size is exactly 7 bytes.
```

Taking a reference to a packed field (`&header.length`) is an error because the reference could be misaligned. Copying the value out is always safe and needs no `unsafe`:

```rust
impl WireHeader {
    fn length(&self) -> u16 {
        self.length // reads by value, which copies the field
    }
}
```

The same hazard disappears when fields are alignment-1 types. `zerocopy` provides them:

```rust
use zerocopy::byteorder::{LittleEndian, U16, U32};
use zerocopy::{FromBytes, Immutable, IntoBytes, KnownLayout, Unaligned};

#[derive(FromBytes, IntoBytes, KnownLayout, Immutable, Unaligned)]
#[repr(C)]
struct WireHeader {
    tag: u8,
    length: U16<LittleEndian>,
    checksum: U32<LittleEndian>,
}

impl WireHeader {
    fn length(&self) -> u16 {
        self.length.get()
    }
    fn checksum(&self) -> u32 {
        self.checksum.get()
    }
}
```

Endianness is part of the type, so a big-endian peer cannot be misread by accident.

### `bitfield`: flag packing

```rust
use bitfield::bitfield;

bitfield! {
    pub struct Permissions(u8);
    impl Debug;
    pub bool, readable, set_readable: 0;
    pub bool, writable, set_writable: 1;
    pub bool, executable, set_executable: 2;
    pub u8, level, set_level: 5, 3; // bits 3 to 5
}

let mut p = Permissions(0);
p.set_readable(true);
p.set_level(5);
assert!(p.readable());
assert_eq!(p.level(), 5);
```

### `modular-bitfield`: richer API

```rust
use modular_bitfield::prelude::*;

#[bitfield(bits = 16)]
#[derive(Debug)]
pub struct StatusWord {
    ready: bool,    // 1 bit
    error_code: B4, // 4 bits
    #[skip]
    __: B3,         // 3 bits of padding
    priority: B8,   // 8 bits
}
```

The macro checks at compile time that the declared widths sum to the stated `bits`.

### `zerocopy`: safe zero-copy parsing

```rust
use zerocopy::{FromBytes, Immutable, KnownLayout};

#[derive(FromBytes, KnownLayout, Immutable)]
#[repr(C)]
struct Packet {
    header: [u8; 4],
    payload_len: [u8; 4],
}

fn parse(bytes: &[u8]) -> Option<(&Packet, &[u8])> {
    Packet::ref_from_prefix(bytes).ok()
}
```

The function borrows a typed view straight out of the input slice: no copy, no allocation, no `transmute`, no pointer cast. The derives verify at compile time that every bit pattern is valid for the type (`FromBytes`) and that the layout is known. A `u32` field needs the input to be aligned; `ref_from_prefix` returns `Err` for a misaligned slice, which is why wire formats use byte arrays or the `Unaligned` byteorder types.

`bytemuck` is the alternative with a slightly different trait set (`Pod`, `Zeroable`).

### Cargo.toml

```toml
zerocopy = { version = "0.8", features = ["derive"] }
bitfield = "0.17"
modular-bitfield = "0.11"
bytemuck = { version = "1", features = ["derive"] }   # alternative to zerocopy
```

---

## 5. Scope guards: error-path cleanup

Rust's `Drop` always runs at scope end. `scopeguard` adds control over when the cleanup applies.

### `guard`: rollback unless disarmed

```rust
use scopeguard::{guard, ScopeGuard};
use std::fs;

fn create_and_process(path: &str) -> std::io::Result<()> {
    let file = fs::File::create(path)?;
    // If any later step returns early, remove the partial file.
    let cleanup = guard(path, |p| {
        let _ = fs::remove_file(p);
    });

    write_data(&file)?;
    validate_data(path)?;

    // Success: disarm the guard so the cleanup never runs.
    let _ = ScopeGuard::into_inner(cleanup);
    Ok(())
}
```

`ScopeGuard::into_inner` returns the protected value without running the closure. Avoid `mem::forget` for this purpose, because it leaks the guard's captured state.

`guard_on_unwind` runs its closure only while a panic unwinds, and `guard_on_success` only on normal exit, which lets one function express both policies.

### `defer!`: cleanup on every exit

```rust
use scopeguard::defer;

fn with_scratch_dir() -> anyhow::Result<()> {
    let dir = tempfile::tempdir()?;
    defer! {
        tracing::debug!(path = %dir.path().display(), "scratch directory released");
    }
    do_work(dir.path())?;
    Ok(())
}
```

### `Drop` as RAII

```rust
struct TempFile {
    path: std::path::PathBuf,
}

impl TempFile {
    fn new(path: impl Into<std::path::PathBuf>) -> std::io::Result<Self> {
        let path = path.into();
        std::fs::File::create(&path)?;
        Ok(Self { path })
    }
}

impl Drop for TempFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

// The file is removed whenever `tmp` goes out of scope, including on early returns.
let tmp = TempFile::new("/tmp/scratch.dat")?;
```

Use a dedicated `Drop` type when the cleanup belongs to the value itself and applies on every path. Use `scopeguard::guard` when cleanup depends on whether the surrounding function succeeded.

### Rollback pattern for multi-step operations

```rust
fn deploy(artifact: &Path) -> Result<(), DeployError> {
    let backup = backup_current()?;

    // Restore the backup if anything below fails.
    let rollback = guard(backup, |b| {
        let _ = restore_from_backup(&b);
    });

    upload(artifact)?;
    health_check()?;

    // Success: keep the new version.
    let _backup = ScopeGuard::into_inner(rollback);
    Ok(())
}
```

Cleanup closures cannot propagate errors, so log them (`tracing::warn!`) rather than discarding silently when the failure matters.

### Cargo.toml

```toml
scopeguard = "1"
tempfile = "3"   # idiomatic temporary files and directories
```

---

## Summary: control feature to Rust pattern

| Capability | Rust tool | Effort | Section |
|---|---|---|---|
| Explicit allocator passing | `bumpalo`, `typed-arena`, `allocator_api` | Low | 1 |
| Compile-time values | `const fn`, `const { }` blocks | Low | 2 |
| Compile-time type generation | procedural macros | Medium | 2 |
| No hidden allocation | slice APIs, `Cow`, `#![no_std]` | Style | 3 |
| Packed layouts and bitfields | `repr`, `bitfield`, `zerocopy` | Low | 4 |
| Run cleanup only on failure | `scopeguard::guard`, `into_inner` on success | Low | 5 |
| Run cleanup on every exit | `defer!`, `Drop` | Low | 5 |

Everything above stays inside the standard toolchain, and the borrow checker, lifetimes, trait bounds and Miri apply on top of the explicit control.

## When these patterns are the wrong call

- **Arenas** are overkill for a CLI that allocates a handful of objects and exits.
- **Zero-allocation signatures** hurt readability when the function naturally yields owned data. Return the `String` when a `String` is the product.
- **`#[repr(packed)]`** belongs to wire formats and FFI; domain types keep the default layout.
- **Scope guards** are redundant when the value's own `Drop` already does the cleanup (`tempfile::NamedTempFile`).
- **`const fn` everywhere** has no payoff; apply it where the value is needed at compile time or the function is trivially eligible.

The goal is visible cost and explicit control. `String` and `Vec` remain the right tools in most code; reach for these patterns when allocation behaviour matters to correctness or performance.
