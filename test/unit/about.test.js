// The website (D20): app/about/index.html in English and index.pt.html in
// Portuguese. Both pages have the same shape, show screenshots that exist in
// both themes, use the app's colors, and show the app's own reading of the
// ingredient line in their "Try a line" box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { displayAmount, parseIngredient } from '../../app/domain/ingredients.js';
import { displayQuantity } from '../../app/domain/quantity.js';
import { unitText } from '../../app/domain/units.js';
import { messages } from '../../app/ui/i18n.js';

const about = new URL('../../app/about/', import.meta.url);
const PAGES = /** @type {const} */ ({ en: 'index.html', pt: 'index.pt.html' });

/** @param {string} name */
const read = (name) => readFile(new URL(name, about), 'utf8');

/** @param {string} html @param {RegExp} pattern the value in group 1 */
const all = (html, pattern) => [...html.matchAll(pattern)].map((match) => String(match[1]));

/** Text without tags, entities as written. @param {string} html */
const text = (html) => html.replace(/<[^>]+>/g, '');

test('the English and Portuguese pages have the same shape', async () => {
  const en = await read(PAGES.en);
  const pt = await read(PAGES.pt);
  assert.match(en, /<html lang="en">/);
  assert.match(pt, /<html lang="pt-BR">/);
  for (const [what, pattern] of /** @type {[string, RegExp][]} */ ([
    ['ids', /\sid="([^"]+)"/g],
    ['in-page links', /href="(#[^"]*)"/g],
    ['classes', /\sclass="([^"]+)"/g],
    ['links to the app', /href="(\.\.\/)"/g],
  ])) {
    assert.deepEqual(all(pt, pattern), all(en, pattern), `the same ${what}, in the same order`);
  }
  const shots = (/** @type {string} */ html, /** @type {string} */ lang) =>
    all(html, /(?:src|srcset)="shots\/([^"]+)"/g).map((name) => name.replace(`${lang}-`, ''));
  assert.deepEqual(shots(pt, 'pt'), shots(en, 'en'), 'the same screens, in each page\'s language');
  assert.ok(!/shots\/pt-/.test(en) && !/shots\/en-/.test(pt), 'each page shows its own language\'s screens');
  assert.match(en, /href="index\.pt\.html" hreflang="pt" lang="pt">Português</, 'English links to Portuguese');
  assert.match(pt, /href="\.\/" hreflang="en" lang="en">English</, 'Portuguese links to English');
  assert.match(en, /href="\.\.\/privacy\.html"/);
  assert.match(pt, /href="\.\.\/privacy\.pt\.html"/);
});

test('every screenshot shown exists in light and dark, and every one taken is shown', async () => {
  const shown = new Set();
  for (const page of Object.values(PAGES)) {
    const html = await read(page);
    const pairs = [...html.matchAll(/srcset="shots\/([^"]+)">\s*<img src="shots\/([^"]+)"/g)];
    assert.equal(pairs.length, all(html, /src="shots\/([^"]+)"/g).length, `${page}: every screen has a dark version`);
    for (const [, dark, light] of pairs) {
      assert.match(String(light), /-light-/, `${page}: ${light}`);
      assert.equal(String(dark), String(light).replace('-light-', '-dark-'), `${page}: the dark version of ${light}`);
      shown.add(light).add(dark);
    }
  }
  const taken = (await readdir(new URL('shots/', about))).filter((name) => !name.startsWith('.'));
  assert.deepEqual([...shown].sort(), taken.sort(), 'app/about/shots/ holds exactly the screens the pages show');
  // Mostly phones at 2x; a tablet and a laptop at 1x, since they're shown smaller.
  const sizes = { phone: '780x1688', tablet: '820x1180', laptop: '1280x800' };
  for (const name of taken) {
    const bytes = await readFile(new URL(`shots/${name}`, about));
    assert.equal(bytes.subarray(1, 4).toString('latin1'), 'PNG', name);
    const device = name.match(/-(tablet|laptop)-/)?.[1] ?? 'phone';
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, sizes[/** @type {keyof typeof sizes} */ (device)], `${name} is a ${device} screen`);
  }
  // Each screen sits in the frame of the device it was taken on, at its own size.
  for (const page of Object.values(PAGES)) {
    const framed = [...(await read(page)).matchAll(/<(?:figure|div) class="(phone|tablet|laptop)\b[^"]*">\s*<picture>\s*<source [^>]+>\s*<img src="shots\/([^"]+)" width="(\d+)" height="(\d+)"/g)];
    assert.equal(framed.length, all(await read(page), /src="shots\/([^"]+)"/g).length, `${page}: every screen is in a device`);
    for (const [, frame, name, width, height] of framed) {
      assert.equal(name.match(/-(tablet|laptop)-/)?.[1] ?? 'phone', frame, `${page}: ${name} is shown on a ${frame}`);
      assert.equal(`${width}x${height}`, sizes[/** @type {keyof typeof sizes} */ (frame)], `${page}: ${name}'s width and height`);
    }
  }
});

