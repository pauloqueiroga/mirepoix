import { displayAmount } from '../../domain/ingredients.js';
import { h } from '../dom.js';
import { formatMoment, t } from '../i18n.js';
import { keepScreenOn } from '../wake-lock.js';
import { extras, lastTime, section } from './recipe.js';

/** @typedef {import('../../domain/recipe.js').Recipe} Recipe */
/** @typedef {import('../../domain/recipe.js').Ingredient} Ingredient */
/** @typedef {import('../../domain/recipe.js').Lang} Lang */
/** @typedef {import('../dom.js').Child} Child */

/**
 * Cook mode (R3, D10): the recipe in big type, with the screen kept on. Tap
 * ingredients and steps to tick them off; the first step not ticked is the
 * one to do now. Ticks live on this screen only and are never saved (R3.2).
 * There's nothing here to edit: the one thing cook mode writes is a dated
 * note for next time (R3.3).
 * @param {Recipe} recipe
 * @param {{
 *   addNote: (text: string) => Promise<void>,
 *   leaving: { unsaved: () => boolean, stop: () => void },
 * }} options
 *   addNote: saves a cook's note to the recipe. leaving: cook mode keeps it
 *   up to date, so a half-written note isn't lost on the way out, and lets
 *   go of the screen when the app moves on.
 */
