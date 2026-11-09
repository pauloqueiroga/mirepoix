import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCanonicalQuantity } from '../../app/domain/recipe.js';
import { SAME, over, quantityRatio, ratio, ratioQuantity, scaleIngredient, scaleQuantity, scaleYield, yieldAmount } from '../../app/domain/scale.js';

const half = ratio(1, 2);
const double = ratio(2);
const triple = ratio(3);
const half_again = ratio(3, 2);

test('quantities become exact fractions', () => {
  assert.deepEqual(quantityRatio('2'), { n: 2, d: 1 });
  assert.deepEqual(quantityRatio('1 1/2'), { n: 3, d: 2 });
  assert.deepEqual(quantityRatio('0.25'), { n: 1, d: 4 });
  assert.deepEqual(quantityRatio('2/4'), { n: 1, d: 2 });
  assert.equal(quantityRatio(''), null);
  assert.equal(quantityRatio('2-3'), null);
});

test('scaling is exact where a kitchen can measure it', () => {
  assert.equal(scaleQuantity('1 1/2', double, 'cup'), '3');
  assert.equal(scaleQuantity('1/3', half, 'cup'), '1/6');
  assert.equal(scaleQuantity('3/4', half, 'tsp'), '3/8');
  assert.equal(scaleQuantity('2/3', half_again, 'cup'), '1');
  assert.equal(scaleQuantity('3', half, 'count'), '1 1/2');
  assert.equal(scaleQuantity('1/2', triple, 'lb'), '1 1/2');
});

test('awkward fractions round to the nearest eighth or third', () => {
  // 24 cookies made as 30: ×5/4
  assert.equal(scaleQuantity('1/3', ratio(5, 4), 'cup'), '3/8');
  assert.equal(scaleQuantity('1', ratio(5, 4), 'tsp'), '1 1/4');
  assert.equal(scaleQuantity('1 3/4', ratio(7, 5), 'cup'), '2 1/2');
  assert.equal(scaleQuantity('2', ratio(39, 40), 'cup'), '2', 'rounds up to a whole');
  assert.equal(scaleQuantity('1/8', half, 'tsp'), '1/16', 'too small to round away');
});

test('grams and millilitres round to whole numbers; kilos and litres keep decimals', () => {
  assert.equal(scaleQuantity('437', half_again, 'g'), '656');
  assert.equal(scaleQuantity('250', ratio(1, 3), 'ml'), '83');
  assert.equal(scaleQuantity('5', half, 'g'), '2.5');
  assert.equal(scaleQuantity('7', ratio(1, 3), 'g'), '2.3');
  assert.equal(scaleQuantity('1/2', ratio(1, 3), 'kg'), '0.17');
  assert.equal(scaleQuantity('1.5', ratio(1, 3), 'l'), '0.5');
  assert.equal(scaleQuantity('0.75', ratio(5, 4), 'lb'), '0.94', 'written with decimals, kept in decimals');
});

test('ranges scale at both ends, and nothing changes at ×1 or without an amount', () => {
  assert.equal(scaleQuantity('2-3', double, 'clove'), '4-6');
  assert.equal(scaleQuantity('1-1', double, 'cup'), '2');
  assert.equal(scaleQuantity('1/3', SAME, 'cup'), '1/3');
  assert.equal(scaleQuantity('', triple, ''), '');
});

test('everything scaling makes is a canonical quantity', () => {
  const factors = [half, double, triple, half_again, ratio(1, 3), ratio(5, 4), ratio(7, 3), ratio(13, 10)];
  for (const quantity of ['1', '1/2', '1 1/2', '0.5', '2-3', '1/3', '437', '3/4', '0.25', '1/8', '12']) {
    for (const unit of ['cup', 'g', 'kg', 'ml', 'count', 'tablete']) {
      for (const factor of factors) {
        const scaled = scaleQuantity(quantity, factor, unit);
        assert.ok(isCanonicalQuantity(scaled), `${quantity} ${unit} × ${factor.n}/${factor.d} = "${scaled}"`);
      }
    }
  }
});

test('an ingredient scales with its equivalents, and keeps the rest', () => {
  const butter = { quantity: '2', unit: 'cup', name: 'butter', note: 'softened', alternatives: [{ quantity: '437', unit: 'g' }] };
  assert.deepEqual(scaleIngredient(butter, half), { ...butter, quantity: '1', alternatives: [{ quantity: '219', unit: 'g' }] });
  const salt = { quantity: '', unit: '', name: 'salt', note: 'to taste', alternatives: [] };
  assert.deepEqual(scaleIngredient(salt, triple), salt);
});

test('the number in Makes is found for scaling by servings', () => {
  assert.deepEqual(yieldAmount('24 cookies', 'en'), { before: '', quantity: '24', amount: { n: 24, d: 1 }, after: 'cookies' });
  assert.deepEqual(yieldAmount('cerca de 30 unidades', 'pt'), { before: 'cerca de ', quantity: '30', amount: { n: 30, d: 1 }, after: 'unidades' });
  assert.deepEqual(yieldAmount('Serves 4', 'en')?.quantity, '4');
  assert.equal(yieldAmount('6-8 servings', 'en'), null, 'a range has no single number');
  assert.equal(yieldAmount('a big pot', 'en'), null);
  assert.equal(yieldAmount('', 'en'), null);
});

test('Makes scales with the recipe, ranges included', () => {
  assert.deepEqual(scaleYield('24 cookies', over(ratio(36), ratio(24)), 'en'), { before: '', quantity: '36', after: 'cookies' });
  assert.deepEqual(scaleYield('6-8 servings', half, 'en'), { before: '', quantity: '3-4', after: 'servings' });
  assert.deepEqual(scaleYield('2 pães', half, 'pt'), { before: '', quantity: '1', after: 'pães' });
  assert.equal(scaleYield('a big pot', double, 'en'), null);
});

test('a factor is written as it is, not rounded like an amount', () => {
  assert.equal(ratioQuantity(ratio(1, 2)), '1/2');
  assert.equal(ratioQuantity(ratio(3)), '3');
  assert.equal(ratioQuantity(ratio(4, 3)), '1 1/3');
  assert.equal(ratioQuantity(ratio(13, 10)), '1.3');
  assert.equal(ratioQuantity(ratio(1, 7)), '0.143');
});
