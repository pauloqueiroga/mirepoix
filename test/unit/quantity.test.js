import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayQuantity, formatQuantity, quantityValue, readQuantity, wordsToDigits } from '../../app/domain/quantity.js';
import { isCanonicalQuantity } from '../../app/domain/recipe.js';

/** @type {[string, 'en' | 'pt', string, string][]} text, lang, quantity, rest */
const readings = [
  ['2 cups', 'en', '2', 'cups'],
  ['500g', 'pt', '500', 'g'],
  ['007 eggs', 'en', '7', 'eggs'],
  ['1/2 cup', 'en', '1/2', 'cup'],
  ['½ xícara', 'pt', '1/2', 'xícara'],
  ['1½ cups', 'en', '1 1/2', 'cups'],
  ['1 ½ cups', 'en', '1 1/2', 'cups'],
  ['1 1/2 cups', 'en', '1 1/2', 'cups'],
  ['1-1/2 cups', 'en', '1 1/2', 'cups'],
  ['1⁄4 tsp', 'en', '1/4', 'tsp'],
  ['1 e 1/2 xícara', 'pt', '1 1/2', 'xícara'],
  ['1 and 1/2 cups', 'en', '1 1/2', 'cups'],
  ['1 e meia xícara', 'pt', '1 1/2', 'xícara'],
  ['2 and a half cups', 'en', '2 1/2', 'cups'],
  ['0.5 kg', 'en', '0.5', 'kg'],
  ['.5 kg', 'en', '0.5', 'kg'],
  ['1.50 lb', 'en', '1.5', 'lb'],
  ['2.0 l', 'en', '2', 'l'],
  ['1,5 kg', 'pt', '1.5', 'kg'],
  ['1,5 kg', 'en', '1.5', 'kg'],
  ['0,25 l', 'pt', '0.25', 'l'],
  ['1,500 g', 'en', '1500', 'g'],
  ['1,500 kg', 'pt', '1.5', 'kg'],
  ['1.500 g', 'pt', '1500', 'g'],
  ['1.500 kg', 'en', '1.5', 'kg'],
  ['0,125 kg', 'pt', '0.125', 'kg'],
  ['2-3 cloves', 'en', '2-3', 'cloves'],
  ['2 - 3 cloves', 'en', '2-3', 'cloves'],
  ['2–3 cloves', 'en', '2-3', 'cloves'],
  ['2 to 3 tbsp', 'en', '2-3', 'tbsp'],
  ['1 or 2 limes', 'en', '1-2', 'limes'],
  ['2 a 3 colheres', 'pt', '2-3', 'colheres'],
  ['2 ou 3 tomates', 'pt', '2-3', 'tomates'],
  ['1/2-1 cup', 'en', '1/2-1', 'cup'],
  ['1 1/2-2 cups', 'en', '1 1/2-2', 'cups'],
  ['2 a pinch', 'en', '2', 'a pinch'],
  ['1/0 cup', 'en', '1', '/0 cup'],
  ['3', 'en', '3', ''],
];

test('reads what people write into canonical quantities', () => {
  for (const [text, lang, quantity, rest] of readings) {
    assert.deepEqual(readQuantity(text, lang), { quantity, rest }, `${text} (${lang})`);
    assert.ok(isCanonicalQuantity(quantity), `${quantity} is canonical`);
  }
});

test('numbers written as words become digits, in English and Portuguese', () => {
  /** @type {[string, string][]} */
  const cases = [
    ['two eggs', '2 eggs'],
    ['Twelve sprigs', '12 sprigs'],
    ['twenty-five almonds', '25 almonds'],
    ['twenty five almonds', '25 almonds'],
    ['vinte e cinco gramas', '25 gramas'],
    ['três xícaras', '3 xícaras'],
    ['duas colheres', '2 colheres'],
    ['two or three cloves', '2 or 3 cloves'],
    ['quatro a cinco tomates', '4 a 5 tomates'],
    ['three quarters of a cup', '3/4 of a cup'],
    ['three-quarters cup', '3/4 cup'],
    ['dois terços de xícara', '2/3 de xícara'],
    ['a quarter cup', '1/4 cup'],
    ['um quarto de xícara', '1/4 de xícara'],
    ['half an onion', '1/2 onion'],
    ['meia cebola', '1/2 cebola'],
    ['uma e meia xícara', '1 e meia xícara'],
  ];
  for (const [text, expected] of cases) assert.equal(wordsToDigits(text), expected, text);
});

test('words that only look like numbers are left alone', () => {
  for (const text of ['five-spice powder', 'an egg', 'a pinch of salt', 'um pouco de sal', 'uma pouquinho', 'one-pot rice', 'salt']) {
    assert.equal(wordsToDigits(text), text, text);
  }
  assert.deepEqual(readQuantity('um pouco de sal', 'pt'), null);
  assert.deepEqual(readQuantity('two or three eggs', 'en'), { quantity: '2-3', rest: 'eggs' });
});

test('text that does not start with a number has no quantity', () => {
  for (const text of ['salt', '', 'a pinch of salt', 'about 2 cups', '-2 eggs']) {
    assert.equal(readQuantity(text, 'en'), null, text);
  }
});

test('Portuguese writes decimals with a comma', () => {
  assert.equal(formatQuantity('1.5', 'pt'), '1,5');
  assert.equal(formatQuantity('0.25-0.5', 'pt'), '0,25-0,5');
  assert.equal(formatQuantity('1 1/2', 'pt'), '1 1/2');
  assert.equal(formatQuantity('1.5', 'en'), '1.5');
});

test('formatted quantities read back to the same canonical form', () => {
  for (const quantity of ['2', '0.5', '0.125', '1.25', '1 1/2', '3/4', '2-3', '1/2-1', '1500']) {
    for (const lang of /** @type {const} */ (['en', 'pt'])) {
      assert.equal(readQuantity(formatQuantity(quantity, lang), lang)?.quantity, quantity, `${quantity} (${lang})`);
    }
  }
});

test('quantities show with fraction glyphs and real dashes for reading', () => {
  assert.equal(displayQuantity('1 1/2', 'en'), '1 ½');
  assert.equal(displayQuantity('3/4', 'en'), '¾');
  assert.equal(displayQuantity('2-3', 'en'), '2–3');
  assert.equal(displayQuantity('1/2-1', 'pt'), '½–1');
  assert.equal(displayQuantity('0.5', 'pt'), '0,5');
  assert.equal(displayQuantity('3/16', 'en'), '3/16');
  assert.equal(displayQuantity('1500', 'pt'), '1500');
});

test('the value of a quantity is its largest amount', () => {
  assert.equal(quantityValue('2'), 2);
  assert.equal(quantityValue('1 1/2'), 1.5);
  assert.equal(quantityValue('1/2'), 0.5);
  assert.equal(quantityValue('0.25'), 0.25);
  assert.equal(quantityValue('2-3'), 3);
  assert.equal(quantityValue(''), 0);
});
