// Prose checks for deliverables a route writes: stacked negations and stacked hedges. Only what a write ADDS counts;
// sentences already in the file, or in the replaced text, belong to the writer.

export const PROSE_FILE = /\.(md|mdx|markdown|txt)$/i;

const EN_PLEDGE = /\b(never|do not|don't|does not|doesn't|cannot|can't|will not|won't|must not|should not|shouldn't)\b/i;
const KO_PLEDGE = /(않습니다|않는다|않아요|않음|하지 마세요|하지 마십시오|하지 말 것|금지합니다|금지한다)\s*[.!]?$/;

const EN_HEDGES = [
  /\b(?:could|may|might)\s+(?:possibly|potentially|perhaps|arguably)\b/gi,
  /\b(?:perhaps|possibly|potentially|arguably|presumably|seemingly|somewhat|relatively|generally|typically|probably|likely)\b/gi,
  /\b(?:it seems|seems to|appears to|tends to|to some extent|in some cases|in many cases|to a certain degree)\b/gi,
  /\b(?:could|might)\b/gi,
];
const KO_HEDGES = [
  /것으로\s*(?:보인다|보입니다|보여요|추정됩니다|판단됩니다|생각됩니다)|(?:인|할|될)\s*듯\s*(?:하다|합니다|하며)|것\s*같(?:다|습니다|아요)/g,
  /수도\s*있|수\s*있을\s*것|가능성이\s*있/g,
  /다소|어느\s*정도|대체로|일반적으로|아마도?|어쩌면|비교적/g,
];
const HEDGES_PER_SENTENCE = 2;
const HEDGES_PER_PARAGRAPH = 4;

export function paragraphs(text) {
  let inFence = false;
  const out = [];
  let current = [];
  for (const line of String(text).split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence || /^\s*>/.test(line)) continue;
    if (!line.trim()) { if (current.length) out.push(current.join(' ')); current = []; continue; }
    current.push(line);
  }
  if (current.length) out.push(current.join(' '));
  return out;
}

export const sentences = (p) => p.split(/(?<=[.!?。])\s+/).map((s) => s.trim()).filter(Boolean);

// Three pledge-style negations in one paragraph, or two Korean ones, is a cluster.
export function addedNegationCluster(newText, existingText = '') {
  const existing = new Set(paragraphs(existingText).flatMap(sentences));
  for (const p of paragraphs(newText)) {
    const fresh = sentences(p).filter((s) => !existing.has(s));
    const en = fresh.filter((s) => EN_PLEDGE.test(s)).length;
    const ko = fresh.filter((s) => KO_PLEDGE.test(s)).length;
    if (en + ko >= 3 || ko >= 2) return { snippet: p.slice(0, 160), ko };
  }
  return null;
}

// The patterns overlap on purpose ("could possibly" is two hedges): each character span is claimed once.
export function hedgeCount(sentence) {
  let count = 0;
  let rest = sentence;
  for (const pattern of [...EN_HEDGES, ...KO_HEDGES]) {
    const hits = rest.match(pattern);
    if (!hits) continue;
    count += hits.length + (pattern === EN_HEDGES[0] ? hits.length : 0);
    rest = rest.replace(pattern, ' ');
  }
  return count;
}

export function addedHedgeCluster(newText, existingText = '') {
  const existing = new Set(paragraphs(existingText).flatMap(sentences));
  for (const p of paragraphs(newText)) {
    const fresh = sentences(p).filter((s) => !existing.has(s));
    const counts = fresh.map(hedgeCount);
    const total = counts.reduce((a, b) => a + b, 0);
    if (counts.some((c) => c >= HEDGES_PER_SENTENCE) || total >= HEDGES_PER_PARAGRAPH) {
      return { snippet: fresh.join(' ').slice(0, 160), count: total };
    }
  }
  return null;
}

export const NEGATION_MESSAGE = 'The limit is under three pledge-style negations per paragraph in any language, and under two Korean ones. Restate the rule in positive form (say what to do), then write again.';
export const HEDGE_MESSAGE = 'The limit is one hedge per sentence and under four per paragraph. Keep the one qualifier that changes the claim, state the rest plainly, and name the single open point once.';
export const DICTATED_NOTE = 'If the user dictated this wording, run the edit on the lit-humanizer route (lit korean / lit humanize), which keeps the writer\'s claims as given.';
