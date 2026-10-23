// Syncing (R2.3, D4–D7): this device's recipes and the remote copy in a
// private GitHub repository become the same, end-to-end encrypted.
//
// It's a three-way comparison per recipe. For each one, the device remembers
// its base: the remote file's version and the recipe's fingerprint when the
// two last matched. A recipe changed here if its fingerprint moved off the
// base; it changed there if the file's version did.
// - Changed on one side only: that side's version wins.
// - Changed on both: the remote version stays, and this device's version is
//   kept beside it as "Title (conflict, device, date)" (D6). Nothing is lost.
// - Deleted on one side and changed on the other: the change wins.
// - A recipe the remote has never seen goes up as a new file. Ids are random
//   (D8), so recipes made on separate devices never collide: connecting
//   merges them as a union (R2.6).
//
// Because changes waiting to go up are worked out from what's stored, they
// survive going offline and reloading with no queue to keep. A returning
// device asks for the branch head first: one small request. Only a head that
// moved means listing the files and downloading the changed ones.
import { fingerprint } from '../domain/fingerprint.js';
import { recipeProblems } from '../domain/recipe.js';
import { CryptoError, createVault, keyOpens, openVault, readVault, seal, unseal } from './crypto.js';
import { RemoteError, findRepository, githubRemote, parseRepository } from './github.js';

/** @typedef {import('../domain/recipe.js').Recipe} Recipe */
/** @typedef {import('./local-store.js').LocalStore} LocalStore */
/** @typedef {import('./local-store.js').Base} Base */
/** @typedef {import('./github.js').Remote} Remote */
/** @typedef {import('./github.js').Fetch} Fetch */
/** @typedef {import('./github.js').RemoteProblem} RemoteProblem */
/** @typedef {import('./crypto.js').CryptoProblem} CryptoProblem */
/**
 * Everything this device needs to sync, kept on it. Never the passphrase (D7).
 * @typedef {object} Connection
 * @property {string} repository "owner/name"
 * @property {string} branch
 * @property {string} token a fine-grained GitHub token for this repository (D5)
 * @property {CryptoKey} key derived from the passphrase; it can't be read back out
 * @property {string} device this device's name, for conflict copies
 * @property {string} vault the version of vault.json the key was checked against
 */
/**
 * Why connecting can't go ahead, beyond what GitHub and the crypto say.
 * - bad-repository: not "owner/name" or a github.com address
 * - public-repository: recipes only go to a private repository (D5)
 * - has-vault: starting fresh, but the repository already holds recipes
 * - no-vault: joining, but there's nothing to join yet
 * - short-passphrase: fewer than 8 characters for a new vault
 * @typedef {'bad-repository' | 'public-repository' | 'has-vault' | 'no-vault' | 'short-passphrase'} ConnectProblem
 */
/** @typedef {RemoteProblem | CryptoProblem | ConnectProblem} SyncProblem */
/** @typedef {{ done: number, total: number }} Progress */
/**
 * What one pass did.
 * @typedef {{ downloaded: number, uploaded: number, deleted: number, conflicts: number, unreadable: number, changed: boolean }} Report
 *   unreadable: remote files that couldn't be opened (tampered, or from a newer Mirepoix); changed: recipes here changed
 */
/** @typedef {(title: string, device: string, at: Date) => string} ConflictTitle */

export const VAULT_PATH = 'vault.json';
export const SHORTEST_PASSPHRASE = 8;
const DOWNLOADS_AT_ONCE = 6;
const TRIES = 3;

export class ConnectError extends Error {
  /** @param {ConnectProblem} code */
  constructor(code) {
    super(`Can't connect: ${code}`);
    this.name = 'ConnectError';
    /** @type {ConnectProblem} */
    this.code = code;
  }
}

/**
 * Where a recipe's file lives in the repository.
 * @param {string} id
 */
export function recipePath(id) {
  return `recipes/${encodeURIComponent(id)}.json`;
}

/**
 * The recipe id a repository path holds, or null for any other file.
 * @param {string} path
 * @returns {string | null}
 */
export function recipeIdOf(path) {
  const match = /^recipes\/([^/]+)\.json$/.exec(path);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1] ?? '');
    return id && recipePath(id) === path ? id : null;
  } catch {
    return null;
  }
}

/**
 * A plain name for the kind of device, for conflict copies: "iPhone", "Mac"…
 * @param {string} userAgent
 * @param {number} [touchPoints] navigator.maxTouchPoints; an iPad says it's a Mac otherwise
 */
