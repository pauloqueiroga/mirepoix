// Search (R1.10): titles, ingredient names and tags (R3.5), ignoring case and
// accents, so "pao" finds "Pão de queijo" and "acucar" finds "açúcar".

/** @typedef {import('./recipe.js').Recipe} Recipe */
/**
 * @typedef {{ recipe: Recipe, ingredients: string[], tags: string[] }} Found
 *   ingredients and tags: the ones that matched, when the title alone didn't
 */

/**
 * Lowercase, accents dropped, spaces squashed: what search compares.
 * @param {string} text
 */
export function fold(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/gu, ' ').trim();
}

/**
 * Recipes matching every word of the query, in the given order, those whose
 * titles hold every word first. An empty query matches everything.
 * @param {Recipe[]} recipes
 * @param {string} query
 * @returns {Found[]}
 */
export function searchRecipes(recipes, query) {
  const words = fold(query).split(' ').filter(Boolean);
  /** @type {Found[]} */
  const byTitle = [];
  /** @type {Found[]} */
  const byContents = [];
  for (const recipe of recipes) {
    const title = fold(recipe.title);
    const names = recipe.ingredients.flatMap((group) => group.items.map((item) => item.name));
    const tags = recipe.tags ?? [];
    const elsewhere = words.filter((word) => !title.includes(word));
    const matching = (/** @type {string[]} */ texts) => {
      const folded = texts.map(fold);
      return texts.filter((_, i) => elsewhere.some((word) => folded[i]?.includes(word)));
    };
    const ingredients = matching(names);
    const tagged = matching(tags);
    const found = [...ingredients, ...tagged].map(fold);
    if (!elsewhere.every((word) => found.some((text) => text.includes(word)))) continue;
    (elsewhere.length === 0 ? byTitle : byContents).push({ recipe, ingredients: [...new Set(ingredients)], tags: tagged });
  }
  return [...byTitle, ...byContents];
}
