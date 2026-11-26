import { askedGlyphs, drawsCaps, hasIconFont, keptIconFont, savedGlyphs } from '../plugin/hud/glyphs.mjs';
import { colorDepth, lightGround } from '../plugin/hud/render.mjs';
import { COMMAND } from './agent-guide.mjs';
import { statusLineOn } from './statusline.mjs';

const square = (reason, fix) => `square (${reason}; ${fix})`;
const check = (why, fix) => `check (${why}; ${fix})`;

// What this window says about itself. An agent's shell is no window, so this counts only when stdout is a terminal.
function windowReason(env) {
  if (Object.hasOwn(env, 'NO_COLOR')) return ['NO_COLOR is set', 'unset NO_COLOR'];
  if (/^dumb$/i.test(env.TERM ?? '')) return ['TERM=dumb', 'use a full-colour terminal'];
  if (env.LITGRAVITY_HUD_ASCII === '1') return ['LITGRAVITY_HUD_ASCII is set', 'unset LITGRAVITY_HUD_ASCII'];
  if (colorDepth(env) !== 'truecolor') return ['fewer colours than truecolor', 'use a truecolor terminal, or set LITGRAVITY_HUD_COLOR=truecolor if this one has it'];
  if (lightGround(env)) return ['light background', 'use a dark background'];
  return null;
}

/** Do pills and gauges end round on the status line? `fontProblem` is why --round added no font. A font file proves that
 *  it is installed and no more: the terminal may still draw a box, so that answer is `check`. */
export function roundState({ env, p, tty = false, fontProblem = null, font = {} }) {
  const platform = font.platform ?? process.platform;
  if (!statusLineOn(p)) return square('no surface enabled', `${COMMAND} install --yes --round --status-line`);
  const asked = askedGlyphs(env);
  const choice = asked ?? savedGlyphs(env);
  if (choice === 'square') return square('choice is square', asked ? 'unset LITGRAVITY_HUD_GLYPHS' : `${COMMAND} update --yes --glyphs auto`);
  const window = tty ? windowReason(env) : null;
  if (window) return square(...window);
  if (choice === 'round') return asked ? check('LITGRAVITY_HUD_GLYPHS asks for round ends', `if your user sees both ends round, ${COMMAND} update --yes --glyphs round`) : 'shown';
  if (drawsCaps(env)) return `ready${tty ? '' : ' in a dark full-colour terminal'}`;
  if (env.SSH_CONNECTION) return square('SSH', `if your user sees round ends over SSH, ${COMMAND} update --yes --glyphs round`);
  const here = keptIconFont(env) ?? hasIconFont(env, { platform, ...(font.folders ? { folders: font.folders } : {}) });
  if (here) return check('an icon font is here, and only your user can see whether this terminal uses it', `show the pill of step 7 in ${COMMAND} install --agent and save the answer with --glyphs round or --glyphs square`);
  if (platform === 'win32') return square('Windows console', 'open agy in Windows Terminal or VS Code');
  if (fontProblem) return square(`font not installed (${fontProblem})`, `run ${COMMAND} update --yes --round again once that is solved`);
  return square('no icon font', `${COMMAND} update --yes --round`);
}

export const roundEnds = (options) => `ROUND_ENDS: ${roundState(options)}`;
