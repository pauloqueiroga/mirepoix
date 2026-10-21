import { draftOf, readDraft } from '../../domain/draft.js';
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
/** @typedef {Required<import('../../domain/draft.js').Draft>} Draft */
/** @typedef {'saved' | 'cancelled' | 'deleted'} Outcome */

/**
 * The screen for adding a recipe (R1.6, R1.8) or changing one (R1.9): paste or
 * type each part, watch Mirepoix read it, then save.
 * @param {{
 *   lang: Lang,
 *   recipe?: Recipe,
 *   save: (recipe: Recipe) => Promise<void>,
 *   remove?: (id: string) => Promise<void>,
 *   leave: (outcome: Outcome) => void,
 *   leaving: { unsaved: () => boolean },
 * }} options
 *   recipe: the one being edited, if any. leaving: the editor keeps
 *   leaving.unsaved up to date, so the app can ask before any way out (D10).
 */
export function editorView({ lang, recipe, save, remove, leave, leaving }) {
  /** @type {Draft} */
  const initial = recipe
    ? draftOf(recipe)
    : { title: '', lang, source: '', yield: '', ingredients: '', preparation: '', variations: '', notes: '' };

  const title = h('input', { id: 'title', type: 'text', class: 'title-input', autocomplete: 'off', autofocus: !recipe });
  // Two radio buttons rather than a <select>: one tap on a phone, and WebKit's
  // <select> trips the strict style policy (D7).
  /** @param {Lang} value @param {string} label */
  const choice = (value, label) =>
    h('label', null, h('input', { type: 'radio', name: 'lang', value, checked: initial.lang === value }), h('span', null, label));
  const language = h('fieldset', { class: 'field' },
    h('legend', null, 'Language'),
    h('div', { class: 'segmented' }, choice('en', 'English'), choice('pt', 'Português')));
  const chosenLang = () => /** @type {HTMLInputElement | null} */ (language.querySelector('input:checked'))?.value === 'pt' ? 'pt' : 'en';
  const source = h('input', { id: 'source', type: 'text', autocomplete: 'off', placeholder: 'Book and page, website, family notebook…' });
  const makes = h('input', { id: 'makes', type: 'text', autocomplete: 'off', placeholder: initial.lang === 'pt' ? '30 unidades' : '24 cookies' });
  const ingredients = h('textarea', {
    id: 'ingredients',
    rows: '12',
    spellcheck: 'false',
    placeholder: initial.lang === 'pt' ? '2 xícaras de farinha de trigo\n1 colher (chá) de sal' : '2 cups flour\n1 tsp salt',
  });
  const preparation = h('textarea', { id: 'preparation', rows: '8' });
  const variations = h('textarea', { id: 'variations', rows: '3', 'aria-label': 'Variations' });
  const notes = h('textarea', { id: 'notes', rows: '3', 'aria-label': 'Notes' });
  const alert = h('p', { class: 'alert', role: 'alert', hidden: true });
  const preview = h('section', { class: 'preview', 'aria-label': 'How Mirepoix reads the ingredients' });
  const stepsPreview = h('section', { class: 'preview steps-preview', 'aria-label': 'How Mirepoix reads the preparation' });

  title.value = initial.title;
  source.value = initial.source;
  makes.value = initial.yield;
  ingredients.value = initial.ingredients;
  preparation.value = initial.preparation;
  variations.value = initial.variations;
  notes.value = initial.notes;

  /** @returns {Draft} */
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
  const changed = () => {
    const now = draft();
    return Object.entries(initial).some(([key, value]) => now[/** @type {keyof Draft} */ (key)] !== value);
  };
  leaving.unsaved = changed;
  /** @param {Outcome} outcome */
  const done = (outcome) => {
    leaving.unsaved = () => false;
    leave(outcome);
  };

  const refreshIngredients = () => {
    const current = chosenLang();
    preview.replaceChildren(...previewContent(parseIngredientList(ingredients.value, current).lines, current));
  };
  const refreshSteps = () => {
    stepsPreview.replaceChildren(...stepsPreviewContent(parseSteps(preparation.value), chosenLang()));
  };
  const cancel = () => {
    if (!changed() || confirm(recipe ? 'Discard your changes?' : 'Discard this recipe?')) done('cancelled');
  };
  /** @param {Event} event */
  const submit = async (event) => {
    event.preventDefault();
    const { recipe: saved, problems } = readDraft(draft(), { base: recipe });
    alert.hidden = problems.length === 0;
    alert.textContent = problems.join(' ');
    if (!saved) return;
    try {
      await save(saved);
      done('saved');
    } catch (error) {
      alert.hidden = false;
      alert.textContent = `Couldn’t save this recipe: ${error instanceof Error ? error.message : String(error)}`;
    }
  };
  const deleteRecipe = async () => {
    if (!recipe || !remove || !confirm(`Delete “${recipe.title}”? This can’t be undone.`)) return;
    await remove(recipe.id);
    done('deleted');
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
        h('h1', { class: 'bar-title' }, recipe ? 'Edit recipe' : 'New recipe'),
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
            h('details', { class: 'more', open: Boolean(initial.variations) }, h('summary', null, 'Variations'), variations),
            h('details', { class: 'more', open: Boolean(initial.notes) }, h('summary', null, 'Notes'), notes))),
        recipe && remove && h('div', { class: 'danger-zone' },
          h('button', { type: 'button', class: 'button danger', onclick: deleteRecipe }, 'Delete recipe')))),
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
