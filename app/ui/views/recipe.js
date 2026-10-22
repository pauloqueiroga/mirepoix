import { displayAmount } from '../../domain/ingredients.js';
import { h } from '../dom.js';
import { t } from '../i18n.js';

/** @typedef {import('../../domain/recipe.js').Recipe} Recipe */
/** @typedef {import('../../domain/recipe.js').Ingredient} Ingredient */
/** @typedef {import('../../domain/recipe.js').IngredientGroup} IngredientGroup */
/** @typedef {import('../../domain/recipe.js').StepGroup} StepGroup */
/** @typedef {import('../../domain/recipe.js').Lang} Lang */
/** @typedef {import('../dom.js').Child} Child */

/**
 * A recipe to read (R1.7, R1.8). Nothing on this screen changes it; the quiet
 * Edit link in the corner opens the editor (D10).
 * @param {Recipe} recipe
 */
export function recipeView(recipe) {
  const { lang } = recipe;
  const meta = [recipe.source, recipe.yield && t.makes(recipe.yield)].filter(Boolean).join(' · ');
  const ingredients = recipe.ingredients.filter((group) => group.heading || group.items.length > 0);
  const preparation = recipe.preparation.filter((group) => group.heading || group.steps.length > 0);
  return [
    h('header', { class: 'bar' },
      h('a', { class: 'back', href: '#/' }, t.recipes),
      h('a', { class: 'edit-link', href: `#/recipes/${encodeURIComponent(recipe.id)}/edit` }, t.edit)),
    h('main', { class: 'page recipe' },
      h('h1', { class: 'recipe-title', lang }, recipe.title),
      meta && h('p', { class: 'meta', lang }, meta),
      section('ingredients', t.ingredients,
        ingredients.length > 0
          ? h('div', { class: 'ingredient-groups' }, ...ingredients.flatMap((group) => ingredientGroup(group, lang)))
          : h('p', { class: 'nothing-yet' }, t.noIngredients)),
      preparation.length > 0 && section('preparation', t.preparation, ...stepGroups(preparation, lang)),
      recipe.variations.length > 0 && section('variations', t.variations,
        h('ul', { class: 'bullets', lang }, ...recipe.variations.map((variation) => h('li', null, variation)))),
      recipe.notes.length > 0 && section('notes', t.notes,
        ...recipe.notes.map((note) => h('p', { class: 'note-text', lang }, note)))),
  ];
}

/**
 * @param {string} id
 * @param {string} label
 * @param {...Child} content
 */
function section(id, label, ...content) {
  return h('section', { class: 'recipe-section', 'aria-labelledby': `${id}-heading` },
    h('h2', { id: `${id}-heading`, class: 'section-label' }, label),
    ...content);
}

/**
 * @param {IngredientGroup} group
 * @param {Lang} lang
 */
function ingredientGroup({ heading, items }, lang) {
  return [
    heading && h('h3', { class: 'group-heading', lang }, heading),
    h('ul', { class: 'ingredients', lang, 'aria-label': heading || t.ingredients }, ...items.map((item) => ingredientRow(item, lang))),
  ];
}

/**
 * @param {Ingredient} ingredient
 * @param {Lang} lang
 */
function ingredientRow(ingredient, lang) {
  return h('li', null,
    h('span', { class: 'amount' },
      displayAmount(ingredient, lang),
      ...ingredient.alternatives.map((alternative) => h('span', { class: 'alt' }, t.or(displayAmount(alternative, lang))))),
    h('span', { class: 'name' },
      ingredient.name,
      ingredient.note && h('span', { class: 'note' }, `, ${ingredient.note}`)));
}

/**
 * Steps are numbered straight through the groups, so "step 5" means one thing.
 * The editor's preview uses this too, so it shows exactly what will be saved.
 * @param {StepGroup[]} groups
 * @param {Lang} lang
 */
export function stepGroups(groups, lang) {
  let next = 1;
  return groups.flatMap(({ heading, steps }) => {
    const start = next;
    next += steps.length;
    return [
      heading && h('h3', { class: 'group-heading', lang }, heading),
      steps.length > 0 && h('ol', { class: 'steps', lang, start: String(start), 'aria-label': heading || t.steps },
        ...steps.map((step) => h('li', null, step))),
    ];
  });
}
