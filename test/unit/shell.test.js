import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { wantsServiceWorker } from '../../app/offline.js';
import { SECURITY_HEADERS } from '../../tools/serve.js';

const appDir = fileURLToPath(new URL('../../app/', import.meta.url));

/** @param {string} path relative to app/ */
const inApp = (path) => join(appDir, ...path.split('/'));

/** Every file under app/ that a browser can load, as "ui/app.js"-style paths (not .htaccess). */
async function appFiles() {
  const entries = await readdir(appDir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(appDir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter((path) => !path.split('/').some((part) => part.startsWith('.')));
}

/** Reads VERSION and SHELL from the service worker without a browser. */
async function serviceWorker() {
  const source = await readFile(inApp('sw.js'), 'utf8');
  const sandbox = { self: { addEventListener() {} } };
  const { VERSION, SHELL } = runInNewContext(`${source}\n;({ VERSION, SHELL })`, sandbox);
  return { version: String(VERSION), shell: [...SHELL].map(String) };
}

/** @param {string} path relative to app/ */
async function pngSize(path) {
  const bytes = await readFile(inApp(path));
  assert.equal(bytes.subarray(1, 4).toString('latin1'), 'PNG', `${path} is a PNG`);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

test('local development skips the service worker unless ?sw asks for it', () => {
  assert.equal(wantsServiceWorker(new URL('https://example.com/mirepoix/')), true);
  assert.equal(wantsServiceWorker(new URL('http://localhost:5173/')), false);
  assert.equal(wantsServiceWorker(new URL('http://127.0.0.1:5173/')), false);
  assert.equal(wantsServiceWorker(new URL('http://localhost:5173/?sw')), true);
});

test('the service worker keeps exactly the files in app/ for offline use', async () => {
  const { shell } = await serviceWorker();
  assert.ok(shell.includes('./'), 'the start page itself');
  const cached = shell.filter((path) => path !== './').sort();
  const files = (await appFiles()).filter((path) => path !== 'sw.js').sort();
  assert.deepEqual(cached, files, 'SHELL in app/sw.js must list every file in app/');
});

test('the service worker version moves with the package version', async () => {
  const { version } = await serviceWorker();
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(version, pkg.version);
});

test('the manifest has what home screens need to install the app', async () => {
  const manifest = JSON.parse(await readFile(inApp('manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Mirepoix');
  assert.equal(manifest.short_name, 'Mirepoix');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.display, 'standalone');
  const icons = /** @type {{ src: string, sizes: string, type: string, purpose?: string }[]} */ (manifest.icons);
  for (const size of ['192x192', '512x512']) {
    assert.ok(icons.some((icon) => icon.sizes === size && !icon.purpose), `an ${size} icon`);
  }
  assert.ok(icons.some((icon) => icon.purpose === 'maskable'), 'a maskable icon');
  for (const icon of icons) {
    assert.equal(icon.type, 'image/png');
    assert.equal(await pngSize(icon.src), icon.sizes, icon.src);
  }
  assert.equal(await pngSize('icons/apple-touch-icon.png'), '180x180');
});

test('the logos carry their lettering as shapes, never as text or fonts (D13)', async () => {
  const logos = (await appFiles()).filter((path) => /^icons\/logo-.+\.svg$/.test(path));
  assert.deepEqual(logos.sort(), [
    'icons/logo-horizontal-dark.svg',
    'icons/logo-horizontal.svg',
    'icons/logo-stacked-dark.svg',
    'icons/logo-stacked.svg',
  ]);
  for (const path of logos) {
    const svg = await readFile(inApp(path), 'utf8');
    assert.match(svg, /<path [^>]*d="M/, `${path} draws its letters`);
    assert.doesNotMatch(svg, /<text|font-family|@font-face|<style|<script/i, `${path} has no text, fonts, styles or scripts`);
  }
});

test('the Apache config sends exactly the dev server\'s security headers', async () => {
  const config = await readFile(inApp('.htaccess'), 'utf8');
  const sent = Object.fromEntries([...config.matchAll(/^\s*Header always set (\S+) "([^"]*)"/gm)].map((m) => [m[1], m[2]]));
  assert.deepEqual(sent, SECURITY_HEADERS);
  assert.match(config, /RewriteRule \^ https:/, 'plain HTTP goes to HTTPS');
  assert.match(config, /Header set Cache-Control "no-cache"/, 'browsers check for new versions');
});

const PAGES = ['index.html', 'privacy.html', 'privacy.pt.html'];

/** @param {string} page */
async function references(page) {
  const html = await readFile(inApp(page), 'utf8');
  return [...html.matchAll(/(?:href|src|content)="([^"]+)"/g)].map((match) => String(match[1]));
}

test('every local file a page refers to exists', async () => {
  for (const page of PAGES) {
    const local = (await references(page)).filter((ref) => /^[\w./-]+\.\w+$/.test(ref) || ref === './');
    assert.ok(local.length >= 5, page);
    for (const path of local) await assert.doesNotReject(access(inApp(path === './' ? 'index.html' : path)), `${page}: ${path}`);
  }
});

test('every address the site gives for itself agrees with package.json\'s homepage (R1.15)', async () => {
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  const home = String(pkg.homepage);
  assert.match(home, /^https:\/\/.+\/$/);
  const own = (/** @type {string} */ url) => !/^https?:\/\/(policies\.google\.com|schema\.org|www\.sitemaps\.org)/.test(url);
  const files = [...PAGES, 'robots.txt', 'sitemap.xml'];
  for (const file of files) {
    const text = await readFile(inApp(file), 'utf8');
    for (const [url] of text.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
      if (own(url)) assert.ok(url.startsWith(home), `${file}: ${url} is not under ${home}`);
    }
  }
  for (const page of PAGES) {
    const refs = await references(page);
    const image = refs.find((ref) => ref.endsWith('/social.png'));
    assert.equal(image, `${home}icons/social.png`, `${page} has a share image`);
    assert.ok(refs.includes(page === 'index.html' ? home : `${home}${page}`), `${page} names its canonical address`);
  }
});

test('the analytics setting is a Google Analytics Measurement ID, or empty for off', async () => {
  const { ANALYTICS_ID } = await import('../../app/config.js');
  assert.match(ANALYTICS_ID, /^(G-[A-Z0-9]{6,12})?$/);
});

test('the share preview is a 1200×630 PNG', async () => {
  assert.equal(await pngSize('icons/social.png'), '1200x630');
});
