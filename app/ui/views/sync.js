import { connect, deviceName, problemOf, reopenVault, replaceToken } from '../../store/sync.js';
import { footer, h } from '../dom.js';
import { t, uiLang } from '../i18n.js';

/** @typedef {import('../../store/sync.js').SyncStatus} SyncStatus */
/** @typedef {import('../../store/sync.js').Connection} Connection */
/** @typedef {import('../../store/local-store.js').LocalStore} LocalStore */
/**
 * What the sync screen needs from the app.
 * @typedef {object} Syncing
 * @property {LocalStore} store
 * @property {{
 *   status: SyncStatus,
 *   run: () => Promise<void>,
 *   listen: (listener: (status: SyncStatus) => void) => () => void,
 *   disconnect: () => Promise<void>,
 * }} syncer
 * @property {(cleanup: () => void) => void} onLeave called when the screen goes away
 * @property {() => void} done connecting finished: show the recipes
 * @property {() => void} again show this screen again, e.g. once connected or disconnected
 */

/**
 * The chip in the corner of the list (R2.5): whether this device syncs, and
 * how that's going. It leads to the sync screen.
 * @param {SyncStatus} status
 * @param {{ link?: boolean }} [options] link: false for the copy on the sync screen itself
 */
export function syncChip({ state, problem, pending }, { link = true } = {}) {
  /** @type {[string, string]} */
  const [tone, label] = state === 'off' ? ['warn', t.thisDeviceOnly]
    : state === 'offline' ? ['warn', t.offline]
      : state === 'stuck' ? ['alert', (problem && t.chipProblems[problem]) || t.syncProblem]
        // Changes waiting to go up are on their way: a pass follows every save.
        : state === 'syncing' || pending > 0 ? ['neutral', t.syncing]
          : ['ok', t.synced];
  const content = [h('span', { class: 'dot', 'aria-hidden': 'true' }), label];
  return link
    ? h('a', { class: `chip ${tone} sync-chip`, href: '#/sync', title: state === 'off' ? t.thisDeviceOnlyTip : t.syncTip }, ...content)
    : h('span', { class: `chip ${tone}` }, ...content);
}

/**
 * The sync screen (R2.4, R2.5): connect this device, or see how syncing goes
 * and fix what stops it.
 * @param {Connection | undefined} connection
 * @param {Syncing} syncing
 */
export function syncView(connection, syncing) {
  return [
    h('header', { class: 'bar' },
      h('a', { class: 'back', href: '#/' }, t.recipes)),
    h('main', { class: 'page sync' },
      h('h1', { class: 'recipe-title' }, connection ? t.sync : t.connectThisDevice),
      ...(connection ? statusPart(connection, syncing) : connectPart(syncing)),
      h('p', { class: 'aside' }, h('a', { href: '#/backup' }, t.keepACopyLink)),
      footer()),
  ];
}

/**
 * Start fresh or join (R2.4). The passphrase is only ever in the form while
 * it's being typed; the device keeps the key it gives (D7).
 * @param {Syncing} syncing
 */
