import { byTitle } from '../domain/recipe.js';
import { openLocalStore, requestPersistentStorage } from '../store/local-store.js';
import { matchRoute } from './router.js';
import { editorView } from './views/editor.js';
import { listView } from './views/list.js';
import { messageView } from './views/message.js';
import { recipeView } from './views/recipe.js';

/** @type {import('./router.js').RouteDef[]} */
const ROUTES = [
  { name: 'list', path: '/' },
  { name: 'new', path: '/new' },
  { name: 'recipe', path: '/recipes/:id' },
  { name: 'edit', path: '/recipes/:id/edit' },
];

const NOT_FOUND = { title: 'Recipe not found', text: 'It may have been deleted, or the address is wrong.', back: true };

/**
 * Opens the device's recipes, then renders the screen for the current hash,
 * and again whenever it changes.
 * @param {HTMLElement} root
 */
export async function startApp(root) {
  /** @type {import('../store/local-store.js').RecipeStore} */
  let store;
  try {
    store = await openLocalStore();
  } catch (error) {
    console.warn('Recipe storage is unavailable:', error);
    root.replaceChildren(...messageView({
      title: 'This browser can’t keep recipes',
      text: 'Private browsing or blocked site data stops Mirepoix from saving. Try a regular window, or allow this site to store data.',
    }));
    return;
  }
  void requestPersistentStorage();

  // Whether the screen on show holds unsaved changes. The editor keeps this
  // current, so every way out asks first: links, the back button, closing (D10).
  const leaving = { unsaved: () => false };
  let shown = location.hash;
  /** @param {string} hash */
  const go = (hash) => {
    location.hash = hash;
  };

  let latest = 0;
  const render = async () => {
    const ticket = ++latest;
    shown = location.hash;
    leaving.unsaved = () => false;
    const route = matchRoute(ROUTES, location.hash);
    const id = route?.params.id ?? '';
    const save = (/** @type {import('../domain/recipe.js').Recipe} */ recipe) => store.put(recipe);
    let nodes;
    let title = 'Mirepoix';
    if (route?.name === 'list') {
      nodes = listView((await store.list()).sort(byTitle), {
        query: route.query.q ?? '',
        // Keep the search in the address, so Back from a recipe returns to it.
        remember: (query) => history.replaceState(null, '', query.trim() ? `#/?q=${encodeURIComponent(query)}` : '#/'),
      });
    } else if (route?.name === 'new') {
      nodes = editorView({ lang: preferredLang(), save, leave: () => go('#/'), leaving });
      title = 'New recipe · Mirepoix';
    } else if (route?.name === 'recipe') {
      const recipe = await store.get(id);
      nodes = recipe ? recipeView(recipe) : messageView(NOT_FOUND);
      if (recipe) title = `${recipe.title} · Mirepoix`;
    } else if (route?.name === 'edit') {
      const recipe = await store.get(id);
      nodes = recipe
        ? editorView({
          lang: recipe.lang,
          recipe,
          save,
          remove: (recipeId) => store.remove(recipeId),
          leave: (outcome) => go(outcome === 'deleted' ? '#/' : `#/recipes/${encodeURIComponent(id)}`),
          leaving,
        })
        : messageView(NOT_FOUND);
      if (recipe) title = `Edit ${recipe.title} · Mirepoix`;
    } else {
      nodes = messageView({ title: 'Page not found', text: 'That address doesn’t match anything in Mirepoix.', back: true });
    }
    if (ticket !== latest) return;
    document.title = title;
    root.replaceChildren(...nodes);
    /** @type {HTMLElement | null} */ (root.querySelector('[autofocus]'))?.focus();
    scrollTo(0, 0);
  };

  addEventListener('hashchange', () => {
    if (leaving.unsaved() && !confirm('Leave without saving? Your changes will be lost.')) {
      history.pushState(null, '', shown); // stay put; pushState doesn't fire hashchange
      return;
    }
    void render();
  });
  addEventListener('beforeunload', (event) => {
    if (leaving.unsaved()) event.preventDefault();
  });
  await render();
}

/** Portuguese for browsers set to Portuguese, English otherwise. */
function preferredLang() {
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}
