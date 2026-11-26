// What a coding agent reads before it installs LitGravity for someone. Text only: printing it reads no file and needs no
// host. test/agent-guide.test.mjs binds it to the parser, to the questions install asks and to both reference prompts.
import { CAPS } from '../plugin/hud/glyphs.mjs';
import { ICON_FONT } from './icon-font.mjs';

export const COMMAND = 'npx --yes @litfamily/litgravity@latest';
export const AGENT_POINTER = `Agent? See ${COMMAND} install --agent.`;

/** The questions for the user. `title` is the name of the same question on install's own cards, where it has one. */
export const QUESTIONS = Object.freeze([
  { title: 'Install', flags: [], line: 'Keep every default? Default: yes, the install line of step 4 as it stands.' },
  { title: 'Scope', flags: ['--scope', '--status-line'], line: 'Where should LitGravity work? Default: in every project. For one project: run every command in that folder with --scope project and leave out --status-line.' },
  { title: 'Global rule', flags: ['--no-agent-file'], line: "Add LitGravity's short rule file to agy's rules folder? Default: yes. For no: add --no-agent-file to every install and update command below." },
  { title: 'Rule later', flags: [], line: `For good, your user can choose it later with ${COMMAND} config agentFile off` },
  { title: 'Status line', flags: ['--status-line', '--replace-status-line'], line: "The status line under agy's prompt is the part of LitGravity your user sees, and round ends show there. It is on only with --status-line, so ask. Default here: yes. For no: leave out --status-line. If agy already shows another status line, the preview stops and says so; your user then chooses between leaving out --status-line and adding --replace-status-line, which saves the old one for uninstall to put back." },
  { title: 'Icon font', flags: ['--round'], line: `--round adds one icon font, ${ICON_FONT.files[0].name} with its licence file (Nerd Fonts ${ICON_FONT.release}, symbols only), to ~/Library/Fonts on macOS or ~/.local/share/fonts on Linux ($XDG_DATA_HOME/fonts when that is set), and only when no icon font is here. The installer fetches it from the official Nerd Fonts release and checks its SHA-256. On Windows it adds nothing. For no: leave out --round.` },
  { title: 'Round or square', flags: ['--glyphs'], line: `Round or square ends: your user can choose it later with ${COMMAND} update --yes --glyphs auto|round|square` },
]);

/** The whole guide, without the last newline. */
export function agentGuide() {
  return [
    'LitGravity install guide for coding agents',
    '',
    'If you are a coding agent and your user asked you to install LitGravity, follow these steps. They are written for your user to read too.',
    '',
    '1. Preview',
    `   ${COMMAND} install --dry-run --round --status-line`,
    '   Show your user what it would change. It needs Node.js 20 or newer and the Antigravity CLI (agy) on PATH. A preview that ends with FAIL has changed nothing.',
    '',
    '2. Ask',
    ...QUESTIONS.map((q) => `   - ${q.line}`),
    '',
    '3. Wait',
    "   Wait for your user's yes. Use only this package; add no other source, and do not approve hooks, trust or sign-in for your user.",
    '',
    '4. Install',
    `   ${COMMAND} install --yes --round --status-line`,
    '',
    '5. Update, another day',
    `   ${COMMAND} update --yes --round`,
    '',
    '6. Check',
    `   ${COMMAND} doctor`,
    '   It passes when its last line starts with "LitGravity: ready". The install must also print a line that starts with ROUND_ENDS:. If a step fails, show your user the lines and stop.',
    '',
    '7. Rounded ends',
    `   Show your user this and ask if both ends are round: ${CAPS[0]} LIT ${CAPS[1]}`,
    `   Round: ${COMMAND} update --yes --glyphs round`,
    `   Boxes: ${COMMAND} update --yes --glyphs square`,
    "   To get round ends there, your user sets the terminal's own font to a full Nerd Font, or adds the symbols font as a fallback font (iTerm2: Non-ASCII Font; VS Code: terminal.integrated.fontFamily; kitty: symbol_map). Terminal.app has no fallback setting and needs a full Nerd Font as its font.",
    '   Over SSH or on a phone: leave it as it is unless your user sees round ends there.',
    `   To undo either choice: ${COMMAND} update --yes --glyphs auto`,
    '',
    '8. Only your user can',
    '   - Quit agy if it is open and start it again; a running agy keeps the old copy.',
    "   - Open agy and sign in, once, with their own account.",
    '   - Approve things inside agy. LitGravity has nothing waiting there: agy loads its hooks, skills and agents without an approval step, and it needs no Git trust.',
  ].join('\n');
}
