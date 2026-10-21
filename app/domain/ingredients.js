// Ingredient lines (D8, D9): what people write ↔ quantity, unit, name, note
// and equivalents. Doubtful readings are flagged, never silently guessed.
import { displayQuantity, formatQuantity, readQuantity } from './quantity.js';
import { isKnownUnit, matchUnit, normalizeWord, unitFromText, unitText } from './units.js';

/** @typedef {import('./recipe.js').Lang} Lang */
/** @typedef {import('./recipe.js').Amount} Amount */
/** @typedef {import('./recipe.js').Ingredient} Ingredient */
/** @typedef {import('./recipe.js').IngredientGroup} IngredientGroup */
/** @typedef {'unknown-unit' | 'assumed-quantity' | 'unclear-quantity' | 'no-name' | 'unclear-override'} DoubtCode */
/** @typedef {{ code: DoubtCode, message: string }} Doubt */
/** @typedef {{ ingredient: Ingredient, doubts: Doubt[] }} Reading */
/**
 * One non-blank line of an Ingredients box; number counts from 1, blank lines included.
 * @typedef {{ kind: 'heading', number: number, line: string, heading: string }
 *   | { kind: 'ingredient', number: number, line: string, ingredient: Ingredient, doubts: Doubt[] }} ListLine
 */

