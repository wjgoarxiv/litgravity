# Conference: Research Synthesis

> **Template: Research Synthesis.** A qualitative conference: three reading researchers cover different facets of a research area, the reviewer grades against the criteria below, and the synthesizer builds one taxonomy with gaps and hypotheses. Researchers are `librarian-researcher` children (read and web, no writes); the Chair writes every file. Copy to `.litgravity/conference/<slug>/conference.md`.

## Goal
Build a taxonomy of {research area} that covers foundational work, recent advances and cross-domain connections, and name research gaps and new hypotheses.

## Mode
qualitative

## Success Criteria
A taxonomy with at least 15 papers, each with authors, year, key contribution, relevance to the goal and an identifier (DOI, arXiv ID or stable URL) that a fetch confirmed. At least 3 research gaps, each supported by the absence of work in a searched region. At least 2 cross-domain connections that name both fields. Disqualifying: any citation that cannot be found, or a summary that contradicts its source.

## Researchers
- **Count:** 3
- **Iterations per round:** 5
- **Max rounds:** 3
- **Researcher agent type:** librarian-researcher

## Pre-Flight Gate
- **Max total iterations:** 45
- **Children (invoke_subagent calls):** 16
- **Model calls:** 64
- **Critic / Devil's Advocate:** disabled
- **Final confirmation:** pending

## Budget
- **Max rounds:** 3
- **Max total iterations:** 45
- **Children:** 16 (3 rounds x (3 researchers + session chair + reviewer) + synthesizer)
- **Model calls:** 64
- **Time budget:** 2h
- **Researcher timeout:** 40m

## Search Space
- **Allowed changes:** search queries, paper selection, synthesis approach, taxonomy structure, hypotheses
- **Forbidden changes:** the research question; inventing citations (every paper is real and fetched)

## Search Space Partitioning
- **Strategy:** assigned

### Researcher A Focus
Foundations and surveys: the works that established the field, highly cited surveys, theoretical groundwork; papers that later work keeps citing.

### Researcher B Focus
Recent advances, the last two years: state-of-the-art results, new methods, recent empirical findings, preprints and conference papers.

### Researcher C Focus
Adjacent fields: the same problem under another name elsewhere, techniques borrowed across fields, analogies that suggest transfer.

## Guard
Every paper in a researcher's rows carries an identifier and an `opened` flag. Rows without both are excluded from Shared Knowledge.

## Noise Handling
- **Noise runs:** 1
- **Min consensus delta:** 0

## Pause Policy
- **pause_every:** every_round

## Current Approach
{What you already know: papers read, suspected gaps.}

## Shared Knowledge
<!-- Appended by the Chair after each peer review. Only validated findings. -->

## Context & References
- Research question: {the specific question}
- Seed papers: {papers already known}
- Key terms: {field-specific vocabulary for searches}

---

## Conference Log
| Round | Researcher | Best Metric | Key Finding | Status |
|-------|-----------|-------------|-------------|--------|
