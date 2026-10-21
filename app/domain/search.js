// Search (R1.10): titles and ingredient names, ignoring case and accents, so
// "pao" finds "Pão de queijo" and "acucar" finds "açúcar".

/** @typedef {import('./recipe.js').Recipe} Recipe */
/** @typedef {{ recipe: Recipe, ingredients: string[] }} Found  ingredients: the names that matched, when the title alone didn't */

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
  const byIngredient = [];
  for (const recipe of recipes) {
    const title = fold(recipe.title);
    const names = recipe.ingredients.flatMap((group) => group.items.map((item) => item.name));
    const folded = names.map(fold);
    const elsewhere = words.filter((word) => !title.includes(word));
    if (!elsewhere.every((word) => folded.some((name) => name.includes(word)))) continue;
    const ingredients = names.filter((_, i) => elsewhere.some((word) => folded[i]?.includes(word)));
    (elsewhere.length === 0 ? byTitle : byIngredient).push({ recipe, ingredients: [...new Set(ingredients)] });
  }
  return [...byTitle, ...byIngredient];
}
