// Unit vocabulary (D8, D9): canonical keys, how each language writes them,
// and the spellings people use. Spellings match ignoring case, accents and
// trailing dots, and also with a plural -s or -es ("xícaras", "pinches").
import { quantityValue } from './quantity.js';

/** @typedef {'en' | 'pt'} Lang */
/** @typedef {{ en: [string, string], pt: [string, string], spellings: string[] }} UnitInfo singular and plural per language */

/** @type {Record<string, UnitInfo>} */
export const UNITS = {
  // Spoons and cups
  cup: { en: ['cup', 'cups'], pt: ['xícara', 'xícaras'], spellings: ['cup', 'c', 'xícara', 'xíc', 'xícara de chá', 'xícara (chá)', 'xícara (de chá)', 'chávena'] },
  tbsp: { en: ['tbsp', 'tbsp'], pt: ['colher de sopa', 'colheres de sopa'], spellings: ['tbsp', 'tbs', 'tbl', 'tb', 'tablespoon', 'colher de sopa', 'colher (sopa)', 'colher (de sopa)', 'c. de sopa', 'c. (sopa)', 'c. sopa', 'cs'] },
  tsp: { en: ['tsp', 'tsp'], pt: ['colher de chá', 'colheres de chá'], spellings: ['tsp', 'teaspoon', 'colher de chá', 'colher (chá)', 'colher (de chá)', 'c. de chá', 'c. (chá)', 'c. chá'] },
  'dessert spoon': { en: ['dessert spoon', 'dessert spoons'], pt: ['colher de sobremesa', 'colheres de sobremesa'], spellings: ['dessert spoon', 'dessertspoon', 'dsp', 'colher de sobremesa', 'colher (sobremesa)', 'colher (de sobremesa)'] },
  'coffee spoon': { en: ['coffee spoon', 'coffee spoons'], pt: ['colher (café)', 'colheres (café)'], spellings: ['coffee spoon', 'colher (café)', 'colher (de café)', 'colher de café'] },
  'coffee cup': { en: ['coffee cup', 'coffee cups'], pt: ['xícara (café)', 'xícaras (café)'], spellings: ['coffee cup', 'xícara (café)', 'xícara (de café)'] },
  spoon: { en: ['spoon', 'spoons'], pt: ['colher', 'colheres'], spellings: ['spoon', 'spoonful', 'colher', 'colherada'] },
  glass: { en: ['glass', 'glasses'], pt: ['copo', 'copos'], spellings: ['glass', 'copo'] },
  'copo americano': { en: ['copo americano', 'copos americanos'], pt: ['copo americano', 'copos americanos'], spellings: ['copo americano'] },

  // Volume
  ml: { en: ['ml', 'ml'], pt: ['ml', 'ml'], spellings: ['ml', 'milliliter', 'millilitre', 'mililitro', 'cc', 'cm3', 'cm³'] },
  l: { en: ['l', 'l'], pt: ['l', 'l'], spellings: ['l', 'lt', 'liter', 'litre', 'litro'] },
  'fl oz': { en: ['fl oz', 'fl oz'], pt: ['fl oz', 'fl oz'], spellings: ['fl oz', 'fl.oz', 'floz', 'fluid ounce', 'liquid ounce'] },
  pint: { en: ['pint', 'pints'], pt: ['pint', 'pints'], spellings: ['pint', 'pt'] },
  quart: { en: ['quart', 'quarts'], pt: ['quart', 'quarts'], spellings: ['quart', 'qt'] },
  gallon: { en: ['gallon', 'gallons'], pt: ['galão', 'galões'], spellings: ['gallon', 'gal', 'galão', 'galões'] },

  // Weight
  g: { en: ['g', 'g'], pt: ['g', 'g'], spellings: ['g', 'gr', 'gram', 'gramme', 'grama'] },
  kg: { en: ['kg', 'kg'], pt: ['kg', 'kg'], spellings: ['kg', 'kilo', 'kilogram', 'kilogramme', 'quilo', 'quilograma'] },
  oz: { en: ['oz', 'oz'], pt: ['oz', 'oz'], spellings: ['oz', 'ounce', 'onça'] },
  lb: { en: ['lb', 'lb'], pt: ['lb', 'lb'], spellings: ['lb', 'lbs', 'pound', 'libra'] },

  // Small amounts
  pinch: { en: ['pinch', 'pinches'], pt: ['pitada', 'pitadas'], spellings: ['pinch', 'pitada'] },
  dash: { en: ['dash', 'dashes'], pt: ['pingo', 'pingos'], spellings: ['dash', 'pingo'] },
  drop: { en: ['drop', 'drops'], pt: ['gota', 'gotas'], spellings: ['drop', 'gota'] },
  drizzle: { en: ['drizzle', 'drizzles'], pt: ['fio', 'fios'], spellings: ['drizzle', 'fio'] },
  handful: { en: ['handful', 'handfuls'], pt: ['punhado', 'punhados'], spellings: ['handful', 'punhado'] },

  // Pieces
  clove: { en: ['clove', 'cloves'], pt: ['dente', 'dentes'], spellings: ['clove', 'dente'] },
  head: { en: ['head', 'heads'], pt: ['cabeça', 'cabeças'], spellings: ['head', 'cabeça'] },
  leaf: { en: ['leaf', 'leaves'], pt: ['folha', 'folhas'], spellings: ['leaf', 'leaves', 'folha'] },
  sprig: { en: ['sprig', 'sprigs'], pt: ['raminho', 'raminhos'], spellings: ['sprig', 'raminho', 'ramo'] },
  bunch: { en: ['bunch', 'bunches'], pt: ['maço', 'maços'], spellings: ['bunch', 'maço'] },
  stalk: { en: ['stalk', 'stalks'], pt: ['talo', 'talos'], spellings: ['stalk', 'talo'] },
  slice: { en: ['slice', 'slices'], pt: ['fatia', 'fatias'], spellings: ['slice', 'fatia'] },
  piece: { en: ['piece', 'pieces'], pt: ['pedaço', 'pedaços'], spellings: ['piece', 'pc', 'pedaço'] },
  stick: { en: ['stick', 'sticks'], pt: ['stick', 'sticks'], spellings: ['stick'] },
  dozen: { en: ['dozen', 'dozen'], pt: ['dúzia', 'dúzias'], spellings: ['dozen', 'dúzia'] },

  // Packages
  can: { en: ['can', 'cans'], pt: ['lata', 'latas'], spellings: ['can', 'tin', 'lata'] },
  jar: { en: ['jar', 'jars'], pt: ['pote', 'potes'], spellings: ['jar', 'pote', 'vidro'] },
  box: { en: ['box', 'boxes'], pt: ['caixa', 'caixas'], spellings: ['box', 'carton', 'caixa', 'caixinha'] },
  bottle: { en: ['bottle', 'bottles'], pt: ['garrafa', 'garrafas'], spellings: ['bottle', 'garrafa'] },
  package: { en: ['package', 'packages'], pt: ['pacote', 'pacotes'], spellings: ['package', 'pack', 'packet', 'pkg', 'pacote'] },
  envelope: { en: ['envelope', 'envelopes'], pt: ['envelope', 'envelopes'], spellings: ['envelope', 'sachet', 'sachê', 'saquinho'] },

  // "2 eggs": a number of things, written without a unit
  count: { en: ['', ''], pt: ['', ''], spellings: [] },
};

