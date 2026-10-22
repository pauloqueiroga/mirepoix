import { analyticsActive, askForAnalytics, screenShown, startAnalytics } from '../analytics.js';
import { byTitle } from '../domain/recipe.js';
import { openLocalStore, requestPersistentStorage } from '../store/local-store.js';
import { t, uiLang } from './i18n.js';
import { matchRoute } from './router.js';
import { backupView } from './views/backup.js';
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
  { name: 'backup', path: '/backup' },
];

const NOT_FOUND = { title: t.recipeNotFound, text: t.recipeNotFoundText, back: true };

/**
 * Opens the device's recipes, then renders the screen for the current hash,
 * and again whenever it changes.
 * @param {HTMLElement} root
 */
export async function startApp(root) {
  document.documentElement.lang = uiLang;
  /** @type {import('../store/local-store.js').RecipeStore} */
  let store;
  try {
    store = await openLocalStore();
  } catch (error) {
    console.warn('Recipe storage is unavailable:', error);
    root.replaceChildren(...messageView({
      title: t.noStorage,
      text: t.noStorageText,
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
    let screen = 'not found'; // the only thing analytics ever hears about a screen (D14)
    // Recipe titles stay out of the tab title while analytics is on, so they can't leak.
    const named = (/** @type {string} */ recipeTitle, /** @type {string} */ generic) => (analyticsActive() ? generic : recipeTitle);
    if (route?.name === 'list') {
      const state = /** @type {{ query?: unknown } | null} */ (history.state);
      nodes = listView((await store.list()).sort(byTitle), {
        query: typeof state?.query === 'string' ? state.query : '',
        // The search lives in this history entry, not the address, so Back from
        // a recipe returns to it and it never shows up in analytics.
        remember: (query) => history.replaceState({ query }, ''),
      });
      screen = 'recipes';
    } else if (route?.name === 'new') {
      nodes = editorView({ lang: uiLang, save, leave: () => go('#/'), leaving });
      title = `${t.newRecipe} · Mirepoix`;
      screen = 'new recipe';
    } else if (route?.name === 'recipe') {
      const recipe = await store.get(id);
      nodes = recipe ? recipeView(recipe) : messageView(NOT_FOUND);
      if (recipe) {
        title = named(`${recipe.title} · Mirepoix`, `${t.recipe} · Mirepoix`);
        screen = 'recipe';
      }
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
      if (recipe) {
        title = named(`${t.editNamed(recipe.title)} · Mirepoix`, `${t.editRecipe} · Mirepoix`);
        screen = 'edit recipe';
      }
    } else if (route?.name === 'backup') {
      nodes = backupView({ count: (await store.list()).length, list: () => store.list(), put: save });
      title = `${t.keepACopy} · Mirepoix`;
      screen = 'keep a copy';
    } else {
      nodes = messageView({ title: t.pageNotFound, text: t.pageNotFoundText, back: true });
    }
    if (ticket !== latest) return;
    document.title = title;
    root.replaceChildren(...nodes);
    /** @type {HTMLElement | null} */ (root.querySelector('[autofocus]'))?.focus();
    scrollTo(0, 0);
    screenShown(screen);
  };

  addEventListener('hashchange', () => {
    if (leaving.unsaved() && !confirm(t.leaveUnsaved)) {
      history.pushState(null, '', shown); // stay put; pushState doesn't fire hashchange
      return;
    }
    void render();
  });
  addEventListener('beforeunload', (event) => {
    if (leaving.unsaved()) event.preventDefault();
  });
  startAnalytics();
  await render();
  askForAnalytics();
}
