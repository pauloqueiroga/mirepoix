// Scaling a recipe (×½, ×2, "makes 36" instead of 24), for cooking only: the
// recipe itself never changes (D10). The math is exact, in fractions, so ⅓
// cup halved is ⅙ cup; only the result is rounded, to amounts a kitchen can
// measure: ⅛s and ⅓s for cups and spoons, whole grams and millilitres.
import { readQuantity } from './quantity.js';

/** @typedef {import('./recipe.js').Lang} Lang */
/** @typedef {import('./recipe.js').Amount} Amount */
/** @typedef {import('./recipe.js').Ingredient} Ingredient */
/** @typedef {{ n: number, d: number }} Ratio  an exact fraction, n/d, in lowest terms with d > 0 */

/** @type {Ratio} */
export const SAME = { n: 1, d: 1 };

/** Units weighed or measured finely enough to round to whole numbers. */
const FINE = new Set(['g', 'ml']);
/** Metric units written with decimals rather than fractions. */
const DECIMAL = new Set(['kg', 'l']);
/** Fractions a kitchen measures, eighths and thirds, with how they're written. */
/** @type {[number, string][]} */
const KITCHEN = [[0, ''], [1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [3 / 8, '3/8'], [1 / 2, '1/2'],
  [5 / 8, '5/8'], [2 / 3, '2/3'], [3 / 4, '3/4'], [7 / 8, '7/8'], [1, '']];
/** Exact results in these are kept as they are: ⅙ cup is a third halved. */
const KITCHEN_DENOMINATORS = new Set([2, 3, 4, 6, 8]);

/**
 * @param {number} n
 * @param {number} [d]
 * @returns {Ratio}
 */
export function ratio(n, d = 1) {
  const divisor = gcd(Math.abs(n), Math.abs(d)) || 1;
  const sign = d < 0 ? -1 : 1;
  return { n: (sign * n) / divisor, d: (sign * d) / divisor };
}

/**
 * @param {Ratio} a
 * @param {Ratio} b
 */
export function times(a, b) {
  return ratio(a.n * b.n, a.d * b.d);
}

/**
 * @param {Ratio} a
 * @param {Ratio} b
 */
export function over(a, b) {
  return ratio(a.n * b.d, a.d * b.n);
}

/**
 * @param {Ratio} a
 * @param {Ratio} b
 */
export function sameRatio(a, b) {
  return a.n === b.n && a.d === b.d;
}

/**
 * A single canonical quantity as an exact fraction: "1 1/2" → 3/2, "0.25" → 1/4.
 * @param {string} quantity canonical, not a range
 * @returns {Ratio | null}
 */
export function quantityRatio(quantity) {
  if (!quantity || quantity.includes('-')) return null;
  let total = ratio(0);
  for (const part of quantity.split(' ')) {
    const [numerator = '', denominator = ''] = part.split('/');
    const [whole = '', decimals = ''] = numerator.split('.');
    const n = Number(`${whole}${decimals}`);
    const d = (denominator ? Number(denominator) : 1) * 10 ** decimals.length;
    if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) return null;
    const piece = ratio(n, d);
    total = ratio(total.n * piece.d + piece.n * total.d, total.d * piece.d);
  }
  return total;
}

/**
 * A quantity times a factor, as canonical text, rounded to what can be
 * measured in its unit. Ranges scale at both ends.
 * @param {string} quantity canonical
 * @param {Ratio} factor
 * @param {string} unit decides how the result is rounded
 */
export function scaleQuantity(quantity, factor, unit) {
  if (!quantity || sameRatio(factor, SAME)) return quantity;
  const ends = quantity.split('-').map((end) => {
    const exact = quantityRatio(end);
    return exact ? written(times(exact, factor), end.includes('.'), unit) : end;
  });
  return ends.length === 2 && ends[0] === ends[1] ? String(ends[0]) : ends.join('-');
}

/**
 * A factor as a canonical quantity, unrounded where it can be: "1/2", "2",
 * "1 1/3", "1.3"; a factor like 1/7 as a decimal to three places.
 * @param {Ratio} factor
 */
