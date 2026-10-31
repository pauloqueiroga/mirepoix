import { analyticsActive, askForAnalytics, screenShown, startAnalytics } from '../analytics.js';
import { addCooksNote } from '../domain/cooks-notes.js';
import { byTitle } from '../domain/recipe.js';
import { allTags } from '../domain/tags.js';
import { openLocalStore, requestPersistentStorage } from '../store/local-store.js';
import { t, uiLang } from './i18n.js';
import { matchRoute } from './router.js';
import { backupView } from './views/backup.js';
import { cookView } from './views/cook.js';
import { editorView } from './views/editor.js';
import { listView } from './views/list.js';
import { messageView } from './views/message.js';
import { recipeView } from './views/recipe.js';

/** @typedef {import('./views/list.js').Filters} Filters */
/**
 * What the app asks of the screen on show as it leaves: whether it holds
 * unsaved changes, which the editor and cook mode keep current so every way
 * out asks first (D10), and to let go of anything it holds, like cook mode's
 * hold on the screen.
 * @typedef {{ unsaved: () => boolean, stop: () => void }} Leaving
 */

/** @type {import('./router.js').RouteDef[]} */
const ROUTES = [
  { name: 'list', path: '/' },
  { name: 'new', path: '/new' },
  { name: 'recipe', path: '/recipes/:id' },
  { name: 'edit', path: '/recipes/:id/edit' },
  { name: 'cook', path: '/recipes/:id/cook' },
  { name: 'backup', path: '/backup' },
];

const NOT_FOUND = { title: t.recipeNotFound, text: t.recipeNotFoundText, back: true };

/** @returns {Leaving} */
const nothingToLeave = () => ({ unsaved: () => false, stop: () => {} });

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

  let leaving = nothingToLeave();
  let shown = location.hash;
  // What the list shows when the next screen is the list, e.g. one tag from a recipe.
  /** @type {Filters | null} */
  let arriving = null;
  /**
   * @param {string} hash
   * @param {Filters} [filters] for the list: the search and tags to show
   */
  const go = (hash, filters) => {
    arriving = filters ?? null;
    location.hash = hash;
  };

  let latest = 0;
  const render = async () => {
    const ticket = ++latest;
    shown = location.hash;
    const filters = arriving;
    arriving = null;
    // The screen on show is going, whatever comes next.
    leaving.stop();
    leaving = nothingToLeave();
    const next = nothingToLeave();
    const route = matchRoute(ROUTES, location.hash);
    const id = route?.params.id ?? '';
    const save = (/** @type {import('../domain/recipe.js').Recipe} */ recipe) => store.put(recipe);
    let nodes;
    let title = 'Mirepoix';
    let screen = 'not found'; // the only thing analytics ever hears about a screen (D14)
    // Recipe titles stay out of the tab title while analytics is on, so they can't leak.
    const named = (/** @type {string} */ recipeTitle, /** @type {string} */ generic) => (analyticsActive() ? generic : recipeTitle);
    if (route?.name === 'list') {
      // The search and tags live in this history entry, not the address, so
      // Back from a recipe returns to them and they never reach analytics (D14).
      if (filters) history.replaceState(filters, '');
      const state = /** @type {{ query?: unknown, tags?: unknown } | null} */ (history.state);
      nodes = listView((await store.list()).sort(byTitle), {
        query: typeof state?.query === 'string' ? state.query : '',
        tags: Array.isArray(state?.tags) ? state.tags.filter((tag) => typeof tag === 'string') : [],
        remember: (filters) => history.replaceState(filters, ''),
      });
      screen = 'recipes';
    } else if (route?.name === 'new') {
      nodes = editorView({ lang: uiLang, tags: allTags(await store.list()), save, leave: () => go('#/'), leaving: next });
      title = `${t.newRecipe} · Mirepoix`;
      screen = 'new recipe';
    } else if (route?.name === 'recipe') {
      const recipe = await store.get(id);
      nodes = recipe ? recipeView(recipe, { showTag: (tag) => go('#/', { query: '', tags: [tag] }) }) : messageView(NOT_FOUND);
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
          tags: allTags(await store.list()),
          save,
          remove: (recipeId) => store.remove(recipeId),
          leave: (outcome) => go(outcome === 'deleted' ? '#/' : `#/recipes/${encodeURIComponent(id)}`),
          leaving: next,
        })
        : messageView(NOT_FOUND);
      if (recipe) {
        title = named(`${t.editNamed(recipe.title)} · Mirepoix`, `${t.editRecipe} · Mirepoix`);
        screen = 'edit recipe';
      }
    } else if (route?.name === 'cook') {
      const recipe = await store.get(id);
      // The note goes on the recipe as it is now, not as cook mode opened it.
      const addNote = async (/** @type {string} */ text) => {
        const current = await store.get(id);
        if (!current) throw new Error(t.recipeNotFoundText);
        await store.put(addCooksNote(current, text));
      };
      nodes = recipe ? cookView(recipe, { addNote, leaving: next }) : messageView(NOT_FOUND);
      if (recipe) {
        title = named(`${t.cookingNamed(recipe.title)} · Mirepoix`, `${t.cookMode} · Mirepoix`);
        screen = 'cook mode';
      }
    } else if (route?.name === 'backup') {
      nodes = backupView({ count: (await store.list()).length, list: () => store.list(), put: save });
      title = `${t.keepACopy} · Mirepoix`;
      screen = 'keep a copy';
    } else {
      nodes = messageView({ title: t.pageNotFound, text: t.pageNotFoundText, back: true });
    }
    if (ticket !== latest) {
      next.stop();
      return;
    }
    leaving = next;
    document.title = title;
    root.replaceChildren(...nodes);
    /** @type {HTMLElement | null} */ (root.querySelector('[autofocus]'))?.focus();
    scrollTo(0, 0);
    screenShown(screen);
  };

  addEventListener('hashchange', () => {
    if (leaving.unsaved() && !confirm(t.leaveUnsaved)) {
      arriving = null;
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
