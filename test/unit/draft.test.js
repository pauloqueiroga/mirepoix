import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDraft } from '../../app/domain/draft.js';
import { recipeProblems } from '../../app/domain/recipe.js';

const now = new Date('2026-10-20T18:00:00Z');

test('a titled draft with ingredients becomes a valid recipe', () => {
  const { recipe, problems } = readDraft({
    title: '  Pão de queijo ',
    lang: 'pt',
    ingredients: 'Massa:\n500 g de polvilho azedo\n\npitada de sal\n2 xícaras (200 g) de queijo meia-cura ralado',
  }, { id: 'r1', now });
  assert.deepEqual(problems, []);
  assert.ok(recipe);
  assert.deepEqual(recipeProblems(recipe), []);
  assert.equal(recipe.id, 'r1');
  assert.equal(recipe.title, 'Pão de queijo');
  assert.equal(recipe.lang, 'pt');
  assert.equal(recipe.createdAt, '2026-10-20T18:00:00.000Z');
  assert.deepEqual(recipe.ingredients, [{
    heading: 'Massa',
    items: [
      { quantity: '500', unit: 'g', name: 'polvilho azedo', note: '', alternatives: [] },
      { quantity: '1', unit: 'pinch', name: 'sal', note: '', alternatives: [] },
      { quantity: '2', unit: 'cup', name: 'queijo meia-cura ralado', note: '', alternatives: [{ quantity: '200', unit: 'g' }] },
    ],
  }]);
});

test('source, makes, preparation, variations and notes come along', () => {
  const { recipe } = readDraft({
    title: 'Pão de queijo',
    lang: 'pt',
    source: ' Family notebook ',
    yield: '30 pieces ',
    ingredients: '500 g de polvilho azedo',
    preparation: 'Ferva o leite.\n\nEscalde o polvilho\ncom a mistura quente.',
    variations: '- Use queijo canastra.',
    notes: 'Congela bem.',
  }, { id: 'r2', now });
  assert.ok(recipe);
  assert.deepEqual(recipeProblems(recipe), []);
  assert.equal(recipe.source, 'Family notebook');
  assert.equal(recipe.yield, '30 pieces');
  assert.deepEqual(recipe.preparation, [{ heading: '', steps: ['Ferva o leite.', 'Escalde o polvilho com a mistura quente.'] }]);
  assert.deepEqual(recipe.variations, ['Use queijo canastra.']);
  assert.deepEqual(recipe.notes, ['Congela bem.']);
});

test('a recipe needs a title', () => {
  const { recipe, problems } = readDraft({ title: '   ', lang: 'en', ingredients: '2 eggs' });
  assert.equal(recipe, null);
  assert.deepEqual(problems, ['Give the recipe a title.']);
});

test('every ingredient needs a name, and the problem says which line', () => {
  const { recipe, problems } = readDraft({ title: 'Cookies', lang: 'en', ingredients: '2 eggs\n\n2 cups\n1 tsp' });
  assert.equal(recipe, null);
  assert.deepEqual(problems, ['Line 3 has no ingredient name.', 'Line 4 has no ingredient name.']);
});

test('doubtful lines do not block saving', () => {
  const { recipe, lines } = readDraft({ title: 'Bread', lang: 'pt', ingredients: '1 tablete de fermento biológico' });
  assert.ok(recipe);
  const [line] = lines;
  assert.ok(line?.kind === 'ingredient' && line.doubts.some((doubt) => doubt.code === 'unknown-unit'));
});

test('a recipe can start with no ingredients at all', () => {
  const { recipe } = readDraft({ title: 'Ideas for Sunday', lang: 'en', ingredients: '' });
  assert.deepEqual(recipe?.ingredients, []);
});
