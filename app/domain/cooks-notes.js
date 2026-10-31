// Cook's notes (R3.3, D10, D16): dated notes for next time, and the only thing
// cook mode ever writes. They're append-only, so two copies of a recipe, from
// two devices or an export, merge by putting their notes together: nothing
// conflicts and nothing is lost.

/** @typedef {import('./recipe.js').Recipe} Recipe */
/** @typedef {import('./recipe.js').CooksNote} CooksNote */

/**
 * The recipe with one more cook's note. The rest of the recipe stays as it
 * is, update time included: that time says whose copy of the recipe's own text
 * is newest when copies merge, and a note must never make older text win (D16).
 * @param {Recipe} recipe
 * @param {string} text
 * @param {{ id?: string, now?: Date }} [options] fixed values, for tests
 * @returns {Recipe}
 */
export function addCooksNote(recipe, text, { id = crypto.randomUUID(), now = new Date() } = {}) {
  const written = text.replace(/\r\n?/gu, '\n').trim();
  if (!written) throw new TypeError('A cook’s note needs some text.');
  return { ...recipe, cooksNotes: [...recipe.cooksNotes, { id, at: now.toISOString(), text: written }] };
}

/**
 * A recipe's cook's notes, newest first.
 * @param {Pick<Recipe, 'cooksNotes'>} recipe
 * @returns {CooksNote[]}
 */
export function newestFirst(recipe) {
  return byTime(recipe.cooksNotes).reverse();
}

/**
 * The newest cook's note, shown as "Last time".
 * @param {Pick<Recipe, 'cooksNotes'>} recipe
 * @returns {CooksNote | undefined}
 */
export function lastCooksNote(recipe) {
  return byTime(recipe.cooksNotes).at(-1);
}

/**
 * Every note from both lists, once each (by id), oldest first.
 * @param {CooksNote[]} ours
 * @param {CooksNote[]} theirs
 * @returns {CooksNote[]}
 */
export function mergeCooksNotes(ours, theirs) {
  const notes = new Map(ours.map((note) => [note.id, note]));
  for (const note of theirs) {
    if (!notes.has(note.id)) notes.set(note.id, note);
  }
  return byTime([...notes.values()]);
}

/**
 * Oldest first; notes written at the same moment go by id, so every device
 * puts them in the same order.
 * @param {CooksNote[]} notes
 */
function byTime(notes) {
  return [...notes].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
