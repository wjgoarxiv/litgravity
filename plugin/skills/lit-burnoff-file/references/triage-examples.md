# Triage examples

Worked candidates for the three categories and the four-question gate. Each example shows the candidate, the question that decides it, and the outcome. The examples use JavaScript and Python, and the rules carry over to any language.

## Obvious comments

| Candidate | Decision | Reason |
| --- | --- | --- |
| `count += 1  // increment count` | cut | restates the code |
| `// ------- helpers -------` | cut | decorative divider |
| `// removed the old retry helper` | cut | narrates a diff |
| `// TODO: future enhancement` | cut | no condition, no owner |
| `// retry once: the upstream returns 502 on the first call after idle` | keep | explains why, names a real behavior |
| `// eslint-disable-next-line no-await-in-loop` | keep | tooling directive |
| `# given / # when / # then` in a test | keep | structured test phase marker |
| `// see issue 4821` | keep | external reference |
| `/** Returns the name. */ get name()` on a one-line getter | cut | trivial accessor docstring |
| `/** Returns the name. */` in a file where every export carries a docstring | keep | the file's own convention |

## Unreachable defensiveness

| Candidate | Decision | Reason |
| --- | --- | --- |
| `if (req == null) return` inside an Express handler | cut when the framework guarantees `req`; confirm in the framework docs or a test | Q2 coverage and Q3 context |
| `if (!user) throw` on a value read from a database column marked nullable | keep | nullable field |
| `try { x = {a:1}.a } catch {}` | cut | cannot throw |
| `try { JSON.parse(body) } catch { return 400 }` | keep | boundary parse |
| `if not isinstance(name, str): raise` on a parameter annotated `str`, called only from typed code | cut after the typecheck passes | static guarantee, Q1 behavior |
| the same check repeated at three call sites | ask once | repeated pattern means convention |
| `_old_name = new_name  # deprecated` with no references in the repository | cut after the existence proof | dead alias |
| `except Exception: pass` around a cache write | list as noticed; narrowing needs a covering test for both paths | behavior-adjacent |

## Deep nesting

```js
// before
function pick(a) {
  if (a) {
    if (a.items) {
      if (a.items.length > 0) {
        return a.items[0];
      }
    }
  }
  return null;
}

// after (same result for every input, same evaluation order)
function pick(a) {
  if (!a?.items?.length) return null;
  return a.items[0];
}
```

The flattening above keeps the result for `undefined`, `null`, an empty array and a non-empty array. A case with a getter that has side effects on `a.items` would change the number of reads, so the covering test or the type of `a` has to rule that out first.

Skip when flattening would change short-circuit timing, exception timing, resource cleanup order or the order of side effects. Record the candidate under "noticed, not touched".

## The four-question gate on a borderline case

Candidate: a `finally` block that closes a file handle that the `with` statement above already closes.

1. Behavior: closing twice is harmless in this runtime, but the `with` could be removed by a later edit. Unsure, so the answer leans to skip.
2. Coverage: a test that opens a file passes either way. It would not fail if the close disappeared.
3. Context: the `finally` may exist because an earlier version used no `with`.
4. Readability: removing it shortens the function by three lines.

Outcome: skip, and list it as noticed. Two doubts out of four decide it.

## Report wording for a clean file

"All 14 comments explain why or carry tool directives; the three guards sit at the external-response boundary (L40, L77, L102); nesting stays within one level; no dead imports according to the linter. Nothing changed." Each clause is checkable, and "looked fine" is not.

## When a pass uncovers a bigger problem

A file over 250 pure lines, a wrapper layer that forwards every call, or a file with no tests at all is outside this pass. Say so in the "noticed, not touched" list and name `lit-burnoff` as the route that plans the change.
