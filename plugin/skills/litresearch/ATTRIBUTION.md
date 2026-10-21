# Attribution and notice: litresearch

The `litresearch` skill is written for LitGravity. One verification idea in it comes from a third-party project and is credited here. No third-party source code is vendored, copied or redistributed in this folder; the skill re-expresses a concept as prompt instructions.

This notice travels with the claim gate described in `SKILL.md` (Step 4) and `references/disputed-claims.md`. When the gate is removed, this notice may go with it; while the gate ships, this notice ships too.

## insane-research by fivetaku: origin of the claim-gate idea

The claim gate lets the synthesis assert a high-risk non-code claim only after it clears at least two independent source domains, a counter-search and a primary source, and sends every other claim to an Unresolved or Refuted annex. That design is inspired by the data-flow lock in **insane-research** by fivetaku.

- Source: https://github.com/fivetaku/insane-research
- Licence: MIT, as declared in that project's README.

**Adapted:** the idea of a verification gate whose output is the only allowlist the synthesis may draw from, so skipping verification leaves nothing to synthesize. The upstream project implements it as a Python checker. LitGravity re-expresses it as instructions the model follows with agy's own tools, because the plugin ships no runtime dependency for this skill.

**Left upstream:** the code, file layout, data format and wording.

The MIT licence asks that its copyright and permission notice accompany adaptations, so it is reproduced in full:

```
MIT License

Copyright (c) 2026 fivetaku

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
