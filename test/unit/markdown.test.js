import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIngredientList } from '../../app/domain/ingredients.js';
import { recipeFile, recipeMarkdown, recipesFile, slug } from '../../app/domain/markdown.js';
import { newRecipe } from '../../app/domain/recipe.js';
import { parseItems, parseSteps } from '../../app/domain/sections.js';

/** @typedef {import('../../app/domain/recipe.js').Recipe} Recipe */
/** @typedef {import('../../app/domain/markdown.js').Words} Words */

/** @type {Record<'en' | 'pt', Words>} */
const WORDS = {
  en: { makes: (amount) => `Makes ${amount}`, tags: 'Tags', ingredients: 'Ingredients', preparation: 'Preparation', variations: 'Variations', notes: 'Notes', cooksNotes: 'Cook’s notes', day: (at) => at.slice(0, 10) },
  pt: { makes: (amount) => `Rende ${amount}`, tags: 'Etiquetas', ingredients: 'Ingredientes', preparation: 'Modo de preparo', variations: 'Variações', notes: 'Notas', cooksNotes: 'Notas de quem cozinhou', day: (at) => at.slice(0, 10) },
};

/** @param {string} quantity @param {string} unit @param {string} name @param {string} [note] */
const item = (quantity, unit, name, note = '', alternatives = /** @type {{ quantity: string, unit: string }[]} */ ([])) =>
  ({ quantity, unit, name, note, alternatives });

/** @type {Recipe} */
const COOKIES = {
  ...newRecipe({ title: 'Brown butter cookies', id: 'c1', now: new Date('2026-10-01T10:00:00Z') }),
  source: 'The Flour Diaries, p. 88',
  yield: '24 cookies',
  tags: ['dessert', 'weeknight'],
  ingredients: [
    { heading: '', items: [item('1 1/2', 'cup', 'light brown sugar', 'packed', [{ quantity: '300', unit: 'g' }]), item('2', 'count', 'large eggs'), item('', '', 'flaky salt', 'to taste')] },
    { heading: 'For the glaze', items: [item('3', 'count', 'pieces of toast'), item('1', 'knob', 'butter')] },
  ],
  preparation: [
    { heading: '', steps: ['Brown the butter until it smells nutty.', 'Beat in the sugar.'] },
    { heading: 'Glaze', steps: ['Whisk it all.'] },
  ],
  variations: ['Swap 1/2 cup of the flour for rye.'],
  notes: ['Dough keeps 3 days in the fridge.', 'Freezes well.'],
  cooksNotes: [
    { id: 'n2', at: '2026-10-20T19:40:00Z', text: 'Halved the sugar.\nStill good.' },
    { id: 'n1', at: '2026-10-12T19:40:00Z', text: 'Rested the dough overnight.' },
  ],
};

test('a recipe reads as Markdown: title, source and makes, tags, then each section', () => {
  assert.equal(recipeMarkdown(COOKIES, WORDS.en), `# Brown butter cookies

The Flour Diaries, p. 88 · Makes 24 cookies  
Tags: dessert, weeknight

## Ingredients

- 1 1/2 cups (300 g) light brown sugar, packed
- 2 large eggs
- flaky salt, to taste

For the glaze:

- 3 |  | pieces of toast
- 1 knob of butter

## Preparation

1. Brown the butter until it smells nutty.
2. Beat in the sugar.

Glaze:

3. Whisk it all.

## Variations

- Swap 1/2 cup of the flour for rye.

## Notes

Dough keeps 3 days in the fridge.

Freezes well.

## Cook’s notes

- 2026-10-12: Rested the dough overnight.
- 2026-10-20: Halved the sugar.
  Still good.
`);
});

test('each section pastes back into the editor as the same groups, steps and items', () => {
  const markdown = recipeMarkdown(COOKIES, WORDS.en);
  /** @param {string} heading */
  const section = (heading) => markdown.split(`## ${heading}\n\n`)[1]?.split('\n## ')[0] ?? '';
  assert.deepEqual(parseIngredientList(section('Ingredients'), 'en').groups, COOKIES.ingredients);
  assert.deepEqual(parseSteps(section('Preparation')), COOKIES.preparation);
  assert.deepEqual(parseItems(section('Variations')), COOKIES.variations);
  assert.deepEqual(parseItems(section('Notes')), COOKIES.notes);
});

test('Mirepoix\'s words come in the recipe\'s language, and what is empty is left out', () => {
  const pao = { ...newRecipe({ title: 'Pão de queijo', lang: 'pt', id: 'p1' }), yield: '30 unidades', ingredients: [{ heading: '', items: [item('2', 'cup', 'polvilho', '', [{ quantity: '240', unit: 'g' }])] }] };
  assert.equal(recipeMarkdown(pao, WORDS.pt), '# Pão de queijo\n\nRende 30 unidades\n\n## Ingredientes\n\n- 2 xícaras (240 g) de polvilho\n');
  assert.equal(recipeMarkdown(newRecipe({ title: 'Toast', id: 't' }), WORDS.en), '# Toast\n');
});

test('one recipe is a file named after it', () => {
  assert.deepEqual(recipeFile(COOKIES, WORDS.en).name, 'brown-butter-cookies.md');
  assert.equal(slug('Pão de queijo (da vó)'), 'pao-de-queijo-da-vo');
  assert.equal(slug('Crème brûlée, 2×!'), 'creme-brulee-2');
  assert.equal(slug('🍪'), 'recipe');
  assert.ok(slug('a'.repeat(100)).length <= 60);
});

test('every recipe goes in one file, by title, in each one\'s language, named after the day', () => {
  const pao = { ...newRecipe({ title: 'Pão de queijo', lang: 'pt', id: 'p1' }), notes: ['Congela bem.'] };
  const toast = newRecipe({ title: 'Apple toast', id: 't' });
  const file = recipesFile([pao, toast], (lang) => WORDS[lang], new Date(2026, 10, 9, 23, 30));
  assert.equal(file.name, 'mirepoix-recipes-2026-11-09.md');
  assert.equal(file.text, '# Apple toast\n\n---\n\n# Pão de queijo\n\n## Notas\n\nCongela bem.\n');
});