/** Single letters where case matters: T is a tablespoon, t a teaspoon. */
/** @type {Record<string, string>} */
const CASE_SENSITIVE = { T: 'tbsp', t: 'tsp' };

/**
 * Lowercase, no accents, no trailing dots: "Xíc." → "xic".
 * @param {string} word
 */
export function normalizeWord(word) {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\.+$/u, '');
}

const SPELLINGS = Object.entries(UNITS).flatMap(([unit, info]) =>
  info.spellings.map((spelling) => ({ unit, words: spelling.split(' ').map(normalizeWord) })));

/**
 * Finds the unit spelled by the first words, preferring the longest spelling
 * ("colher de sopa" over "colher") and exact spellings over plurals.
 * @param {string[]} words
 * @returns {{ unit: string, length: number } | null} unit key and how many words it took
 */
export function matchUnit(words) {
  const first = (words[0] ?? '').replace(/\.$/u, '');
  if (CASE_SENSITIVE[first]) return { unit: CASE_SENSITIVE[first], length: 1 };

  const normalized = words.map(normalizeWord);
  /** @type {{ unit: string, length: number, score: number } | null} */
  let best = null;
  for (const spelling of SPELLINGS) {
    let exact = true;
    const matches = spelling.words.every((word, i) => {
      const candidate = normalized[i];
      if (candidate === word) return true;
      if (candidate === `${word}s` || candidate === `${word}es`) {
        exact = false;
        return true;
      }
      return false;
    });
    if (!matches) continue;
    const score = spelling.words.length * 2 + (exact ? 1 : 0);
    if (!best || score > best.score) best = { unit: spelling.unit, length: spelling.words.length, score };
  }
  return best && { unit: best.unit, length: best.length };
}

/**
 * The unit key for some text that is nothing but a unit ("xícaras" → "cup").
 * @param {string} text
 * @returns {string | null}
 */
export function unitFromText(text) {
  const words = text.split(' ').filter(Boolean);
  const match = matchUnit(words);
  return match && match.length === words.length ? match.unit : null;
}

/**
 * Whether a unit is one of ours rather than kept as written.
 * @param {string} unit
 */
export function isKnownUnit(unit) {
  return Object.hasOwn(UNITS, unit);
}

/**
 * How a unit is written for an amount in a language: "2 cups", "1 xícara".
 * Unknown units come back as written; counts have no unit word.
 * @param {{ quantity: string, unit: string }} amount
 * @param {Lang} lang
 */
export function unitText({ quantity, unit }, lang) {
  const info = UNITS[unit];
  if (!info) return unit;
  const [one, many] = info[lang];
  return quantityValue(quantity) > 1 ? many : one;
}