export function deviceName(userAgent, touchPoints = 0) {
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1)) return 'iPad';
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Windows/.test(userAgent)) return 'Windows';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'Mac';
  if (/CrOS/.test(userAgent)) return 'Chromebook';
  if (/Linux/.test(userAgent)) return 'Linux';
  return 'Web';
}

/**
 * The code for why something went wrong, or null for an error nobody planned for.
 * @param {unknown} error
 * @returns {SyncProblem | null}
 */
export function problemOf(error) {
  if (error instanceof RemoteError || error instanceof CryptoError || error instanceof ConnectError) return error.code;
  return null;
}

/**
 * Connects this device to a repository (R2.4): starts a new vault there
 * ("fresh"), or opens the one there ("join"). It never touches the recipes
 * on this device; the first sync merges them with the remote ones.
 * @param {object} options
 * @param {LocalStore} options.store
 * @param {'fresh' | 'join'} options.mode
 * @param {string} options.repository as typed: "owner/name" or its address
 * @param {string} options.token
 * @param {string} options.passphrase
 * @param {string} options.device
 * @param {(step: 'repository' | 'passphrase') => void} [options.step] told as each check passes
 * @param {Fetch} [options.fetch]
 * @param {number} [options.iterations] for a new vault; fewer only in tests
 * @returns {Promise<Connection>} rejects with a ConnectError, RemoteError or CryptoError
 */
export async function connect({ store, mode, repository: typed, token, passphrase, device, step = () => {}, fetch, iterations }) {
  const repository = parseRepository(typed);
  if (!repository) throw new ConnectError('bad-repository');
  if (mode === 'fresh' && [...passphrase.normalize('NFC')].length < SHORTEST_PASSPHRASE) throw new ConnectError('short-passphrase');
  token = token.trim();
  const found = await findRepository({ repository, token, fetch });
  if (!found.private) throw new ConnectError('public-repository');
  const remote = githubRemote({ repository, branch: found.branch, token, fetch });
  const existing = await remote.get(VAULT_PATH);
  step('repository');

  let key;
  let vault;
  if (mode === 'fresh') {
    if (existing) throw new ConnectError('has-vault');
    const made = await createVault(passphrase, iterations ? { iterations } : {});
    try {
      vault = (await remote.put(VAULT_PATH, made.text, null)).version;
    } catch (error) {
      if (error instanceof RemoteError && error.code === 'conflict') throw new ConnectError('has-vault');
      throw error;
    }
    key = made.key;
  } else {
    if (!existing) throw new ConnectError('no-vault');
    key = await openVault(readVault(existing.text), passphrase);
    vault = existing.version;
  }
  step('passphrase');

  /** @type {Connection} */
  const connection = { repository, branch: found.branch, token, key, device, vault };
  await store.forgetSync();
  await store.setSetting('connection', connection);
  return connection;
}

/**
 * Takes a new token for the same repository (R2.5), after the old one expired
 * or was revoked. Recipes and keys stay as they are.
 * @param {{ store: LocalStore, token: string, fetch?: Fetch }} options
 * @returns {Promise<Connection>} rejects when the new token doesn't work either
 */
export async function replaceToken({ store, token, fetch }) {
  const connection = await connected(store);
  token = token.trim();
  const found = await findRepository({ repository: connection.repository, token, fetch });
  const updated = { ...connection, token, branch: found.branch };
  await store.setSetting('connection', updated);
  return updated;
}

/**
 * Takes the passphrase again (R2.5), after the remote vault was made anew
 * with another one.
 * @param {{ store: LocalStore, passphrase: string, fetch?: Fetch }} options
 * @returns {Promise<Connection>} rejects with wrong-passphrase, or when there's no vault
 */
export async function reopenVault({ store, passphrase, fetch }) {
  const connection = await connected(store);
  const file = await githubRemote({ ...connection, fetch }).get(VAULT_PATH);
  if (!file) throw new CryptoError('not-a-vault');
  const key = await openVault(readVault(file.text), passphrase);
  const updated = { ...connection, key, vault: file.version };
  await store.setSetting('connection', updated);
  return updated;
}

/**
 * Stops syncing on this device (R2.4). Every recipe stays here, including
 * changes that hadn't gone up yet; the remote copy stays as it is.
 * @param {LocalStore} store
 */
export async function disconnect(store) {
  await store.forgetSync();
}

