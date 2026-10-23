import { expect, test } from './fixtures.js';
import { createFakeGitHub } from '../support/fake-github.js';

// The GitHub remote (R2.2) from a real browser, under the production security
// policy: cross-origin requests with a token reach api.github.com (here, the
// stand-in), and their answers can be read.

test('the browser talks to GitHub\'s API: head, put, get, list and remove', async ({ page }) => {
  const github = createFakeGitHub();
  github.addRepo('cook/mirepoix-data');
  github.addToken('good', ['cook/mirepoix-data']);
  await page.context().route('https://api.github.com/**', github.route);
  /** @type {string[]} */
  const errors = [];
  page.on('console', (message) => {
    // Browsers log every 4xx answer; expected ones (an empty repository, a
    // conflict, a file that's gone) are not errors here, but CSP refusals are.
    if (message.type() === 'error' && !/^Failed to load resource: the server responded with a status of 4\d\d/.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { findRepository, githubRemote } = await import('/store/github.js');
    const found = await findRepository({ repository: 'cook/mirepoix-data', token: 'good' });
    const remote = githubRemote({ repository: 'cook/mirepoix-data', branch: found.branch, token: 'good' });
    const empty = await remote.head();
    const written = await remote.put('recipes/a.json', 'Pão de queijo', null);
    const head = await remote.head();
    const files = [...(await remote.list(String(head)))];
    const got = await remote.get('recipes/a.json');
    let conflict = '';
    await remote.put('recipes/a.json', 'again', null).catch((error) => { conflict = error.code; });
    await remote.remove('recipes/a.json', written.version);
    return { found, empty, sameHead: head === written.commit, files, got, conflict, gone: await remote.get('recipes/a.json') };
  });
  expect(result).toMatchObject({
    found: { branch: 'main', private: true },
    empty: null,
    sameHead: true,
    got: { text: 'Pão de queijo' },
    conflict: 'conflict',
    gone: null,
  });
  expect(result.files).toEqual([['recipes/a.json', result.got?.version]]);
  expect(github.files('cook/mirepoix-data')).toEqual({});
  expect(errors).toEqual([]);
});
