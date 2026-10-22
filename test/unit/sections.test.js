import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseItems, parseSteps, renderItems, renderSteps } from '../../app/domain/sections.js';

/** @param {string[]} steps */
const one = (steps) => [{ heading: '', steps }];

test('one step per line, when there are no blank lines or numbers', () => {
  assert.deepEqual(parseSteps('Ferva o leite.\nEscalde o polvilho.\nAsse por 25 minutos.'),
    one(['Ferva o leite.', 'Escalde o polvilho.', 'Asse por 25 minutos.']));
});

test('blank lines separate steps, and the lines of a paragraph join up', () => {
  const pasted = 'Brown the butter until it\nsmells nutty.\n\n\nBeat in the sugar,\nthen the eggs.\n';
  assert.deepEqual(parseSteps(pasted), one(['Brown the butter until it smells nutty.', 'Beat in the sugar, then the eggs.']));
});

test('numbered steps start at each number, even with wrapped lines and no blank lines', () => {
  const pasted = '1. Preheat the oven\nto 180 °C.\n2) Mix everything.\n\n3. Bake for 25 minutes.';
  assert.deepEqual(parseSteps(pasted), one(['Preheat the oven to 180 °C.', 'Mix everything.', 'Bake for 25 minutes.']));
});

test('a short line ending in ":" starts a group of steps', () => {
  assert.deepEqual(parseSteps('Massa:\nFerva o leite.\nEscalde.\nRecheio:\nMisture os queijos.'), [
    { heading: 'Massa', steps: ['Ferva o leite.', 'Escalde.'] },
    { heading: 'Recheio', steps: ['Misture os queijos.'] },
  ]);
  assert.deepEqual(parseSteps('Mix the flour, the salt and the baking soda in a bowl:\nthen whisk.'),
    one(['Mix the flour, the salt and the baking soda in a bowl:', 'then whisk.']), 'a long line is a step');
});

test('empty boxes have no steps or items', () => {
  assert.deepEqual(parseSteps(''), []);
  assert.deepEqual(parseSteps('\n  \n'), []);
  assert.deepEqual(parseItems(''), []);
});

test('variations and notes are plain items, bullets dropped, no headings', () => {
  assert.deepEqual(parseItems('- Swap half the flour for rye.\n- Add walnuts:\n• Chill overnight.'),
    ['Swap half the flour for rye.', 'Add walnuts:', 'Chill overnight.']);
  assert.deepEqual(parseItems('Keeps 3 days in the fridge.\n\nFreezes well.'), ['Keeps 3 days in the fridge.', 'Freezes well.']);
});

test('steps and items write back as text that reads back the same', () => {
  const groups = [
    { heading: '', steps: ['Ferva o leite, o óleo e o sal.'] },
    { heading: 'Massa', steps: ['Escalde o polvilho.', 'Junte os ovos.'] },
    { heading: 'Assar', steps: ['Asse a 180 °C por 25 minutos.'] },
  ];
  assert.deepEqual(parseSteps(renderSteps(groups)), groups);
  assert.deepEqual(parseSteps(renderSteps(one(['Just one step.']))), one(['Just one step.']));
  const items = ['Swap half the flour for rye.', 'Add walnuts.'];
  assert.deepEqual(parseItems(renderItems(items)), items);
});
