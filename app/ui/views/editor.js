import { readDraft } from '../../domain/draft.js';
import { displayAmount, parseIngredientList } from '../../domain/ingredients.js';
import { displayQuantity } from '../../domain/quantity.js';
import { describeSteps, parseSteps } from '../../domain/sections.js';
import { unitText } from '../../domain/units.js';
import { h } from '../dom.js';
import { stepGroups } from './recipe.js';

/** @typedef {import('../../domain/recipe.js').Lang} Lang */
/** @typedef {import('../../domain/recipe.js').Recipe} Recipe */
/** @typedef {import('../../domain/recipe.js').Ingredient} Ingredient */
/** @typedef {import('../../domain/ingredients.js').ListLine} ListLine */

/**
 * The screen for adding a recipe (R1.6, R1.8): paste or type each part, watch
 * Mirepoix read the ingredients and count the steps, then save.
 * @param {{ lang: Lang, save: (recipe: Recipe) => Promise<void>, close: () => void }} options
 */
export function editorView({ lang, save, close }) {
  const title = h('input', { id: 'title', type: 'text', class: 'title-input', autocomplete: 'off', autofocus: true });
  // Two radio buttons rather than a <select>: one tap on a phone, and WebKit's
  // <select> trips the strict style policy (D7).
  /** @param {Lang} value @param {string} label */
  const choice = (value, label) =>
    h('label', null, h('input', { type: 'radio', name: 'lang', value, checked: lang === value }), h('span', null, label));
  const language = h('fieldset', { class: 'field' },
    h('legend', null, 'Language'),
    h('div', { class: 'segmented' }, choice('en', 'English'), choice('pt', 'Português')));
  const chosenLang = () => /** @type {HTMLInputElement | null} */ (language.querySelector('input:checked'))?.value === 'pt' ? 'pt' : 'en';
  const source = h('input', { id: 'source', type: 'text', autocomplete: 'off', placeholder: 'Book and page, website, family notebook…' });
  const makes = h('input', { id: 'makes', type: 'text', autocomplete: 'off', placeholder: lang === 'pt' ? '30 unidades' : '24 cookies' });
  const ingredients = h('textarea', {
    id: 'ingredients',
    rows: '12',
    spellcheck: 'false',
    placeholder: lang === 'pt' ? '2 xícaras de farinha de trigo\n1 colher (chá) de sal' : '2 cups flour\n1 tsp salt',
  });
  const preparation = h('textarea', { id: 'preparation', rows: '8' });
  const variations = h('textarea', { id: 'variations', rows: '3', 'aria-label': 'Variations' });
  const notes = h('textarea', { id: 'notes', rows: '3', 'aria-label': 'Notes' });
  const alert = h('p', { class: 'alert', role: 'alert', hidden: true });
  const preview = h('section', { class: 'preview', 'aria-label': 'How Mirepoix reads the ingredients' });
  const stepsPreview = h('section', { class: 'preview steps-preview', 'aria-label': 'How Mirepoix reads the preparation' });
  const boxes = [title, source, makes, ingredients, preparation, variations, notes];

  /** @returns {import('../../domain/draft.js').Draft} */
  const draft = () => ({
    title: title.value,
    lang: chosenLang(),
    source: source.value,
    yield: makes.value,
    ingredients: ingredients.value,
    preparation: preparation.value,
    variations: variations.value,
    notes: notes.value,
  });
  const refreshIngredients = () => {
    const current = chosenLang();
    preview.replaceChildren(...previewContent(parseIngredientList(ingredients.value, current).lines, current));
  };
  const refreshSteps = () => {
    stepsPreview.replaceChildren(...stepsPreviewContent(parseSteps(preparation.value), chosenLang()));
  };
  const cancel = () => {
    const typed = boxes.some((box) => box.value.trim());
    if (!typed || confirm('Discard this recipe?')) close();
  };
  /** @param {Event} event */
  const submit = async (event) => {
    event.preventDefault();
    const { recipe, problems } = readDraft(draft());
    alert.hidden = problems.length === 0;
    alert.textContent = problems.join(' ');
    if (!recipe) return;
    try {
      await save(recipe);
      close();
    } catch (error) {
      alert.hidden = false;
      alert.textContent = `Couldn’t save this recipe: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  ingredients.addEventListener('input', refreshIngredients);
  language.addEventListener('change', refreshIngredients);
  language.addEventListener('change', refreshSteps);
  preparation.addEventListener('input', refreshSteps);
  refreshIngredients();
  refreshSteps();

  return [
    h('form', { class: 'screen', novalidate: true, onsubmit: submit },
      h('header', { class: 'bar' },
        h('button', { type: 'button', class: 'button quiet', onclick: cancel }, 'Cancel'),
        h('h1', { class: 'bar-title' }, 'New recipe'),
        h('button', { type: 'submit', class: 'button primary' }, 'Save')),
      h('main', { class: 'page editor' },
        alert,
        h('div', { class: 'fields' },
          h('div', { class: 'field' }, h('label', { for: 'title' }, 'Title'), title),
          language),
        h('div', { class: 'fields' },
          h('div', { class: 'field' }, h('label', { for: 'source' }, 'Source'), source),
          h('div', { class: 'field makes' }, h('label', { for: 'makes' }, 'Makes'), makes)),
        h('div', { class: 'columns' },
          h('div', { class: 'field ingredients-box' },
            h('label', { for: 'ingredients' }, 'Ingredients · paste or type, one per line'),
            ingredients,
            h('p', { class: 'hint' },
              'A line ending in “:” starts a group. To set the parts yourself, write ',
              h('code', null, '2 | punhado | salsinha'),
              ' for quantity | unit | name.')),
          preview,
          h('div', { class: 'field preparation-box' },
            h('label', { for: 'preparation' }, 'Preparation'),
            preparation,
            h('p', { class: 'hint' },
              'One step per line, blank lines between steps, or numbered steps. A short line ending in “:” starts a group.')),
          stepsPreview,
          h('div', { class: 'more-boxes' },
            h('details', { class: 'more' }, h('summary', null, 'Variations'), variations),
            h('details', { class: 'more' }, h('summary', null, 'Notes'), notes))))),
  ];
}

/**
 * @param {ListLine[]} lines
 * @param {Lang} lang
 */
function previewContent(lines, lang) {
  const doubtful = lines.filter((line) => line.kind === 'ingredient' && line.doubts.length > 0).length;
  const head = h('div', { class: 'preview-head' },
    h('h2', null, 'How Mirepoix reads it'),
    doubtful > 0 && h('span', { class: 'chip warn' }, `${doubtful} to check`));
  if (lines.length === 0) {
    return [head, h('p', { class: 'placeholder' }, 'As you type, each ingredient shows here as quantity, unit and name.')];
  }
  return [head,
    h('table', null,
      h('thead', null,
        h('tr', null,
          h('th', { scope: 'col', class: 'qty' }, 'Qty'),
          h('th', { scope: 'col' }, 'Unit'),
          h('th', { scope: 'col' }, 'Ingredient'))),
      h('tbody', null, ...lines.flatMap((line) => rows(line, lang))))];
}

/**
 * @param {import('../../domain/recipe.js').StepGroup[]} groups
 * @param {Lang} lang
 */
function stepsPreviewContent(groups, lang) {
  const steps = groups.reduce((count, group) => count + group.steps.length, 0);
  const head = h('div', { class: 'preview-head' },
    h('h2', null, 'How Mirepoix reads it'),
    steps > 0 && h('span', { class: 'chip neutral' }, describeSteps(groups)));
  if (groups.length === 0) {
    return [head, h('p', { class: 'placeholder' }, 'As you type, each step shows here, numbered, the way the recipe will show it.')];
  }
  return [head, h('div', { class: 'preview-steps' }, ...stepGroups(groups, lang))];
}

/**
 * @param {ListLine} line
 * @param {Lang} lang
 */
function rows(line, lang) {
  if (line.kind === 'heading') {
    return [h('tr', { class: 'group' }, h('th', { colspan: '3', scope: 'colgroup' }, line.heading))];
  }
  const { ingredient, doubts } = line;
  const flagged = doubts.length > 0;
  const row = h('tr', { class: flagged && 'flagged' },
    h('td', { class: 'qty' }, ingredient.quantity ? displayQuantity(ingredient.quantity, lang) : h('span', { class: 'muted' }, '–')),
    h('td', { class: 'unit' },
      unitCell(ingredient, lang),
      ...ingredient.alternatives.map((alternative) => h('span', { class: 'alt' }, `or ${displayAmount(alternative, lang)}`))),
    h('td', { class: 'name' },
      ingredient.name || h('span', { class: 'muted' }, 'no name'),
      ingredient.note && h('span', { class: 'note' }, `, ${ingredient.note}`)));
  if (!flagged) return [row];
  return [row, h('tr', { class: 'flagged' }, h('td', { colspan: '3', class: 'flag' }, doubts.map((doubt) => doubt.message).join(' ')))];
}

/**
 * @param {Ingredient} ingredient
 * @param {Lang} lang
 */
function unitCell(ingredient, lang) {
  if (ingredient.unit === 'count') return h('span', { class: 'muted' }, 'count');
  if (!ingredient.unit) return h('span', { class: 'muted' }, '–');
  return unitText(ingredient, lang);
}
