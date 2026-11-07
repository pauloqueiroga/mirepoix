// The website's script (D20), for two things the page reads fine without:
// the "Try a line" box, which reads an ingredient line with the app's own
// reader, the one behind "How Mirepoix reads it" in the editor; and sections
// that ease in as they scroll into view.
import { displayAmount, parseIngredient } from '../domain/ingredients.js';
import { displayQuantity } from '../domain/quantity.js';
import { unitText } from '../domain/units.js';
import { h } from '../ui/dom.js';
import { messages } from '../ui/i18n.js';

/** @typedef {import('../domain/recipe.js').Lang} Lang */
/** @typedef {import('../domain/recipe.js').Ingredient} Ingredient */

/** The page's own language; the words below come from the app, in it. */
const t = messages[document.documentElement.lang.startsWith('pt') ? 'pt' : 'en'];

tryALine();
easeIn();

function tryALine() {
  const form = document.querySelector('form.try');
  const input = form?.querySelector('input[name="line"]');
  const body = form?.querySelector('.reading tbody');
  const chip = form?.querySelector('.reading .chip');
  if (!form || !(input instanceof HTMLInputElement) || !body || !(chip instanceof HTMLElement)) return;

  /** @returns {Lang} */
  const lang = () => {
    const picked = form.querySelector('input[name="lang"]:checked');
    return picked instanceof HTMLInputElement && picked.value === 'pt' ? 'pt' : 'en';
  };

  const show = () => {
    const line = input.value.trim();
    if (!line) {
      chip.hidden = true;
      body.replaceChildren(h('tr', null, h('td', { colspan: '3', class: 'muted' }, t.ingredientsPlaceholder)));
      return;
    }
    const { ingredient, doubts } = parseIngredient(line, lang());
    chip.hidden = doubts.length === 0;
    chip.textContent = t.toCheck(1);
    body.replaceChildren(
      reading(ingredient, lang(), doubts.length > 0),
      ...(doubts.length > 0
        ? [h('tr', { class: 'flagged' }, h('td', { colspan: '3', class: 'flag' }, doubts.map((doubt) => t.doubts[doubt.code](doubt.detail)).join(' ')))]
        : []));
  };

  input.addEventListener('input', show);
  form.addEventListener('change', show);
  form.addEventListener('submit', (event) => event.preventDefault());
  for (const example of form.querySelectorAll('button[data-line]')) {
    example.addEventListener('click', () => {
      input.value = example.getAttribute('data-line') ?? '';
      const radio = form.querySelector(`input[name="lang"][value="${example.getAttribute('data-lang') === 'pt' ? 'pt' : 'en'}"]`);
      if (radio instanceof HTMLInputElement) radio.checked = true;
      show();
    });
  }
  show();
}

/**
 * One row of the reading, like the editor's.
 * @param {Ingredient} ingredient
 * @param {Lang} lang
 * @param {boolean} flagged
 */
function reading(ingredient, lang, flagged) {
  const unit = ingredient.unit === 'count' ? h('span', { class: 'muted' }, t.count)
    : ingredient.unit ? unitText(ingredient, lang)
      : h('span', { class: 'muted' }, '–');
  return h('tr', { class: flagged && 'flagged' },
    h('td', { class: 'qty' }, ingredient.quantity ? displayQuantity(ingredient.quantity, lang) : h('span', { class: 'muted' }, '–')),
    h('td', { class: 'unit' },
      unit,
      ...ingredient.alternatives.map((alternative) => h('span', { class: 'alt' }, t.or(displayAmount(alternative, lang))))),
    h('td', { class: 'name', lang },
      ingredient.name || h('span', { class: 'muted' }, t.noName),
      ingredient.note && h('span', { class: 'note' }, `, ${ingredient.note}`)));
}

/** Sections ease in once, the first time they come into view. */
function easeIn() {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('revealed');
      watcher.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const element of document.querySelectorAll('[data-reveal]')) {
    // Whatever is already on screen stays put; only what's below eases in.
    if (element.getBoundingClientRect().top < innerHeight) continue;
    element.classList.add('will-reveal');
    watcher.observe(element);
  }
}
