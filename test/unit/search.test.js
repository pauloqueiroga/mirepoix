import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRecipe } from '../../app/domain/recipe.js';
import { fold, searchRecipes } from '../../app/domain/search.js';

/**
 * @param {string} title
 * @param {string[]} names
 * @param {string[]} [tags]
 */
function recipe(title, names, tags = []) {
  return {
    ...newRecipe({ title, id: title }),
    ingredients: [{ heading: '', items: names.map((name) => ({ quantity: '1', unit: 'count', name, note: '', alternatives: [] })) }],
    tags,
  };
}

const RECIPES = [
  recipe('Angu', ['fubá', 'água', 'sal'], ['mineiro']),
  recipe('Bolo de fubá', ['fubá', 'açúcar', 'ovos'], ['sobremesa', 'café da tarde']),
  recipe('Brown butter cookies', ['butter', 'brown sugar', 'eggs'], ['Sobremesa']),
  recipe('Pão de queijo', ['polvilho azedo', 'queijo meia-cura', 'ovos'], ['mineiro', 'café da tarde']),
  recipe('Torta de frango', ['frango', 'polvilho azedo', 'requeijão']),
];

/** @param {string} query */
const titles = (query) => searchRecipes(RECIPES, query).map((found) => found.recipe.title);

test('folding drops case and accents', () => {
  assert.equal(fold('  Pão  de QUEIJO '), 'pao de queijo');
  assert.equal(fold('Açúcar, Requeijão, Crème brûlée'), 'acucar, requeijao, creme brulee');
});

test('an empty query shows every recipe, in order', () => {
  assert.deepEqual(titles(''), RECIPES.map((r) => r.title));
  assert.deepEqual(titles('   '), RECIPES.map((r) => r.title));
});

test('titles match ignoring case and accents, both ways', () => {
  assert.deepEqual(titles('pao'), ['Pão de queijo']);
  assert.deepEqual(titles('PÃO'), ['Pão de queijo']);
  assert.deepEqual(titles('BOLO'), ['Bolo de fubá']);
});

test('ingredient names match too, and say which ingredient', () => {
  assert.deepEqual(searchRecipes(RECIPES, 'acucar').map((f) => [f.recipe.title, f.ingredients]), [['Bolo de fubá', ['açúcar']]]);
  assert.deepEqual(searchRecipes(RECIPES, 'polvilho').map((f) => [f.recipe.title, f.ingredients]), [
    ['Pão de queijo', ['polvilho azedo']],
    ['Torta de frango', ['polvilho azedo']],
  ]);
});

test('tags match too, ignoring case and accents, and say which tag', () => {
  assert.deepEqual(searchRecipes(RECIPES, 'sobremesa').map((f) => [f.recipe.title, f.ingredients, f.tags]), [
    ['Bolo de fubá', [], ['sobremesa']],
    ['Brown butter cookies', [], ['Sobremesa']],
  ]);
  assert.deepEqual(searchRecipes(RECIPES, 'cafe ovos').map((f) => [f.recipe.title, f.ingredients, f.tags]), [
    ['Bolo de fubá', ['ovos'], ['café da tarde']],
    ['Pão de queijo', ['ovos'], ['café da tarde']],
  ]);
  assert.deepEqual(titles('queijo mineiro'), ['Pão de queijo'], 'a word in the title, another in a tag');
});

test('a recipe saved before tags existed is still found', () => {
  const old = recipe('Feijoada', ['feijão preto']);
  delete (/** @type {Partial<typeof old>} */ (old)).tags;
  assert.deepEqual(searchRecipes([old], 'feijao').map((f) => f.ingredients), [['feijão preto']]);
});

test('every word must match, in the title or an ingredient', () => {
  assert.deepEqual(titles('queijo ovos'), ['Pão de queijo']);
  assert.deepEqual(titles('polvilho frango'), ['Torta de frango']);
  assert.deepEqual(titles('polvilho chocolate'), []);
});

test('recipes whose titles match come before ingredient matches', () => {
  const found = searchRecipes(RECIPES, 'fuba');
  assert.deepEqual(found.map((f) => [f.recipe.title, f.ingredients, f.tags]), [['Bolo de fubá', [], []], ['Angu', ['fubá'], []]]);
  assert.deepEqual(titles('butter'), ['Brown butter cookies']);
  assert.deepEqual(titles('ovos'), ['Bolo de fubá', 'Pão de queijo']);
  assert.deepEqual(titles('de'), ['Bolo de fubá', 'Pão de queijo', 'Torta de frango']);
});

test('nothing matching means an empty list', () => {
  assert.deepEqual(searchRecipes(RECIPES, 'lasanha'), []);
});