function connectPart({ store, syncer, onLeave, done, again }) {
  /** @param {'join' | 'fresh'} value @param {string} label */
  const choice = (value, label) =>
    h('label', null, h('input', { type: 'radio', name: 'mode', value, checked: value === 'join' }), h('span', null, label));
  const modes = h('fieldset', { class: 'field' },
    h('legend', { class: 'visually-hidden' }, t.connectThisDevice),
    h('div', { class: 'segmented' }, choice('join', t.joinMine), choice('fresh', t.startFresh)),
    h('p', { class: 'hint' }, t.modeHint));
  const fresh = () => /** @type {HTMLInputElement | null} */ (modes.querySelector('input:checked'))?.value === 'fresh';

  const secret = { type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' };
  const repository = h('input', { id: 'repository', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: t.repositoryPlaceholder });
  const token = h('input', { id: 'token', class: 'mono', ...secret });
  const passphrase = h('input', { id: 'passphrase', ...secret, 'aria-describedby': 'passphrase-hint' });
  const repeat = h('input', { id: 'passphrase-again', ...secret });
  const passphraseHint = h('p', { id: 'passphrase-hint', class: 'hint' });
  const repeatField = h('div', { class: 'field' }, h('label', { for: 'passphrase-again' }, t.passphraseAgain), repeat);
  const alert = h('p', { class: 'alert', role: 'alert', hidden: true });
  const button = h('button', { type: 'submit', class: 'button primary' }, t.connect);
  const checks = h('ul', { class: 'checks', 'aria-live': 'polite' });

  const showMode = () => {
    repeatField.hidden = !fresh();
    passphraseHint.className = fresh() ? 'hint warn' : 'hint';
    passphraseHint.textContent = fresh() ? t.passphraseWarn : t.passphraseJoinHint;
  };
  modes.addEventListener('change', showMode);
  showMode();

  /** @param {string} text @param {boolean} [working] */
  const check = (text, working = false) => {
    const item = h('li', { class: working ? 'working' : 'done' }, text);
    checks.append(item);
    return item;
  };
  /** @param {string} message */
  const fail = (message) => {
    alert.textContent = message;
    alert.hidden = false;
    button.disabled = false;
    button.textContent = t.connect;
  };

  /** @param {Event} event */
  const submit = async (event) => {
    event.preventDefault();
    alert.hidden = true;
    checks.replaceChildren();
    if (!repository.value.trim() || !token.value.trim() || !passphrase.value) return fail(t.fillIn);
    if (fresh() && repeat.value !== passphrase.value) return fail(t.passphrasesDiffer);
    button.disabled = true;
    button.textContent = t.connecting;
    const mode = fresh() ? 'fresh' : 'join';
    try {
      await connect({
        store,
        mode,
        repository: repository.value,
        token: token.value,
        passphrase: passphrase.value,
        device: deviceName(navigator.userAgent, navigator.maxTouchPoints),
        step: (step) => check(step === 'repository' ? t.stepRepository : mode === 'fresh' ? t.stepPassphraseFresh : t.stepPassphraseJoin),
      });
    } catch (error) {
      const problem = problemOf(error);
      if (!problem) console.warn('Connecting failed:', error);
      return fail(problem ? t.problems[problem] : String(error));
    }
    passphrase.value = '';
    repeat.value = '';
    // The first sync: everyone else's recipes come down, and this device's go up.
    const progress = check(t.syncing, true);
    const stop = syncer.listen((status) => {
      if (status.progress) progress.textContent = t.stepSyncing(status.progress.done, status.progress.total);
    });
    onLeave(stop);
    await syncer.run();
    stop();
    if (syncer.status.state === 'synced') {
      progress.className = 'done';
      progress.textContent = t.stepDone;
      done();
    } else {
      again();
    }
  };

  return [
    h('p', { class: 'lead secure' }, h('span', null, t.connectLead)),
    h('form', { class: 'connect', novalidate: true, onsubmit: submit },
      modes,
      h('div', { class: 'field' },
        h('label', { for: 'repository' }, t.repository), repository),
      h('div', { class: 'field' },
        h('label', { for: 'token' }, t.token), token,
        h('p', { class: 'hint' }, t.tokenHint)),
      h('details', { class: 'how' },
        h('summary', null, t.howTo),
        h('ol', null, ...t.howToSteps.map((step) => h('li', null, step))),
        h('p', { class: 'caveat' }, t.howToCaveat),
        h('p', null,
          h('a', { href: 'https://github.com/new', target: '_blank', rel: 'noopener' }, t.createRepository),
          ' · ',
          h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, t.createToken))),
      h('div', { class: 'field' },
        h('label', { for: 'passphrase' }, t.passphrase), passphrase, passphraseHint),
      repeatField,
      alert,
      button,
      checks),
  ];
}

