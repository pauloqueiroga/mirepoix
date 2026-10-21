import { searchRecipes } from '../../domain/search.js';
import { brand, h, logo } from '../dom.js';

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
      h('a', { class: 'chip warn', href: '#/backup', title: 'Recipes are saved in this browser, on this device. Tap to keep a copy.' },
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        'This device only')),
    h('main', { class: 'page' },
      ...(recipes.length === 0
        ? [h('div', { class: 'empty' },
          logo(),
          h('h2', null, 'No recipes yet'),
          h('p', null, 'Tap + to add your first one. Recipes are kept in this browser, on this device.'),
          h('p', { class: 'aside' }, 'Have an export from another device? ', h('a', { href: '#/backup' }, 'Import it')))]
        : searchable(recipes, query, remember))),
    h('a', { class: 'fab', href: '#/new', 'aria-label': 'New recipe', title: 'New recipe' }),
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
    placeholder: 'Search recipes or ingredients',
    'aria-label': 'Search recipes',
    autocomplete: 'off',
    enterkeyhint: 'search',
  });
  const count = h('p', { class: 'count', 'aria-live': 'polite' });
  const results = h('div', { class: 'results' });
  search.value = query;

  const show = () => {
    const found = searchRecipes(recipes, search.value);
    const words = search.value.trim();
    const total = `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}`;
    count.textContent = words ? `${found.length} of ${total}` : total;
    results.replaceChildren(found.length > 0
      ? h('ul', { class: 'list', 'aria-label': 'Recipes' }, ...found.map(row))
      : h('div', { class: 'empty' },
        h('h2', null, 'No matches'),
        h('p', null, `No title or ingredient matches “${words}”.`)));
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
  const detail = ingredients.length > 0 ? `with ${ingredients.join(', ')}` : recipe.source;
  return h('li', null,
    h('a', { href: `#/recipes/${encodeURIComponent(recipe.id)}` },
      h('div', { class: 'title' }, recipe.title),
      detail && h('div', { class: 'source' }, detail)));
}
