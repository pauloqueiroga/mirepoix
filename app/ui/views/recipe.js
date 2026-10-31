import { lastCooksNote, newestFirst } from '../../domain/cooks-notes.js';
import { displayAmount } from '../../domain/ingredients.js';
import { tagsOf } from '../../domain/tags.js';
import { h } from '../dom.js';
import { formatDay, t } from '../i18n.js';

/** @typedef {import('../../domain/recipe.js').Recipe} Recipe */
/** @typedef {import('../../domain/recipe.js').Ingredient} Ingredient */
/** @typedef {import('../../domain/recipe.js').IngredientGroup} IngredientGroup */
/** @typedef {import('../../domain/recipe.js').StepGroup} StepGroup */
/** @typedef {import('../../domain/recipe.js').Lang} Lang */
/** @typedef {import('../dom.js').Child} Child */

/**
 * A recipe to read (R1.7, R1.8). Nothing on this screen changes it; the quiet
 * Edit link in the corner opens the editor (D10), and Start cooking opens
 * cook mode (R3.1), the one place to leave a note for next time.
 * @param {Recipe} recipe
 * @param {{ showTag: (tag: string) => void }} options
 *   showTag: opens the list showing just the recipes with that tag (R3.5)
 */
export function recipeView(recipe, { showTag }) {
  const { lang } = recipe;
  const meta = [recipe.source, recipe.yield && t.makes(recipe.yield)].filter(Boolean).join(' · ');
  const tags = tagsOf(recipe);
  // "Last time" shows the newest; the whole log is worth a section once there's more than that.
  const log = recipe.cooksNotes.length > 1 ? newestFirst(recipe) : [];
  return [
    h('header', { class: 'bar' },
      h('a', { class: 'back', href: '#/' }, t.recipes),
      h('a', { class: 'edit-link', href: `#/recipes/${encodeURIComponent(recipe.id)}/edit` }, t.edit)),
    h('main', { class: 'page recipe' },
      h('h1', { class: 'recipe-title', lang }, recipe.title),
      meta && h('p', { class: 'meta', lang }, meta),
      tags.length > 0 && h('ul', { class: 'tag-list', 'aria-label': t.tags },
        ...tags.map((tag) => h('li', null,
          h('a', {
            class: 'tag',
            href: '#/',
            lang,
            title: t.seeTagged(tag),
            onclick: (event) => {
              event.preventDefault();
              showTag(tag);
            },
          }, h('span', null, tag))))),
      lastTime(recipe),
      ...recipeSections(recipe),
      log.length > 0 && section('cooks-notes', t.cooksNotes,
        h('ul', { class: 'cooks-notes' }, ...log.map((note) => h('li', null,
          h('time', { datetime: note.at }, formatDay(new Date(note.at))),
          h('p', null, note.text)))))),
    h('div', { class: 'foot' },
      h('a', { class: 'button primary wide pot', href: `#/recipes/${encodeURIComponent(recipe.id)}/cook` }, t.startCooking)),
  ];
}

/**
 * Ingredients, Preparation, Variations and Notes, as a recipe shows them.
 * @param {Recipe} recipe
 */
function recipeSections(recipe) {
  const { lang } = recipe;
  const ingredients = recipe.ingredients.filter((group) => group.heading || group.items.length > 0);
  const preparation = recipe.preparation.filter((group) => group.heading || group.steps.length > 0);
  return [
    section('ingredients', t.ingredients,
      ingredients.length > 0
        ? h('div', { class: 'ingredient-groups' }, ...ingredients.flatMap((group) => ingredientGroup(group, lang)))
        : h('p', { class: 'nothing-yet' }, t.noIngredients)),
    preparation.length > 0 && section('preparation', t.preparation, ...stepGroups(preparation, lang)),
    ...extras(recipe),
  ];
}

/**
 * Variations and Notes, the parts cook mode shows as they are.
 * @param {Recipe} recipe
 */
export function extras({ variations, notes, lang }) {
  return [
    variations.length > 0 && section('variations', t.variations,
      h('ul', { class: 'bullets', lang }, ...variations.map((variation) => h('li', null, variation)))),
    notes.length > 0 && section('notes', t.notes,
      ...notes.map((note) => h('p', { class: 'note-text', lang }, note))),
  ];
}

/**
 * The newest cook's note, near the top, so it's read before cooking (R3.3).
 * Notes are in whatever language their writer used, so they carry no lang.
 * @param {Recipe} recipe
 */
export function lastTime(recipe) {
  const note = lastCooksNote(recipe);
  return note && h('aside', { class: 'last-time', 'aria-labelledby': 'last-time-label' },
    h('p', { id: 'last-time-label', class: 'last-time-label' },
      t.lastTime, ' · ', h('time', { datetime: note.at }, formatDay(new Date(note.at)))),
    h('p', { class: 'last-time-text' }, note.text));
}

/**
 * @param {string} id
 * @param {string} label
 * @param {...Child} content
 */
export function section(id, label, ...content) {
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