export function cookView(recipe, { addNote, leaving }) {
  const { lang } = recipe;
  const meta = [recipe.source, recipe.yield && t.makes(recipe.yield)].filter(Boolean).join(' · ');
  const screenOn = h('span', { class: 'chip ok sun', role: 'status', title: t.screenOnTip, hidden: true }, t.screenOn);
  leaving.stop = keepScreenOn((on) => {
    screenOn.hidden = !on;
  });

  // Ingredients: tick them off as they're measured out.
  const groups = recipe.ingredients.filter((group) => group.items.length > 0);
  /** @type {HTMLInputElement[]} */
  const ingredientTicks = [];
  const ready = h('span', { class: 'progress' });

  // Steps, numbered straight through their groups, as the recipe shows them.
  const stepGroups = recipe.preparation.filter((group) => group.steps.length > 0);
  /** @type {HTMLInputElement[]} */
  const stepTicks = [];
  /** @type {HTMLLIElement[]} */
  const stepRows = [];
  const stepProgress = h('span', { class: 'progress' });
  const motion = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  const update = () => {
    ready.textContent = t.ready(ingredientTicks.filter((tick) => tick.checked).length, ingredientTicks.length);
    const now = stepTicks.findIndex((tick) => !tick.checked);
    stepRows.forEach((row, i) => {
      if (i === now) row.setAttribute('aria-current', 'step');
      else row.removeAttribute('aria-current');
    });
    stepProgress.textContent = now === -1 ? t.allStepsDone : t.stepOf(now + 1, stepTicks.length);
    return stepRows[now];
  };

  /**
   * @param {HTMLInputElement[]} ticks
   * @param {...Child} content
   */
  const tickable = (ticks, ...content) => {
    const tick = h('input', { type: 'checkbox' });
    ticks.push(tick);
    return h('label', { class: 'tick' }, tick, ...content);
  };

  const ingredientLists = groups.flatMap(({ heading, items }) => [
    heading && h('h3', { class: 'group-heading', lang }, heading),
    h('ul', { class: 'cook-list', lang, 'aria-label': heading || t.ingredients },
      ...items.map((item) => h('li', null,
        tickable(ingredientTicks, h('span', { class: 'box', 'aria-hidden': 'true' }), h('span', { class: 'line' }, ...ingredientLine(item, lang)))))),
  ]);

  let number = 0;
  const stepLists = stepGroups.flatMap(({ heading, steps }) => [
    heading && h('h3', { class: 'group-heading', lang }, heading),
    h('ol', { class: 'cook-list cook-steps', role: 'list', lang, 'aria-label': heading || t.steps },
      ...steps.map((step) => {
        number += 1;
        const row = h('li', null,
          tickable(stepTicks, h('span', { class: 'number' }, String(number)), ' ', h('span', { class: 'line' }, step)));
        stepRows.push(row);
        return row;
      })),
  ]);

  const tickedStep = (/** @type {Event} */ event) => {
    const next = update();
    // Moving on: bring the next step into view, unless it's there already.
    if (/** @type {HTMLInputElement} */ (event.target).checked) next?.scrollIntoView({ block: 'nearest', behavior: motion() });
  };
  for (const tick of ingredientTicks) tick.addEventListener('change', update);
  for (const tick of stepTicks) tick.addEventListener('change', tickedStep);
  update();

  // A note for next time, in a sheet over the recipe.
  const note = h('textarea', { id: 'cooks-note', rows: '5', 'aria-label': t.yourNote, placeholder: t.notePlaceholder });
  const stamp = h('p', { class: 'stamp' });
  const alert = h('p', { class: 'alert', role: 'alert', hidden: true });
  const saveNote = h('button', { type: 'submit', class: 'button primary', disabled: true }, t.saveNote);
  const status = h('p', { class: 'foot-status', role: 'status' });
  const typed = () => note.value.trim() !== '';
  leaving.unsaved = typed;

  const close = () => {
    note.value = '';
    saveNote.disabled = true;
    sheet.close();
  };
  const cancel = () => {
    if (!typed() || confirm(t.discardNote)) close();
  };
  /** @param {Event} event */
  const save = async (event) => {
    event.preventDefault();
    if (!typed()) return;
    saveNote.disabled = true;
    try {
      await addNote(note.value);
    } catch (error) {
      alert.hidden = false;
      alert.textContent = t.couldntSaveNote(error instanceof Error ? error.message : String(error));
      saveNote.disabled = false;
      return;
    }
    close();
    status.textContent = t.noteSaved;
  };
  const open = () => {
    const now = new Date();
    stamp.replaceChildren(h('time', { datetime: now.toISOString() }, formatMoment(now)));
    alert.hidden = true;
    status.textContent = '';
    sheet.showModal();
    note.focus();
  };

  const sheet = h('dialog', { class: 'sheet', 'aria-labelledby': 'note-heading' },
    h('form', { novalidate: true, onsubmit: save },
      h('h2', { id: 'note-heading' }, t.noteForNextTime),
      h('p', { class: 'sub' }, ...t.noteAbout(h('span', { lang }, recipe.title))),
      alert,
      note,
      stamp,
      h('div', { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'button quiet', onclick: cancel }, t.cancel),
        saveNote)));
  // Escape asks first too, like Cancel.
  sheet.addEventListener('cancel', (event) => {
    event.preventDefault();
    cancel();
  });
  note.addEventListener('input', () => {
    saveNote.disabled = !typed();
  });

  return [
    h('header', { class: 'bar cook-bar' },
      h('a', { class: 'done-link', href: `#/recipes/${encodeURIComponent(recipe.id)}` }, t.done),
      h('h1', { class: 'bar-title', lang }, recipe.title),
      screenOn),
    h('main', { class: 'page cook' },
      meta && h('p', { class: 'meta', lang }, meta),
      lastTime(recipe),
      ingredientLists.length > 0 && progressSection('ingredients', t.ingredients, ready, ...ingredientLists),
      stepLists.length > 0 && progressSection('preparation', t.preparation, stepProgress, ...stepLists),
      ...extras(recipe)),
    h('div', { class: 'foot' },
      status,
      h('button', { type: 'button', class: 'button secondary wide pen', onclick: open }, t.noteForNextTime)),
    sheet,
  ];
}

/**
 * "2 xícaras ou 200 g queijo meia-cura, ralado": the amount, any equivalents, then the rest.
 * @param {Ingredient} ingredient
 * @param {Lang} lang
 * @returns {Child[]}
 */
function ingredientLine(ingredient, lang) {
  const amount = displayAmount(ingredient, lang);
  return [
    amount && h('b', { class: 'amount' }, amount),
    ...ingredient.alternatives.map((alternative) => h('span', { class: 'alt' }, ' ', t.or(displayAmount(alternative, lang)))),
    amount && ' ',
    h('span', { class: 'name' }, ingredient.name, ingredient.note && h('span', { class: 'note' }, `, ${ingredient.note}`)),
  ];
}

/**
 * A section with how far along it is, beside its label.
 * @param {string} id
 * @param {string} label
 * @param {HTMLElement} progress
 * @param {...Child} content
 */
function progressSection(id, label, progress, ...content) {
  const part = section(id, label, ...content);
  part.querySelector('.section-label')?.after(progress);
  return part;
}
