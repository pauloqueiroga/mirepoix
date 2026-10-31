// Tags (R3.4, R3.5, D19): short words that group recipes ("sobremesa",
// "weeknight"), typed into one box with commas between them. They're kept as
// typed and compared the way search compares words, ignoring case and accents,
// so "Natal" and "natal" are one tag.
import { fold } from './search.js';

/** @typedef {import('./recipe.js').Recipe} Recipe */

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/**
 * Reads the Tags box: commas separate tags, a leading "#" is dropped, spaces
 * are squashed, and a tag given twice is kept once, as first written.
 * @param {string} text
 * @returns {string[]}
 */
export function parseTags(text) {
  /** @type {string[]} */
  const tags = [];
  for (const part of text.split(',')) {
    const tag = part.replace(/\s+/gu, ' ').trim().replace(/^#+\s*/u, '');
    if (tag && !tags.some((kept) => sameTag(kept, tag))) tags.push(tag);
  }
  return tags;
}

/**
 * Writes tags back as text that reads back to the same tags.
 * @param {string[]} tags
 */
export function renderTags(tags) {
  return tags.join(', ');
}

/**
 * @param {string} a
 * @param {string} b
 */
export function sameTag(a, b) {
  return fold(a) === fold(b);
}

/**
 * A recipe's tags; recipes saved before tags existed have none.
 * @param {Pick<Recipe, 'tags'>} recipe
 */
export function tagsOf(recipe) {
  return recipe.tags ?? [];
}

/**
 * Every tag in use, once each, in alphabetical order. A tag written two ways
 * shows the way most recipes write it.
 * @param {Recipe[]} recipes
 * @returns {string[]}
 */
export function allTags(recipes) {
  /** @type {Map<string, Map<string, number>>} folded tag → spelling → recipes using it */
  const spellings = new Map();
  for (const recipe of recipes) {
    for (const tag of tagsOf(recipe)) {
      const ways = spellings.get(fold(tag)) ?? new Map();
      ways.set(tag, (ways.get(tag) ?? 0) + 1);
      spellings.set(fold(tag), ways);
    }
  }
  return [...spellings.values()]
    .map((ways) => [...ways].sort(([a, m], [b, n]) => n - m || a.localeCompare(b))[0]?.[0] ?? '')
    .sort(collator.compare);
}

/**
 * The recipes that have every one of the given tags; all of them when none are given.
 * @param {Recipe[]} recipes
 * @param {string[]} tags
 */
export function withTags(recipes, tags) {
  const wanted = tags.map(fold);
  return recipes.filter((recipe) => {
    const has = new Set(tagsOf(recipe).map(fold));
    return wanted.every((tag) => has.has(tag));
  });
}
