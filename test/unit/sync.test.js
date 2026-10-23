import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint } from '../../app/domain/fingerprint.js';
import { newRecipe } from '../../app/domain/recipe.js';
import { CryptoError, createVault, seal } from '../../app/store/crypto.js';
import { RemoteError, githubRemote } from '../../app/store/github.js';
import {
  ConnectError, VAULT_PATH, connect, createSyncer, deviceName, disconnect, pendingChanges,
  recipeIdOf, recipePath, reopenVault, replaceToken, syncOnce,
} from '../../app/store/sync.js';
import { createFakeGitHub } from '../support/fake-github.js';
import { createMemoryStore } from '../support/memory-store.js';

// The sync engine (R2.3), the ways of connecting (R2.4) and what can go wrong
// (R2.5), with devices that are memory stores sharing one stand-in GitHub.

const REPO = 'cook/mirepoix-data';
const PASSPHRASE = 'correct horse battery';
const FAST = 1000; // PBKDF2 iterations: few, to keep tests quick
const today = () => new Date('2026-10-23T12:00:00Z');
/** @type {import('../../app/store/sync.js').ConflictTitle} */
const conflictTitle = (title, device, at) => `${title} (conflict, ${device}, ${at.toISOString().slice(0, 10)})`;

/** @typedef {import('../../app/domain/recipe.js').Recipe} Recipe */

/** @param {string} title */
function recipe(title) {
  return {
    ...newRecipe({ title, lang: 'pt', now: new Date('2026-10-01T10:00:00Z') }),
    ingredients: [{ heading: '', items: [{ quantity: '500', unit: 'g', name: `${title.toLowerCase()} base`, note: '', alternatives: [] }] }],
  };
}

/** @param {Recipe} r @param {string} title */
const edited = (r, title) => ({ ...r, title, updatedAt: new Date().toISOString() });

function world() {
  const github = createFakeGitHub();
  github.addRepo(REPO);
  github.addToken('good', [REPO]);
  return github;
}

/**
 * A device: its own store, connected to the shared stand-in GitHub.
 * @param {ReturnType<typeof createFakeGitHub>} github
 * @param {{ name?: string, recipes?: Recipe[] }} [options]
 */
async function device(github, { name = 'Mac', recipes = [] } = {}) {
  const store = createMemoryStore();
  for (const r of recipes) await store.put(r);
  return {
    store,
    /** @param {'fresh' | 'join'} mode @param {string} [passphrase] */
    connect: (mode, passphrase = PASSPHRASE) =>
      connect({ store, mode, repository: REPO, token: 'good', passphrase, device: name, fetch: github.fetch, iterations: FAST }),
    async sync() {
      const connection = await store.setting('connection');
      assert.ok(connection, 'connected');
      return syncOnce({ store, remote: githubRemote({ ...connection, fetch: github.fetch }), connection, conflictTitle, now: today });
    },
    titles: async () => (await store.list()).map((r) => r.title).sort(),
    /** @param {string} title */
    find: async (title) => (await store.list()).find((r) => r.title === title),
  };
}

/**
 * @param {Promise<unknown>} promise
 * @param {string} code
 */
async function failsWith(promise, code) {
  await assert.rejects(promise, (error) => /** @type {{ code?: string }} */ (error).code === code);
}

/** How many requests of a kind GitHub got since a point. */
const count = (/** @type {ReturnType<typeof createFakeGitHub>} */ github, /** @type {number} */ since, /** @type {RegExp} */ match) =>
  github.requests.slice(since).filter((r) => match.test(`${r.method} ${r.path}`)).length;

test('each recipe has its own file, named by its id, and nothing else is taken for one', () => {
  assert.equal(recipePath('0c9f8e4a-1'), 'recipes/0c9f8e4a-1.json');
  for (const id of ['0c9f8e4a-1', 'a/b', '..', 'pão', '%41']) assert.equal(recipeIdOf(recipePath(id)), id, id);
  for (const path of ['vault.json', 'README.md', 'recipes/x.txt', 'recipes/a/b.json', 'recipes/.json', 'recipes/%2.json', 'recipes/%41.json']) {
    assert.equal(recipeIdOf(path), null, path);
  }
});