const BULLETS = /^[-–—•*·▪◦‣⁃□☐▢✓✔]+\s*/u;
const SIZE_WORDS = new Set(['sopa', 'cha', 'cafe', 'sobremesa', 'de sopa', 'de cha', 'de cafe', 'de sobremesa']);
const CONNECTORS = new Set(['of', 'de', 'do', 'da', 'dos', 'das']);
const ONE = new Set(['a', 'an', 'one', 'um', 'uma']);
const HALF = new Set(['half', 'meia', 'meio']);
const APPROXIMATELY = /^(about|approx\.?|approximately|around|roughly|aprox\.?|aproximadamente|cerca de)\s+(?=[\d½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/iu;
const TRAILING_NOTE = /\s+(to taste|as needed|if needed|optional|for serving|to serve|for garnish|a gosto|à gosto|q\.?\s?b\.?|o quanto baste|quanto baste|opcional|para servir|para decorar)$/iu;
const FIRST_COMMA = /(?<!\d),|,(?!\d)/u;

/**
 * Reads one ingredient line.
 * @param {string} line
 * @param {Lang} lang
 * @returns {Reading}
 */
export function parseIngredient(line, lang) {
  /** @type {Doubt[]} */
  const doubts = [];
  /** @type {Amount[]} */
  const alternatives = [];
  /** @type {string[]} */
  const notes = [];

  // Parentheses: equivalent amounts ("(437 g)") or notes ("(optional)"). Cup and
  // spoon sizes ("colher (sopa)") stay put; they're part of the unit.
  let text = squash(clean(line).replace(/\(([^()]*)\)/gu, (whole, inner) => {
    const content = String(inner).trim();
    if (SIZE_WORDS.has(normalizePhrase(content))) return whole;
    const amounts = readAmounts(content, lang);
    if (amounts) alternatives.push(...amounts);
    else if (content) notes.push(content);
    return ' ';
  }));

  const parts = text.split('|');
  if (parts.length === 3) return readExplicit(parts.map((part) => part.trim()), lang, { alternatives, notes, doubts });
  if (parts.length > 1) {
    doubts.push(doubt('unclear-override'));
    text = squash(parts.join(' '));
  }

  const [segment, commaNote] = splitNote(text);
  let rest = segment;
  let lead = '';
  let trailing = '';
  const approximately = APPROXIMATELY.exec(rest);
  if (approximately) {
    lead = String(approximately[1]);
    rest = rest.slice(approximately[0].length);
  }
  const ending = TRAILING_NOTE.exec(rest);
  if (ending) {
    trailing = String(ending[1]);
    rest = rest.slice(0, ending.index);
  }

  let quantity = '';
  let unit = '';
  let words = rest.split(' ').filter(Boolean);
  const read = readQuantity(rest, lang);
  if (read) {
    quantity = read.quantity;
    words = read.rest.split(' ').filter(Boolean);
    if (/^[\d/]/u.test(words[0] ?? '')) doubts.push(doubt('unclear-quantity'));
    const known = matchUnit(words);
    if (known) {
      unit = known.unit;
      words = words.slice(known.length);
      ({ quantity, words } = andAHalf(quantity, words));
      words = skipConnector(words);
    } else {
      const guess = guessUnit(words);
      if (guess) {
        unit = guess.unit;
        words = guess.words;
        doubts.push(doubt('unknown-unit', unit));
      } else {
        unit = 'count';
      }
    }
  } else {
    const spelled = spelledQuantity(words);
    const bare = !spelled && matchUnit(words);
    if (spelled) {
      ({ quantity, unit } = spelled);
      ({ quantity, words } = andAHalf(quantity, words.slice(spelled.length)));
      words = skipConnector(words);
    } else if (bare && isConnector(words[bare.length]) && words.length > bare.length + 1) {
      quantity = '1';
      unit = bare.unit;
      words = skipConnector(words.slice(bare.length));
      doubts.push(doubt('assumed-quantity'));
    }
  }

  let name = words.join(' ').replace(/\s*\(([^()]*)\)/gu, (_, inner) => {
    notes.push(String(inner).trim());
    return '';
  });
  name = name.replace(/[\s.;:]+$/u, '');
  if (/^(?:\+|plus\s|mais\s)/iu.test(name)) doubts.push(doubt('unclear-quantity'));
  if (!name) doubts.push(doubt('no-name'));

  const note = [lead, ...notes, trailing, commaNote].filter(Boolean).join(', ');
  return { ingredient: { quantity, unit, name, note, alternatives }, doubts };
}

/**
 * Writes an ingredient as one line that reads back to exactly the same
 * ingredient: naturally when possible ("2 xícaras de farinha"), otherwise
 * with explicit parts ("3 | | ovos de codorna").
 * @param {Ingredient} ingredient
 * @param {Lang} lang
 */
export function renderIngredient(ingredient, lang) {
  const natural = naturalLine(ingredient, lang);
  return sameIngredient(parseIngredient(natural, lang).ingredient, ingredient) ? natural : explicitLine(ingredient, lang);
}

/**
 * Reads a whole Ingredients box: one ingredient per line, blank lines
 * ignored, and lines like "For the sauce:" starting a new group.
 * @param {string} text
 * @param {Lang} lang
 * @returns {{ lines: ListLine[], groups: IngredientGroup[] }}
 */
export function parseIngredientList(text, lang) {
  /** @type {ListLine[]} */
  const lines = [];
  /** @type {IngredientGroup[]} */
  const groups = [];
  /** @type {IngredientGroup} */
  let group = { heading: '', items: [] };
  for (const [index, raw] of text.split(/\r?\n/u).entries()) {
    const line = clean(raw);
    const number = index + 1;
    if (!line) continue;
    if (line.endsWith(':') && !/\d/u.test(line)) {
      if (group.heading || group.items.length > 0) groups.push(group);
      group = { heading: line.slice(0, -1).trim(), items: [] };
      lines.push({ kind: 'heading', number, line: raw.trim(), heading: group.heading });
      continue;
    }
    const { ingredient, doubts } = parseIngredient(line, lang);
    group.items.push(ingredient);
    lines.push({ kind: 'ingredient', number, line: raw.trim(), ingredient, doubts });
  }
  if (group.heading || group.items.length > 0) groups.push(group);
  return { lines, groups };
}

/**
 * Writes ingredient groups back as the text of an Ingredients box.
 * @param {IngredientGroup[]} groups
 * @param {Lang} lang
 */
export function renderIngredientList(groups, lang) {
  return groups
    .map((group) => [group.heading && `${group.heading}:`, ...group.items.map((item) => renderIngredient(item, lang))]
      .filter(Boolean)
      .join('\n'))
    .join('\n\n');
}

/**
 * An amount for reading: "1 ½ xícaras", "500 g", "2" for things counted, ""
 * when there is none.
 * @param {Amount} amount
 * @param {Lang} lang
 */
export function displayAmount(amount, lang) {
  return [displayQuantity(amount.quantity, lang), unitText(amount, lang)].filter(Boolean).join(' ');
}

/**
 * @param {Ingredient} a
 * @param {Ingredient} b
 */
export function sameIngredient(a, b) {
  return a.quantity === b.quantity && a.unit === b.unit && a.name === b.name && a.note === b.note
    && a.alternatives.length === b.alternatives.length
    && a.alternatives.every((alt, i) => alt.quantity === b.alternatives[i]?.quantity && alt.unit === b.alternatives[i]?.unit);
}

// Reading helpers

/**
 * "2 | xícaras | farinha, peneirada": quantity, unit and name exactly as given.
 * @param {string[]} parts
 * @param {Lang} lang
 * @param {{ alternatives: Amount[], notes: string[], doubts: Doubt[] }} found
 * @returns {Reading}
 */
function readExplicit([quantityText = '', unitText = '', nameText = ''], lang, { alternatives, notes, doubts }) {
  let quantity = '';
  if (quantityText) {
    const read = readQuantity(quantityText, lang);
    if (read && !read.rest) quantity = read.quantity;
    else {
      notes.unshift(quantityText);
      doubts.push(doubt('unclear-quantity'));
    }
  }
  let unit = unitText ? (unitFromText(unitText) ?? unitText) : '';
  if (quantity && !unit) unit = 'count';
  if (!quantity && unit) {
    quantity = '1';
    doubts.push(doubt('assumed-quantity'));
  }
  const [name, commaNote] = splitNote(nameText);
  if (!name) doubts.push(doubt('no-name'));
  const note = [...notes, commaNote].filter(Boolean).join(', ');
  return { ingredient: { quantity, unit, name, note, alternatives }, doubts };
}

/**
 * Equivalents inside parentheses: "437 g", "240 ml; 8 fl oz", "1 cup or 240 ml".
 * @param {string} text
 * @param {Lang} lang
 * @returns {Amount[] | null} null unless every piece is an amount with a known unit
 */
function readAmounts(text, lang) {
  /** @type {Amount[]} */
  const amounts = [];
  for (const piece of text.split(/\s*;\s*|\s+\/\s+|\s+(?:or|ou)\s+/iu)) {
    const read = readQuantity(piece, lang);
    if (!read) return null;
    const words = read.rest.split(' ').filter(Boolean);
    const unit = matchUnit(words);
    if (!unit || unit.length !== words.length) return null;
    amounts.push({ quantity: read.quantity, unit: unit.unit });
  }
  return amounts.length > 0 ? amounts : null;
}

/**
 * Amounts written as words: "a pinch", "uma xícara", "half a cup", "meio quilo".
 * @param {string[]} words
 * @returns {{ quantity: string, unit: string, length: number } | null}
 */
function spelledQuantity(words) {
  const first = normalizeWord(words[0] ?? '');
  const half = HALF.has(first);
  if (!half && !ONE.has(first)) return null;
  const skip = half && ['a', 'an'].includes(normalizeWord(words[1] ?? '')) ? 2 : 1;
  const unit = matchUnit(words.slice(skip));
  return unit && { quantity: half ? '1/2' : '1', unit: unit.unit, length: skip + unit.length };
}

/**
 * "1 xícara e meia" / "1 cup and a half": one and a half.
 * @param {string} quantity
 * @param {string[]} words
 */
function andAHalf(quantity, words) {
  const [and = '', half = '', third = ''] = words.map(normalizeWord);
  if (/^[1-9]\d*$/u.test(quantity)) {
    if (and === 'e' && (half === 'meia' || half === 'meio')) return { quantity: `${quantity} 1/2`, words: words.slice(2) };
    if (and === 'and' && half === 'a' && third === 'half') return { quantity: `${quantity} 1/2`, words: words.slice(3) };
  }
  return { quantity, words };
}

/**
 * An unknown unit, read from "N <unit> de/of <name>": up to three words
 * before the first connector. Always flagged.
 * @param {string[]} words
 * @returns {{ unit: string, words: string[] } | null}
 */
function guessUnit(words) {
  for (let i = 1; i <= 3 && i < words.length - 1; i++) {
    if (!isConnector(words[i])) continue;
    const unitWords = words.slice(0, i);
    if (!unitWords.every((word) => /^\p{L}[\p{L}'’-]*$/u.test(word))) return null;
    return { unit: unitWords.join(' '), words: words.slice(i + 1) };
  }
  return null;
}

/** @param {string | undefined} word */
function isConnector(word) {
  return word !== undefined && CONNECTORS.has(normalizeWord(word));
}

/**
 * Drops the "de"/"of" between a unit and the name, including "d'água".
 * @param {string[]} words
 */
function skipConnector(words) {
  if (isConnector(words[0]) && words.length > 1) return words.slice(1);
  const first = words[0] ?? '';
  if (/^d['’]\p{L}/u.test(first)) return [first.slice(2), ...words.slice(1)];
  return words;
}

/**
 * Splits off the note after the first comma that isn't a decimal comma.
 * @param {string} text
 * @returns {[string, string]}
 */
function splitNote(text) {
  const comma = text.search(FIRST_COMMA);
  if (comma < 0) return [text.trim(), ''];
  return [text.slice(0, comma).trim(), text.slice(comma + 1).trim()];
}

/** @param {string} line */
function clean(line) {
  return squash(line).replace(BULLETS, '').replace(/(\S)\(/gu, '$1 (').trim();
}

/** @param {string} text */
function squash(text) {
  return text.replace(/\s+/gu, ' ').trim();
}

/** @param {string} text */
function normalizePhrase(text) {
  return text.split(' ').filter(Boolean).map(normalizeWord).join(' ');
}

/** @type {Record<DoubtCode, (detail: string) => string>} */
const MESSAGES = {
  'unknown-unit': (unit) => `New unit “${unit}”. It’s kept as written, so check it’s right.`,
  'assumed-quantity': () => 'No amount was given, so it reads as 1.',
  'unclear-quantity': () => 'The amount is unclear. Check it, or write it as quantity | unit | name.',
  'no-name': () => 'There’s no ingredient name.',
  'unclear-override': () => 'Write exactly three parts: quantity | unit | name.',
};

/**
 * @param {DoubtCode} code
 * @param {string} [detail]
 * @returns {Doubt}
 */
function doubt(code, detail = '') {
  return { code, message: MESSAGES[code](detail) };
}

// Writing helpers

/**
 * @param {Amount} amount
 * @param {Lang} lang
 */
function amountText(amount, lang) {
  return [formatQuantity(amount.quantity, lang), unitText(amount, lang)].filter(Boolean).join(' ');
}

/**
 * @param {Ingredient} ingredient
 * @param {Lang} lang
 */
function equivalentsText(ingredient, lang) {
  return ingredient.alternatives.length > 0
    ? `(${ingredient.alternatives.map((alternative) => amountText(alternative, lang)).join('; ')})`
    : '';
}

/**
 * @param {Ingredient} ingredient
 * @param {Lang} lang
 */
function naturalLine(ingredient, lang) {
  const unit = unitText(ingredient, lang);
  const connector = !unit || !ingredient.name ? '' : lang === 'pt' ? 'de' : isKnownUnit(ingredient.unit) ? '' : 'of';
  const line = [amountText(ingredient, lang), equivalentsText(ingredient, lang), connector, ingredient.name].filter(Boolean).join(' ');
  return ingredient.note ? `${line}, ${ingredient.note}` : line;
}

/**
 * @param {Ingredient} ingredient
 * @param {Lang} lang
 */
function explicitLine(ingredient, lang) {
  const name = [ingredient.name, equivalentsText(ingredient, lang)].filter(Boolean).join(' ');
  const line = [formatQuantity(ingredient.quantity, lang), unitText(ingredient, lang), name].join(' | ');
  return ingredient.note ? `${line}, ${ingredient.note}` : line;
}
