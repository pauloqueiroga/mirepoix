// Sets the release version everywhere it lives (R1.12): package.json, its
// lock file, and app/sw.js. Installed apps pick up new files only when sw.js
// changes, so every deploy needs a new version.
//   npm run release -- 0.1.1
import { readFile, writeFile } from 'node:fs/promises';

const version = process.argv[2] ?? '';
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: npm run release -- <major.minor.patch>, for example 0.1.1');
  process.exit(1);
}

const pkgFile = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(await readFile(pkgFile, 'utf8'));
const previous = pkg.version;
pkg.version = version;
await writeFile(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

const lockFile = new URL('../package-lock.json', import.meta.url);
const lock = JSON.parse(await readFile(lockFile, 'utf8'));
lock.version = version;
if (lock.packages?.['']) lock.packages[''].version = version;
await writeFile(lockFile, `${JSON.stringify(lock, null, 2)}\n`);

const swFile = new URL('../app/sw.js', import.meta.url);
const sw = await readFile(swFile, 'utf8');
const pattern = /const VERSION = '[^']*';/;
if (!pattern.test(sw)) throw new Error('No VERSION line in app/sw.js');
await writeFile(swFile, sw.replace(pattern, `const VERSION = '${version}';`));

console.log(`Version ${previous} → ${version}.`);
console.log('Next: run the tests, upload app/ (with .htaccess), run npm run check:deploy -- <address>, then tag the release.');