test('devices get plain names for conflict copies', () => {
  assert.equal(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'iPhone');
  assert.equal(deviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), 'iPad');
  assert.equal(deviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), 'Mac');
  assert.equal(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'Windows');
  assert.equal(deviceName('Mozilla/5.0 (Linux; Android 15; Pixel 9)'), 'Android');
  assert.equal(deviceName('Mozilla/5.0 (X11; Linux x86_64)'), 'Linux');
  assert.equal(deviceName('curl/8'), 'Web');
});

test('starting fresh creates the vault, and keeps the key, never the passphrase', async () => {
  const github = world();
  const a = await device(github, { recipes: [recipe('Feijoada')] });
  const steps = /** @type {string[]} */ ([]);
  const connection = await connect({ store: a.store, mode: 'fresh', repository: `https://github.com/${REPO}`, token: ' good\n', passphrase: PASSPHRASE, device: 'Mac', fetch: github.fetch, iterations: FAST, step: (s) => steps.push(s) });
  assert.deepEqual(steps, ['repository', 'passphrase']);
  assert.deepEqual(Object.keys(github.files(REPO)), [VAULT_PATH]);
  assert.equal(connection.repository, REPO);
  assert.equal(connection.token, 'good', 'pasted spaces trimmed');
  const kept = await a.store.setting('connection');
  assert.ok(kept?.key instanceof CryptoKey);
  assert.equal(kept?.key.extractable, false);
  assert.doesNotMatch(JSON.stringify(kept), /correct horse/);
  assert.deepEqual(await a.titles(), ['Feijoada'], 'connecting alone changes no recipe');
});

test('connecting says why it can\'t, before changing anything', async () => {
  const github = world();
  github.addRepo('cook/public', { private: false });
  github.addToken('good', [REPO, 'cook/public']);
  const a = await device(github);
  const attempt = (/** @type {Partial<Parameters<typeof connect>[0]>} */ change) =>
    connect({ store: a.store, mode: 'fresh', repository: REPO, token: 'good', passphrase: PASSPHRASE, device: 'Mac', fetch: github.fetch, iterations: FAST, ...change });

  await failsWith(attempt({ repository: 'mirepoix-data' }), 'bad-repository');
  await failsWith(attempt({ passphrase: 'short' }), 'short-passphrase');
  await failsWith(attempt({ token: 'nope' }), 'unauthorized');
  await failsWith(attempt({ repository: 'cook/elsewhere' }), 'not-found');
  await failsWith(attempt({ repository: 'cook/public' }), 'public-repository');
  await failsWith(attempt({ mode: 'join' }), 'no-vault');
  github.offline = true;
  await failsWith(attempt({}), 'offline');
  github.offline = false;
  assert.equal(await a.store.setting('connection'), undefined);
  assert.deepEqual(github.files(REPO), {});

  await attempt({});
  const b = await device(github);
  await failsWith(b.connect('fresh'), 'has-vault');
});

