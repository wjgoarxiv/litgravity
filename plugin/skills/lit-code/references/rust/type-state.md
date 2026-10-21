# Type-State and Newtype Patterns

The strongest protection Rust gives a coding agent: invariants live in types, so the compiler refuses code that breaks them. Nothing has to be remembered, because the rules are physical.

## Two core patterns

1. **Newtypes for distinct semantic units.** Money, identifiers, byte offsets and coordinate spaces each get their own wrapper type. Meters cannot be passed where feet are expected even though both are `f64` underneath. The `euclid` crate's `Point<Screen>` versus `Point<World>` is the model.
2. **Type-state for state machines.** Instead of a struct with a `status` enum and methods that check `if self.status == ..`, give each state its own type. Transitions are methods that consume `self` and return the next type. Illegal transitions have no method to call.

## Newtype cookbook

### Domain identifiers

```rust
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(transparent)]
pub struct UserId(Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(transparent)]
pub struct ProductId(Uuid);

impl UserId {
    #[must_use]
    pub fn new() -> Self {
        Self(Uuid::now_v7())
    }

    #[must_use]
    pub const fn as_uuid(&self) -> &Uuid {
        &self.0
    }
}

impl ProductId {
    #[must_use]
    pub fn new() -> Self {
        Self(Uuid::now_v7())
    }

    #[must_use]
    pub const fn as_uuid(&self) -> &Uuid {
        &self.0
    }
}

// buy(user: UserId, product: ProductId) rejects swapped arguments at compile time.
```

`#[serde(transparent)]` keeps JSON and SQL representations identical to a bare `Uuid`; the wrapper is a purely compile-time discipline. When identifiers multiply, a small macro or the `nutype` crate removes the repetition. Implement `From<UserId> for Uuid` only when a conversion out is wanted everywhere; usually `as_uuid` at the database boundary is enough.

### Quantities with phantom unit tags

```rust
use core::marker::PhantomData;
use core::ops::{Add, Mul, Sub};

/// A value measured in `Unit`. The tag costs nothing at runtime.
pub struct Quantity<Unit> {
    raw: f64,
    _unit: PhantomData<fn() -> Unit>,
}

// Tag types: zero-sized and never constructed at runtime.
#[derive(Debug, Clone, Copy)]
pub struct Meters;
#[derive(Debug, Clone, Copy)]
pub struct Feet;

// Manual impls avoid the `Unit: Clone` bound that #[derive] would add.
impl<U> Clone for Quantity<U> {
    fn clone(&self) -> Self {
        *self
    }
}
impl<U> Copy for Quantity<U> {}

impl<U> core::fmt::Debug for Quantity<U> {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "Quantity({})", self.raw)
    }
}

impl<U> Quantity<U> {
    #[must_use]
    pub const fn new(value: f64) -> Self {
        Self { raw: value, _unit: PhantomData }
    }

    #[must_use]
    pub const fn raw(self) -> f64 {
        self.raw
    }
}

impl<U> Add for Quantity<U> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self {
        Self::new(self.raw + rhs.raw)
    }
}

impl<U> Sub for Quantity<U> {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self {
        Self::new(self.raw - rhs.raw)
    }
}

impl<U> Mul<f64> for Quantity<U> {
    type Output = Self;
    fn mul(self, rhs: f64) -> Self {
        Self::new(self.raw * rhs)
    }
}

// Conversions are named methods; From and Into between units would hide them.
impl Quantity<Meters> {
    #[must_use]
    pub const fn to_feet(self) -> Quantity<Feet> {
        Quantity::new(self.raw * 3.280_84)
    }
}
```

Usage:

```rust
let distance: Quantity<Meters> = Quantity::new(100.0);
let height: Quantity<Feet> = Quantity::new(50.0);

// let combined = distance + height;   // compile error: Meters and Feet differ
let in_feet = distance.to_feet() + height;  // explicit conversion first
let doubled = distance + distance;          // same unit: allowed
```

Two details make this compile: the phantom marker is `PhantomData<fn() -> Unit>`, which keeps `Quantity` `Send` and `Sync` regardless of the tag, and `Clone` and `Copy` are written by hand because `#[derive]` would demand `Unit: Clone`. A refactor that changes the unit of a field fails at every use site.

### Byte offsets and character offsets

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct ByteOffset(pub u32);

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct CharOffset(pub u32);

impl ByteOffset {
    #[must_use]
    pub const fn advance(self, delta: u32) -> Self {
        Self(self.0 + delta)
    }
}

/// Converting between the two needs the text itself.
pub fn byte_to_char(text: &str, byte: ByteOffset) -> Option<CharOffset> {
    let prefix = text.get(..usize::try_from(byte.0).ok()?)?;
    let count = u32::try_from(prefix.chars().count()).ok()?;
    Some(CharOffset(count))
}
```

`fn slice(text: &str, start: ByteOffset, end: ByteOffset)` cannot receive character offsets, and `text.get(..)` returns `None` when an offset falls inside a multi-byte character. The classic UTF-8 boundary bug becomes a type error.

### Currency

```rust
use core::marker::PhantomData;
use core::ops::Add;