export function ratioQuantity(factor) {
  if (KITCHEN_DENOMINATORS.has(factor.d) || factor.d === 1) return mixed(factor);
  return decimalText(factor.n / factor.d, 3);
}

/**
 * An ingredient with its amount and every equivalent scaled.
 * @param {Ingredient} ingredient
 * @param {Ratio} factor
 * @returns {Ingredient}
 */
export function scaleIngredient(ingredient, factor) {
  /** @param {Amount} amount */
  const scaled = (amount) => scaleQuantity(amount.quantity, factor, amount.unit);
  return {
    ...ingredient,
    quantity: scaled(ingredient),
    alternatives: ingredient.alternatives.map((alternative) => ({ ...alternative, quantity: scaled(alternative) })),
  };
}

/**
 * The number in a recipe's Makes, for scaling by servings: "24 cookies",
 * "about 30 unidades", "Serves 4". A range ("6-8 servings") has none.
 * @param {string} text
 * @param {Lang} lang
 * @returns {{ before: string, amount: Ratio, quantity: string, after: string } | null}
 *   quantity: canonical; before and after: the words around it
 */
export function yieldAmount(text, lang) {
  const found = findNumber(text, lang);
  if (!found || found.quantity.includes('-')) return null;
  const amount = quantityRatio(found.quantity);
  return amount && amount.n > 0 ? { ...found, amount } : null;
}

/**
 * A recipe's Makes, scaled: "24 cookies" ×1.5 → "36 cookies". Text without
 * a number stays as it is.
 * @param {string} text
 * @param {Ratio} factor
 * @param {Lang} lang
 * @returns {{ before: string, quantity: string, after: string } | null} null when nothing in it scales
 */
export function scaleYield(text, factor, lang) {
  const found = findNumber(text, lang);
  return found && { before: found.before, quantity: scaleQuantity(found.quantity, factor, 'count'), after: found.after };
}

/**
 * The first number in some text, digits or a fraction, with the words before and after it.
 * @param {string} text
 * @param {Lang} lang
 */
function findNumber(text, lang) {
  const start = text.search(/(?<![\p{L}\d.,])[\d½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/u);
  if (start < 0) return null;
  const read = readQuantity(text.slice(start), lang);
  if (!read) return null;
  const after = read.rest;
  return { before: text.slice(0, start), quantity: read.quantity, after };
}

/**
 * Writes an exact amount the way its unit is measured.
 * @param {Ratio} exact
 * @param {boolean} decimal the original was written with decimals ("0.5 kg")
 * @param {string} unit
 */
function written(exact, decimal, unit) {
  if (exact.d === 1) return String(exact.n);
  const value = exact.n / exact.d;
  if (FINE.has(unit)) return value >= 10 ? String(Math.round(value)) : decimalText(value, 1);
  if (decimal || DECIMAL.has(unit)) return decimalText(Number(value.toPrecision(3)), 2);
  if (KITCHEN_DENOMINATORS.has(exact.d)) return mixed(exact);
  const whole = Math.floor(value);
  const [nearest, part] = KITCHEN.reduce((best, next) => (Math.abs(value - whole - next[0]) < Math.abs(value - whole - best[0]) ? next : best));
  if (whole === 0 && nearest === 0) return mixed(exact); // too small to round away: 1/16 tsp stays 1/16
  if (nearest === 1) return String(whole + 1);
  return [whole > 0 && String(whole), part].filter(Boolean).join(' ');
}

/**
 * "7/2" → "3 1/2".
 * @param {Ratio} exact
 */
function mixed({ n, d }) {
  const whole = Math.floor(n / d);
  const rest = n - whole * d;
  return [whole > 0 && String(whole), rest > 0 && `${rest}/${d}`].filter(Boolean).join(' ') || '0';
}

/**
 * A canonical decimal: no trailing zeros, at most `places` decimals, never "0".
 * @param {number} value
 * @param {number} places
 */
function decimalText(value, places) {
  const rounded = Number(value.toFixed(places));
  if (rounded === 0) return String(Number(value.toPrecision(1)));
  return String(rounded);
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}
