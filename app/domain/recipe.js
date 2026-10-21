// Recipe model, schema v1 (D8). Pure data and rules: no DOM, no storage.

export const SCHEMA = 1;

/**
 * @typedef {'en' | 'pt'} Lang
 * @typedef {{ quantity: string, unit: string }} Amount
 * @typedef {{ quantity: string, unit: string, name: string, note: string, alternatives: Amount[] }} Ingredient
 * @typedef {{ heading: string, items: Ingredient[] }} IngredientGroup
 * @typedef {{ heading: string, steps: string[] }} StepGroup
 * @typedef {{ id: string, at: string, text: string }} CooksNote
 * @typedef {{
 *   schema: 1,
 *   id: string,
 *   lang: Lang,
 *   title: string,
 *   source: string,
 *   yield: string,
 *   ingredients: IngredientGroup[],
 *   preparation: StepGroup[],
 *   variations: string[],
 *   notes: string[],
 *   cooksNotes: CooksNote[],
 *   createdAt: string,
 *   updatedAt: string,
 * }} Recipe
 */

/** @type {readonly Lang[]} */
export const LANGS = ['en', 'pt'];

const INTEGER = String.raw`(?:0|[1-9]\d*)`;
const NUMBER = String.raw`(?:[1-9]\d* [1-9]\d*/[1-9]\d*|[1-9]\d*/[1-9]\d*|${INTEGER}\.\d*[1-9]|${INTEGER})`;
const QUANTITY = new RegExp(`^(?:${NUMBER}(?:-${NUMBER})?)?$`);

/**
 * Whether a quantity is in canonical form: "" (none), "2", "0.5", "1/2",
 * "1 1/2", or a range like "2-3". Text, never a float, so ⅓ stays ⅓. No
 * leading or trailing zeros, so each amount has exactly one spelling.
 * @param {string} quantity
 */
export function isCanonicalQuantity(quantity) {
  return QUANTITY.test(quantity);
}

/**
 * A new recipe with nothing in it yet but a title.
 * @param {{ title: string, lang?: Lang, id?: string, now?: Date }} init
 * @returns {Recipe}
 */
export function newRecipe({ title, lang = 'en', id = crypto.randomUUID(), now = new Date() }) {
  const at = now.toISOString();
  return {
    schema: SCHEMA,
    id,
    lang,
    title,
    source: '',
    yield: '',
    ingredients: [],
    preparation: [],
    variations: [],
    notes: [],
    cooksNotes: [],
    createdAt: at,
    updatedAt: at,
  };
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/**
 * Orders recipes by title the way people read them: ignoring case and accents.
 * @param {{ title: string }} a
 * @param {{ title: string }} b
 */
export function byTitle(a, b) {
  return collator.compare(a.title, b.title);
}

/** @typedef {(path: string, expected: string) => void} Fail */

/**
 * Lists what's wrong with a value that should be a Recipe; empty when valid.
 * Unknown extra fields are fine, so data written by newer versions survives.
 * @param {unknown} value
 * @returns {string[]}
 */
export function recipeProblems(value) {
  /** @type {string[]} */
  const problems = [];
  /** @type {Fail} */
  const fail = (path, expected) => {
    problems.push(`${path}: expected ${expected}`);
  };

  if (!isObject(value)) return ['recipe: expected an object'];
  if (value.schema !== SCHEMA) fail('schema', String(SCHEMA));
  if (!isText(value.id) || value.id === '') fail('id', 'a non-empty string');
  if (!LANGS.some((lang) => lang === value.lang)) fail('lang', LANGS.join(' or '));
  if (!isText(value.title) || value.title.trim() === '') fail('title', 'a non-blank string');
  for (const key of ['source', 'yield']) {
    if (!isText(value[key])) fail(key, 'a string');
  }
  for (const key of ['createdAt', 'updatedAt']) {
    if (!isTimestamp(value[key])) fail(key, 'an ISO timestamp');
  }

  objects(value.ingredients, 'ingredients', fail, (group, path) => {
    if (!isText(group.heading)) fail(`${path}.heading`, 'a string');
    objects(group.items, `${path}.items`, fail, (item, itemPath) => {
      amountProblems(item, itemPath, fail);
      if (!isText(item.name) || item.name.trim() === '') fail(`${itemPath}.name`, 'a non-blank string');
      if (!isText(item.note)) fail(`${itemPath}.note`, 'a string');
      if (item.quantity === '' && item.unit !== '') fail(`${itemPath}.unit`, 'empty when there is no quantity');
      objects(item.alternatives, `${itemPath}.alternatives`, fail, (alternative, altPath) => {
        amountProblems(alternative, altPath, fail);
        if (alternative.quantity === '' || alternative.unit === '') fail(altPath, 'both a quantity and a unit');
      });
    });
  });
  objects(value.preparation, 'preparation', fail, (group, path) => {
    if (!isText(group.heading)) fail(`${path}.heading`, 'a string');
    texts(group.steps, `${path}.steps`, fail);
  });
  texts(value.variations, 'variations', fail);
  texts(value.notes, 'notes', fail);
  objects(value.cooksNotes, 'cooksNotes', fail, (note, path) => {
    if (!isText(note.id) || note.id === '') fail(`${path}.id`, 'a non-empty string');
    if (!isTimestamp(note.at)) fail(`${path}.at`, 'an ISO timestamp');
    if (!isText(note.text) || note.text.trim() === '') fail(`${path}.text`, 'a non-blank string');
  });
  return problems;
}

/**
 * @param {unknown} value
 * @returns {asserts value is Recipe}
 */
export function assertValidRecipe(value) {
  const problems = recipeProblems(value);
  if (problems.length > 0) throw new TypeError(`Not a valid recipe: ${problems.join('; ')}`);
}

/**
 * @param {Record<string, unknown>} amount
 * @param {string} path
 * @param {Fail} fail
 */
function amountProblems(amount, path, fail) {
  if (!isText(amount.quantity) || !isCanonicalQuantity(amount.quantity)) {
    fail(`${path}.quantity`, 'a canonical quantity like "2", "1 1/2" or "2-3"');
  }
  if (!isText(amount.unit)) fail(`${path}.unit`, 'a string');
}

/**
 * @param {unknown} list
 * @param {string} path
 * @param {Fail} fail
 * @param {(item: Record<string, unknown>, path: string) => void} check
 */
function objects(list, path, fail, check) {
  if (!Array.isArray(list)) {
    fail(path, 'a list');
    return;
  }
  list.forEach((item, i) => {
    if (isObject(item)) check(item, `${path}[${i}]`);
    else fail(`${path}[${i}]`, 'an object');
  });
}

/**
 * @param {unknown} list
 * @param {string} path
 * @param {Fail} fail
 */
function texts(list, path, fail) {
  if (!Array.isArray(list)) {
    fail(path, 'a list');
    return;
  }
  list.forEach((item, i) => {
    if (!isText(item)) fail(`${path}[${i}]`, 'a string');
  });
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isText(value) {
  return typeof value === 'string';
}

/** @param {unknown} value */
function isTimestamp(value) {
  return isText(value) && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}
