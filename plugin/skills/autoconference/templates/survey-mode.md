# Conference: Literature Survey: {Topic}

> **Template: Survey Mode.** Three `librarian-researcher` children split a literature by source, the Chair relays citation leads between them each round, a `quality-reviewer` child checks summaries and balance, and the result is one taxonomy with a citation graph and a coverage table. The protocol is `modes/survey.md`. Copy to `.litgravity/conference/<slug>/conference.md`.

## Goal
{A systematic survey of the literature on this topic across several sources, periods and methods, for example "Survey work on evaluating retrieval-augmented generation, 2020 to 2025, across biomedical, computer science and engineering literature".}

## Mode
qualitative

## Success Criteria
{For example: every taxonomy category holds at least 5 papers; at least 3 sources and 5 years are covered; every citation was opened or carries a verification flag; at least one research gap per category is named with the queries that found nothing.}

## Researchers
- **Count:** 3
- **Max rounds:** 2
- **Minimum papers per category:** 5
- **Researcher agent type:** librarian-researcher; reviewer quality-reviewer

## Pre-Flight Gate
- **Children (invoke_subagent calls):** 8 (2 rounds x (3 researchers + reviewer))
- **Model calls:** 10 (8 children + 2 nudges)
- **Final confirmation:** pending

## Budget
- **Max rounds:** 2
- **Children:** 8, plus 1 for a citation-check child when the list is long
- **Model calls:** 10
- **Time budget:** 2h
- **Researcher timeout:** 40m

## Search Space
- **Allowed changes:** search queries, paper selection, taxonomy categories (with the user's agreement), synthesis structure
- **Forbidden changes:** invented citations, misrepresented findings, a different survey topic

## Search Space Partitioning
- **Strategy:** assigned

### Researcher A Focus
**Sources: PubMed, bioRxiv, medRxiv.** Biomedical and life-science work: clinical applications, mechanisms, domain-specific methods.

### Researcher B Focus
**Sources: arXiv, Semantic Scholar.** Computer science, physics and interdisciplinary work: methods, benchmarks, theory.

### Researcher C Focus
**Sources: Google Scholar, ACM Digital Library, IEEE Xplore.** Engineering, applied computing and industry work: systems, deployed applications, practitioner reports.

## Taxonomy Categories
<!-- The categories every researcher sorts papers into. -->
1. {Category 1}
2. {Category 2}
3. {Category 3}

## Current Approach
{Existing knowledge or earlier surveys: seed papers, periods and sources already covered.}

## Shared Knowledge
<!-- Citation chains and anchor papers, appended by the Chair after each round. -->

## Context & References
- Seed papers: {DOIs or titles}
- Key authors and groups: {names}
- Date range: {for example 2020 to 2025}
- Excluded: {subfields or paper types left out}

---

## Conference Log
| Round | Researcher | Best Metric | Key Finding | Status |
|-------|-----------|-------------|-------------|--------|
