// The answer guide under a goal question. agy shows hook text only through the model, so every goal question reaches
// the user inside a model-written reply; the guide is Markdown the model puts right under the unchanged question line.
// One option list per question: the question's `(yes / …)` choices and the guide's rows are both built from it.
export const GOAL_ANSWERS = Object.freeze({
  plan: Object.freeze({
    title: 'approve plan · start work · set goal',
    rows: Object.freeze([
      ['yes', 'Starts the work now and arms this goal; the reply gives the /goal line to paste'],
      ['edit', "Change the goal's check first"],
      ['no', 'Nothing starts'],
    ]),
  }),
  start: Object.freeze({
    title: 'approve plan · start work',
    rows: Object.freeze([['yes', 'Starts the work now, with no goal'], ['no', 'Nothing starts']]),
  }),
  loop: Object.freeze({
    title: 'set goal for this lit-loop',
    rows: Object.freeze([
      ['yes', 'Arms this goal; the reply gives the /goal line to paste'],
      ['no', 'Keeps working without a goal'],
    ]),
  }),
});

/** `(yes / edit / no)` or `(yes / no)`: the choices printed at the end of the question line. */
export const answerChoices = (kind) => `(${GOAL_ANSWERS[kind].rows.map(([word]) => word).join(' / ')})`;

// A condition holds backticks (`npm test`), so it needs the double-backtick span to stay one code span.
const goalSpan = (condition) => (condition.includes('`') ? `\`\` /goal ${condition} \`\`` : `\`/goal ${condition}\``);

/** The Markdown guide for one question; `condition` is null for the start-only question. */
export const answerGuide = (kind, condition = null) => {
  const { title, rows } = GOAL_ANSWERS[kind];
  const lines = [`**▶ Answer: ${title}**`, ''];
  if (typeof condition === 'string') lines.push(`Goal: ${goalSpan(condition)}`, '');
  lines.push('| Type | What happens |', '|---|---|', ...rows.map(([word, effect]) => `| **\`${word}\`** | ${effect} |`), '', 'Type the word alone.');
  return lines.map((line) => (line ? `> ${line}` : '>')).join('\n');
};