/**
 * The custom properties a stylesheet sets for light (its first :root) and for
 * dark (the :root inside its prefers-color-scheme: dark block).
 * @param {string} css
 */
function colors(css) {
  const block = (/** @type {string} */ from) => Object.fromEntries(
    all(css.slice(css.indexOf('{', from) + 1, css.indexOf('}', from)), /(--[\w-]+:\s*#[0-9A-Fa-f]{6})/g)
      .map((pair) => pair.split(/:\s*/)));
  return { light: block(css.indexOf(':root')), dark: block(css.indexOf(':root', css.indexOf('prefers-color-scheme: dark'))) };
}

test('the website uses the app\'s colors (D13)', async () => {
  const app = colors(await readFile(new URL('../../app/styles/app.css', import.meta.url), 'utf8'));
  const site = colors(await read('about.css'));
  for (const theme of /** @type {const} */ (['light', 'dark'])) {
    for (const name of ['--paper', '--ink', '--ink-2', '--line', '--carrot', '--carrot-soft', '--celery', '--celery-soft', '--warn', '--warn-soft']) {
      assert.ok(app[theme][name], `app.css has ${name} for ${theme}`);
      assert.equal(site[theme][name], app[theme][name], `${name} in ${theme}`);
    }
  }
});

test('the website\'s Ko-fi links go where the app\'s does (D16)', async () => {
  const { KOFI_URL } = await import('../../app/config.js');
  for (const page of Object.values(PAGES)) {
    const links = all(await read(page), /href="(https:\/\/ko-fi\.com[^"]*)"/g);
    assert.ok(links.length > 0, `${page} offers Ko-fi; with KOFI_URL empty, take the links out`);
    for (const link of links) assert.equal(link, KOFI_URL, page);
  }
});

test('"Try a line" shows, before any script runs, what the app\'s reader makes of its line', async () => {
  for (const [lang, page] of Object.entries(PAGES)) {
    const html = await read(page);
    const line = html.match(/id="try-line" name="line" type="text" value="([^"]+)"/)?.[1];
    const recipeLang = html.match(/<input type="radio" name="lang" value="(en|pt)" checked>/)?.[1];
    assert.ok(line && (recipeLang === 'en' || recipeLang === 'pt'), page);
    assert.equal(recipeLang, lang, `${page} starts with a recipe in its own language`);
    const { ingredient, doubts } = parseIngredient(line, recipeLang);
    assert.deepEqual(doubts, [], `${page}: the first line reads without doubts`);
    const t = messages[/** @type {'en' | 'pt'} */ (lang)];
    const row = html.match(/<tbody>\s*<tr>(.*?)<\/tr>/s)?.[1] ?? '';
    const cells = all(row, /<td[^>]*>(.*?)<\/td>/gs).map(text);
    assert.deepEqual(cells, [
      displayQuantity(ingredient.quantity, recipeLang),
      unitText(ingredient, recipeLang) + ingredient.alternatives.map((alternative) => t.or(displayAmount(alternative, recipeLang))).join(''),
      ingredient.name + (ingredient.note ? `, ${ingredient.note}` : ''),
    ], page);
  }
});

test('every example to try reads as an ingredient in its language', async () => {
  for (const page of Object.values(PAGES)) {
    const examples = [...(await read(page)).matchAll(/data-line="([^"]+)" data-lang="(en|pt)"/g)];
    assert.ok(examples.length >= 4, page);
    for (const [, line, lang] of examples) {
      const { ingredient } = parseIngredient(String(line), /** @type {'en' | 'pt'} */ (lang));
      assert.ok(ingredient.name, `${page}: ${line}`);
    }
  }
});
