import { draftOf, readDraft } from '../../domain/draft.js';
import { displayAmount, parseIngredientList } from '../../domain/ingredients.js';
import { displayQuantity } from '../../domain/quantity.js';
import { parseSteps } from '../../domain/sections.js';
import { parseTags, renderTags, sameTag } from '../../domain/tags.js';
import { unitText } from '../../domain/units.js';
import { h } from '../dom.js';
import { t } from '../i18n.js';
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
 *   tags?: string[],
 *   save: (recipe: Recipe) => Promise<void>,
 *   remove?: (id: string) => Promise<void>,
 *   leave: (outcome: Outcome) => void,
 *   leaving: { unsaved: () => boolean },
 * }} options
 *   recipe: the one being edited, if any. tags: every tag in use, offered
 *   with a tap (R3.4). leaving: the editor keeps leaving.unsaved up to date,
 *   so the app can ask before any way out (D10).
 */
export function editorView({ lang, recipe, tags: known = [], save, remove, leave, leaving }) {
  /** @type {Draft} */
  const initial = recipe
    ? draftOf(recipe)
    : { title: '', lang, source: '', yield: '', tags: '', ingredients: '', preparation: '', variations: '', notes: '' };

  const title = h('input', { id: 'title', type: 'text', class: 'title-input', autocomplete: 'off', autofocus: !recipe });
  // Two radio buttons rather than a <select>: one tap on a phone, and WebKit's
  // <select> trips the strict style policy (D7).
  /** @param {Lang} value */
  const choice = (value) =>
    h('label', null, h('input', { type: 'radio', name: 'lang', value, checked: initial.lang === value }), h('span', null, t.langNames[value]));
  const language = h('fieldset', { class: 'field' },
    h('legend', null, t.language),
    h('div', { class: 'segmented' }, choice('en'), choice('pt')));
  const chosenLang = () => /** @type {HTMLInputElement | null} */ (language.querySelector('input:checked'))?.value === 'pt' ? 'pt' : 'en';
  const source = h('input', { id: 'source', type: 'text', autocomplete: 'off', placeholder: t.sourcePlaceholder });
  const makes = h('input', { id: 'makes', type: 'text', autocomplete: 'off', placeholder: initial.lang === 'pt' ? '30 unidades' : '24 cookies' });
  const tags = h('input', { id: 'tags', type: 'text', autocomplete: 'off', autocapitalize: 'none', placeholder: t.tagsPlaceholder });
  // The tags already in use, a tap away, so one tag isn't typed three ways.
  const picks = known.map((tag) => h('button', { type: 'button', class: 'tag', 'aria-pressed': 'false', onclick: () => pick(tag) }, h('span', null, tag)));
  const ingredients = h('textarea', {
    id: 'ingredients',
    rows: '12',
    spellcheck: 'false',
    placeholder: initial.lang === 'pt' ? '2 xícaras de farinha de trigo\n1 colher (chá) de sal' : '2 cups flour\n1 tsp salt',
  });
  const preparation = h('textarea', { id: 'preparation', rows: '8' });
  const variations = h('textarea', { id: 'variations', rows: '3', 'aria-label': t.variations });
  const notes = h('textarea', { id: 'notes', rows: '3', 'aria-label': t.notes });
  const alert = h('p', { class: 'alert', role: 'alert', hidden: true });
  const preview = h('section', { class: 'preview', 'aria-label': t.readsIngredients });
  const stepsPreview = h('section', { class: 'preview steps-preview', 'aria-label': t.readsPreparation });

  title.value = initial.title;
  source.value = initial.source;
  makes.value = initial.yield;
  tags.value = initial.tags;
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
    tags: tags.value,
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
  const refreshTags = () => {
    const typed = parseTags(tags.value);
    known.forEach((tag, i) => picks[i]?.setAttribute('aria-pressed', String(typed.some((other) => sameTag(other, tag)))));
  };
  /** Adds a tag in use to the box, or takes it out again. @param {string} tag */
  const pick = (tag) => {
    const typed = parseTags(tags.value);
    const has = typed.some((other) => sameTag(other, tag));
    tags.value = renderTags(has ? typed.filter((other) => !sameTag(other, tag)) : [...typed, tag]);
    refreshTags();
  };
  const refreshSteps = () => {
    stepsPreview.replaceChildren(...stepsPreviewContent(parseSteps(preparation.value), chosenLang()));
  };
  const cancel = () => {
    if (!changed() || confirm(recipe ? t.discardChanges : t.discardRecipe)) done('cancelled');
  };
  /** @param {Event} event */
  const submit = async (event) => {
    event.preventDefault();
    const { recipe: saved, problems } = readDraft(draft(), { base: recipe });
    alert.hidden = problems.length === 0;
    alert.textContent = problems.map(t.problem).join(' ');
    if (!saved) return;
    try {
      await save(saved);
      done('saved');
    } catch (error) {
      alert.hidden = false;
      alert.textContent = t.couldntSave(error instanceof Error ? error.message : String(error));
    }
  };
  const deleteRecipe = async () => {
    if (!recipe || !remove || !confirm(t.confirmDelete(recipe.title))) return;
    await remove(recipe.id);
    done('deleted');
  };

  ingredients.addEventListener('input', refreshIngredients);
  language.addEventListener('change', refreshIngredients);
  language.addEventListener('change', refreshSteps);
  preparation.addEventListener('input', refreshSteps);
  tags.addEventListener('input', refreshTags);
  refreshIngredients();
  refreshSteps();
  refreshTags();

  return [
    h('form', { class: 'screen', novalidate: true, onsubmit: submit },
      h('header', { class: 'bar' },
        h('button', { type: 'button', class: 'button quiet', onclick: cancel }, t.cancel),
        h('h1', { class: 'bar-title' }, recipe ? t.editRecipe : t.newRecipe),
        h('button', { type: 'submit', class: 'button primary' }, t.save)),
      h('main', { class: 'page editor' },
        alert,
        h('div', { class: 'fields' },
          h('div', { class: 'field' }, h('label', { for: 'title' }, t.title), title),
          language),
        h('div', { class: 'fields' },
          h('div', { class: 'field' }, h('label', { for: 'source' }, t.source), source),
          h('div', { class: 'field makes' }, h('label', { for: 'makes' }, t.makesLabel), makes)),
        h('div', { class: 'field' },
          h('label', { for: 'tags' }, t.tags),
          tags,
          picks.length > 0 && h('div', { class: 'tag-picker', role: 'group', 'aria-label': t.yourTags }, ...picks),
          h('p', { class: 'hint' }, picks.length > 0 ? t.tagsHintKnown : t.tagsHint)),
        h('div', { class: 'columns' },
          h('div', { class: 'field ingredients-box' },
            h('label', { for: 'ingredients' }, t.ingredientsLabel),
            ingredients,
            h('p', { class: 'hint' }, ...t.ingredientsHint(h('code', null, '2 | punhado | salsinha')))),
          preview,
          h('div', { class: 'field preparation-box' },
            h('label', { for: 'preparation' }, t.preparation),
            preparation,
            h('p', { class: 'hint' }, t.preparationHint)),
          stepsPreview,
          h('div', { class: 'more-boxes' },
            h('details', { class: 'more', open: Boolean(initial.variations) }, h('summary', null, t.variations), variations),
            h('details', { class: 'more', open: Boolean(initial.notes) }, h('summary', null, t.notes), notes))),
        recipe && remove && h('div', { class: 'danger-zone' },
          h('button', { type: 'button', class: 'button danger', onclick: deleteRecipe }, t.deleteRecipe)))),
  ];
}

