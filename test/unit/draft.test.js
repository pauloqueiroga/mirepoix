import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftOf, readDraft } from '../../app/domain/draft.js';
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

/** A recipe with everything in it, including things the editor doesn't show. */
function savedRecipe() {
  return {
    schema: /** @type {const} */ (1),
    id: 'r9',
    lang: /** @type {const} */ ('pt'),
    title: 'Pão de queijo',
    source: 'Family notebook',
    yield: '30 unidades',
    ingredients: [
      { heading: 'Massa', items: [
        { quantity: '500', unit: 'g', name: 'polvilho azedo', note: '', alternatives: [] },
        { quantity: '1 1/2', unit: 'cup', name: 'queijo meia-cura', note: 'ralado', alternatives: [{ quantity: '150', unit: 'g' }] },
        { quantity: '3', unit: 'count', name: 'ovos de codorna', note: '', alternatives: [] },
      ] },
      { heading: 'Para finalizar', items: [{ quantity: '', unit: '', name: 'sal', note: 'a gosto', alternatives: [] }] },
    ],
    preparation: [{ heading: 'Massa', steps: ['Ferva o leite.', 'Escalde o polvilho.'] }, { heading: 'Assar', steps: ['Asse a 180 °C.'] }],
    variations: ['Use queijo canastra.'],
    notes: ['Congela bem.', 'Asse direto do congelador.'],
    cooksNotes: [{ id: 'n1', at: '2026-10-12T19:40:00Z', text: 'Ficou ótimo.' }],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-12T19:40:00.000Z',
    servings: 30,
  };
}

test('a saved recipe, opened and saved untouched, changes only its update time', () => {
  const recipe = savedRecipe();
  const { recipe: saved, problems } = readDraft(draftOf(recipe), { base: recipe, now });
  assert.deepEqual(problems, []);
  assert.deepEqual(saved, { ...recipe, updatedAt: '2026-10-20T18:00:00.000Z' });
});

test('editing keeps the id, creation time, cook\'s notes and fields from newer versions', () => {
  const recipe = savedRecipe();
  const draft = { ...draftOf(recipe), title: 'Pão de queijo mineiro', lang: /** @type {const} */ ('pt'), notes: '' };
  const { recipe: saved } = readDraft(draft, { base: recipe, now });
  assert.ok(saved);
  assert.equal(saved.title, 'Pão de queijo mineiro');
  assert.deepEqual(saved.notes, []);
  assert.equal(saved.id, 'r9');
  assert.equal(saved.createdAt, recipe.createdAt);
  assert.deepEqual(saved.cooksNotes, recipe.cooksNotes);
  assert.equal(/** @type {Record<string, unknown>} */ (saved).servings, 30);
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
