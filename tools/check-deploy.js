// Checks a deployed Mirepoix from the outside (R1.12):
//   npm run check:deploy -- https://pauloq.com/mirepoix/
// Every app file is there, with the security headers and the right types, at
// the version in this checkout; server config stays private; plain HTTP
// redirects to HTTPS.
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { SECURITY_HEADERS } from './serve.js';

let base;
try {
  base = new URL(process.argv[2] ?? '');
} catch {
  console.error('Usage: npm run check:deploy -- <address>, for example https://pauloq.com/mirepoix/');
  process.exit(1);
}
if (!base.pathname.endsWith('/')) base.pathname += '/';

let failures = 0;
/**
 * @param {boolean} ok
 * @param {string} what
 * @param {string} [why] shown when the check fails
 */
const check = (ok, what, why = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '✓' : '✗'} ${what}${!ok && why ? `: ${why}` : ''}`);
};
/** @param {string} path */
const get = (path, init = {}) => fetch(new URL(path, base), { redirect: 'manual', ...init });

const source = await readFile(new URL('../app/sw.js', import.meta.url), 'utf8');
const { VERSION, SHELL } = runInNewContext(`${source}\n;({ VERSION, SHELL })`, { self: { addEventListener() {} } });

console.log(`Checking ${base.href} for Mirepoix ${VERSION}\n`);

const page = await get('');
check(page.status === 200, 'the app answers', `status ${page.status}`);
check((page.headers.get('content-type') ?? '').startsWith('text/html'), 'it is served as a web page', page.headers.get('content-type') ?? 'no type');
for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
  check(page.headers.get(name) === value, `${name} is set`, page.headers.get(name) ?? 'missing');
}

const worker = await get('sw.js');
const workerSource = await worker.text();
check(/javascript/.test(worker.headers.get('content-type') ?? ''), 'sw.js is served as JavaScript', worker.headers.get('content-type') ?? 'no type');
check(workerSource.includes(`const VERSION = '${VERSION}';`), `the deployed version is ${VERSION}`, 'upload the new app/sw.js');
check(/no-cache|no-store/.test(worker.headers.get('cache-control') ?? ''), 'browsers check sw.js for updates', worker.headers.get('cache-control') ?? 'no Cache-Control');

const missing = [];
for (const path of [...SHELL].map(String)) {
  const response = await get(path, { method: 'HEAD' });
  if (!response.ok) missing.push(`${path} (${response.status})`);
}
check(missing.length === 0, `all ${SHELL.length} app files are there`, missing.join(', '));

const manifest = await get('manifest.webmanifest', { method: 'HEAD' });
check(/json/.test(manifest.headers.get('content-type') ?? ''), 'the manifest is served as JSON', manifest.headers.get('content-type') ?? 'no type');

const config = await get('.htaccess');
check(config.status === 403 || config.status === 404, '.htaccess stays private', `status ${config.status}`);

if (base.protocol === 'https:') {
  const plain = new URL(base);
  plain.protocol = 'http:';
  const response = await fetch(plain, { redirect: 'manual' });
  const location = response.headers.get('location') ?? '';
  check(response.status >= 300 && response.status < 400 && location.startsWith('https:'), 'plain HTTP redirects to HTTPS', `status ${response.status} ${location}`);
}

console.log(failures === 0 ? '\nAll good.' : `\n${failures} ${failures === 1 ? 'problem' : 'problems'} found.`);
process.exitCode = failures === 0 ? 0 : 1;