use rust_decimal::Decimal;

#[derive(Debug, Clone, Copy)]
pub struct Krw;
#[derive(Debug, Clone, Copy)]
pub struct Usd;

pub struct Money<C> {
    amount: Decimal,
    _currency: PhantomData<fn() -> C>,
}

impl<C> Money<C> {
    #[must_use]
    pub const fn new(amount: Decimal) -> Self {
        Self { amount, _currency: PhantomData }
    }

    /// Convert with an explicit rate; the compiler checks both currencies.
    #[must_use]
    pub fn convert<To>(self, rate: &Rate<C, To>) -> Money<To> {
        Money::new(self.amount * rate.factor)
    }
}

impl<C> Add for Money<C> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self {
        Self::new(self.amount + rhs.amount)
    }
}

pub struct Rate<From, To> {
    factor: Decimal,
    _pair: PhantomData<fn() -> (From, To)>,
}

impl<From, To> Rate<From, To> {
    #[must_use]
    pub const fn new(factor: Decimal) -> Self {
        Self { factor, _pair: PhantomData }
    }
}
```

`Money<Krw> + Money<Usd>` fails to compile, and `convert` accepts only a `Rate<Krw, _>` for a `Money<Krw>`. There is deliberately no blanket `From<Money<X>> for Money<Y>`: conversion needs a rate, and the type signature says so. Store money as `Decimal` or integer minor units; `f64` loses cents.

### Paths rooted at different bases

```rust
use std::path::{Component, Path, PathBuf};

#[derive(Debug, thiserror::Error)]
pub enum PathError {
    #[error("path must be relative")]
    NotRelative,
    #[error("path escapes its root")]
    EscapesRoot,
}

/// A path known to be relative and free of `..` components, rooted at the project.
#[derive(Debug, Clone)]
pub struct ProjectRel(PathBuf);

/// A path relative to the user's home directory.
#[derive(Debug, Clone)]
pub struct HomeRel(PathBuf);

impl ProjectRel {
    pub fn new(path: impl AsRef<Path>) -> Result<Self, PathError> {
        let path = path.as_ref();
        if path.is_absolute() {
            return Err(PathError::NotRelative);
        }
        if path.components().any(|c| matches!(c, Component::ParentDir)) {
            return Err(PathError::EscapesRoot);
        }
        Ok(Self(path.to_path_buf()))
    }

    #[must_use]
    pub fn resolve(&self, project_root: &Path) -> PathBuf {
        project_root.join(&self.0)
    }
}
```

A function that takes `ProjectRel` cannot be handed a `HomeRel`, and the constructor is the single place where traversal outside the root is rejected. That moves path-traversal defence into the type. Symlinks still need a canonicalisation check at the point of use.

### Validated strings through smart constructors

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Email(String);

#[derive(Debug, thiserror::Error)]
#[error("invalid email address")]
pub struct InvalidEmail;

impl TryFrom<String> for Email {
    type Error = InvalidEmail;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        match value.split_once('@') {
            Some((local, domain)) if !local.is_empty() && domain.contains('.') => Ok(Self(value)),
            _ => Err(InvalidEmail),
        }
    }
}

impl AsRef<str> for Email {
    fn as_ref(&self) -> &str {
        &self.0
    }
}
```

With a private field and a fallible constructor, holding an `Email` is proof of validity. Implement `Deserialize` through `#[serde(try_from = "String")]` so the check also runs at the wire boundary.

## Type-state state machines

Encode a value's lifecycle as a sequence of types. Each transition consumes the previous state and returns the next.

### Request builder

```rust
use std::marker::PhantomData;

pub struct NoUrl;
pub struct NoMethod;
pub struct Ready;

/// Fields shared by every state.
struct Parts {
    url: String,
    method: Method,
    headers: HeaderMap,
    body: Option<Vec<u8>>,
}

pub struct RequestBuilder<State> {
    parts: Parts,
    _state: PhantomData<State>,
}

impl<S> RequestBuilder<S> {
    fn into_state<Next>(self) -> RequestBuilder<Next> {
        RequestBuilder { parts: self.parts, _state: PhantomData }
    }

    /// Available in every state.
    #[must_use]
    pub fn header(mut self, name: HeaderName, value: HeaderValue) -> Self {
        self.parts.headers.insert(name, value);
        self
    }
}

impl RequestBuilder<NoUrl> {
    #[must_use]
    pub fn new() -> Self {
        Self {
            parts: Parts {
                url: String::new(),
                method: Method::GET,
                headers: HeaderMap::new(),
                body: None,
            },
            _state: PhantomData,
        }
    }

    #[must_use]
    pub fn url(mut self, url: impl Into<String>) -> RequestBuilder<NoMethod> {
        self.parts.url = url.into();
        self.into_state()
    }
}

impl RequestBuilder<NoMethod> {
    #[must_use]
    pub fn method(mut self, method: Method) -> RequestBuilder<Ready> {
        self.parts.method = method;
        self.into_state()
    }
}

impl RequestBuilder<Ready> {
    /// Only reachable once URL and method are set.
    pub async fn send(self, client: &Client) -> reqwest::Result<Response> {
        client
            .request(self.parts.method, self.parts.url)
            .headers(self.parts.headers)
            .send()
            .await
    }
}
```

