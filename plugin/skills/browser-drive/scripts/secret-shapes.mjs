// Credential-shape set used by the capability probe before it echoes any banner a driver prints.
//
// Detection is shape-based and conservative about ordinary prose. A caller decides what to do with
// a hit (the probe drops the banner and reports an unverified identity); this module only answers
// whether the text looks like a credential. The list is frozen so a consumer cannot weaken it.

/** The guarded credential shapes, in a frozen list so a consumer cannot weaken the set. */
export const SECRET_SHAPE_PATTERNS = Object.freeze([
  /-----BEGIN (?:RSA |EC |DSA |ED25519 |OPENSSH |ENCRYPTED |SSH2 ENCRYPTED )?PRIVATE KEY-----/iu,
  /-----BEGIN PGP PRIVATE KEY BLOCK-----/iu,
  /(?<![A-Za-z0-9_])(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}(?![A-Za-z0-9_])/u,
  /(?<![A-Za-z0-9_])(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}(?![A-Za-z0-9_])/u,
  /\bsk-[A-Za-z0-9_-]{20,}\b/u,
  /(?<![A-Za-z0-9_])npm_[A-Za-z0-9]{20,}(?![A-Za-z0-9_])/u,
  /(?<![A-Z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])/u,
  /(?<![A-Za-z0-9_])xox[baprs]-[A-Za-z0-9-]{10,}(?![A-Za-z0-9_-])/u,
  /(?<![A-Za-z0-9_])xapp-[A-Za-z0-9-]{20,}(?![A-Za-z0-9_-])/u,
  /(?<![A-Za-z0-9_])AIza[0-9A-Za-z_-]{20,}(?![A-Za-z0-9_])/u,
  /(?<![A-Za-z0-9_])hf_[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_])/u,
  /(?<![A-Za-z0-9_])whsec_[A-Za-z0-9]{24,}(?![A-Za-z0-9_])/u,
  /(?<![A-Za-z0-9_])SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}(?![A-Za-z0-9_])/u,
  /(?<![A-Za-z0-9_])(?:glpat|gldt|glrt)-[A-Za-z0-9_-]{8,}(?![A-Za-z0-9_])/u,
  /(?<![A-Za-z0-9_])eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?![A-Za-z0-9_])/u,
  /\bbearer\s+[A-Za-z0-9._~+/=-]{12,}(?=$|[^A-Za-z0-9._~+/=-])/iu,
  // A Basic credential is standard base64 of at least 8 characters in whole 4-character groups,
  // carrying a digit, `+`, `/`, padding, or mixed case with an inner capital. The scheme matches
  // in any case; the credential is case-sensitive, so "basic understanding" is not a credential.
  /\b[Bb][Aa][Ss][Ii][Cc]\s+(?=[A-Za-z0-9+/=]{8})(?=[A-Za-z0-9+/=]*[0-9+/=]|(?=[A-Za-z0-9+/=]*[a-z])[A-Za-z0-9+/=]+[A-Z])(?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?(?![A-Za-z0-9._~+/=-])/u,
  /(?<![A-Za-z0-9-])(?:proxy-)?authorization\s*:\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+\s+(?:[!#$%&'*+\-.^_`|~0-9A-Za-z]+\s*=\s*\S+|\S{12,})/iu,
  /\b(?:password|passwd|secret|token|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s,;]+/iu,
  /\b[A-Za-z][A-Za-z0-9]*(?:[_-][A-Za-z0-9]+)*[_-](?:token|secret|key)(?:[_-][A-Za-z0-9]+)*\s*[:=]\s*[^\s,;]+/iu,
  /(?<![A-Za-z0-9_])_?auth(?:[_-]?token)?\s*[:=]\s*[^\s,;]{8,}/iu,
]);

/** Credentials embedded in URI userinfo, which no persisted surface should carry. */
export const URI_USERINFO_PATTERN = /(?<![A-Za-z0-9+.-])(?:[A-Za-z][A-Za-z0-9+.-]*:)?\/\/[^/?#\s]+@/u;

const ANSI_CONTROL_PATTERN = /[\u001b\u0080-\u009f]/u;
const CONTROL_OR_FORMAT_PATTERN = /[\p{Cc}\p{Cf}]/gu;
const MAX_SECRET_SCAN_BYTES = 64 * 1024;
const normalizedForSecretScan = (value) => value
  .replace(CONTROL_OR_FORMAT_PATTERN, "");
const spacedForSecretScan = (value) => value
  .replace(CONTROL_OR_FORMAT_PATTERN, " ");
const matchesSecretShape = (value) => URI_USERINFO_PATTERN.test(value)
  || SECRET_SHAPE_PATTERNS.some((pattern) => pattern.test(value));

/** True when the value looks like it carries a credential. Never throws, whatever it is given. */
export const containsSecret = (value) => {
  if (typeof value !== "string" || value === "") return false;
  if (Buffer.byteLength(value, "utf8") > MAX_SECRET_SCAN_BYTES) return true;
  if (ANSI_CONTROL_PATTERN.test(value)) return true;
  return matchesSecretShape(value)
    || matchesSecretShape(normalizedForSecretScan(value))
    || matchesSecretShape(spacedForSecretScan(value));
};
