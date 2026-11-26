/** Every option the CLI takes. `value`: it takes the next word, and this names it; `one`: that word is one of these. */
export const FLAGS = Object.freeze({
  '--agent': { key: 'agent' },
  '--dry-run': { key: 'dryRun' },
  '--no-agent-file': { key: 'noAgentFile' },
  '--yes': { key: 'yes' },
  '-y': { key: 'yes' },
  '--json': { key: 'json' },
  '--offline': { key: 'offline' },
  '--status-line': { key: 'statusLine' },
  '--replace-status-line': { key: 'replaceStatusLine' },
  '--round': { key: 'round' },
  '--glyphs': { key: 'glyphs', value: 'auto, round or square', one: ['auto', 'round', 'square'] },
  '--discard-modified': { key: 'discardModified' },
  '--scope': { key: 'scope', value: 'user or project', one: ['user', 'project'] },
  '--project': { key: 'project' },
  '--all': { key: 'all' },
  '--allow-shadow': { key: 'allowShadow' },
  '--from': { key: 'from', value: 'a path' },
  '--family': { key: 'family', value: 'a name' },
  '--older-than': { key: 'olderThan', value: 'a number of days' },
  '--help': { key: 'help' },
  '-h': { key: 'help' },
  '--version': { key: 'version' },
  '-v': { key: 'version' },
});

/** `{command, args, flags}`, with `error` when a word that starts with a dash is no option or an option's value is wrong. */
export function parse(argv) {
  const flags = {};
  const rest = [];
  let error;
  for (let i = 0; i < argv.length; i += 1) {
    const word = argv[i];
    const spec = Object.hasOwn(FLAGS, word) ? FLAGS[word] : null;
    if (spec && !spec.value) {
      flags[spec.key] = true;
    } else if (spec) {
      const value = argv[i + 1];
      const missing = value === undefined || value.startsWith('--');
      if (missing || (spec.one && !spec.one.includes(value))) error ??= `${word} takes ${spec.value}`;
      else flags[spec.key] = value;
      if (!missing) i += 1;
    } else if (word === '--dir' && rest[0] === 'agent-file') {
      rest.push(word); // agent-file reads its own option
    } else if (word.startsWith('-') && word !== '-') {
      error ??= `Unknown option: ${word}`;
    } else {
      rest.push(word);
    }
  }
  return { command: rest[0] ?? 'help', args: rest.slice(1), flags, ...(error ? { error } : {}) };
}
