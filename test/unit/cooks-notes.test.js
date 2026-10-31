import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCooksNote, lastCooksNote, mergeCooksNotes, newestFirst } from '../../app/domain/cooks-notes.js';
import { newRecipe, recipeProblems } from '../../app/domain/recipe.js';

// Cook's notes (R3.3, D16): dated, append-only, and they merge.

const created = new Date('2026-10-01T10:00:00Z');

/** @param {string} id @param {string} at @param {string} [text] */
const note = (id, at, text = `note ${id}`) => ({ id, at, text });

test('a note is added with its own id and the time it was written', () => {
  const recipe = newRecipe({ title: 'Pão de queijo', lang: 'pt', now: created });
  const noted = addCooksNote(recipe, '  A massa ficou mole: usei 50 g a mais de polvilho.\r\n\r\nFicou ótimo.  ',
    { id: 'n1', now: new Date('2026-10-19T22:42:00Z') });
  assert.deepEqual(noted.cooksNotes, [
    { id: 'n1', at: '2026-10-19T22:42:00.000Z', text: 'A massa ficou mole: usei 50 g a mais de polvilho.\n\nFicou ótimo.' },
  ]);
  assert.deepEqual(recipeProblems(noted), []);
});

test('adding a note leaves the recipe itself alone, update time included', () => {
  const recipe = { ...newRecipe({ title: 'Bolo', now: created }), cooksNotes: [note('n1', '2026-10-02T10:00:00Z')] };
  const before = structuredClone(recipe);
  const noted = addCooksNote(recipe, 'Less sugar next time.', { now: new Date('2026-10-20T10:00:00Z') });
  assert.deepEqual({ ...noted, cooksNotes: [] }, { ...recipe, cooksNotes: [] });
  assert.equal(noted.updatedAt, recipe.updatedAt);
  assert.deepEqual(noted.cooksNotes.slice(0, 1), recipe.cooksNotes, 'earlier notes stay, first');
  assert.equal(noted.cooksNotes.length, 2);
  assert.deepEqual(recipe, before, 'the recipe passed in is not changed');
});

test('every note gets its own random id', () => {
  let recipe = newRecipe({ title: 'Bolo' });
  for (let i = 0; i < 20; i++) recipe = addCooksNote(recipe, `try ${i}`);
  assert.equal(new Set(recipe.cooksNotes.map((n) => n.id)).size, 20);
});

test('a blank note is refused', () => {
  const recipe = newRecipe({ title: 'Bolo' });
  for (const text of ['', '   ', '\n\n']) assert.throws(() => addCooksNote(recipe, text), TypeError);
});

test('"Last time" is the newest note, wherever it sits in the list', () => {
  assert.equal(lastCooksNote({ cooksNotes: [] }), undefined);
  const cooksNotes = [note('b', '2026-10-12T19:40:00Z'), note('c', '2026-10-30T08:00:00.000Z'), note('a', '2026-09-01T12:00:00Z')];
  assert.equal(lastCooksNote({ cooksNotes })?.id, 'c');
  assert.deepEqual(newestFirst({ cooksNotes }).map((n) => n.id), ['c', 'b', 'a']);
});

test('notes from two copies merge: every note once, oldest first', () => {
  const ours = [note('a', '2026-10-01T10:00:00Z'), note('c', '2026-10-03T10:00:00Z')];
  const theirs = [note('b', '2026-10-02T10:00:00Z'), note('a', '2026-10-01T10:00:00.000Z'), note('d', '2026-10-04T10:00:00Z')];
  const merged = mergeCooksNotes(ours, theirs);
  assert.deepEqual(merged.map((n) => n.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(mergeCooksNotes(theirs, ours).map((n) => n.id), ['a', 'b', 'c', 'd'], 'either way round');
  assert.deepEqual(mergeCooksNotes(merged, ours), merged, 'merging again changes nothing');
  assert.deepEqual(mergeCooksNotes([], []), []);
});

test('notes written at the same moment come out in the same order on every device', () => {
  const at = '2026-10-01T10:00:00Z';
  assert.deepEqual(mergeCooksNotes([note('y', at)], [note('x', at)]).map((n) => n.id), ['x', 'y']);
  assert.deepEqual(mergeCooksNotes([note('x', at)], [note('y', at)]).map((n) => n.id), ['x', 'y']);
});
