// Quantities (D8, D9): what people write ("1½", "1,5", "2 a 3", "1-1/2")
// becomes canonical text ("1 1/2", "1.5", "2-3"), and back.

/** @typedef {'en' | 'pt'} Lang */

/** @type {Record<string, string>} */
const VULGAR = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5', '⅖': '2/5', '⅗': '3/5',
  '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
};
const VULGAR_CHARS = new RegExp(`[${Object.keys(VULGAR).join('')}]`, 'gu');

// Numbers written as words (R1.16), English and Portuguese together.
/** @type {Record<string, number>} */
const CARDINALS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8,
  nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15,
  dezesseis: 16, dezasseis: 16, dezessete: 17, dezassete: 17, dezoito: 18, dezenove: 19,
  dezanove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90,
};
/** @type {Record<string, number>} the denominator each fraction word stands for */
const FRACTIONS = {
  half: 2, third: 3, thirds: 3, quarter: 4, quarters: 4, fourth: 4, fourths: 4, eighth: 8, eighths: 8,
  meio: 2, meia: 2, terco: 3, tercos: 3, quarto: 4, quartos: 4,
};
const TENS = new Set(['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
  'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']);
/** "um pouco de sal" is "a little salt", not one of anything. */
const NOT_A_NUMBER_AFTER = new Set(['pouco', 'pouca', 'poucos', 'poucas', 'pouquinho', 'bocado', 'bocadinho', 'tanto']);
const RANGE_WORDS = new Set(['or', 'to', 'ou', 'a', '-', '–']);
const RANGE = /^(?:\s*[-–—]\s*|\s+(?:to|a|or|ou|até)\s+)/iu;
const AND_A_HALF = /^\s+(?:e|and)\s+(?:meia|meio|a half)(?=\s|$)/iu;

/**
 * Reads the quantity at the start of some text.
 * @param {string} text
 * @param {Lang} lang picks the decimal separator ("1,5" in Portuguese, "1.5" in English)
 * @returns {{ quantity: string, rest: string } | null} canonical quantity and the text after it
 */
export function readQuantity(text, lang) {
  const s = wordsToDigits(text.replace(/\s+/gu, ' ').trim())
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
 * Turns a number written as words at the start of the text into digits:
 * "two or three eggs" → "2 or 3 eggs", "três quartos de xícara" → "3/4 de
 * xícara", "half an onion" → "1/2 onion". Anything else is left as it is.
 * @param {string} text
 */
export function wordsToDigits(text) {
  const words = text.split(' ');
  const first = wordNumber(words, 0);
  if (!first) return text;
  const out = [first.value];
  let next = first.next;
  const separator = words[next];
  const second = separator !== undefined && RANGE_WORDS.has(fold(separator)) ? wordNumber(words, next + 1) : null;
  if (separator !== undefined && second) {
    out.push(separator, second.value);
    next = second.next;
  }
  return [...out, ...words.slice(next)].join(' ');
}

/**
 * The number spelled by the words starting at i, and where they end.
 * @param {string[]} words
 * @param {number} i
 * @returns {{ value: string, next: number } | null}
 */
function wordNumber(words, i) {
  const word = fold(words[i] ?? '');
  const after = fold(words[i + 1] ?? '');
  if (!word) return null;

  const parts = word.split('-');
  if (parts.length === 2) {
    const [head = '', tail = ''] = parts;
    const n = CARDINALS[head];
    if (n !== undefined && FRACTIONS[tail]) return { value: `${n}/${FRACTIONS[tail]}`, next: i + 1 }; // three-quarters
    const units = CARDINALS[tail];
    if (TENS.has(head) && n !== undefined && units !== undefined && units < 10) return { value: String(n + units), next: i + 1 }; // twenty-five
    return null;
  }

  if (['a', 'an', 'um', 'uma'].includes(word) && FRACTIONS[after]) return { value: `1/${FRACTIONS[after]}`, next: i + 2 }; // a quarter, um terço
  const denominator = FRACTIONS[word];
  if (denominator) {
    const skip = word === 'half' && (after === 'a' || after === 'an') ? 2 : 1; // half an onion
    return { value: `1/${denominator}`, next: i + skip };
  }

  const n = CARDINALS[word];
  if (n === undefined) return null;
  if ((word === 'um' || word === 'uma') && NOT_A_NUMBER_AFTER.has(after)) return null;
  if (FRACTIONS[after] && after !== 'half' && after !== 'meio' && after !== 'meia') return { value: `${n}/${FRACTIONS[after]}`, next: i + 2 }; // two thirds
  if (TENS.has(word)) {
    const units = CARDINALS[after];
    if (units !== undefined && units < 10) return { value: String(n + units), next: i + 2 }; // twenty five
    const joined = CARDINALS[fold(words[i + 2] ?? '')];
    if ((after === 'e' || after === 'and') && joined !== undefined && joined < 10) return { value: String(n + joined), next: i + 3 }; // vinte e cinco
  }
  return { value: String(n), next: i + 1 };
}

/** @param {string} word lowercase, no accents */
function fold(word) {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
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