/**
 * How syncing goes on a connected device (R2.5), what to do when it's stuck,
 * and a way to stop.
 * @param {Connection} connection
 * @param {Syncing} syncing
 */
function statusPart(connection, { store, syncer, onLeave, again }) {
  const box = h('div', { class: 'sync-status', role: 'status' });
  const fix = h('div', { class: 'fix' });
  /** @type {'token' | 'passphrase' | null} */
  let fixing = null;
  const when = new Intl.DateTimeFormat(uiLang, { dateStyle: 'medium', timeStyle: 'short' });

  /** @param {SyncStatus} status */
  const show = (status) => {
    const { state, problem, pending, unreadable, progress, lastSynced } = status;
    box.replaceChildren(...[
      h('p', { class: 'status-line' },
        syncChip(status, { link: false }),
        ' ',
        progress && state === 'syncing' ? t.stepSyncing(progress.done, progress.total) : lastSynced ? t.lastSynced(when.format(new Date(lastSynced))) : t.notSyncedYet),
      state === 'offline' && h('p', null, t.offlineNote),
      state === 'stuck' && problem && h('p', { class: 'alert' },
        problem === 'wrong-passphrase' ? t.passphraseChanged : t.problems[problem]),
      pending > 0 && h('p', null, t.pendingChanges(pending)),
      unreadable > 0 && h('p', null, t.unreadable(unreadable)),
    ].filter((node) => node instanceof Node));
    const needs = state !== 'stuck' ? null
      : problem === 'unauthorized' || problem === 'forbidden' || problem === 'not-found' ? 'token'
        : problem === 'wrong-passphrase' ? 'passphrase' : null;
    if (needs !== fixing) {
      fixing = needs;
      fix.replaceChildren(...(needs === 'token' ? tokenFix() : needs === 'passphrase' ? passphraseFix() : []));
    }
  };

  /**
   * A one-field form that hands its value to an action, then syncs.
   * @param {{ id: string, label: string, button: string, action: (value: string) => Promise<unknown>, hint?: string }} options
   */
  const oneField = ({ id, label, button, action, hint }) => {
    const input = h('input', { id, type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    const alert = h('p', { class: 'alert', role: 'alert', hidden: true });
    const submit = h('button', { type: 'submit', class: 'button primary' }, button);
    return [h('form', {
      class: 'connect',
      novalidate: true,
      onsubmit: async (/** @type {Event} */ event) => {
        event.preventDefault();
        if (!input.value.trim()) return;
        alert.hidden = true;
        submit.disabled = true;
        try {
          await action(input.value);
          input.value = '';
          await syncer.run();
        } catch (error) {
          const problem = problemOf(error);
          alert.textContent = problem ? t.problems[problem] : String(error);
          alert.hidden = false;
        }
        submit.disabled = false;
      },
    },
    hint && h('p', null, hint),
    h('div', { class: 'field' }, h('label', { for: id }, label), input),
    alert,
    submit)];
  };
  const tokenFix = () => oneField({
    id: 'new-token',
    label: t.newToken,
    button: t.useToken,
    hint: t.tokenProblem,
    action: (token) => replaceToken({ store, token }),
  });
  const passphraseFix = () => oneField({
    id: 'passphrase',
    label: t.passphrase,
    button: t.unlock,
    action: (passphrase) => reopenVault({ store, passphrase }),
  });

  const leave = async () => {
    const pending = syncer.status.pending;
    if (!confirm(t.confirmDisconnect(pending))) return;
    await syncer.disconnect();
    again();
  };

  show(syncer.status);
  onLeave(syncer.listen(show));

  return [
    h('p', { class: 'lead secure' }, h('span', null, ...t.syncedWith(h('code', null, connection.repository)))),
    box,
    fix,
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'button secondary', onclick: () => void syncer.run() }, t.syncNow)),
    h('div', { class: 'danger-zone' },
      h('button', { type: 'button', class: 'button danger', onclick: leave }, t.disconnect)),
  ];
}
