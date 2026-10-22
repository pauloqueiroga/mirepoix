import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  displayAmount,
  parseIngredient,
  parseIngredientList,
  renderIngredient,
  renderIngredientList,
} from '../../app/domain/ingredients.js';
import { recipeProblems } from '../../app/domain/recipe.js';
import { UNITS } from '../../app/domain/units.js';

/** @typedef {import('../../app/domain/recipe.js').Ingredient} Ingredient */
/** @typedef {'en' | 'pt'} Lang */

/**
 * Reads test/fixtures/ingredients.<lang>.txt.
 * @param {Lang} lang
 */
async function fixtures(lang) {
  const text = await readFile(new URL(`../fixtures/ingredients.${lang}.txt`, import.meta.url), 'utf8');
  return text.split(/\r?\n/u).flatMap((row, i) => {
    if (!row.trim() || row.trimStart().startsWith('#')) return [];
    const arrow = row.lastIndexOf(' => ');
    assert.ok(arrow > 0, `ingredients.${lang}.txt:${i + 1} needs " => "`);
    const [quantity = '', unit = '', name = '', note = '', equivalents = '', doubts = ''] =
      row.slice(arrow + 4).split('|').map((field) => field.trim());
    /** @type {Ingredient} */
    const ingredient = { quantity, unit, name, note, alternatives: equivalents ? equivalents.split(';').map(amount) : [] };
    return [{ where: `ingredients.${lang}.txt:${i + 1}`, line: row.slice(0, arrow), ingredient, doubts: doubts.split(' ').filter(Boolean).sort() }];
  });
}

/** "1 1/2 cup" → { quantity: "1 1/2", unit: "cup" } */
function amount(/** @type {string} */ text) {
  const match = /^(\S+(?: \d+\/\d+)?) (.+)$/u.exec(text.trim());
  assert.ok(match, `"${text}" is not an amount`);
  return { quantity: String(match[1]), unit: String(match[2]) };
}

/** An ingredient is valid when a recipe holding it passes validation. */
function ingredientProblems(/** @type {Ingredient} */ ingredient) {
  const recipe = {
    schema: 1, id: 'x', lang: 'en', title: 'x', source: '', yield: '',
    ingredients: [{ heading: '', items: [ingredient] }],
    preparation: [], variations: [], notes: [], cooksNotes: [],
    createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z',
  };
  return recipeProblems(recipe).filter((problem) => !problem.includes('.name: expected a non-blank'));
}

for (const lang of /** @type {const} */ (['en', 'pt'])) {
  test(`reads every line in the ${lang} fixtures as expected`, async () => {
    for (const { where, line, ingredient, doubts } of await fixtures(lang)) {
      const reading = parseIngredient(line, lang);
      assert.deepEqual(reading.ingredient, ingredient, `${where}: ${line}`);
      assert.deepEqual(reading.doubts.map((doubt) => doubt.code).sort(), doubts, `${where}: doubts for ${line}`);
      for (const doubt of reading.doubts.filter(({ code }) => code === 'unknown-unit')) {
        assert.equal(doubt.detail, reading.ingredient.unit, `${where}: the doubt names the new unit`);
      }
    }
  });

  test(`what the ${lang} fixtures expect is valid recipe data`, async () => {
    for (const { where, ingredient } of await fixtures(lang)) {
      assert.deepEqual(ingredientProblems(ingredient), [], where);
    }
  });

  test(`every ${lang} fixture writes and reads back unchanged, in both languages`, async () => {
    for (const { where, ingredient } of await fixtures(lang)) {
      for (const as of /** @type {const} */ (['en', 'pt'])) {
        const line = renderIngredient(ingredient, as);
        assert.deepEqual(parseIngredient(line, as).ingredient, ingredient, `${where} written in ${as} as "${line}"`);
      }
    }
  });
}

test('writes ingredients the way a recipe would', () => {
  /** @type {[Ingredient, Lang, string][]} */
  const cases = [
    [{ quantity: '2', unit: 'cup', name: 'farinha de trigo', note: '', alternatives: [] }, 'pt', '2 xícaras de farinha de trigo'],
    [{ quantity: '0.5', unit: 'kg', name: 'músculo', note: '', alternatives: [] }, 'pt', '0,5 kg de músculo'],
    [{ quantity: '1 1/2', unit: 'cup', name: 'light brown sugar', note: 'packed', alternatives: [{ quantity: '300', unit: 'g' }] }, 'en', '1 1/2 cups (300 g) light brown sugar, packed'],
    [{ quantity: '2', unit: 'count', name: 'large eggs', note: '', alternatives: [] }, 'en', '2 large eggs'],
    [{ quantity: '', unit: '', name: 'sal', note: 'a gosto', alternatives: [] }, 'pt', 'sal, a gosto'],
    [{ quantity: '1', unit: 'tablete', name: 'fermento', note: '', alternatives: [] }, 'pt', '1 tablete de fermento'],
    [{ quantity: '2', unit: 'knobs', name: 'butter', note: '', alternatives: [] }, 'en', '2 knobs of butter'],
    [{ quantity: '1', unit: 'coffee spoon', name: 'noz-moscada', note: '', alternatives: [] }, 'pt', '1 colher (café) de noz-moscada'],
    [{ quantity: '2', unit: 'cup', name: '', note: '', alternatives: [] }, 'pt', '2 xícaras'],
  ];
  for (const [ingredient, lang, expected] of cases) assert.equal(renderIngredient(ingredient, lang), expected);
});