Calling `send` on a builder without a method is a compile error, and the editor's completion list shows only the legal next steps. The shared `Parts` struct and `into_state` helper keep each transition to a single line. Mark transitions `#[must_use]` so a discarded builder is a warning. For plain builders without states, the `bon` and `typed-builder` crates generate the same compile-time "required field" checks from a derive.

### File handles

```rust
use std::marker::PhantomData;
use std::os::fd::RawFd;
use std::path::Path;

pub struct File<State> {
    fd: RawFd,
    _state: PhantomData<State>,
}

pub struct Open;
pub struct Locked;
pub struct Closed;

impl File<Open> {
    pub fn open(path: &Path) -> std::io::Result<Self> { /* open(2) */ }
    pub fn lock_exclusive(self) -> std::io::Result<File<Locked>> { /* flock(2) */ }
    pub fn close(self) -> std::io::Result<File<Closed>> { /* close(2) */ }
}

impl File<Locked> {
    pub fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> { /* read(2) */ }
    pub fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> { /* write(2) */ }
    pub fn unlock(self) -> std::io::Result<File<Open>> { /* flock(2) */ }
}

impl File<Closed> {
    // No methods: the type exists to be dropped.
}
```

An unlocked file cannot be read, a locked file cannot be closed without unlocking, and a closed file offers nothing. In real code implement `Drop` on the generic wrapper or the concrete states so that a handle dropped mid-protocol still releases its descriptor.

## Sealed traits

When a crate wants trait dispatch over a closed set of implementors, seal the trait so downstream crates cannot add their own:

```rust
mod sealed {
    pub trait Sealed {}
}

pub trait Renderer: sealed::Sealed {
    fn render(&self, frame: &mut Frame);
}

pub struct OpenGl;
pub struct Vulkan;
pub struct Metal;

impl sealed::Sealed for OpenGl {}
impl sealed::Sealed for Vulkan {}
impl sealed::Sealed for Metal {}

impl Renderer for OpenGl { fn render(&self, frame: &mut Frame) { /* ... */ } }
impl Renderer for Vulkan { fn render(&self, frame: &mut Frame) { /* ... */ } }
impl Renderer for Metal { fn render(&self, frame: &mut Frame) { /* ... */ } }
```

The `sealed` module is private, so outside code cannot name `Sealed` and therefore cannot implement `Renderer`. The crate keeps the freedom to add trait methods later without a breaking change.

## Non-empty collections

```rust
#[derive(Debug, Clone)]
pub struct NonEmptyVec<T> {
    head: T,
    tail: Vec<T>,
}

#[derive(Debug, thiserror::Error)]
#[error("vector was empty")]
pub struct Empty;

impl<T> NonEmptyVec<T> {
    pub fn try_from_vec(mut items: Vec<T>) -> Result<Self, Empty> {
        if items.is_empty() {
            return Err(Empty);
        }
        let tail = items.split_off(1);
        let head = items.pop().ok_or(Empty)?;
        Ok(Self { head, tail })
    }

    #[must_use]
    pub const fn first(&self) -> &T {
        &self.head
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.tail.len() + 1
    }
}
```

A function that takes `NonEmptyVec<T>` never receives an empty list, `first()` returns `&T` rather than `Option<&T>`, and no caller writes `match v.first() { None => panic!(..) }` again. The `nonempty` crate packages the same idea.

## When a newtype costs more than it saves

- A unit that lives inside one function and never crosses a boundary.
- A wrapper that adds no behaviour or invariant over the inner type, such as a `Count(u32)` used in one struct.
- A design where every call site wants `From` and `Into` back to the inner type; that is a type alias in disguise.

A newtype costs one tuple struct and the impls needed. Break-even arrives around the third use across different functions, and immediately for any use that crosses an API boundary.

## When type-state costs more than it saves

- Small state spaces with simple transitions; `Option<T>` and `Result<T, E>` are state machines already.
- Designs that force runtime branching upward: if configuration decides whether a file is `Open` or `Locked`, the program stores a trait object anyway.
- APIs consumed where the state is unknown at compile time (heterogeneous collections, dynamic dispatch boundaries).

In those cases an enum with a tag is correct. The test: can the call site know the state statically? If yes, use type-state. If no, use an enum.

## Review questions

1. Does a primitive in this signature carry a unit, a base or an identity? Wrap it.
2. Does a method begin with an `if self.state` check? Move it onto a state type.
3. Can a caller construct an invalid value? Make the field private and add a fallible constructor.
4. Does a derive add a bound the design does not want (`Clone` on a phantom tag)? Write the impl by hand or use `PhantomData<fn() -> T>`.
5. Does a transition return `Self` where it should return the next state? The type system cannot help until the types differ.
