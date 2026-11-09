// Timers from steps: the times in a step's text ("bake 10–12 minutes", "deixe
// descansar por 1 hora e meia"), and the countdown of a timer set from one.
// Times are read with the same reader as amounts, so "1½", "dez", "meia" and
// ranges work in both languages. Nothing here touches a clock: the screens
// pass the time in, so tests can too.
import { quantityValue, readQuantity } from './quantity.js';
import { normalizeWord } from './units.js';

/** @typedef {import('./recipe.js').Lang} Lang */
/**
 * A time found in a step.
 * @typedef {{ start: number, end: number, text: string, seconds: number, upTo: number }} Duration
 *   start, end: where it is in the step's text; text: as written there;
 *   seconds: how long, the short end of a range; upTo: the long end
 */
/**
 * A timer's countdown. Ready and paused hold the seconds left; running holds
 * when it ends, so it keeps time even while the page sleeps.
 * @typedef {{ state: 'ready' | 'paused', left: number } | { state: 'running', endsAt: number } | { state: 'done', endedAt: number }} Countdown
 */

const HOUR = 3600;
const MINUTE = 60;
/** @type {Record<string, number>} */
const UNITS = {
  h: HOUR, hr: HOUR, hrs: HOUR, hour: HOUR, hours: HOUR, hora: HOUR, horas: HOUR,
  min: MINUTE, mins: MINUTE, minute: MINUTE, minutes: MINUTE, minuto: MINUTE, minutos: MINUTE,
  sec: 1, secs: 1, second: 1, seconds: 1, seg: 1, segundo: 1, segundos: 1,
};
const DIGITS = '0-9½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞';
/** Digits and letters apart ("10min", "1h30"), punctuation around them dropped. */
const PIECE = new RegExp(`[${DIGITS}](?:[${DIGITS}.,/⁄–-]*[${DIGITS}])?|[^${DIGITS}\\s]+`, 'gu');
const PUNCTUATION = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;
/** The most words a number can take: "vinte e cinco", "1 and a half". */
const LONGEST_NUMBER = 5;

/**
 * Every time in a step's text, in order.
 * @param {string} text
 * @param {Lang} lang the recipe's, for decimals
 * @returns {Duration[]}
 */
export function findDurations(text, lang) {
  const pieces = splitPieces(text);
  /** @type {Duration[]} */
  const found = [];
  let i = 0;
  while (i < pieces.length) {
    const time = readTime(pieces, i, lang);
    if (!time) {
      i += 1;
      continue;
    }
    const first = /** @type {Piece} */ (pieces[i]);
    const last = /** @type {Piece} */ (pieces[time.next - 1]);
    found.push({ start: first.start, end: last.end, text: text.slice(first.start, last.end), seconds: time.seconds, upTo: time.upTo });
    i = time.next;
  }
  return found;
}

/** @typedef {{ word: string, start: number, end: number }} Piece */

/**
 * The text as words and numbers, with where each one is.
 * @param {string} text
 * @returns {Piece[]}
 */
function splitPieces(text) {
  /** @type {Piece[]} */
  const pieces = [];
  for (const match of text.matchAll(PIECE)) {
    const raw = match[0];
    const word = raw.replace(PUNCTUATION, '');
    if (!word) continue;
    const start = match.index + raw.indexOf(word);
    pieces.push({ word, start, end: start + word.length });
  }
  return pieces;
}

/**
 * A time starting at piece i: a number or range, its unit, and maybe more
 * ("1 hour 15 minutes", "1h30", "1 hora e meia").
 * @param {Piece[]} pieces
 * @param {number} i
 * @param {Lang} lang
 * @returns {{ seconds: number, upTo: number, next: number } | null}
 */