/**
 * How many changes on this device haven't reached the remote copy yet:
 * recipes added or changed since they last matched it, and deletions.
 * @param {LocalStore} store
 */
export async function pendingChanges(store) {
  const bases = new Map((await store.bases()).map((base) => [base.id, base]));
  let pending = 0;
  for (const recipe of await store.list()) {
    if (bases.get(recipe.id)?.fingerprint !== fingerprint(recipe)) pending += 1;
    bases.delete(recipe.id);
  }
  return pending + bases.size;
}

/**
 * One sync pass: brings this device and the remote copy level.
 * @param {object} options
 * @param {LocalStore} options.store
 * @param {Remote} options.remote
 * @param {Connection} options.connection
 * @param {ConflictTitle} options.conflictTitle names the copy kept in a conflict
 * @param {() => Date} [options.now]
 * @param {(progress: Progress) => void} [options.progress] told as files go down and up
 * @returns {Promise<Report>} rejects with a RemoteError, or a CryptoError when the
 *   remote vault no longer opens with this device's key (wrong-passphrase) or is gone (not-a-vault)
 */
export async function syncOnce({ store, remote, connection, conflictTitle, now = () => new Date(), progress = () => {} }) {
  const { key } = connection;
  /** @type {Report} */
  const report = { downloaded: 0, uploaded: 0, deleted: 0, conflicts: 0, unreadable: 0, changed: false };
  const known = await store.setting('head');
  const head = await remote.head();
  const bases = new Map((await store.bases()).map((base) => [base.id, base]));
  const locals = new Map((await store.list()).map((recipe) => [recipe.id, recipe]));
  // Every base reflects the commit we know, so an unchanged head means the
  // remote files are exactly the bases: nothing to list, nothing to download.
  /** @type {Map<string, string>} recipe id → file version */
  const files = new Map();
  if (head !== null && head === known) {
    for (const base of bases.values()) files.set(base.id, base.version);
  } else {
    const listing = head === null ? new Map() : await remote.list(head);
    await checkVault(listing.get(VAULT_PATH));
    for (const [path, version] of listing) {
      const id = recipeIdOf(path);
      if (id !== null) files.set(id, version);
    }
  }

  // The commit our bases reflect, followed through our own writes. Lost
  // (undefined) when someone else wrote in between: then the next pass lists.
  /** @type {string | null | undefined} */
  let at = head;
  // Whether every recipe was brought level; if not, the next pass lists again.
  let complete = true;
  /** @type {string[]} */
  const downloads = [];
  // Uploads go one at a time, after the downloads: GitHub refuses a commit
  // that races another one on the same branch.
  /** @type {{ id: string, over: string | null, tries: number }[]} */
  const uploads = [];
  for (const id of new Set([...locals.keys(), ...bases.keys(), ...files.keys()])) {
    const local = locals.get(id);
    const base = bases.get(id);
    const version = files.get(id);
    const here = base ? (local ? fingerprint(local) : null) !== base.fingerprint : local !== undefined;
    const there = base ? version !== base.version : version !== undefined;
    if (!here && !there) continue;
    if (there && version !== undefined) downloads.push(id);
    else if (there && !here) await settle({ expect: { [id]: base?.fingerprint ?? null }, remove: [id], forget: [id] }, true); // deleted there
    else if (local) uploads.push({ id, over: there ? null : base?.version ?? null, tries: 0 }); // a deletion there loses to a change here
    else if (there) await settle({ forget: [id] }); // deleted on both sides
    else uploads.push({ id, over: base?.version ?? null, tries: 0 }); // deleted here
  }

  let done = 0;
  const tick = () => progress({ done: (done += 1), total: downloads.length + uploads.length });
  if (downloads.length + uploads.length > 0) progress({ done, total: downloads.length + uploads.length });
  await inParallel(downloads, DOWNLOADS_AT_ONCE, async (id) => {
    await reconcile(id, await remote.get(recipePath(id)), 0);
    tick();
  });
  // Reconciling can add uploads (a conflict copy, say), so the list may grow as it goes.
  for (let i = 0; i < uploads.length; i += 1) {
    const { id, over, tries } = /** @type {{ id: string, over: string | null, tries: number }} */ (uploads[i]);
    await push(id, over, tries);
    tick();
  }
  if (complete && at) await store.setSetting('head', at);
  else await store.setSetting('head', undefined);
  return report;

  /**
   * Brings one recipe level with its remote file as it is now.
   * @param {string} id
   * @param {{ text: string, version: string } | null} file
   * @param {number} tries
   */
  async function reconcile(id, file, tries) {
    const local = await store.get(id);
    const mine = local ? fingerprint(local) : null;
    const base = bases.get(id);
    const here = base ? mine !== base.fingerprint : local !== undefined;
    if (!file) {
      if (!local) await settle({ forget: [id] });
      else if (!here) await settle({ expect: { [id]: mine }, remove: [id], forget: [id] }, true);
      else uploads.push({ id, over: null, tries: tries + 1 }); // changed here, deleted there: the change wins
      return;
    }
    let theirs;
    try {
      theirs = await openRecipe(id, file.text);
    } catch (error) {
      if (!(error instanceof CryptoError)) throw error;
      // Left as it is here; listing again next time keeps it in the status.
      report.unreadable += 1;
      complete = false;
      return;
    }
    const newBase = { id, version: file.version, fingerprint: fingerprint(theirs) };
    if (!local || !here || mine === newBase.fingerprint) {
      const same = mine === newBase.fingerprint;
      if (await settle({ expect: { [id]: mine }, put: same ? [] : [theirs], bases: [newBase] }, !same) && !same) report.downloaded += 1;
      return;
    }
    // Changed on both sides: theirs stays, and ours is kept beside it (D6).
    const when = now();
    const copy = { ...local, id: crypto.randomUUID(), title: conflictTitle(local.title, connection.device, when), createdAt: when.toISOString(), updatedAt: when.toISOString() };
    if (await settle({ expect: { [id]: mine }, put: [theirs, copy], bases: [newBase] }, true)) {
      report.conflicts += 1;
      uploads.push({ id: copy.id, over: null, tries: 0 });
    }
  }

  /**
   * Sends one recipe's change up: the recipe as it is now, or its deletion.
   * @param {string} id
   * @param {string | null} over the file version it replaces; null for a new file
   * @param {number} tries
   */
  async function push(id, over, tries) {
    if (tries >= TRIES) {
      complete = false;
      return;
    }
    const local = await store.get(id);
    const path = recipePath(id);
    try {
      if (local) {
        const written = await remote.put(path, await seal(key, `recipe:${id}`, local), over);
        follow(written);
        await settle({ bases: [{ id, version: written.version, fingerprint: fingerprint(local) }] });
        report.uploaded += 1;
      } else if (over !== null) {
        const written = await remote.remove(path, over);
        if (written) follow(written);
        await settle({ forget: [id] });
        report.deleted += 1;
      } else {
        await settle({ forget: [id] });
      }
    } catch (error) {
      if (!(error instanceof RemoteError) || error.code !== 'conflict') throw error;
      // Either the file moved on, or someone else's commit landed at the same
      // moment; GitHub says "conflict" to both.
      at = undefined;
      const file = await remote.get(path);
      if ((file?.version ?? null) === over) await push(id, over, tries + 1);
      else await reconcile(id, file, tries + 1);
    }
  }

  /**
   * @param {import('./local-store.js').Settlement} change
   * @param {boolean} [changesRecipes]
   */
  async function settle(change, changesRecipes = false) {
    const ok = await store.settle(change);
    if (!ok) {
      complete = false; // a recipe changed here meanwhile; the next pass sees to it
      return false;
    }
    for (const base of change.bases ?? []) bases.set(base.id, base);
    for (const id of change.forget ?? []) bases.delete(id);
    if (changesRecipes) report.changed = true;
    return true;
  }

  /** @param {import('./github.js').Written} written */
  function follow(written) {
    at = at !== undefined && written.parent === at ? written.commit : undefined;
  }

  /**
   * The vault must still be there, and still open with this device's key.
   * @param {string | undefined} version
   */
  async function checkVault(version) {
    // Without a vault, a listing can't be trusted to mean anything: never
    // take it as "every recipe was deleted".
    if (version === undefined) throw new CryptoError('not-a-vault');
    if (version === connection.vault) return;
    const file = await remote.get(VAULT_PATH);
    if (!file) throw new CryptoError('not-a-vault');
    if (!(await keyOpens(readVault(file.text), key))) throw new CryptoError('wrong-passphrase');
    connection.vault = file.version;
    await store.setSetting('connection', connection);
  }

  /**
   * @param {string} id
   * @param {string} text
   * @returns {Promise<Recipe>} rejects with a CryptoError when it can't be used here
   */
  async function openRecipe(id, text) {
    const value = await unseal(key, `recipe:${id}`, text);
    if (recipeProblems(value).length > 0) throw new CryptoError('too-new');
    const recipe = /** @type {Recipe} */ (value);
    if (recipe.id !== id) throw new CryptoError('tampered');
    return recipe;
  }
}

