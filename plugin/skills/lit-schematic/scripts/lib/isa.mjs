// Instrument and equipment tag grammar after ANSI/ISA-5.1 identification letters.
// The parser is deliberately strict about letter positions and lenient about loop numbers,
// because projects number loops in many ways (101, 1-101, 101A) but letters carry meaning.

export const MEASURED = Object.freeze({
  A: "analysis", B: "burner, combustion", C: "conductivity", D: "density", E: "voltage",
  F: "flow", G: "gauging", H: "hand", I: "current", J: "power", K: "time", L: "level",
  M: "moisture", N: "user's choice", O: "user's choice", P: "pressure", Q: "quantity",
  R: "radiation", S: "speed, frequency", T: "temperature", U: "multivariable", V: "vibration",
  W: "weight, force", X: "unclassified", Y: "event, state", Z: "position",
});

export const VARIABLE_MODIFIER = Object.freeze({
  D: "differential", F: "ratio", J: "scan", K: "time rate of change", M: "momentary",
  Q: "integrate, totalize", S: "safety", X: "x-axis", Y: "y-axis", Z: "z-axis",
});

export const READOUT = Object.freeze({
  A: "alarm", B: "user's choice", E: "primary element", G: "glass, gauge", I: "indicating",
  L: "light", N: "user's choice", O: "orifice, restriction", P: "test point", R: "recording",
  W: "well, probe", X: "unclassified",
});

export const OUTPUT = Object.freeze({
  C: "controlling", K: "control station", S: "switch", T: "transmitting", U: "multifunction",
  V: "valve, damper", Y: "compute, convert, relay", Z: "actuator, final element",
});

export const FUNCTION_MODIFIER = Object.freeze({ H: "high", L: "low", M: "middle" });

// Pairs whose meaning is the readable name, not the letter-by-letter reading.
const NAMED = Object.freeze({
  PSV: "pressure safety valve", PSE: "rupture disk", TW: "thermowell", PG: "pressure gauge",
  TG: "thermometer", LG: "level gauge", FG: "sight flow glass", PCV: "self-actuated pressure regulator",
  FO: "restriction orifice", HV: "hand valve", HS: "hand switch", XV: "on-off valve",
});

const TAG = /^([A-Z]{1,6})[-\s]?([0-9]{1,5}(?:[-.][0-9]{1,5})?[A-Z]?)$/u;

export function parseInstrumentTag(tag) {
  const match = TAG.exec(String(tag ?? "").trim());
  if (!match) return { ok: false, tag, error: "a tag is identification letters followed by a loop number, for example PIC-101" };
  const [, letters, loop] = match;
  const [first, ...rest] = letters;
  if (!MEASURED[first]) return { ok: false, tag, error: `${first} is not a measured-variable letter` };
  let index = 0;
  let modifier = null;
  // A second letter that is a variable modifier only counts as one when a function follows it.
  if (rest.length > 1 && VARIABLE_MODIFIER[rest[0]]) {
    const candidate = rest[0];
    const followers = rest.slice(1);
    const followersValid = followers.every((letter) => READOUT[letter] || OUTPUT[letter] || FUNCTION_MODIFIER[letter]);
    if (followersValid && !(candidate === "S" && followers.every((letter) => FUNCTION_MODIFIER[letter]))) {
      modifier = candidate;
      index = 1;
    }
  }
  const functions = rest.slice(index);
  if (functions.length === 0) return { ok: false, tag, error: "a tag needs at least one function letter after the measured variable" };
  const words = [];
  let seenOutput = false;
  for (let i = 0; i < functions.length; i++) {
    const letter = functions[i];
    if (FUNCTION_MODIFIER[letter]) {
      const previous = functions[i - 1];
      if (!previous || !(previous === "A" || previous === "S" || FUNCTION_MODIFIER[previous])) {
        return { ok: false, tag, error: `${letter} (high/low) may only follow an alarm or switch letter` };
      }
      words.push(FUNCTION_MODIFIER[letter]);
      continue;
    }
    if (READOUT[letter]) {
      if (seenOutput && (letter === "I" || letter === "R")) return { ok: false, tag, error: `readout letter ${letter} must come before output letters` };
      words.push(READOUT[letter]);
      continue;
    }
    if (OUTPUT[letter]) {
      seenOutput = true;
      words.push(OUTPUT[letter]);
      continue;
    }
    return { ok: false, tag, error: `${letter} is not a function letter` };
  }
  const repeated = functions.filter((letter, i) => !FUNCTION_MODIFIER[letter] && functions.indexOf(letter) !== i);
  if (repeated.length) return { ok: false, tag, error: `function letter ${repeated[0]} repeats` };
  const meaning = NAMED[letters] ?? [MEASURED[first], modifier ? VARIABLE_MODIFIER[modifier] : null, ...words].filter(Boolean).join(" ");
  return { ok: true, tag, letters, loop, first, modifier, functions, meaning };
}

// Equipment tags: a class prefix of one to three letters, a number, an optional train suffix.
const EQUIPMENT = /^([A-Z]{1,3})-?([0-9]{2,5})([A-Z]?)$/u;
export const EQUIPMENT_CLASS = Object.freeze({
  B: "blower", C: "column", CV: "conveyor", D: "drum", E: "heat exchanger", F: "filter",
  H: "heater", K: "compressor", M: "mixer, agitator", P: "pump", PK: "package unit",
  R: "reactor", S: "separator", T: "tower", TK: "tank", V: "vessel", X: "miscellaneous",
  GC: "gas cylinder", CH: "chiller", BR: "booster", MFC: "mass flow controller", A: "analyzer",
});

export function parseEquipmentTag(tag) {
  const match = EQUIPMENT.exec(String(tag ?? "").trim());
  if (!match) return { ok: false, tag, error: "an equipment tag is a class prefix and a number, for example R-101 or P-101A" };
  return { ok: true, tag, prefix: match[1], number: match[2], train: match[3] || null, meaning: EQUIPMENT_CLASS[match[1]] ?? null };
}

// Line numbers: nominal size, fluid code, sequence number, piping class, and an optional
// insulation or tracing code, joined by hyphens: 2"-P-1001-A1A, 1/4"-CH4-101-HP1, DN50-CW-205-B1-IH.
// Projects order the parts differently; this is the common size-first form most P&IDs use.
const LINE_NUMBER = /^((?:\d+(?:\s\d+\/\d+)?|\d+\/\d+)"|DN\d{1,4}|\d{1,4}mm)-([A-Z][A-Z0-9]{0,5})-(\d{2,6}[A-Z]?)-([A-Z0-9]{1,8})(?:-([A-Z]{1,4}))?$/u;

export function parseLineNumber(text) {
  const match = LINE_NUMBER.exec(String(text ?? "").trim());
  if (!match) return { ok: false, text, error: "a line number is size-fluid-sequence-class[-insulation], for example 2\"-P-1001-A1A" };
  const [, size, fluid, sequence, spec, insulation = null] = match;
  return { ok: true, text, size, fluid, sequence, spec, insulation };
}
