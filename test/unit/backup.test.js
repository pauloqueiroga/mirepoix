import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportFile, mergePlan, readExport } from '../../app/domain/backup.js';
import { newRecipe } from '../../app/domain/recipe.js';

const noon = new Date(2026, 9, 20, 12, 0, 0);

/**
 * @param {string} title
 * @param {string} id
 * @param {string} [updatedAt]
 */
function recipe(title, id, updatedAt = '2026-10-01T10:00:00.000Z') {
  return { ...newRecipe({ title, id, now: new Date('2026-10-01T10:00:00Z') }), updatedAt };
}

test('an export is one versioned file, named after the day', () => {
  const recipes = [recipe('Feijoada', 'a'), recipe('Pão de queijo', 'b')];
  const { name, text } = exportFile(recipes, noon);
  assert.equal(name, 'mirepoix-recipes-2026-10-20.json');
  const data = JSON.parse(text);
  assert.equal(data.format, 'mirepoix-recipes');
  assert.equal(data.version, 1);
  assert.equal(data.exportedAt, noon.toISOString());
  assert.deepEqual(data.recipes, recipes);
});

test('an export reads back to the same recipes', () => {
  const recipes = [recipe('Feijoada', 'a'), { ...recipe('Pão de queijo', 'b'), servings: 30 }];
  assert.deepEqual(readExport(exportFile(recipes, noon).text), { recipes, skipped: 0 });
});

test('files that are not Mirepoix exports are refused with a reason', () => {
  assert.deepEqual(readExport('not json at all'), { error: 'not-an-export' });
  assert.deepEqual(readExport('{"recipes": []}'), { error: 'not-an-export' });
  assert.deepEqual(readExport('[1, 2]'), { error: 'not-an-export' });
  assert.deepEqual(readExport('{"format": "mirepoix-recipes", "version": 2, "recipes": []}'), { error: 'too-new' });
  assert.deepEqual(readExport('{"format": "mirepoix-recipes", "version": 1}'), { error: 'no-recipes' });
});

test('recipes that are not valid are skipped and counted, never imported', () => {
  const good = recipe('Feijoada', 'a');
  const text = JSON.stringify({ format: 'mirepoix-recipes', version: 1, recipes: [good, { title: 'half a recipe' }, { ...good, id: 'c', title: '' }] });
  assert.deepEqual(readExport(text), { recipes: [good], skipped: 2 });
});

test('importing adds new recipes and keeps the newer version of the same one', () => {
  const here = [recipe('Feijoada', 'a', '2026-10-10T10:00:00.000Z'), recipe('Bolo', 'b', '2026-10-10T10:00:00.000Z')];
  const incoming = [
    recipe('Feijoada (older)', 'a', '2026-10-05T10:00:00Z'),
    recipe('Bolo de fubá', 'b', '2026-10-15T10:00:00Z'),
    recipe('Pão de queijo', 'c'),
  ];
  const plan = mergePlan(here, incoming);
  assert.deepEqual(plan.put.map((r) => r.title), ['Bolo de fubá', 'Pão de queijo']);
  assert.deepEqual([plan.added, plan.updated, plan.unchanged], [1, 1, 1]);
});

test('the same moment written two ways is not newer', () => {
  const plan = mergePlan([recipe('Feijoada', 'a', '2026-10-10T10:00:00.000Z')], [recipe('Feijoada', 'a', '2026-10-10T10:00:00Z')]);
  assert.deepEqual([plan.put.length, plan.unchanged], [0, 1]);
});

/** @param {string} id @param {string} at */
const note = (id, at) => ({ id, at, text: `note ${id}` });

test('cook\'s notes from both copies are kept, whichever copy\'s text wins (R3.3)', () => {
  const ours = { ...recipe('Pão de queijo', 'a', '2026-10-10T10:00:00Z'), cooksNotes: [note('n1', '2026-10-11T10:00:00Z')] };
  const older = { ...recipe('Pão de queijo (older text)', 'a', '2026-10-05T10:00:00Z'), cooksNotes: [note('n2', '2026-10-12T10:00:00Z')] };
  const newer = { ...recipe('Pão de queijo mineiro', 'a', '2026-10-15T10:00:00Z'), cooksNotes: [note('n3', '2026-10-16T10:00:00Z')] };

  const fromOlder = mergePlan([ours], [older]);
  assert.deepEqual([fromOlder.added, fromOlder.updated, fromOlder.unchanged], [0, 1, 0]);
  assert.deepEqual(fromOlder.put, [{ ...ours, cooksNotes: [ours.cooksNotes[0], older.cooksNotes[0]] }], 'our text, both notes');

  const fromNewer = mergePlan([ours], [newer]);
  assert.deepEqual(fromNewer.put, [{ ...newer, cooksNotes: [ours.cooksNotes[0], newer.cooksNotes[0]] }], 'their text, both notes');
});

test('a copy with no notes we lack, and no newer text, changes nothing', () => {
  const ours = { ...recipe('Bolo', 'a', '2026-10-10T10:00:00Z'), cooksNotes: [note('n1', '2026-10-11T10:00:00Z'), note('n2', '2026-10-12T10:00:00Z')] };
  const theirs = { ...ours, cooksNotes: [note('n1', '2026-10-11T10:00:00Z')] };
  assert.deepEqual(mergePlan([ours], [theirs]), { put: [], added: 0, updated: 0, unchanged: 1 });
});

test('importing into an empty recipe box adds everything', () => {
  const incoming = [recipe('Feijoada', 'a'), recipe('Pão de queijo', 'b')];
  assert.deepEqual(mergePlan([], incoming), { put: incoming, added: 2, updated: 0, unchanged: 0 });
});