function readTime(pieces, i, lang) {
  const amount = readNumber(pieces, i, lang);
  if (!amount) return null;
  // "5 more minutes"
  const more = normalizeWord(pieces[amount.next]?.word ?? '') === 'more' ? 1 : 0;
  const unitWord = pieces[amount.next + more]?.word ?? '';
  const unit = UNITS[normalizeWord(unitWord)];
  if (!unit) return null;
  let seconds = amount.low * unit;
  let upTo = amount.high * unit;
  let next = amount.next + more + 1;

  const after = (/** @type {number} */ k) => normalizeWord(pieces[next + k]?.word ?? '');
  if (after(0) === 'e' && (after(1) === 'meia' || after(1) === 'meio')) {
    // "1 hora e meia"
    seconds += unit / 2;
    upTo += unit / 2;
    next += 2;
  } else if (after(0) === 'and' && after(1) === 'a' && after(2) === 'half') {
    // "1 hour and a half"
    seconds += unit / 2;
    upTo += unit / 2;
    next += 3;
  } else if (unit > 1 && amount.low === amount.high) {
    // "1 hour 15 minutes", "1 hora e 15 minutos", "1h30"
    const skip = ['and', 'e'].includes(after(0)) ? 1 : 0;
    const part = readNumber(pieces, next + skip, lang);
    const partUnit = part && UNITS[normalizeWord(pieces[part.next]?.word ?? '')];
    if (part && part.low === part.high && partUnit && partUnit < unit) {
      seconds += part.low * partUnit;
      upTo += part.low * partUnit;
      next = part.next + 1;
    } else if (part && !partUnit && unitWord === 'h' && skip === 0 && Number.isInteger(part.low) && part.low < 60) {
      seconds += part.low * MINUTE;
      upTo += part.low * MINUTE;
      next = part.next;
    }
  }
  return { seconds: Math.round(seconds), upTo: Math.round(upTo), next };
}

/**
 * A number or range at piece i, as long as it can be: "10-12", "10 to 12",
 * "1 1/2", "dois ou três", "half an", "an" (as in "an hour").
 * @param {Piece[]} pieces
 * @param {number} i
 * @param {Lang} lang
 * @returns {{ low: number, high: number, next: number } | null}
 */
function readNumber(pieces, i, lang) {
  for (let length = Math.min(LONGEST_NUMBER, pieces.length - i); length >= 1; length--) {
    const words = pieces.slice(i, i + length).map((piece) => piece.word);
    if (length === 1 && ['a', 'an'].includes(normalizeWord(words[0] ?? ''))) return { low: 1, high: 1, next: i + 1 };
    const read = readQuantity(words.join(' '), lang);
    if (!read || read.rest) continue;
    const [low = '', high = low] = read.quantity.split('-');
    return { low: quantityValue(low), high: quantityValue(high), next: i + length };
  }
  return null;
}

// Countdowns

/**
 * A timer set to some seconds, not started.
 * @param {number} seconds
 * @returns {Countdown}
 */
export function countdown(seconds) {
  return { state: 'ready', left: Math.max(0, Math.round(seconds)) };
}

/**
 * Whole seconds left, rounded up, so a timer shows 0:00 only when it's done.
 * @param {Countdown} timer
 * @param {number} now in milliseconds
 */
export function secondsLeft(timer, now) {
  if (timer.state === 'running') return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
  return timer.state === 'done' ? 0 : timer.left;
}

/**
 * Starts or resumes a timer. One with no time left is done straight away.
 * @param {Countdown} timer
 * @param {number} now
 * @returns {Countdown}
 */
export function start(timer, now) {
  if (timer.state !== 'ready' && timer.state !== 'paused') return timer;
  return timer.left > 0 ? { state: 'running', endsAt: now + timer.left * 1000 } : { state: 'done', endedAt: now };
}

/**
 * @param {Countdown} timer
 * @param {number} now
 * @returns {Countdown}
 */
export function pause(timer, now) {
  return timer.state === 'running' ? { state: 'paused', left: secondsLeft(timer, now) } : timer;
}

/**
 * More time, or less (seconds below 0), before or while it runs. Less than
 * none left ends a running timer; more time on a done one starts it again.
 * @param {Countdown} timer
 * @param {number} seconds
 * @param {number} now
 * @returns {Countdown}
 */
export function addTime(timer, seconds, now) {
  if (timer.state === 'ready' || timer.state === 'paused') return { state: timer.state, left: Math.max(0, timer.left + seconds) };
  if (timer.state === 'running') return tick({ state: 'running', endsAt: timer.endsAt + seconds * 1000 }, now);
  return seconds > 0 ? { state: 'running', endsAt: now + seconds * 1000 } : timer;
}

/**
 * The timer as it is now: a running one whose time is up is done.
 * @param {Countdown} timer
 * @param {number} now
 * @returns {Countdown}
 */
export function tick(timer, now) {
  return timer.state === 'running' && now >= timer.endsAt ? { state: 'done', endedAt: timer.endsAt } : timer;
}

/**
 * Seconds as a clock: "9:05", "1:02:03", "0:45".
 * @param {number} seconds
 */
export function clock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const hours = Math.floor(s / HOUR);
  const minutes = Math.floor((s % HOUR) / MINUTE);
  const rest = String(s % MINUTE).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
