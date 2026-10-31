// What's typed in the editor becomes a recipe, or a short list of what's
// still missing (R1.6, R1.8), which the screens put into words. Doubtful lines don't block saving; they're
// flagged. A saved recipe turns back into the same text for editing (R1.9).
import { parseIngredientList, renderIngredientList } from './ingredients.js';
import { newRecipe } from './recipe.js';
import { parseItems, parseSteps, renderItems, renderSteps } from './sections.js';
import { parseTags, renderTags, tagsOf } from './tags.js';

/** @typedef {import('./recipe.js').Lang} Lang */
/** @typedef {import('./recipe.js').Recipe} Recipe */
/** @typedef {import('./ingredients.js').ListLine} ListLine */
/**
 * Every box of the editor, as typed. Only title, language and ingredients are required here.
 * @typedef {{ title: string, lang: Lang, ingredients: string,
 *   source?: string, yield?: string, tags?: string, preparation?: string, variations?: string, notes?: string }} Draft
 */
/** @typedef {{ code: 'no-title' } | { code: 'no-name', line: number }} Problem */

/**
 * The editor's text for a saved recipe; reading it back gives the same recipe.
 * @param {Recipe} recipe
 * @returns {Required<Draft>}
 */
export function draftOf(recipe) {
  return {
    title: recipe.title,
    lang: recipe.lang,
    source: recipe.source,
    yield: recipe.yield,
    tags: renderTags(tagsOf(recipe)),
    ingredients: renderIngredientList(recipe.ingredients, recipe.lang),
    preparation: renderSteps(recipe.preparation),
    variations: renderItems(recipe.variations),
    notes: renderItems(recipe.notes),
  };
}

/**
 * @param {Draft} draft
 * @param {{ id?: string, now?: Date, base?: Recipe }} [options]
 *   base: the recipe being edited, whose id, creation time, cook's notes and
 *   any fields from newer versions are kept; id and now: fixed values, for tests
 * @returns {{ recipe: Recipe | null, problems: Problem[], lines: ListLine[] }}
 */
export function readDraft(draft, { id, now = new Date(), base } = {}) {
  const { title, lang, ingredients, source = '', yield: makes = '', tags = '', preparation = '', variations = '', notes = '' } = draft;
  const { lines, groups } = parseIngredientList(ingredients, lang);
  /** @type {Problem[]} */
  const problems = [];
  if (!title.trim()) problems.push({ code: 'no-title' });
  for (const line of lines) {
    if (line.kind === 'ingredient' && !line.ingredient.name) problems.push({ code: 'no-name', line: line.number });
  }
  if (problems.length > 0) return { recipe: null, problems, lines };
  const start = base ?? newRecipe({ title: title.trim(), lang, id, now });
  return {
    recipe: {
      ...start,
      title: title.trim(),
      lang,
      source: source.trim(),
      yield: makes.trim(),
      tags: parseTags(tags),
      ingredients: groups,
      preparation: parseSteps(preparation),
      variations: parseItems(variations),
      notes: parseItems(notes),
      updatedAt: now.toISOString(),
    },
    problems,
    lines,
  };
}
