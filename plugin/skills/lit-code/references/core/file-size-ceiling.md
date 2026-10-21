# The 250 pure LOC ceiling

A source file whose pure LOC (non-blank, non-comment lines) passes 250 is an architectural defect. The size is the symptom; the causes are what this file helps you find and fix.

What a file past the line is usually telling you:

- The module does more than one job.
- Cohesive units were merged to save creating a file.
- Re-exports, barrels and orchestration were fused into pure-logic units.
- Every future reader pays to find the part they need.

## Why 250

At 250 pure LOC a file still fits on one or two screens, and a reviewer can hold all of it in working memory and spot a cross-cutting bug. At 500 they start skimming; at 1,000 they stop trying. The number is the review ceiling of one person who has not memorized the file. It also keeps diffs readable and makes ownership obvious: a 120-line `token.rs` has one owner, a 900-line `auth.rs` has whoever touched it last.

## Measuring

```bash
# quick: excludes blank lines and whole-line comments (Python, Rust, TypeScript, Go, SQL)
awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(\/\/|#|--)/' <file> | wc -l

# authoritative, handles block comments and docstrings, when cloc is installed
cloc --by-file <file>        # the "code" column is the number that counts
```

Among the shipped checkers only the Python one measures size (rule `oversized-module`, honouring a `SIZE_OK` marker in the first ten lines). For Rust, TypeScript and Go files, run the `awk` line on each changed file as step 1 of the post-write loop.

## Required behavior

| Situation | Action |
|---|---|
| Creating a file that will pass 250 | Split before the first commit, one cohesive unit per file, carved by responsibility. Barrels (`__init__.py`, `mod.rs`, `index.ts`) hold re-exports only |
| Adding lines to a file already past 250 | Move the unit you are touching into its own file first, then add the lines. The split is part of this task |
| Reading a file past 250 during feature work | Name the smell in the reply, propose a concrete split (which functions go where, one or two lines each), and ask with `ask_question` whether to split now. Recommended default: split now. Headless: take the default and log a `decision` ledger line |
| A file in the 200 to 250 band | Say so in the next message; propose the split if the next planned edit adds lines; log a ledger `note` if you leave it there |

## Escapes that do not count

- Counting comments and blank lines toward the budget. Pure LOC counts code lines.
- Splitting by size (`foo_1.py`, `module_part_a.rs`, `service-2.ts`). Split by what each file does and name it after the concept it owns.
- Dump files: `utils.py`, `helpers.ts`, `common.py`, `shared.ts`, a `lib.rs` used as a logic bin. They move the smell to a new address.
- "It is generated." True only for files in `dist/`, `target/`, `__generated__/` or wherever the build rewrites them. A hand-edited file you plan to regenerate later is hand-edited.
- "It is a test file with many cases." Split by system under test or by behavior cluster, one file per cohesive `describe` group or test module.
- "230, close enough." A file at 230 about to grow is already over; plan the split now.

## Justified exceptions (rare)

A file may pass 250 pure LOC only when it is:

- A truly indivisible single-responsibility unit: a generated parser table, a state machine whose states share one closure, a derive-macro implementation. Mark it in the first ten lines with the reason: `# noqa: SIZE_OK - generated parser table, 612 states share branch tables` (Python) or `// allow: SIZE_OK - state machine; removing any state breaks the transition matrix` (Rust, TypeScript, Go).
- A pure data table: translation strings, error code lookups, a palette. Data is exempt; logic is covered.

A `SIZE_OK` marker without a justifying reason is itself a defect, and the next person to touch the file removes it or supplies the reason.

## Split examples

### Python

Before: `user_service.py`, 412 pure LOC.

```python
# user_service.py - five jobs in one file
class UserRepository: ...        # 90 LOC of SQLAlchemy
class UserValidator: ...         # 60 LOC of Pydantic and business rules
class PasswordHasher: ...        # 40 LOC wrapping a hashing library
class EmailSender: ...           # 50 LOC of httpx2 client
class UserService: ...           # 130 LOC orchestrating the four above
def _build_query(...): ...       # 25 LOC helper
def _format_email(...): ...      # 17 LOC helper
```

After, split by responsibility:

```text
src/<app>/users/
├── __init__.py      # barrel: re-exports UserService only        (5 LOC)
├── repository.py    # UserRepository                             (~95 LOC)
├── validator.py     # UserValidator                              (~65 LOC)
├── password.py      # PasswordHasher                             (~45 LOC)
├── notifier.py      # EmailSender, renamed for its role           (~55 LOC)
├── service.py       # UserService, the orchestrator               (~135 LOC)
└── _queries.py      # _build_query, private                       (~30 LOC)
```

Each file owns one concept and the barrel exposes one public name. A reviewer reading mail retry policy never scrolls through password hashing.

### Rust

Before: `auth.rs`, 380 pure LOC holding `Session` and its impl (130), `TokenIssuer` and its impl (100), `RateLimiter` and its impl (120), and `parse_authorization_header` (30).

```text
src/auth/
├── mod.rs           # re-exports Session, TokenIssuer, RateLimiter (8 LOC)
├── session.rs       # Session + impl                              (~130 LOC)
├── token.rs         # TokenIssuer + impl                          (~100 LOC)
├── rate_limit.rs    # RateLimiter + impl                          (~120 LOC)
└── header.rs        # parse_authorization_header                  (~35 LOC)
```

### TypeScript

Before: `api/orders.ts`, 510 pure LOC holding `OrderSchema` and its type (30), `OrderRepository` (110), `PricingEngine` (130), `TaxCalculator` (90) and `OrderService` (150).

```text
src/orders/
├── index.ts         # barrel                                      (6 LOC)
├── schema.ts        # OrderSchema + Order type                    (~35 LOC)
├── repository.ts    # OrderRepository                             (~115 LOC)
├── pricing.ts       # PricingEngine                               (~135 LOC)
├── tax.ts           # TaxCalculator                               (~95 LOC)
└── service.ts       # OrderService, the orchestrator               (~155 LOC)
```

### Go

Go has no re-export mechanism, so the shape is one package per concept under `internal/`, one file per type with its methods, and a short `doc.go` or exported-API file in place of a barrel.

```text
internal/orders/
├── doc.go           # package comment and the exported surface    (~15 LOC)
├── order.go         # Order type + smart constructor              (~70 LOC)
├── repository.go    # Repository interface + pgx implementation   (~120 LOC)
├── pricing.go       # Pricer                                      (~110 LOC)
└── service.go       # Service, the orchestrator                   (~140 LOC)
```

## How to carve a split

1. List the top-level units with their pure LOC.
2. Group them by the reason they would change (storage schema, business rule, transport format, presentation).
3. Give each group a file named for the concept it owns.
4. Move one unit at a time, running the tests after each move (`refactor` owns the long form of this loop).
5. Leave a barrel or exported-API file only where the language needs one, holding re-exports only.
