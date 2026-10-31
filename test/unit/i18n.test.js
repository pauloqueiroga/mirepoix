import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseLang, dateLocale, messages } from '../../app/ui/i18n.js';

// Mirepoix's own words in English and Portuguese (R1.17, D15).

const { en, pt } = messages;

test('Portuguese has every word English has, of the same kind', () => {
  /** @param {Record<string, unknown>} a @param {Record<string, unknown>} b @param {string} where */
  const same = (a, b, where) => {
    assert.deepEqual(Object.keys(b).sort(), Object.keys(a).sort(), where);
    for (const [key, value] of Object.entries(a)) {
      const other = b[key];
      assert.equal(typeof other, typeof value, `${where}.${key}`);
      if (typeof value === 'string') assert.ok(String(other).trim(), `${where}.${key} is not blank`);
      if (value && typeof value === 'object') {
        same(/** @type {Record<string, unknown>} */ (value), /** @type {Record<string, unknown>} */ (other), `${where}.${key}`);
      }
    }
  };
  same(en, pt, 'pt');
});

test('the language picked on this device wins, then the browser\'s', () => {
  assert.equal(chooseLang(null, 'pt-BR'), 'pt');
  assert.equal(chooseLang(null, 'pt-PT'), 'pt');
  assert.equal(chooseLang(null, 'pt'), 'pt');
  assert.equal(chooseLang(null, 'en-US'), 'en');
  assert.equal(chooseLang(null, 'fr-FR'), 'en', 'any other language gets English');
  assert.equal(chooseLang('en', 'pt-BR'), 'en');
  assert.equal(chooseLang('pt', 'en-US'), 'pt');
  assert.equal(chooseLang('de', 'pt-BR'), 'pt', 'an unknown pick is ignored');
});

test('counts read naturally in both languages', () => {
  assert.equal(en.recipeCount(1), '1 recipe');
  assert.equal(en.recipeCount(12), '12 recipes');
  assert.equal(pt.recipeCount(1), '1 receita');
  assert.equal(pt.recipeCount(12), '12 receitas');
  assert.equal(pt.foundOf(2, pt.recipeCount(12)), '2 de 12 receitas');
});

test('the step count says how a Preparation box reads', () => {
  assert.equal(en.stepCount(0, 0), '0 steps');
  assert.equal(en.stepCount(1, 1), '1 step');
  assert.equal(en.stepCount(3, 2), '3 steps in 2 groups');
  assert.equal(pt.stepCount(1, 1), '1 passo');
  assert.equal(pt.stepCount(3, 2), '3 passos em 2 grupos');
});

test('the import summary says what happened in plain words', () => {
  assert.equal(en.imported({ added: 3, updated: 1, unchanged: 2, skipped: 0 }), 'Added 3 recipes and updated 1. 2 were already here.');
  assert.equal(en.imported({ added: 1, updated: 0, unchanged: 0, skipped: 1 }), 'Added 1 recipe. 1 couldn’t be read and was skipped.');
  assert.equal(en.imported({ added: 0, updated: 0, unchanged: 4, skipped: 0 }), 'Nothing new to add. 4 were already here.');
  assert.equal(en.imported({ added: 0, updated: 2, unchanged: 0, skipped: 3 }), 'Updated 2. 3 couldn’t be read and were skipped.');

  assert.equal(pt.imported({ added: 3, updated: 1, unchanged: 2, skipped: 0 }), '3 receitas adicionadas e 1 atualizada. 2 já estavam aqui.');
  assert.equal(pt.imported({ added: 1, updated: 0, unchanged: 0, skipped: 1 }), '1 receita adicionada. 1 não pôde ser lida e foi ignorada.');
  assert.equal(pt.imported({ added: 0, updated: 0, unchanged: 1, skipped: 0 }), 'Nada de novo para adicionar. 1 já estava aqui.');
  assert.equal(pt.imported({ added: 0, updated: 2, unchanged: 0, skipped: 3 }), '2 receitas atualizadas. 3 não puderam ser lidas e foram ignoradas.');
});

test('problems with a draft say what to fix, and where', () => {
  assert.equal(en.problem({ code: 'no-title' }), 'Give the recipe a title.');
  assert.equal(en.problem({ code: 'no-name', line: 3 }), 'Line 3 has no ingredient name.');
  assert.equal(pt.problem({ code: 'no-title' }), 'Dê um título à receita.');
  assert.equal(pt.problem({ code: 'no-name', line: 3 }), 'A linha 3 não tem nome de ingrediente.');
});

test('every doubt explains itself, and a new unit is named', () => {
  for (const [lang, words] of Object.entries(messages)) {
    for (const [code, say] of Object.entries(words.doubts)) {
      assert.ok(say('tablete').length > 10, `${lang}: ${code} explains itself`);
    }
    assert.match(words.doubts['unknown-unit']('tablete'), /“tablete”/, lang);
  }
});

test('cook mode says how far along you are (R3.2)', () => {
  assert.equal(en.ready(0, 7), '0 of 7 ready');
  assert.equal(en.ready(7, 7), 'All ready');
  assert.equal(en.stepOf(2, 4), 'Step 2 of 4');
  assert.equal(pt.ready(2, 7), '2 de 7 separados');
  assert.equal(pt.ready(7, 7), 'Tudo separado');
  assert.equal(pt.stepOf(2, 4), 'Passo 2 de 4');
});

test('a tag match says which tag, and an empty filter says why (R3.5)', () => {
  assert.equal(en.tagged(['sobremesa']), 'tagged sobremesa');
  assert.equal(en.tagged(['festa', 'doce']), 'tagged festa, doce');
  assert.equal(pt.tagged(['sobremesa']), 'etiqueta sobremesa');
  assert.equal(pt.tagged(['festa', 'doce']), 'etiquetas festa, doce');
  assert.equal(en.noMatchesTagged(''), 'No recipe has all the tags you picked.');
  assert.equal(en.noMatchesTagged('pudim'), 'Nothing with the tags you picked matches “pudim”.');
  assert.equal(pt.noMatchesTagged('pudim'), 'Nada com as etiquetas escolhidas combina com “pudim”.');
});

test('dates are written the browser\'s way when it speaks the screens\' language', () => {
  assert.equal(dateLocale('en', 'en-GB'), 'en-GB');
  assert.equal(dateLocale('en', 'EN-us'), 'EN-us');
  assert.equal(dateLocale('pt', 'pt-PT'), 'pt-PT');
  assert.equal(dateLocale('pt', 'en-US'), 'pt-BR', 'Portuguese picked on an English browser is Brazilian');
  assert.equal(dateLocale('en', 'pt-BR'), 'en');
  assert.equal(dateLocale('en', 'fr-FR'), 'en');
});
