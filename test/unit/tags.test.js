import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRecipe, recipeProblems } from '../../app/domain/recipe.js';
import { allTags, parseTags, renderTags, sameTag, tagsOf, withTags } from '../../app/domain/tags.js';

// Tags (R3.4, R3.5, D17).

/**
 * @param {string} title
 * @param {string[] | undefined} tags
 */
function recipe(title, tags) {
  const made = { ...newRecipe({ title, id: title }), tags };
  if (!tags) delete made.tags;
  return made;
}

test('commas separate tags, and spaces around them go', () => {
  assert.deepEqual(parseTags('sobremesa, natal,sem glúten '), ['sobremesa', 'natal', 'sem glúten']);
  assert.deepEqual(parseTags('  weeknight   dinner  '), ['weeknight dinner']);
  assert.deepEqual(parseTags(''), []);
  assert.deepEqual(parseTags(' , ,, '), []);
});

test('a leading # is dropped, so hashtags work too', () => {
  assert.deepEqual(parseTags('#vegan, ## quick, c#'), ['vegan', 'quick', 'c#']);
  assert.deepEqual(parseTags('#'), []);
});

test('tags are kept as typed, once each, ignoring case and accents', () => {
  assert.deepEqual(parseTags('Natal, natal, NATAL, Sobremesa, sobremésa'), ['Natal', 'Sobremesa']);
  assert.ok(sameTag('Pão', 'pao'));
  assert.ok(!sameTag('pão', 'pães'));
});

test('tags written back read back to the same tags, and make valid recipes', () => {
  for (const tags of [[], ['sobremesa'], ['Natal', 'sem glúten', 'c#']]) {
    assert.deepEqual(parseTags(renderTags(tags)), tags);
    assert.deepEqual(recipeProblems({ ...newRecipe({ title: 'x' }), tags }), []);
  }
  assert.equal(renderTags(['sobremesa', 'natal']), 'sobremesa, natal');
});

test('a recipe saved before tags existed has none', () => {
  assert.deepEqual(tagsOf(recipe('Old', undefined)), []);
  assert.deepEqual(tagsOf(recipe('New', ['natal'])), ['natal']);
});

test('every tag in use is listed once, alphabetically, the way most recipes write it', () => {
  const recipes = [
    recipe('a', ['natal', 'Sobremesa']),
    recipe('b', ['Natal', 'sobremesa']),
    recipe('c', ['Natal', 'açúcar mascavo']),
    recipe('d', undefined),
    recipe('e', ['10 minutes', '2 minutes']),
  ];
  assert.deepEqual(allTags(recipes), ['2 minutes', '10 minutes', 'açúcar mascavo', 'Natal', 'sobremesa']);
  assert.deepEqual(allTags([]), []);
});

test('filtering keeps recipes with every tag asked for', () => {
  const recipes = [
    recipe('Brigadeiro', ['sobremesa', 'festa']),
    recipe('Pudim', ['Sobremesa']),
    recipe('Coxinha', ['festa', 'salgado']),
    recipe('Old', undefined),
  ];
  /** @param {string[]} tags */
  const titles = (tags) => withTags(recipes, tags).map((r) => r.title);
  assert.deepEqual(titles([]), ['Brigadeiro', 'Pudim', 'Coxinha', 'Old']);
  assert.deepEqual(titles(['sobremesa']), ['Brigadeiro', 'Pudim'], 'ignoring case');
  assert.deepEqual(titles(['FESTA']), ['Brigadeiro', 'Coxinha']);
  assert.deepEqual(titles(['sobremesa', 'festa']), ['Brigadeiro'], 'all of them, not any');
  assert.deepEqual(titles(['natal']), []);
});
