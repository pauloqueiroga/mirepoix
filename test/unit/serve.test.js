import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contentType, createDevServer, resolveFile } from '../../tools/serve.js';

describe('resolveFile', () => {
  const root = join(tmpdir(), 'mirepoix-root');

  test('maps a folder path to its index.html', () => {
    assert.equal(resolveFile(root, '/'), join(root, 'index.html'));
    assert.equal(resolveFile(root, '/ui/'), join(root, 'ui', 'index.html'));
  });

  test('maps file paths under the root, decoding them', () => {
    assert.equal(resolveFile(root, '/ui/list.js'), join(root, 'ui', 'list.js'));
    assert.equal(resolveFile(root, '/p%C3%A3o.txt'), join(root, 'pão.txt'));
  });

  test('refuses paths that would leave the root', () => {
    for (const path of [
      '/../package.json',
      '/a/../../package.json',
      '/%2e%2e/package.json',
      '/..%2fpackage.json',
      '/..%5cpackage.json',
    ]) {
      assert.equal(resolveFile(root, path), null, path);
    }
  });

  test('never serves dot files, like Apache', () => {
    assert.equal(resolveFile(root, '/.htaccess'), null);
    assert.equal(resolveFile(root, '/icons/.hidden.svg'), null);
    assert.equal(resolveFile(root, '/%2Ehtaccess'), null);
  });

  test('refuses malformed paths', () => {
    assert.equal(resolveFile(root, '/%E0%A4%A'), null);
    assert.equal(resolveFile(root, '/index.html%00.js'), null);
  });
});

describe('contentType', () => {
  test('knows the types the app ships', () => {
    assert.equal(contentType('index.html'), 'text/html; charset=utf-8');
    assert.equal(contentType('main.js'), 'text/javascript; charset=utf-8');
    assert.equal(contentType('app.webmanifest'), 'application/manifest+json; charset=utf-8');
    assert.equal(contentType('ICON.SVG'), 'image/svg+xml');  });

  test('falls back to a download type for anything else', () => {
    assert.equal(contentType('notes.xyz'), 'application/octet-stream');
  });
});

describe('dev server', () => {
  /** @type {string} */
  let root;
  /** @type {ReturnType<typeof createDevServer>} */
  let server;
  /** @type {string} */
  let origin;

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'mirepoix-serve-'));
    await mkdir(join(root, 'ui'));
    await writeFile(join(root, 'index.html'), '<title>Test</title>');
    await writeFile(join(root, 'ui', 'list.js'), 'export {};');
    server = createDevServer({ root });
    await new Promise((done) => server.listen(0, '127.0.0.1', () => done(undefined)));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    origin = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((done) => server.close(done));
    await rm(root, { recursive: true, force: true });
  });

  test('serves files with their content type and the security headers', async () => {
    const page = await fetch(`${origin}/`);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.match(page.headers.get('content-security-policy') ?? '', /script-src 'self'/);
    assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await page.text(), '<title>Test</title>');

    const script = await fetch(`${origin}/ui/list.js?v=1`);
    assert.equal(script.status, 200);
    assert.equal(script.headers.get('content-type'), 'text/javascript; charset=utf-8');
  });

  test('answers 404 for missing files and folders without index.html', async () => {
    assert.equal((await fetch(`${origin}/nope.js`)).status, 404);
    assert.equal((await fetch(`${origin}/ui/`)).status, 404);
  });

  test('only answers GET and HEAD', async () => {
    const head = await fetch(`${origin}/`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    const post = await fetch(`${origin}/`, { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET, HEAD');
  });
});
