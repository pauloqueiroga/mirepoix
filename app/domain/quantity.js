// Quantities (D8, D9): what people write ("1½", "1,5", "2 a 3", "1-1/2")
// becomes canonical text ("1 1/2", "1.5", "2-3"), and back.

/** @typedef {'en' | 'pt'} Lang */

/** @type {Record<string, string>} */
const VULGAR = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5', '⅖': '2/5', '⅗': '3/5',
  '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
};
const VULGAR_CHARS = new RegExp(`[${Object.keys(VULGAR).join('')}]`, 'gu');
const RANGE = /^(?:\s*[-–—]\s*|\s+(?:to|a|or|ou|até)\s+)/iu;
const AND_A_HALF = /^\s+(?:e|and)\s+(?:meia|meio|a half)(?=\s|$)/iu;

/**
 * Reads the quantity at the start of some text.
 * @param {string} text
 * @param {Lang} lang picks the decimal separator ("1,5" in Portuguese, "1.5" in English)
 * @returns {{ quantity: string, rest: string } | null} canonical quantity and the text after it
 */
export function readQuantity(text, lang) {
  const s = text
    .replace(VULGAR_CHARS, (char) => ` ${VULGAR[char]} `)
    .replace(/⁄/gu, '/')
    .replace(/\s+/gu, ' ')
    .trim();
  const first = readNumber(s, lang);
  if (!first) return null;
  let quantity = first.value;
  let rest = s.slice(first.length);

  const half = AND_A_HALF.exec(rest);
  const separator = RANGE.exec(rest);
  if (half && /^[1-9]\d*$/.test(quantity)) {
    quantity = `${quantity} 1/2`;
    rest = rest.slice(half[0].length);
  } else if (separator) {
    const second = readNumber(rest.slice(separator[0].length), lang);
    if (second) {
      quantity = `${quantity}-${second.value}`;
      rest = rest.slice(separator[0].length + second.length);
    }
  }
  return { quantity, rest: rest.trim() };
}

/**
 * Writes a canonical quantity the way the recipe's language does.
 * @param {string} quantity
 * @param {Lang} lang
 */
export function formatQuantity(quantity, lang) {
  return lang === 'pt' ? quantity.replace(/\./gu, ',') : quantity;
}

const GLYPHS = Object.fromEntries(Object.entries(VULGAR).map(([glyph, fraction]) => [fraction, glyph]));

/**
 * Shows a canonical quantity for reading: "1 1/2" → "1 ½", "2-3" → "2–3",
 * "0.5" → "0,5" in Portuguese. Not for editing; formatQuantity is.
 * @param {string} quantity
 * @param {Lang} lang
 */
export function displayQuantity(quantity, lang) {
  return quantity
    .split('-')
    .map((part) => part.split(' ').map((piece) => GLYPHS[piece] ?? formatQuantity(piece, lang)).join(' '))
    .join('–');
}

/**
 * The largest amount a canonical quantity stands for ("2-3" → 3), or 0.
 * @param {string} quantity
 */
export function quantityValue(quantity) {
  const top = quantity.split('-').at(-1) ?? '';
  let value = 0;
  for (const part of top.split(' ')) {
    const [numerator, denominator] = part.split('/');
    value += denominator ? Number(numerator) / Number(denominator) : Number(numerator || 0);
  }
  return Number.isFinite(value) ? value : 0;
}

/**
 * @param {string} s
 * @param {Lang} lang
 * @returns {{ value: string, length: number } | null}
 */
function readNumber(s, lang) {
  let m;
  if ((m = /^(\d+)\s+(?:(?:e|and)\s+)?(\d+)\/(\d+)(?![\d/])/iu.exec(s))) {
    const value = mixed(m[1], m[2], m[3]);
    if (value) return { value, length: m[0].length };
  }
  if ((m = /^(\d+)-(\d+)\/(\d+)(?![\d/])/u.exec(s)) && Number(m[2]) < Number(m[3])) {
    const value = mixed(m[1], m[2], m[3]);
    if (value) return { value, length: m[0].length };
  }
  if ((m = /^(\d+)\/(\d+)(?![\d/])/u.exec(s))) {
    const value = fraction(m[1], m[2]);
    if (value) return { value, length: m[0].length };
  }
  if ((m = /^(\d*)([.,])(\d+)(?!\d)/u.exec(s))) {
    const [whole, integerPart = '', separator, digits = ''] = m;
    const decimalSeparator = lang === 'pt' ? ',' : '.';
    const thousands = separator !== decimalSeparator && digits.length === 3 && integerPart !== '';
    return { value: thousands ? integer(integerPart + digits) : decimal(integerPart, digits), length: whole.length };
  }
  if ((m = /^\d+/u.exec(s))) return { value: integer(m[0]), length: m[0].length };
  return null;
}

/** @param {string} digits */
function integer(digits) {
  return digits.replace(/^0+(?=\d)/u, '');
}

/**
 * @param {string} integerPart
 * @param {string} digits
 */
function decimal(integerPart, digits) {
  const fractionPart = digits.replace(/0+$/u, '');
  const whole = integer(integerPart || '0');
  return fractionPart ? `${whole}.${fractionPart}` : whole;
}

/**
 * @param {string | undefined} numerator
 * @param {string | undefined} denominator
 */
function fraction(numerator = '', denominator = '') {
  const n = integer(numerator);
  const d = integer(denominator);
  if (d === '0') return null;
  return n === '0' ? '0' : `${n}/${d}`;
}

/**
 * @param {string | undefined} whole
 * @param {string | undefined} numerator
 * @param {string | undefined} denominator
 */
function mixed(whole = '', numerator = '', denominator = '') {
  const part = fraction(numerator, denominator);
  if (!part) return null;
  const w = integer(whole);
  if (part === '0') return w;
  return w === '0' ? part : `${w} ${part}`;
}
