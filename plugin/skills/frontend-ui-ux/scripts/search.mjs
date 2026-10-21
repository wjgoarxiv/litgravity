const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

export function normalizeQuery(input) {
  return input.normalize("NFKC").toLocaleLowerCase("en-US").trim();
}

function tokens(input) {
  return normalizeQuery(String(input)).match(TOKEN_PATTERN) ?? [];
}

function recordText(record) {
  return Object.entries(record)
    .filter(([key, value]) => key !== "No" && typeof value === "string")
    .map(([, value]) => value)
    .join(" ");
}

function scoreRecord(record, queryTokens) {
  const haystack = tokens(recordText(record));
  if (haystack.length === 0) return 0;
  const frequencies = new Map();
  for (const token of haystack) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  let matches = 0;
  for (const token of queryTokens) {
    matches += frequencies.get(token) ?? 0;
  }
  return matches / Math.sqrt(haystack.length);
}

export function searchRecords(records, { query, domain, limit, minScore }) {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return [];
  return records
    .filter((record) => record.domain === domain)
    .map((record) => ({ record, score: scoreRecord(record, queryTokens) }))
    .filter(({ score }) => score >= minScore && score > 0)
    .sort((left, right) => right.score - left.score || left.record.record_id.localeCompare(right.record.record_id))
    .slice(0, limit)
    .map(({ record, score }) => ({
      ...record,
      score: Number(score.toFixed(8)),
    }));
}
