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
];

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

  const home = () => {
    location.hash = '#/';
  };

  let latest = 0;
  const render = async () => {
    const ticket = ++latest;
    const route = matchRoute(ROUTES, location.hash);
    let nodes;
    let title = 'Mirepoix';
    if (route?.name === 'list') {
      nodes = listView((await store.list()).sort(byTitle));
    } else if (route?.name === 'new') {
      nodes = editorView({ lang: preferredLang(), save: (recipe) => store.put(recipe), close: home });
      title = 'New recipe · Mirepoix';
    } else if (route?.name === 'recipe') {
      const recipe = await store.get(route.params.id ?? '');
      nodes = recipe
        ? recipeView(recipe)
        : messageView({ title: 'Recipe not found', text: 'It may have been deleted, or the address is wrong.', back: true });
      if (recipe) title = `${recipe.title} · Mirepoix`;
    } else {
      nodes = messageView({ title: 'Page not found', text: 'That address doesn’t match anything in Mirepoix.', back: true });
    }
    if (ticket !== latest) return;
    document.title = title;
    root.replaceChildren(...nodes);
    /** @type {HTMLElement | null} */ (root.querySelector('[autofocus]'))?.focus();
    scrollTo(0, 0);
  };
  addEventListener('hashchange', () => void render());
  await render();
}

/** Portuguese for browsers set to Portuguese, English otherwise. */
function preferredLang() {
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}
