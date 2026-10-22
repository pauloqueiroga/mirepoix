import { searchRecipes } from '../../domain/search.js';
import { brand, footer, h, logo } from '../dom.js';
import { t } from '../i18n.js';

/** @typedef {import('../../domain/recipe.js').Recipe} Recipe */
/** @typedef {import('../../domain/search.js').Found} Found */

/**
 * The home screen: every recipe on this device, in the order given, with a
 * search box that filters as you type (R1.10).
 * @param {Recipe[]} recipes
 * @param {{ query?: string, remember?: (query: string) => void }} [options]
 *   query: the search to start with; remember: told every change, so the
 *   search can survive opening a recipe and coming back
 */
export function listView(recipes, { query = '', remember = () => {} } = {}) {
  return [
    h('header', { class: 'bar' },
      h('h1', { class: 'wordmark' }, brand()),
      h('a', { class: 'chip warn', href: '#/backup', title: t.thisDeviceOnlyTip },
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        t.thisDeviceOnly)),
    h('main', { class: 'page' },
      ...(recipes.length === 0
        ? [h('div', { class: 'empty' },
          logo(),
          h('h2', null, t.noRecipes),
          h('p', null, t.noRecipesText),
          h('p', { class: 'aside' }, t.haveExport, h('a', { href: '#/backup' }, t.importIt)))]
        : searchable(recipes, query, remember)),
      footer()),
    h('a', { class: 'fab', href: '#/new', 'aria-label': t.newRecipe, title: t.newRecipe }),
  ];
}

/**
 * @param {Recipe[]} recipes
 * @param {string} query
 * @param {(query: string) => void} remember
 */
function searchable(recipes, query, remember) {
  const search = h('input', {
    type: 'search',
    class: 'search',
    placeholder: t.searchPlaceholder,
    'aria-label': t.searchLabel,
    autocomplete: 'off',
    enterkeyhint: 'search',
  });
  const count = h('p', { class: 'count', 'aria-live': 'polite' });
  const results = h('div', { class: 'results' });
  search.value = query;

  const show = () => {
    const found = searchRecipes(recipes, search.value);
    const words = search.value.trim();
    const total = t.recipeCount(recipes.length);
    count.textContent = words ? t.foundOf(found.length, total) : total;
    results.replaceChildren(found.length > 0
      ? h('ul', { class: 'list', 'aria-label': t.recipes }, ...found.map(row))
      : h('div', { class: 'empty' },
        h('h2', null, t.noMatches),
        h('p', null, t.noMatchesText(words))));
  };
  search.addEventListener('input', () => {
    show();
    remember(search.value);
  });
  show();

  return [h('div', { class: 'search-bar' }, search, count), results];
}

/** @param {Found} found */
function row({ recipe, ingredients }) {
  const detail = ingredients.length > 0 ? t.withIngredients(ingredients) : recipe.source;
  return h('li', null,
    h('a', { href: `#/recipes/${encodeURIComponent(recipe.id)}` },
      h('div', { class: 'title' }, recipe.title),
      detail && h('div', { class: 'source' }, detail)));
}