/**
 * Runs passes when asked, one at a time, and keeps a status for the screens
 * (R2.5). Asking while a pass runs means one more pass after it.
 * @param {object} options
 * @param {LocalStore} options.store
 * @param {ConflictTitle} options.conflictTitle
 * @param {(connection: Connection) => Remote} [options.remoteFor]
 * @param {() => Date} [options.now]
 */
export function createSyncer({ store, conflictTitle, remoteFor = (connection) => githubRemote(connection), now = () => new Date() }) {
  /** @type {SyncStatus} */
  let status = { state: 'off', problem: null, pending: 0, unreadable: 0, progress: null, lastSynced: null };
  /** @type {Set<(status: SyncStatus, changed: boolean) => void>} */
  const listeners = new Set();
  /** @type {Promise<void> | null} */
  let running = null;
  let again = false;
  let stopping = false;

  /**
   * @param {Partial<SyncStatus>} change
   * @param {boolean} [changed] recipes here changed
   */
  const update = (change, changed = false) => {
    status = { ...status, ...change };
    for (const listener of listeners) listener(status, changed);
  };

  const pass = async () => {
    const connection = await store.setting('connection');
    if (!connection) {
      update({ state: 'off', problem: null, pending: 0, unreadable: 0, progress: null });
      return;
    }
    update({ state: 'syncing', progress: null });
    try {
      const report = await syncOnce({
        store,
        remote: remoteFor(connection),
        connection,
        conflictTitle,
        now,
        progress: (progress) => update({ progress }),
      });
      const lastSynced = now().toISOString();
      await store.setSetting('synced', lastSynced);
      update({
        state: 'synced',
        problem: null,
        unreadable: report.unreadable,
        pending: await pendingChanges(store),
        progress: null,
        lastSynced,
      }, report.changed);
    } catch (error) {
      const problem = problemOf(error);
      if (!problem) console.warn('Sync failed:', error);
      update({ state: problem === 'offline' ? 'offline' : 'stuck', problem: problem ?? 'unavailable', pending: await pendingChanges(store), progress: null });
    }
  };

  return {
    get status() {
      return status;
    },
    /**
     * Calls the listener with every new status, and whether recipes here changed.
     * @param {(status: SyncStatus, changed: boolean) => void} listener
     * @returns {() => void} stops listening
     */
    listen(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Runs a pass now, or right after the one running. @returns {Promise<void>} */
    run() {
      if (stopping) return Promise.resolve();
      if (running) {
        again = true;
        return running;
      }
      running = (async () => {
        do {
          again = false;
          await pass();
        } while (again);
      })().finally(() => {
        running = null;
      });
      return running;
    },
    /**
     * Stops syncing on this device (R2.4), once any pass under way has
     * finished, so nothing that pass writes outlives the connection. Every
     * recipe stays here.
     */
    async disconnect() {
      stopping = true;
      try {
        while (running) await running;
        await store.forgetSync();
      } finally {
        stopping = false;
      }
      await this.run();
    },
    /** Counts what's waiting to go up, without syncing. A connected device that hasn't synced yet is about to. */
    async refresh() {
      const connection = await store.setting('connection');
      update(connection
        ? {
          pending: await pendingChanges(store),
          state: status.state === 'off' ? 'syncing' : status.state,
          lastSynced: status.lastSynced ?? (await store.setting('synced')) ?? null,
        }
        : { state: 'off', problem: null, pending: 0, unreadable: 0, lastSynced: null });
    },
  };
}

/**
 * @typedef {'off' | 'syncing' | 'synced' | 'offline' | 'stuck'} SyncState
 *   off: not connected; stuck: needs a person (a new token, the passphrase) or GitHub is unwell
 * @typedef {{ state: SyncState, problem: SyncProblem | null, pending: number, unreadable: number, progress: Progress | null, lastSynced: string | null }} SyncStatus
 */

/**
 * @param {LocalStore} store
 * @returns {Promise<Connection>}
 */
async function connected(store) {
  const connection = await store.setting('connection');
  if (!connection) throw new Error('This device is not connected');
  return connection;
}

/**
 * Runs a task for every item, a few at a time.
 * @template T
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<void>} task
 */
async function inParallel(items, limit, task) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = /** @type {T} */ (items[next]);
      next += 1;
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