/**
 * @param {ListLine[]} lines
 * @param {Lang} lang
 */
function previewContent(lines, lang) {
  const doubtful = lines.filter((line) => line.kind === 'ingredient' && line.doubts.length > 0).length;
  const head = h('div', { class: 'preview-head' },
    h('h2', null, t.readsIt),
    doubtful > 0 && h('span', { class: 'chip warn' }, t.toCheck(doubtful)));
  if (lines.length === 0) {
    return [head, h('p', { class: 'placeholder' }, t.ingredientsPlaceholder)];
  }
  return [head,
    h('table', null,
      h('thead', null,
        h('tr', null,
          h('th', { scope: 'col', class: 'qty' }, t.qty),
          h('th', { scope: 'col' }, t.unit),
          h('th', { scope: 'col' }, t.ingredient))),
      h('tbody', null, ...lines.flatMap((line) => rows(line, lang))))];
}

/**
 * @param {import('../../domain/recipe.js').StepGroup[]} groups
 * @param {Lang} lang
 */
function stepsPreviewContent(groups, lang) {
  const steps = groups.reduce((count, group) => count + group.steps.length, 0);
  const head = h('div', { class: 'preview-head' },
    h('h2', null, t.readsIt),
    steps > 0 && h('span', { class: 'chip neutral' }, t.stepCount(steps, groups.length)));
  if (groups.length === 0) {
    return [head, h('p', { class: 'placeholder' }, t.stepsPlaceholder)];
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
      ...ingredient.alternatives.map((alternative) => h('span', { class: 'alt' }, t.or(displayAmount(alternative, lang))))),
    h('td', { class: 'name' },
      ingredient.name || h('span', { class: 'muted' }, t.noName),
      ingredient.note && h('span', { class: 'note' }, `, ${ingredient.note}`)));
  if (!flagged) return [row];
  return [row, h('tr', { class: 'flagged' }, h('td', { colspan: '3', class: 'flag' }, doubts.map((doubt) => t.doubts[doubt.code](doubt.detail)).join(' ')))];
}

/**
 * @param {Ingredient} ingredient
 * @param {Lang} lang
 */
function unitCell(ingredient, lang) {
  if (ingredient.unit === 'count') return h('span', { class: 'muted' }, t.count);
  if (!ingredient.unit) return h('span', { class: 'muted' }, '–');
  return unitText(ingredient, lang);
}
