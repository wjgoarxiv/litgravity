// Ledger lines and handoff files never carry credentials. Shapes cover the common provider keys, bearer tokens and
// `name=value` assignments whose name says secret.
const SHAPES = [
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bnpm_[A-Za-z0-9]{30,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  /\b(?:[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)S?)\s*=\s*\S+/g,
];

export function redact(text) {
  let out = String(text);
  for (const re of SHAPES) out = out.replace(re, '[redacted]');
  return out;
}

export const clip = (text, n = 240) => {
  const s = redact(String(text ?? '')).replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}...` : s;
};
