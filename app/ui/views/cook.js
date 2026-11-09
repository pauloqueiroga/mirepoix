import { displayAmount } from '../../domain/ingredients.js';
import { displayQuantity, formatQuantity, readQuantity } from '../../domain/quantity.js';
import { SAME, over, quantityRatio, ratio, ratioQuantity, sameRatio, scaleIngredient, scaleQuantity, scaleYield, yieldAmount } from '../../domain/scale.js';
import { findDurations } from '../../domain/timers.js';
import { h } from '../dom.js';
import { formatMoment, t, uiLang } from '../i18n.js';
import { timerTray } from '../timers.js';
import { keepScreenOn } from '../wake-lock.js';
import { extras, lastTime, section } from './recipe.js';

/** @typedef {import('../../domain/recipe.js').Recipe} Recipe */
/** @typedef {import('../../domain/recipe.js').Ingredient} Ingredient */
/** @typedef {import('../../domain/recipe.js').Lang} Lang */
/** @typedef {import('../../domain/scale.js').Ratio} Ratio */
/** @typedef {import('../../domain/timers.js').Duration} Duration */
/** @typedef {import('../dom.js').Child} Child */

/** The amounts offered with one tap: half, as written, double, triple. */
const PICKS = [ratio(1, 2), SAME, ratio(2), ratio(3)];
/** Smaller or bigger than this, a typed amount is surely a slip. */
const SMALLEST = 1 / 100;
const BIGGEST = 100;

/**
 * Cook mode (R3, D10): the recipe in big type, with the screen kept on. Tap
 * ingredients and steps to tick them off; the first step not ticked is the
 * one to do now. Ticks live on this screen only and are never saved (R3.2).
 * There's nothing here to edit: the one thing cook mode writes is a dated
 * note for next time (R3.3). The amounts can be scaled (×½, ×2, makes 36),
 * and a time in a step sets a timer, for this screen only, like the ticks.
 * @param {Recipe} recipe
 * @param {{
 *   addNote: (text: string) => Promise<void>,
 *   leaving: import('../app.js').Leaving,
 *   onLeave: (cleanup: () => void) => void,
 * }} options
 *   addNote: saves a cook's note to the recipe. leaving: cook mode keeps
 *   leaving.unsaved up to date, so a half-written note or a timer isn't lost
 *   on the way out. onLeave: given what to do when the app moves on: let the
 *   screen sleep, stop the timers.
 */