test('a wrong passphrase is caught before any recipe downloads', async () => {
  const github = world();
  const a = await device(github, { recipes: [recipe('Feijoada')] });
  await a.connect('fresh');
  await a.sync();
  const b = await device(github);
  const before = github.requests.length;
  await failsWith(b.connect('join', 'wrong horse battery'), 'wrong-passphrase');
  assert.equal(count(github, before, /recipes\//), 0);
  assert.equal(await b.store.setting('connection'), undefined);
});

test('the first sync uploads every recipe, sealed, and a returning device asks one small question', async () => {
  const github = world();
  const recipes = [recipe('Feijoada'), recipe('Pão de queijo')];
  const a = await device(github, { recipes });
  await a.connect('fresh');
  const report = await a.sync();
  assert.equal(report.uploaded, 2);
  const files = github.files(REPO);
  assert.deepEqual(Object.keys(files).sort(), [VAULT_PATH, ...recipes.map((r) => recipePath(r.id))].sort());
  for (const text of Object.values(files)) assert.doesNotMatch(text, /Feijoada|queijo|feij/i, 'GitHub only sees sealed files');
  assert.equal(await pendingChanges(a.store), 0);

  const before = github.requests.length;
  const again = await a.sync();
  assert.deepEqual(github.requests.slice(before).map((r) => r.method), ['GET'], 'just the branch head, though our own writes moved it');
  assert.deepEqual(again, { downloaded: 0, uploaded: 0, deleted: 0, conflicts: 0, unreadable: 0, changed: false });
});

test('joining brings both sides together: a union, ids kept', async () => {
  const github = world();
  const a = await device(github, { recipes: [recipe('Feijoada'), recipe('Bolo de fubá')] });
  await a.connect('fresh');
  await a.sync();
  const mine = recipe('Shakshuka');
  const b = await device(github, { name: 'iPhone', recipes: [mine] });
  await b.connect('join');
  const progress = /** @type {string[]} */ ([]);
  const connection = await b.store.setting('connection');
  assert.ok(connection);
  const report = await syncOnce({ store: b.store, remote: githubRemote({ ...connection, fetch: github.fetch }), connection, conflictTitle, progress: ({ done, total }) => progress.push(`${done}/${total}`) });
  assert.equal(report.downloaded, 2);
  assert.equal(report.uploaded, 1);
  assert.deepEqual(progress, ['0/3', '1/3', '2/3', '3/3']);
  assert.deepEqual(await b.titles(), ['Bolo de fubá', 'Feijoada', 'Shakshuka']);
  assert.deepEqual(await b.store.get(mine.id), mine);
  await a.sync();
  assert.deepEqual(await a.titles(), ['Bolo de fubá', 'Feijoada', 'Shakshuka']);
  assert.deepEqual(await a.store.list().then((l) => l.sort((x, y) => x.id.localeCompare(y.id))), await b.store.list().then((l) => l.sort((x, y) => x.id.localeCompare(y.id))));
});

test('changes and deletions travel, and only changed files download', async () => {
  const github = world();
  const feijoada = recipe('Feijoada');
  const bolo = recipe('Bolo');
  const a = await device(github, { recipes: [feijoada, bolo, recipe('Pastel')] });
  await a.connect('fresh');
  await a.sync();
  const b = await device(github);
  await b.connect('join');
  await b.sync();

  await a.store.put(edited(feijoada, 'Feijoada completa'));
  await a.store.remove(bolo.id);
  assert.equal(await pendingChanges(a.store), 2);
  const sent = await a.sync();
  assert.equal(sent.uploaded, 1);
  assert.equal(sent.deleted, 1);

  const before = github.requests.length;
  const got = await b.sync();
  assert.equal(count(github, before, /^GET .*\/contents\/recipes\//), 1, 'one download, for the one change');
  assert.equal(got.changed, true);
  assert.deepEqual(await b.titles(), ['Feijoada completa', 'Pastel']);
});

test('changes made offline wait, survive a reload, and go up once back online', async () => {
  const github = world();
  const feijoada = recipe('Feijoada');
  const a = await device(github, { recipes: [feijoada] });
  await a.connect('fresh');
  await a.sync();
  github.offline = true;
  await a.store.put(edited(feijoada, 'Feijoada completa'));
  await a.store.put(recipe('Moqueca'));
  await failsWith(a.sync(), 'offline');
  assert.equal(await pendingChanges(a.store), 2);

  // A reload: nothing but the stored recipes, bases and settings carries over.
  const reloaded = createSyncer({ store: a.store, conflictTitle, remoteFor: (c) => githubRemote({ ...c, fetch: github.fetch }) });
  await reloaded.refresh();
  assert.equal(reloaded.status.pending, 2);
  github.offline = false;
  await reloaded.run();
  assert.equal(reloaded.status.state, 'synced');
  assert.equal(reloaded.status.pending, 0);
  const b = await device(github);
  await b.connect('join');
  await b.sync();
  assert.deepEqual(await b.titles(), ['Feijoada completa', 'Moqueca']);
});

test('the same recipe changed on two devices: theirs stays, and ours is kept beside it (D6)', async () => {
  const github = world();
  const bolo = recipe('Bolo');
  const a = await device(github, { name: 'Mac', recipes: [bolo] });
  await a.connect('fresh');
  await a.sync();
  const b = await device(github, { name: 'iPhone' });
  await b.connect('join');
  await b.sync();

  await a.store.put(edited(bolo, 'Bolo de fubá'));
  await b.store.put(edited(bolo, 'Bolo de milho'));
  await a.sync();
  const report = await b.sync();
  assert.equal(report.conflicts, 1);
  assert.deepEqual(await b.titles(), ['Bolo de fubá', 'Bolo de milho (conflict, iPhone, 2026-10-23)']);
  assert.equal((await b.store.get(bolo.id))?.title, 'Bolo de fubá', 'the remote version keeps the id');
  assert.equal(await pendingChanges(b.store), 0, 'the copy went up too');
  await a.sync();
  assert.deepEqual(await a.titles(), await b.titles());
});

test('many conflicts in one pass all keep both versions, and every copy goes up', async () => {
  const github = world();
  const recipes = ['Bolo', 'Pastel', 'Moqueca', 'Feijoada', 'Cuscuz', 'Quindim', 'Coxinha', 'Brigadeiro'].map(recipe);
  const a = await device(github, { name: 'Mac', recipes });
  await a.connect('fresh');
  await a.sync();
  const b = await device(github, { name: 'iPhone' });
  await b.connect('join');
  await b.sync();
  for (const r of recipes) {
    await a.store.put(edited(r, `${r.title} da Ana`));
    await b.store.put(edited(r, `${r.title} do Beto`));
  }
  await a.sync();
  const report = await b.sync();
  assert.equal(report.conflicts, 8);
  assert.equal(report.uploaded, 8);
  assert.equal(await pendingChanges(b.store), 0);
  await a.sync();
  const expected = recipes.flatMap((r) => [`${r.title} da Ana`, `${r.title} do Beto (conflict, iPhone, 2026-10-23)`]).sort();
  assert.deepEqual(await a.titles(), expected);
  assert.deepEqual(await b.titles(), expected);
});

test('the same change made on two devices is no conflict', async () => {
  const github = world();
  const bolo = recipe('Bolo');
  const a = await device(github, { recipes: [bolo] });
  await a.connect('fresh');
  await a.sync();
  const b = await device(github);
  await b.connect('join');
  await b.sync();
  const same = edited(bolo, 'Bolo de fubá');
  await a.store.put(same);
  await b.store.put(same);
  await a.sync();
  const report = await b.sync();
  assert.equal(report.conflicts, 0);
  assert.deepEqual(await b.titles(), ['Bolo de fubá']);
  assert.equal(await pendingChanges(b.store), 0);
});

test('a change beats a deletion, whichever side made which', async () => {
  const github = world();
  const bolo = recipe('Bolo');
  const pastel = recipe('Pastel');
  const a = await device(github, { recipes: [bolo, pastel] });
  await a.connect('fresh');
  await a.sync();
  const b = await device(github);
  await b.connect('join');
  await b.sync();

  await a.store.put(edited(bolo, 'Bolo de fubá')); // changed on A…
  await b.store.remove(bolo.id); // …deleted on B
  await a.store.remove(pastel.id); // deleted on A…
  await b.store.put(edited(pastel, 'Pastel de feira')); // …changed on B
  await a.sync();
  await b.sync();
  await a.sync();
  assert.deepEqual(await a.titles(), ['Bolo de fubá', 'Pastel de feira']);
  assert.deepEqual(await b.titles(), ['Bolo de fubá', 'Pastel de feira']);
});

test('a recipe edited here while its download is on the way is never overwritten', async () => {
  const github = world();
  const bolo = recipe('Bolo');
  const a = await device(github, { recipes: [bolo] });
  await a.connect('fresh');
  await a.sync();
  const b = await device(github, { name: 'iPhone' });
  await b.connect('join');
  await b.sync();
  await a.store.put(edited(bolo, 'Bolo de fubá'));
  await a.sync();

  // B's person saves an edit at the very moment B's sync is about to store A's version.
  const settle = b.store.settle;
  let typed = false;
  b.store.settle = async (change) => {
    if (!typed && change.put?.some((r) => r.id === bolo.id)) {
      typed = true;
      await b.store.put(edited(bolo, 'Bolo de milho'));
    }
    return settle(change);
  };
  await b.sync();
  assert.equal((await b.store.get(bolo.id))?.title, 'Bolo de milho', 'the edit made here survives');
  b.store.settle = settle;
  await b.sync();
  assert.deepEqual(await b.titles(), ['Bolo de fubá', 'Bolo de milho (conflict, iPhone, 2026-10-23)']);
});

test('someone else\'s commit landing at the same moment is retried, not taken for a conflict', async () => {
  const github = world();
  const a = await device(github, { recipes: [recipe('Bolo')] });
  await a.connect('fresh');
  github.fail(/^PUT .*\/recipes\//, 409);
  const report = await a.sync();
  assert.equal(report.uploaded, 1);
  assert.equal(report.conflicts, 0);
  assert.deepEqual(await a.titles(), ['Bolo']);
});

test('a tampered file is reported, left alone here, and the rest still syncs', async () => {
  const github = world();
  const bolo = recipe('Bolo');
  const a = await device(github, { recipes: [bolo, recipe('Pastel')] });
  await a.connect('fresh');
  await a.sync();
  const b = await device(github);
  await b.connect('join');
  await b.sync();

  github.writeFile(REPO, recipePath(bolo.id), github.files(REPO)[recipePath(bolo.id)]?.replace(/"data": ?"(.)/, (m, c) => m.slice(0, -1) + (c === 'A' ? 'B' : 'A')) ?? '');
  await a.store.put(recipe('Moqueca'));
  await a.sync();
  const report = await b.sync();
  assert.equal(report.unreadable, 1);
  assert.deepEqual(await b.titles(), ['Bolo', 'Moqueca', 'Pastel']);
  assert.equal((await b.sync()).unreadable, 1, 'still reported next time');
});

test('a file from a newer Mirepoix, or holding another recipe, can\'t be used here', async () => {
  const github = world();
  const a = await device(github);
  const connection = await a.connect('fresh');
  const remote = githubRemote({ ...connection, fetch: github.fetch });
  const newer = { ...recipe('Bolo'), schema: 2 };
  await remote.put(recipePath(newer.id), await seal(connection.key, `recipe:${newer.id}`, newer), null);
  const other = recipe('Pastel');
  const elsewhere = 'not-its-id';
  await remote.put(recipePath(elsewhere), await seal(connection.key, `recipe:${elsewhere}`, other), null);
  const report = await a.sync();
  assert.equal(report.unreadable, 2);
  assert.deepEqual(await a.titles(), []);
});

test('a vault made anew with another passphrase stops syncing until that passphrase is given', async () => {
  const github = world();
  const a = await device(github, { recipes: [recipe('Bolo')] });
  await a.connect('fresh');
  await a.sync();
  const { text } = await createVault('another passphrase', { iterations: FAST });
  github.writeFile(REPO, VAULT_PATH, text);
  await a.store.put(recipe('Pastel'));
  await assert.rejects(a.sync(), (error) => error instanceof CryptoError && error.code === 'wrong-passphrase');
  await failsWith(reopenVault({ store: a.store, passphrase: PASSPHRASE, fetch: github.fetch }), 'wrong-passphrase');
  await reopenVault({ store: a.store, passphrase: 'another passphrase', fetch: github.fetch });
  await a.sync();
  assert.equal(await pendingChanges(a.store), 0);
});

test('a missing vault is reported, and is never taken to mean every recipe was deleted', async () => {
  const github = world();
  const a = await device(github, { recipes: [recipe('Bolo'), recipe('Pastel')] });
  await a.connect('fresh');
  await a.sync();
  for (const path of Object.keys(github.files(REPO))) github.writeFile(REPO, path, null);
  await failsWith(a.sync(), 'not-a-vault');
  assert.deepEqual(await a.titles(), ['Bolo', 'Pastel']);
});

test('an expired or revoked token stops syncing until a new one is given', async () => {
  const github = world();
  const a = await device(github, { recipes: [recipe('Bolo')] });
  await a.connect('fresh');
  github.revokeToken('good');
  await assert.rejects(a.sync(), (error) => error instanceof RemoteError && error.code === 'unauthorized');
  await failsWith(replaceToken({ store: a.store, token: 'also-wrong', fetch: github.fetch }), 'unauthorized');
  github.addToken('fresh-token', [REPO]);
  await replaceToken({ store: a.store, token: ' fresh-token ', fetch: github.fetch });
  assert.equal((await a.store.setting('connection'))?.token, 'fresh-token');
  assert.equal((await a.sync()).uploaded, 1);
});

test('disconnecting keeps every recipe, and joining again adds no duplicates', async () => {
  const github = world();
  const a = await device(github, { recipes: [recipe('Bolo'), recipe('Pastel')] });
  await a.connect('fresh');
  await a.sync();
  await a.store.put(recipe('Moqueca')); // not synced yet
  await disconnect(a.store);
  assert.equal(await a.store.setting('connection'), undefined);
  assert.deepEqual(await a.titles(), ['Bolo', 'Moqueca', 'Pastel']);

  await a.connect('join');
  const report = await a.sync();
  assert.deepEqual({ ...report, changed: false }, { downloaded: 0, uploaded: 1, deleted: 0, conflicts: 0, unreadable: 0, changed: false });
  assert.deepEqual(await a.titles(), ['Bolo', 'Moqueca', 'Pastel']);
});

test('the syncer keeps a status, runs one pass at a time, and says when recipes changed', async () => {
  const github = world();
  const a = await device(github, { recipes: [recipe('Bolo')] });
  const syncer = createSyncer({ store: a.store, conflictTitle, now: today, remoteFor: (c) => githubRemote({ ...c, fetch: github.fetch }) });
  /** @type {string[]} */
  const seen = [];
  syncer.listen((status, changed) => seen.push(`${status.state}${changed ? ' +changed' : ''}`));
  await syncer.run();
  assert.equal(syncer.status.state, 'off');

  await a.connect('fresh');
  await syncer.refresh();
  assert.equal(syncer.status.pending, 1);
  await Promise.all([syncer.run(), syncer.run(), syncer.run()]);
  assert.equal(syncer.status.state, 'synced');
  assert.equal(syncer.status.lastSynced, today().toISOString());
  const afterReload = createSyncer({ store: a.store, conflictTitle });
  await afterReload.refresh();
  assert.equal(afterReload.status.lastSynced, today().toISOString(), 'when it last synced is kept on the device');
  assert.equal(afterReload.status.state, 'syncing', 'a connected device is about to sync');
  assert.equal(seen.filter((s) => s.startsWith('synced')).length, 2, 'one pass, then one more for the asks that came during it');

  const b = await device(github);
  await b.connect('join');
  await b.store.put(recipe('Pastel'));
  await b.sync();
  seen.length = 0;
  await syncer.run();
  assert.deepEqual(seen.filter((s) => s.startsWith('synced')), ['synced +changed']);

  github.offline = true;
  await syncer.run();
  assert.deepEqual([syncer.status.state, syncer.status.problem], ['offline', 'offline']);
  github.offline = false;
  github.revokeToken('good');
  await syncer.run();
  assert.deepEqual([syncer.status.state, syncer.status.problem], ['stuck', 'unauthorized']);
});

test('a ConnectError carries its code', () => {
  const error = new ConnectError('has-vault');
  assert.equal(error.code, 'has-vault');
  assert.equal(fingerprint({ b: 1, a: [1, { d: 2, c: 3 }] }), fingerprint({ a: [1, { c: 3, d: 2 }], b: 1 }), 'fingerprints ignore key order');
  assert.notEqual(fingerprint({ a: 1 }), fingerprint({ a: 2 }));
});