test('amounts read naturally in each language', () => {
  assert.equal(displayAmount({ quantity: '1 1/2', unit: 'cup' }, 'pt'), '1 ½ xícaras');
  assert.equal(displayAmount({ quantity: '1/2', unit: 'cup' }, 'en'), '½ cup');
  assert.equal(displayAmount({ quantity: '500', unit: 'g' }, 'pt'), '500 g');
  assert.equal(displayAmount({ quantity: '0.5', unit: 'kg' }, 'pt'), '0,5 kg');
  assert.equal(displayAmount({ quantity: '2-3', unit: 'clove' }, 'en'), '2–3 cloves');
  assert.equal(displayAmount({ quantity: '2', unit: 'count' }, 'en'), '2');
  assert.equal(displayAmount({ quantity: '1', unit: 'tablete' }, 'pt'), '1 tablete');
  assert.equal(displayAmount({ quantity: '', unit: '' }, 'pt'), '');
});

test('falls back to explicit parts when the natural line would read differently', () => {
  const quail = { quantity: '3', unit: 'count', name: 'ovos de codorna', note: '', alternatives: [] };
  assert.equal(renderIngredient(quail, 'pt'), '3 |  | ovos de codorna');
  const bread = { quantity: '', unit: '', name: '7 grain bread', note: '', alternatives: [] };
  assert.equal(renderIngredient(bread, 'en'), ' |  | 7 grain bread');
});

test('any ingredient the editor can hold writes and reads back unchanged', () => {
  const random = mulberry32(20261020);
  const pick = (/** @type {readonly any[]} */ items) => items[Math.floor(random() * items.length)];
  const quantities = ['1', '2', '1/2', '1 1/2', '0.5', '2-3', '1.25', '12', '1500', '3/4-1'];
  const units = [...Object.keys(UNITS), 'tablete', 'copo grande', 'knobs'];
  const names = ['farinha de trigo', 'ovos de codorna', 'of rice', 'de leite', 'a gosto', 'sal', 'água', 'pão de queijo',
    'large eggs', 'bay leaves', '7 grain bread', 'e meia', 'half', 'cup', 'xícara de chá', 'to taste'];
  const notes = ['', '', 'softened', 'picada, fina', 'to taste', 'cerca de'];
  const alternatives = [[], [], [{ quantity: '100', unit: 'g' }], [{ quantity: '1', unit: 'cup' }, { quantity: '240', unit: 'ml' }]];
  for (let i = 0; i < 2000; i++) {
    const quantity = random() < 0.15 ? '' : pick(quantities);
    /** @type {Ingredient} */
    const ingredient = {
      quantity,
      unit: quantity ? pick(units) : '',
      name: pick(names),
      note: pick(notes),
      alternatives: pick(alternatives),
    };
    for (const lang of /** @type {const} */ (['en', 'pt'])) {
      const line = renderIngredient(ingredient, lang);
      assert.deepEqual(parseIngredient(line, lang).ingredient, ingredient, `"${line}" (${lang})`);
    }
  }
});

test('an Ingredients box becomes groups, with headings and blank lines', () => {
  const text = [
    'Massa:',
    '500 g de polvilho azedo',
    '',
    '- 2 ovos',
    'Recheio:',
    '200 g de queijo, ralado',
    '  ',
  ].join('\n');
  const { lines, groups } = parseIngredientList(text, 'pt');
  assert.deepEqual(lines.map((line) => line.kind), ['heading', 'ingredient', 'ingredient', 'heading', 'ingredient']);
  assert.deepEqual(groups.map((group) => [group.heading, group.items.map((item) => item.name)]), [
    ['Massa', ['polvilho azedo', 'ovos']],
    ['Recheio', ['queijo']],
  ]);
});

test('lines before the first heading form an untitled group', () => {
  const { groups } = parseIngredientList('2 cups flour\n1 tsp salt\nFor the glaze:\n1 cup sugar', 'en');
  assert.deepEqual(groups.map((group) => [group.heading, group.items.length]), [['', 2], ['For the glaze', 1]]);
  assert.deepEqual(parseIngredientList('\n \n', 'en').groups, []);
});

test('an Ingredients box writes and reads back to the same groups', () => {
  const text = 'Massa:\n500 g de polvilho azedo\n1 xícara (chá) de leite\n2 ovos\n\nRecheio:\nsal a gosto\n3 | | ovos de codorna';
  const { groups } = parseIngredientList(text, 'pt');
  const written = renderIngredientList(groups, 'pt');
  assert.equal(written, 'Massa:\n500 g de polvilho azedo\n1 xícara de leite\n2 ovos\n\nRecheio:\nsal, a gosto\n3 |  | ovos de codorna');
  assert.deepEqual(parseIngredientList(written, 'pt').groups, groups);
});

/**
 * Small seeded random numbers, so the property test is repeatable.
 * @param {number} seed
 */
function mulberry32(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
