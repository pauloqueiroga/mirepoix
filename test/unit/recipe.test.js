import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidRecipe,
  byTitle,
  isCanonicalQuantity,
  newId,
  newRecipe,
  recipeProblems,
} from '../../app/domain/recipe.js';

/** The example recipe from DECISIONS.md, D8. */
function example() {
  return {
    schema: 1,
    id: '0c9f8e4a-0000-4000-8000-000000000000',
    lang: 'en',
    title: 'Brown butter cookies',
    source: 'The Flour Diaries, p. 88',
    yield: '24 cookies',
    ingredients: [{
      heading: '',
      items: [
        { quantity: '1 1/2', unit: 'cup', name: 'light brown sugar', note: 'packed', alternatives: [{ quantity: '300', unit: 'g' }] },
        { quantity: '2', unit: 'count', name: 'large eggs', note: '', alternatives: [] },
        { quantity: '', unit: '', name: 'flaky salt', note: 'to taste', alternatives: [] },
      ],
    }],
    preparation: [{ heading: '', steps: ['Brown the butter until it smells nutty.'] }],
    variations: ['Swap 1/2 cup of the flour for rye.'],
    notes: ['Dough keeps 3 days in the fridge.'],
    cooksNotes: [{ id: 'n1', at: '2026-10-12T19:40:00Z', text: 'Rested the dough overnight.' }],
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-12T19:40:00Z',
  };
}

test('the D8 example is a valid recipe', () => {
  assert.deepEqual(recipeProblems(example()), []);
});

test('a new recipe has only its title, language and timestamps', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const recipe = newRecipe({ title: 'Pão de queijo', lang: 'pt', now });
  assert.deepEqual(recipeProblems(recipe), []);
  assert.equal(recipe.title, 'Pão de queijo');
  assert.equal(recipe.lang, 'pt');
  assert.equal(recipe.createdAt, '2026-10-20T12:00:00.000Z');
  assert.equal(recipe.updatedAt, recipe.createdAt);
  assert.deepEqual([recipe.ingredients, recipe.preparation, recipe.variations, recipe.notes, recipe.cooksNotes], [[], [], [], [], []]);
  assert.equal(newRecipe({ title: 'x' }).lang, 'en');
});

test('every new recipe gets its own random id, so devices never collide', () => {
  const ids = new Set(Array.from({ length: 100 }, () => newRecipe({ title: 'x' }).id));
  assert.equal(ids.size, 100);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('ids are made on plain http:// pages too, where browsers offer no randomUUID', () => {
  const insecure = { getRandomValues: (/** @type {Uint8Array} */ bytes) => crypto.getRandomValues(bytes) };
  const ids = new Set(Array.from({ length: 100 }, () => newId(insecure)));
  assert.equal(ids.size, 100);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('problems name the field and what was expected', () => {
  /** @type {[(recipe: any) => void, string][]} */
  const cases = [
    [(r) => { r.schema = 2; }, 'schema: expected 1'],
    [(r) => { r.id = ''; }, 'id: expected a non-empty string'],
    [(r) => { r.lang = 'fr'; }, 'lang: expected en or pt'],
    [(r) => { r.title = '  '; }, 'title: expected a non-blank string'],
    [(r) => { r.source = null; }, 'source: expected a string'],
    [(r) => { r.updatedAt = 'yesterday'; }, 'updatedAt: expected an ISO timestamp'],
    [(r) => { r.ingredients = {}; }, 'ingredients: expected a list'],
    [(r) => { r.ingredients[0] = 'flour'; }, 'ingredients[0]: expected an object'],
    [(r) => { r.ingredients[0].items[0].quantity = '1.5 cups'; }, 'ingredients[0].items[0].quantity: expected a canonical quantity'],
    [(r) => { r.ingredients[0].items[1].name = ''; }, 'ingredients[0].items[1].name: expected a non-blank string'],
    [(r) => { r.ingredients[0].items[1].note = undefined; }, 'ingredients[0].items[1].note: expected a string'],
    [(r) => { r.ingredients[0].items[2].unit = 'pinch'; }, 'ingredients[0].items[2].unit: expected empty when there is no quantity'],
    [(r) => { r.ingredients[0].items[0].alternatives[0].unit = ''; }, 'ingredients[0].items[0].alternatives[0]: expected both a quantity and a unit'],
    [(r) => { r.preparation[0].steps = [3]; }, 'preparation[0].steps[0]: expected a string'],
    [(r) => { r.notes = 'keeps well'; }, 'notes: expected a list'],
    [(r) => { r.cooksNotes[0].at = ''; }, 'cooksNotes[0].at: expected an ISO timestamp'],
    [(r) => { r.cooksNotes[0].text = ' '; }, 'cooksNotes[0].text: expected a non-blank string'],
  ];
  for (const [mutate, expected] of cases) {
    const recipe = example();
    mutate(recipe);
    const problems = recipeProblems(recipe);
    assert.ok(problems.some((problem) => problem.startsWith(expected)), `${expected}\n    got: ${problems.join(' | ')}`);
  }
});

test('anything that is not an object is rejected outright', () => {
  for (const value of [null, undefined, 'Feijoada', 3, []]) {
    assert.deepEqual(recipeProblems(value), ['recipe: expected an object']);
  }
});

test('unknown fields are allowed, so data from newer versions survives', () => {
  assert.deepEqual(recipeProblems({ ...example(), servings: 4, photos: [] }), []);
});

test('quantities are canonical text', () => {
  for (const quantity of ['', '2', '12', '0.5', '1/2', '1 1/2', '2-3', '1/2-1', '1.5-2']) {
    assert.ok(isCanonicalQuantity(quantity), quantity);
  }
  for (const quantity of ['½', '1,5', ' 2', '2 ', '1  1/2', '2 - 3', 'two', '1/2/3', '-1', '2-', '.5', '1.50', '2.0', '05', '1/0', '0/2', '0 1/2']) {
    assert.equal(isCanonicalQuantity(quantity), false, quantity);
  }
});

test('assertValidRecipe lists every problem it finds', () => {
  assert.throws(
    () => assertValidRecipe({ ...example(), title: '', lang: 'fr' }),
    (error) => error instanceof TypeError && /lang: /.test(error.message) && /title: /.test(error.message),
  );
  assert.doesNotThrow(() => assertValidRecipe(example()));
});

test('titles sort the way people read them, ignoring case and accents', () => {
  const titles = ['Shakshuka', 'pão de queijo', 'Bolo de fubá', 'Pastel', 'açaí bowl'];
  const sorted = titles.map((title) => ({ title })).sort(byTitle).map((recipe) => recipe.title);
  assert.deepEqual(sorted, ['açaí bowl', 'Bolo de fubá', 'pão de queijo', 'Pastel', 'Shakshuka']);
});
