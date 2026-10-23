import { analyticsActive, askForAnalytics, screenShown, startAnalytics } from '../analytics.js';
import { fingerprint } from '../domain/fingerprint.js';
import { byTitle } from '../domain/recipe.js';
import { openLocalStore, requestPersistentStorage } from '../store/local-store.js';
import { createSyncer, deviceName } from '../store/sync.js';
import { t, uiLang } from './i18n.js';
import { matchRoute } from './router.js';
import { backupView } from './views/backup.js';
import { editorView } from './views/editor.js';
import { listView } from './views/list.js';
import { messageView } from './views/message.js';
import { recipeView } from './views/recipe.js';
import { syncChip, syncView } from './views/sync.js';

/** @typedef {import('../domain/recipe.js').Recipe} Recipe */

/** @type {import('./router.js').RouteDef[]} */
const ROUTES = [
  { name: 'list', path: '/' },
  { name: 'new', path: '/new' },
  { name: 'recipe', path: '/recipes/:id' },
  { name: 'edit', path: '/recipes/:id/edit' },
  { name: 'backup', path: '/backup' },
  { name: 'sync', path: '/sync' },
];

const NOT_FOUND = { title: t.recipeNotFound, text: t.recipeNotFoundText, back: true };
// After a save, a short pause lets a burst of edits go up together.
const SAVE_PAUSE = 1500;
// While the app is open, it checks for others' changes now and then (R2.3).
const CHECK_EVERY = 5 * 60_000;

/**
 * Opens the device's recipes, then renders the screen for the current hash,
 * and again whenever it changes.
 * @param {HTMLElement} root
 */
export async function startApp(root) {
  document.documentElement.lang = uiLang;
  /** @type {import('../store/local-store.js').LocalStore} */
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

  // Syncing (R2) runs beside the screens and never holds them up (D4).
  const syncer = createSyncer({ store, conflictTitle: t.conflictTitle });
  await syncer.refresh();
  let pause = 0;
  const syncSoon = async () => {
    await syncer.refresh();
    clearTimeout(pause);
    pause = setTimeout(() => void syncer.run(), SAVE_PAUSE);
  };

  // Whether the screen on show holds unsaved changes. The editor keeps this
  // current, so every way out asks first: links, the back button, closing (D10).
  const leaving = { unsaved: () => false };
  // What the screen on show needs done when it goes away.
  /** @type {(() => void)[]} */
  let cleanups = [];
  let shown = location.hash;
  /** @param {string} hash */
  const go = (hash) => {
    location.hash = hash;
  };

  /** @param {Recipe} recipe */
  const save = async (recipe) => {
    await store.put(recipe);
    await syncSoon();
  };
  /** @param {string} id */
  const remove = async (id) => {
    await store.remove(id);
    await syncSoon();
  };

  let latest = 0;
  /** @param {{ keepScroll?: boolean }} [options] */
  const render = async ({ keepScroll = false } = {}) => {
    const ticket = ++latest;
    for (const cleanup of cleanups) cleanup();
    cleanups = [];
    shown = location.hash;
    leaving.unsaved = () => false;
    const route = matchRoute(ROUTES, location.hash);
    const id = route?.params.id ?? '';
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
        status: syncer.status,
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
      let landed = id;
      nodes = recipe
        ? editorView({
          lang: recipe.lang,
          recipe,
          // If the recipe changed on another device while this one was being
          // edited, theirs stays and this edit is kept beside it (D6).
          save: async (edited) => {
            const now = await store.get(id);
            if (now && fingerprint(now) !== fingerprint(recipe)) {
              const at = new Date();
              const device = deviceName(navigator.userAgent, navigator.maxTouchPoints);
              edited = { ...edited, id: crypto.randomUUID(), title: t.conflictTitle(edited.title, device, at), createdAt: at.toISOString() };
            }
            await save(edited);
            landed = edited.id;
          },
          remove,
          leave: (outcome) => go(outcome === 'deleted' ? '#/' : `#/recipes/${encodeURIComponent(landed)}`),
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
    } else if (route?.name === 'sync') {
      const connection = await store.setting('connection');
      nodes = syncView(connection, {
        store,
        syncer,
        onLeave: (cleanup) => cleanups.push(cleanup),
        done: () => go('#/'),
        again: () => void render(),
      });
      title = `${connection ? t.sync : t.connectThisDevice} · Mirepoix`;
      screen = 'sync';
    } else {
      nodes = messageView({ title: t.pageNotFound, text: t.pageNotFoundText, back: true });
    }
    if (ticket !== latest) return;
    document.title = title;
    root.replaceChildren(...nodes);
    if (keepScroll) return;
    /** @type {HTMLElement | null} */ (root.querySelector('[autofocus]'))?.focus();
    scrollTo(0, 0);
    screenShown(screen);
  };

  // The chip follows every change of status; screens that show recipes follow
  // what syncing brings in, unless someone is typing in them.
  syncer.listen((status, changed) => {
    for (const chip of document.querySelectorAll('a.sync-chip')) chip.replaceWith(syncChip(status));
    if (!changed) return;
    const route = matchRoute(ROUTES, location.hash)?.name;
    const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
    if ((route === 'list' || route === 'recipe') && !typing) void render({ keepScroll: true });
  });

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
  addEventListener('online', () => void syncer.run());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncer.run();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncer.run();
  }, CHECK_EVERY);
  startAnalytics();
  await render();
  askForAnalytics();
  void syncer.run();
}
