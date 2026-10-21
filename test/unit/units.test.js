import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, isKnownUnit, matchUnit, unitFromText, unitText } from '../../app/domain/units.js';

const units = Object.keys(UNITS).filter((unit) => unit !== 'count');

test('every unit key is also a spelling of itself', () => {
  for (const unit of units) assert.equal(unitFromText(unit), unit, unit);
});

test('every way Mirepoix writes a unit reads back as that unit', () => {
  for (const unit of units) {
    for (const lang of /** @type {const} */ (['en', 'pt'])) {
      for (const quantity of ['1', '2']) {
        const text = unitText({ quantity, unit }, lang);
        assert.equal(unitFromText(text), unit, `${unit} written as "${text}" (${lang})`);
      }
    }
  }
});

test('no spelling belongs to two units', () => {
  /** @type {Map<string, string>} */
  const owners = new Map();
  for (const unit of units) {
    for (const spelling of UNITS[unit]?.spellings ?? []) {
      const owner = unitFromText(spelling);
      assert.equal(owner, unit, `"${spelling}" is listed for ${unit} but reads as ${owner}`);
      assert.ok(!owners.has(spelling) || owners.get(spelling) === unit, spelling);
      owners.set(spelling, unit);
    }
  }
});

test('matching ignores case, accents and trailing dots, and accepts plurals', () => {
  assert.deepEqual(matchUnit(['Xíc.', 'de', 'leite']), { unit: 'cup', length: 1 });
  assert.deepEqual(matchUnit(['xicaras']), { unit: 'cup', length: 1 });
  assert.deepEqual(matchUnit(['colheres', '(sopa)', 'de', 'azeite']), { unit: 'tbsp', length: 2 });
  assert.deepEqual(matchUnit(['Tablespoons', 'butter']), { unit: 'tbsp', length: 1 });
  assert.deepEqual(matchUnit(['pinches']), { unit: 'pinch', length: 1 });
  assert.deepEqual(matchUnit(['fluid', 'ounces']), { unit: 'fl oz', length: 2 });
});

test('the longest spelling wins', () => {
  assert.deepEqual(matchUnit(['colher', 'de', 'sopa', 'de', 'açúcar']), { unit: 'tbsp', length: 3 });
  assert.deepEqual(matchUnit(['colher', 'de', 'manteiga']), { unit: 'spoon', length: 1 });
  assert.deepEqual(matchUnit(['copo', 'americano', 'de', 'leite']), { unit: 'copo americano', length: 2 });
  assert.deepEqual(matchUnit(['copo', 'de', 'água']), { unit: 'glass', length: 1 });
});

test('an exact spelling beats a plural of a shorter one', () => {
  assert.deepEqual(matchUnit(['cs']), { unit: 'tbsp', length: 1 }, '"cs" is colher de sopa, not plural "c"');
});

test('capital T is a tablespoon and small t a teaspoon', () => {
  assert.deepEqual(matchUnit(['T', 'sugar']), { unit: 'tbsp', length: 1 });
  assert.deepEqual(matchUnit(['t', 'salt']), { unit: 'tsp', length: 1 });
});

test('words that are not units match nothing', () => {
  for (const words of [['large', 'eggs'], ['cebolas'], [], ['candied', 'ginger']]) {
    assert.equal(matchUnit(words), null, words.join(' '));
  }
});

test('units are written in the recipe language, plural above one', () => {
  assert.equal(unitText({ quantity: '1', unit: 'cup' }, 'pt'), 'xícara');
  assert.equal(unitText({ quantity: '1 1/2', unit: 'cup' }, 'pt'), 'xícaras');
  assert.equal(unitText({ quantity: '1/2', unit: 'cup' }, 'en'), 'cup');
  assert.equal(unitText({ quantity: '2-3', unit: 'tbsp' }, 'pt'), 'colheres de sopa');
  assert.equal(unitText({ quantity: '2', unit: 'count' }, 'en'), '');
  assert.equal(unitText({ quantity: '1', unit: 'tablete' }, 'pt'), 'tablete');
  assert.equal(isKnownUnit('tablete'), false);
  assert.equal(isKnownUnit('count'), true);
});
