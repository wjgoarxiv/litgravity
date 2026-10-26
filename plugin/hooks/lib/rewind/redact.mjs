// Redaction for every string the lit-adhd collector emits. Credential shapes, URI userinfo,
// secret-named NAME=value pairs and quoted "name": value pairs, one-time codes beside an auth word,
// environment values of 8+ characters, and the home directory. Shorter environment values are left
// alone: masking every short value would erase ordinary words.

const MASK = '[redacted]';
const SECRET_NAME = /KEY|TOKEN|SECRET|PASS|AUTH|COOKIE/iu;
const ASSIGNMENT = /\b([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|[^\s"'`]+)/gu;
// A quoted key (JSON, a dict literal) names a secret when it ends in one; `author` does not.
const QUOTED_PAIR = /(["'])([A-Za-z_][A-Za-z0-9_-]*)\1(\s*:\s*)("(?:[^"\\]|\\.)*"|'[^']*'|[^\s,}\]]+)/gu;
const SECRET_KEY = /(?:key|token|secret|passw(?:or)?d|passphrase|cookie|credentials?|authorization|auth)$/iu;
const ONE_TIME = [
  /\b((?:otp|passcode|pin|2fa|mfa|one[- ]time (?:code|password)|verification code|auth(?:entication)? code)\b[\s:=#-]*)\d{4,8}\b/giu,
  /(인증\s*(?:번호|코드)\s*[:=]?\s*)\d{4,8}(?!\d)/gu,
];
// Terminal control: ESC/CSI/OSC sequences, other C0/C1 controls and bidi overrides would act on the
// terminal that shows the brief, so they go before anything else. Tab and newline stay.
const OSC = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/gu;
const CSI = /(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]/gu;
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu;
const PLAIN_ENV_NAMES = /^(?:PATH|HOME|PWD|OLDPWD|SHELL|USER|LOGNAME|LANG|LANGUAGE|TERM|TERM_PROGRAM|TERM_PROGRAM_VERSION|COLORTERM|EDITOR|VISUAL|PAGER|TMPDIR|SHLVL|LC_[A-Z]+|XPC_[A-Z_]+|__CF[A-Z_]*|COMMAND_MODE|_)$/u;

const SHAPES = [
  /(?<![A-Za-z0-9_])(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}(?![A-Za-z0-9_])/gu,
  /(?<![A-Za-z0-9_])(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}(?![A-Za-z0-9_])/gu,
  /\bsk-[A-Za-z0-9_-]{20,}\b/gu,
  /(?<![A-Za-z0-9_])npm_[A-Za-z0-9]{20,}(?![A-Za-z0-9_])/gu,
  /(?<![A-Z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])/gu,
  /(?<![A-Za-z0-9_])xox[baprs]-[A-Za-z0-9-]{10,}(?![A-Za-z0-9_-])/gu,
  /(?<![A-Za-z0-9_])AIza[0-9A-Za-z_-]{20,}(?![A-Za-z0-9_])/gu,
  /\bbearer\s+[A-Za-z0-9._~+/=-]{12,}(?=$|[^A-Za-z0-9._~+/=-])/giu,
  /\b(?:password|passwd|secret|token|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s,;]+/giu,
];
const USERINFO = /(?<![A-Za-z0-9+.-])(?:[A-Za-z][A-Za-z0-9+.-]*:)?\/\/[^/?#\s]+@/gu;

const envSecrets = (env) => Object.entries(env ?? {})
  .filter(([name, value]) => typeof value === 'string' && value.length >= 8 && !PLAIN_ENV_NAMES.test(name)
    && !/^[~/]/u.test(value) && !value.includes(':/') && !/^(?:true|false|\d+)$/iu.test(value))
  .map(([, value]) => value)
  .sort((a, b) => b.length - a.length);

export const makeRedactor = ({ env = process.env, home = env?.HOME } = {}) => {
  const values = envSecrets(env);
  return (input) => {
    if (typeof input !== 'string' || input === '') return input;
    let text = input.replace(OSC, '').replace(CSI, '').replace(CONTROL, '');
    for (const value of values) if (text.includes(value)) text = text.split(value).join(MASK);
    text = text.replace(USERINFO, (match) => match.replace(/\/\/[^/?#\s]+@/u, `//${MASK}@`));
    text = text.replace(ASSIGNMENT, (match, name) => (SECRET_NAME.test(name) ? `${name}=${MASK}` : match));
    text = text.replace(QUOTED_PAIR, (match, quote, name, sep, value) => {
      if (!SECRET_KEY.test(name)) return match;
      const q = /^["']/u.test(value) ? value[0] : '';
      return `${quote}${name}${quote}${sep}${q}${MASK}${q}`;
    });
    for (const pattern of ONE_TIME) text = text.replace(pattern, (match, lead) => `${lead}${MASK}`);
    for (const pattern of SHAPES) text = text.replace(pattern, MASK);
    if (typeof home === 'string' && home.length > 1) text = text.split(home).join('~');
    return text;
  };
};