export function cookView(recipe, { addNote, leaving, onLeave }) {
  const { lang } = recipe;
  const meta = h('p', { class: 'meta', lang });
  /** @param {Ratio} factor */
  const showMeta = (factor) => {
    const makes = recipe.yield && t.makes(scaledMakes(recipe.yield, factor, lang));
    meta.textContent = [recipe.source, makes].filter(Boolean).join(' · ');
    meta.hidden = !meta.textContent;
  };
  showMeta(SAME);
  const screenOn = h('span', { class: 'chip ok sun', role: 'status', title: t.screenOnTip, hidden: true }, t.screenOn);
  onLeave(keepScreenOn((on) => {
    screenOn.hidden = !on;
  }));
  const timers = timerTray();
  onLeave(timers.stop);

  // Ingredients: tick them off as they're measured out.
  const groups = recipe.ingredients.filter((group) => group.items.length > 0);
  /** @type {HTMLInputElement[]} */
  const ingredientTicks = [];
  /** Each ingredient and where its line is shown, to show it again scaled. */
  /** @type {{ item: Ingredient, line: HTMLElement }[]} */
  const lines = [];
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
      ...items.map((item) => {
        const line = h('span', { class: 'line' }, ...ingredientLine(item, lang));
        lines.push({ item, line });
        return h('li', null, tickable(ingredientTicks, h('span', { class: 'box', 'aria-hidden': 'true' }), line));
      })),
  ]);
  // Scaling shows every amount again, in place, so the ticks stay.
  const scale = scaleControl(recipe, { hasSteps: recipe.preparation.some((group) => group.steps.length > 0) }, (factor) => {
    for (const { item, line } of lines) {
      line.replaceChildren(...ingredientLine(scaleIngredient(item, factor), lang).filter((child) => typeof child === 'string' || child instanceof Node));
    }
    showMeta(factor);
  });

  let number = 0;
  const stepLists = stepGroups.flatMap(({ heading, steps }) => [
    heading && h('h3', { class: 'group-heading', lang }, heading),
    h('ol', { class: 'cook-list cook-steps', role: 'list', lang, 'aria-label': heading || t.steps },
      ...steps.map((step) => {
        number += 1;
        const n = number;
        const times = findDurations(step, lang);
        // Each time in a step sets a timer, ready to start.
        const timerButtons = times.map((time, i) => h('button', {
          type: 'button',
          class: 'timer-chip',
          'aria-label': t.setTimer(time.text),
          onclick: () => timers.add({ key: `${n}:${i}`, seconds: time.seconds, label: [t.stepNumber(n), ' · ', h('span', { lang }, time.text)] }),
        }, h('span', { lang }, time.text)));
        const row = h('li', null,
          tickable(stepTicks, h('span', { class: 'number' }, String(number)), ' ', h('span', { class: 'line' }, ...withTimes(step, times))),
          timerButtons.length > 0 && h('div', { class: 'step-timers' }, ...timerButtons));
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
  leaving.unsaved = () => typed() || timers.active();
  leaving.message = () => (typed() ? t.leaveUnsaved : t.leaveTimers);

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
      meta,
      lastTime(recipe),
      ingredientLists.length > 0 && progressSection('ingredients', t.ingredients, ready, scale, ...ingredientLists),
      stepLists.length > 0 && progressSection('preparation', t.preparation, stepProgress, ...stepLists),
      ...extras(recipe)),
    h('div', { class: 'foot' },
      timers.element,
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
 * How much to make: ×½, ×1, ×2 or ×3 with a tap, or any amount typed, as the
 * number the recipe makes ("Makes [36] cookies") when Makes has one, or as
 * times the recipe. Calls scaled with every new factor.
 * @param {Recipe} recipe
 * @param {{ hasSteps: boolean }} about
 * @param {(factor: Ratio) => void} scaled
 */
function scaleControl({ yield: makes, lang }, { hasSteps }, scaled) {
  const base = yieldAmount(makes, lang);
  const picks = PICKS.map((pick) => h('input', { type: 'radio', name: 'scale', checked: sameRatio(pick, SAME) }));
  const amount = h('input', {
    type: 'text',
    class: 'scale-amount',
    inputmode: 'decimal',
    autocomplete: 'off',
    'aria-label': base ? t.howManyMakes : t.timesTheRecipe,
  });
  const hint = h('p', { class: 'scale-hint', hidden: true }, t.stepsAsWritten);
  let factor = SAME;

  /** The amount box shows the factor as Makes' number, or as itself. */
  const showAmount = () => {
    amount.value = formatQuantity(base ? scaleQuantity(base.quantity, factor, 'count') : ratioQuantity(factor), uiLang);
    amount.removeAttribute('aria-invalid');
  };
  /** @param {Ratio} next */
  const scaleBy = (next) => {
    factor = next;
    picks.forEach((pick, i) => {
      pick.checked = sameRatio(PICKS[i] ?? SAME, factor);
    });
    hint.hidden = !hasSteps || sameRatio(factor, SAME);
    scaled(factor);
  };

  picks.forEach((pick, i) => pick.addEventListener('change', () => {
    scaleBy(PICKS[i] ?? SAME);
    showAmount();
  }));
  amount.addEventListener('input', () => {
    const typed = readAmount(amount.value);
    const next = typed && (base ? over(typed, base.amount) : typed);
    const sensible = next && next.n / next.d >= SMALLEST && next.n / next.d <= BIGGEST;
    if (next && sensible) {
      amount.removeAttribute('aria-invalid');
      scaleBy(next);
    } else {
      amount.setAttribute('aria-invalid', 'true');
    }
  });
  // A box left empty or unreadable shows the amount in use again.
  amount.addEventListener('change', showAmount);
  showAmount();

  return h('fieldset', { class: 'scale' },
    h('legend', { class: 'visually-hidden' }, t.amountToMake),
    h('div', { class: 'segmented' },
      ...picks.map((pick, i) => h('label', null, pick, h('span', null, `×${displayQuantity(ratioQuantity(PICKS[i] ?? SAME), uiLang)}`)))),
    h('label', { class: 'scale-custom' },
      ...(base
        ? t.makesThisMany(h('span', { lang }, base.before, amount, base.after && ` ${base.after}`))
        : ['×', amount])),
    hint);
}

/**
 * A number typed in the amount box: "36", "1,5", "1 1/2". Nothing else.
 * @param {string} text
 * @returns {Ratio | null}
 */
function readAmount(text) {
  const read = readQuantity(text, uiLang);
  return read && !read.rest ? quantityRatio(read.quantity) : null;
}

/**
 * Makes, scaled: "36 cookies" for "24 cookies" ×1.5. Text without a number stays.
 * @param {string} makes
 * @param {Ratio} factor
 * @param {Lang} lang
 */
function scaledMakes(makes, factor, lang) {
  const found = sameRatio(factor, SAME) ? null : scaleYield(makes, factor, lang);
  return found ? `${found.before}${displayQuantity(found.quantity, lang)}${found.after && ` ${found.after}`}` : makes;
}

/**
 * A step's text with its times marked, where the timers come from.
 * @param {string} step
 * @param {Duration[]} times
 * @returns {Child[]}
 */
function withTimes(step, times) {
  /** @type {Child[]} */
  const parts = [];
  let at = 0;
  for (const time of times) {
    parts.push(step.slice(at, time.start), h('span', { class: 'time' }, time.text));
    at = time.end;
  }
  parts.push(step.slice(at));
  return parts;
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
