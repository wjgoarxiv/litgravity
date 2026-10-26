// Skill looks for the status line. agy draws the line as one row and repaints it when it chooses, so a look is a paint
// for the whole row, a label segment or a route segment, never an animation: the rainbow turns at most one step per
// 10-second bucket and everything else is static. NO_COLOR keeps every label and drops every paint.
//   rewind     lit-adhd and its alias: every cell its own hue (render.mjs draws it)
//   your-turn  the session waits on the user: the row in amber and a YOUR TURN label with the reason
//   done       a plan or goal of this route was finished in the last DONE_MS: a DONE label once, then the plain row
//   review     review-work: the five lanes, each in its own colour once it reports
export const LOOKS = Object.freeze({
  rewind: Object.freeze({ paint: 'rainbow' }),
  'your-turn': Object.freeze({ paint: 'amber', label: 'YOUR TURN' }),
  done: Object.freeze({ label: 'DONE' }),
  review: Object.freeze({ segment: 'lanes' }),
});

// A route takes its look whichever way it started (route word, skill id, slash, alias or skill load), because every
// entry writes the same route id into the conversation state and the line reads only that.
export const ROUTE_LOOKS = Object.freeze({ 'lit-adhd': 'rewind', 'review-work': 'review' });

export const DONE_MS = 20_000;

// The review-work lanes in their fixed order, as `lane-N-<name>.md` in the review folder names them.
export const REVIEW_LANES = Object.freeze(['goal', 'qa', 'quality', 'security', 'context']);

// Waiting on the user outranks a finish, which outranks the route's own look.
export function lookOf({ route = null, waiting = null, done = false } = {}) {
  if (waiting) return 'your-turn';
  if (done) return 'done';
  return ROUTE_LOOKS[route] ?? null;
}
