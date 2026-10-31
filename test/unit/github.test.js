import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RemoteError, findRepository, githubRemote, parseRepository } from '../../app/store/github.js';
import { createFakeGitHub } from '../support/fake-github.js';

// The GitHub remote (R2.2, D5), against the stand-in for GitHub's API.

const REPO = 'cook/mirepoix-data';

/** @param {{ files?: Record<string, string>, write?: boolean }} [options] */
function setUp({ files, write = true } = {}) {
  const github = createFakeGitHub();
  github.addRepo(REPO, { files });
  github.addToken('good', [REPO], { write });
  const remote = githubRemote({ repository: REPO, branch: 'main', token: 'good', fetch: github.fetch });
  return { github, remote };
}

/**
 * @param {Promise<unknown>} promise
 * @param {import('../../app/store/github.js').RemoteProblem} code
 */
async function failsWith(promise, code) {
  await assert.rejects(promise, (error) => error instanceof RemoteError && error.code === code);
}

test('a repository can be given as owner/name or as its address', () => {
  assert.equal(parseRepository('cook/mirepoix-data'), 'cook/mirepoix-data');
  assert.equal(parseRepository('  https://github.com/cook/mirepoix-data  '), 'cook/mirepoix-data');
  assert.equal(parseRepository('github.com/cook/mirepoix-data.git'), 'cook/mirepoix-data');
  assert.equal(parseRepository('https://github.com/cook/my.recipes/'), 'cook/my.recipes');
  for (const wrong of ['', 'mirepoix-data', 'cook/', '/data', 'cook/data/extra', 'https://gitlab.com/cook/data', 'cook/..', '-cook/data']) {
    assert.equal(parseRepository(wrong), null, wrong);
  }
});

test('finding a repository tells its default branch and whether it is private', async () => {
  const github = createFakeGitHub();
  github.addRepo(REPO, { branch: 'trunk' });
  github.addRepo('cook/open', { private: false });
  github.addToken('good', [REPO, 'cook/open']);
  assert.deepEqual(await findRepository({ repository: REPO, token: 'good', fetch: github.fetch }), { branch: 'trunk', private: true });
  assert.deepEqual(await findRepository({ repository: 'cook/open', token: 'good', fetch: github.fetch }), { branch: 'main', private: false });
});

test('a wrong token, a hidden repository and no network each say so', async () => {
  const github = createFakeGitHub();
  github.addRepo(REPO);
  github.addRepo('cook/other');
  github.addToken('good', [REPO]);
  await failsWith(findRepository({ repository: REPO, token: 'wrong', fetch: github.fetch }), 'unauthorized');
  await failsWith(findRepository({ repository: 'cook/other', token: 'good', fetch: github.fetch }), 'not-found');
  await failsWith(findRepository({ repository: 'cook/nothing', token: 'good', fetch: github.fetch }), 'not-found');
  github.offline = true;
  await failsWith(findRepository({ repository: REPO, token: 'good', fetch: github.fetch }), 'offline');
});

test('an empty repository has no head and takes its first file', async () => {
  const { github, remote } = setUp();
  assert.equal(await remote.head(), null);
  assert.equal(await remote.get('vault.json'), null);
  const written = await remote.put('vault.json', '{"v": 1}\n', null);
  assert.equal(written.parent, null);
  assert.equal(await remote.head(), written.commit);
  assert.deepEqual(github.files(REPO), { 'vault.json': '{"v": 1}\n' });
});

test('put, get, list and remove keep track of versions', async () => {
  const { remote } = setUp({ files: { 'README.md': 'hi' } });
  const before = await remote.head();
  const first = await remote.put('recipes/a.json', 'Pão de queijo ½', null);
  assert.equal(first.parent, before, 'the write sat right on top of the head we knew');
  assert.deepEqual(await remote.get('recipes/a.json'), { text: 'Pão de queijo ½', version: first.version });

  const head = /** @type {string} */ (await remote.head());
  assert.equal(head, first.commit);
  assert.deepEqual(await remote.list(head), new Map([['README.md', (await remote.get('README.md'))?.version], ['recipes/a.json', first.version]]));

  const second = await remote.put('recipes/a.json', 'Pão de queijo mineiro', first.version);
  assert.notEqual(second.version, first.version);
  assert.equal(second.parent, first.commit);
  const removed = await remote.remove('recipes/a.json', second.version);
  assert.equal(removed?.parent, second.commit);
  assert.equal(await remote.get('recipes/a.json'), null);
  assert.equal(await remote.remove('recipes/a.json', second.version), null, 'already gone is fine');
});

test('a write or delete over a version that moved on is a conflict, and changes nothing', async () => {
  const { github, remote } = setUp();
  const first = await remote.put('recipes/a.json', 'one', null);
  await remote.put('recipes/a.json', 'two', first.version);
  await failsWith(remote.put('recipes/a.json', 'three', first.version), 'conflict');
  await failsWith(remote.put('recipes/a.json', 'three', null), 'conflict');
  await failsWith(remote.remove('recipes/a.json', first.version), 'conflict');
  assert.deepEqual(github.files(REPO), { 'recipes/a.json': 'two' });
});

test('a revoked token, a read-only token and GitHub trouble are told apart', async () => {
  const { github, remote } = setUp();
  await remote.put('recipes/a.json', 'one', null);

  const readOnly = setUp({ write: false });
  await failsWith(readOnly.remote.put('recipes/a.json', 'one', null), 'forbidden');

  github.fail(/^GET .*\/commits\//, 403);
  await failsWith(remote.head(), 'rate-limited');
  github.fail(/^GET .*\/commits\//, 502);
  await failsWith(remote.head(), 'unavailable');
  github.revokeToken('good');
  await failsWith(remote.head(), 'unauthorized');
});

test('file names with spaces and accents reach GitHub intact', async () => {
  const { github, remote } = setUp();
  await remote.put('recipes/pão de queijo.json', 'x', null);
  assert.deepEqual(Object.keys(github.files(REPO)), ['recipes/pão de queijo.json']);
  assert.equal((await remote.get('recipes/pão de queijo.json'))?.text, 'x');
});

test('each request carries the token and asks GitHub whether anything changed', async () => {
  /** @type {{ url: string, init: RequestInit }[]} */
  const seen = [];
  const github = createFakeGitHub();
  github.addRepo(REPO, { files: { 'vault.json': '{}' } });
  github.addToken('good', [REPO]);
  const remote = githubRemote({
    repository: REPO,
    branch: 'main',
    token: 'good',
    fetch: (url, init = {}) => {
      seen.push({ url, init });
      return github.fetch(url, init);
    },
  });
  await remote.head();
  const [{ url, init }] = /** @type {[{ url: string, init: RequestInit }]} */ (seen);
  assert.equal(url, 'https://api.github.com/repos/cook/mirepoix-data/commits/main');
  assert.equal(init.cache, 'no-cache');
  assert.deepEqual(init.headers, { Accept: 'application/vnd.github.sha', Authorization: 'Bearer good', 'X-GitHub-Api-Version': '2022-11-28' });
});
