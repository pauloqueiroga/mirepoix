import { searchRecipes } from '../../domain/search.js';
import { allTags, sameTag, withTags } from '../../domain/tags.js';
import { brand, footer, h, logo } from '../dom.js';
import { t } from '../i18n.js';
import { syncChip } from './sync.js';

/** @typedef {import('../../domain/recipe.js').Recipe} Recipe */
/** @typedef {import('../../domain/search.js').Found} Found */
/** @typedef {import('../../store/sync.js').SyncStatus} SyncStatus */
/** @typedef {{ query: string, tags: string[] }} Filters  what narrows the list: words to search for, tags to have */

/** @type {SyncStatus} */
const OFF = { state: 'off', problem: null, pending: 0, unreadable: 0, progress: null, lastSynced: null };

/**
 * The home screen: every recipe on this device, in the order given, with a
 * search box that filters as you type (R1.10), the tags in use, to show only
 * the recipes that have them (R3.5), and how syncing goes (R2.5).
 * @param {Recipe[]} recipes
 * @param {{ query?: string, tags?: string[], remember?: (filters: Filters) => void, status?: SyncStatus }} [options]
 *   query and tags: the filters to start with; remember: told every change,
 *   so the filters can survive opening a recipe and coming back; status: syncing's
 */
export function listView(recipes, { query = '', tags = [], remember = () => {}, status = OFF } = {}) {
  return [
    h('header', { class: 'bar' },
      h('h1', { class: 'wordmark' }, brand()),
      syncChip(status)),
    h('main', { class: 'page' },
      ...(recipes.length === 0
        ? [h('div', { class: 'empty' },
          logo(),
          h('h2', null, t.noRecipes),
          h('p', null, status.state === 'off' ? t.noRecipesText : t.noRecipesSyncedText),
          h('p', { class: 'aside' }, t.haveExport, h('a', { href: '#/backup' }, t.importIt)))]
        : searchable(recipes, { query, tags }, remember)),
      footer()),
    h('a', { class: 'fab', href: '#/new', 'aria-label': t.newRecipe, title: t.newRecipe }),
  ];
}

/**
 * @param {Recipe[]} recipes
 * @param {Filters} filters
 * @param {(filters: Filters) => void} remember
 */
function searchable(recipes, { query, tags }, remember) {
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

  // Tags no recipe has any more drop out of the filter.
  const known = allTags(recipes);
  let picked = known.filter((tag) => tags.some((wanted) => sameTag(tag, wanted)));

  const show = () => {
    const found = searchRecipes(withTags(recipes, picked), search.value);
    const words = search.value.trim();
    const total = t.recipeCount(recipes.length);
    count.textContent = words || picked.length > 0 ? t.foundOf(found.length, total) : total;
    results.replaceChildren(found.length > 0
      ? h('ul', { class: 'list', 'aria-label': t.recipes }, ...found.map(row))
      : h('div', { class: 'empty' },
        h('h2', null, t.noMatches),
        h('p', null, picked.length > 0 ? t.noMatchesTagged(words) : t.noMatchesText(words))));
  };
  const changed = () => {
    show();
    remember({ query: search.value, tags: picked });
  };
  search.addEventListener('input', changed);

  const chips = known.map((tag) => h('button', {
    type: 'button',
    class: 'tag',
    'aria-pressed': String(picked.includes(tag)),
    onclick: (event) => {
      const on = !picked.includes(tag);
      picked = on ? [...picked, tag] : picked.filter((other) => other !== tag);
      /** @type {HTMLElement} */ (event.currentTarget).setAttribute('aria-pressed', String(on));
      changed();
    },
  }, h('span', null, tag)));
  show();

  return [
    h('div', { class: 'search-bar' },
      search,
      chips.length > 0 && h('div', { class: 'tag-filter', role: 'group', 'aria-label': t.filterByTag }, ...chips),
      count),
    results,
  ];
}

/** @param {Found} found */
function row({ recipe, ingredients, tags }) {
  const matched = [ingredients.length > 0 && t.withIngredients(ingredients), tags.length > 0 && t.tagged(tags)].filter(Boolean).join(' · ');
  const detail = matched || recipe.source;
  return h('li', null,
    h('a', { href: `#/recipes/${encodeURIComponent(recipe.id)}` },
      h('div', { class: 'title' }, recipe.title),
      detail && h('div', { class: 'source' }, detail)));
}
