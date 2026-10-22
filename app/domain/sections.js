// Preparation, Variations and Notes (R1.8): boxes of free text, split into
// steps or items the way people write them, and written back the same way.

/** @typedef {import('./recipe.js').StepGroup} StepGroup */
/** @typedef {{ kind: 'heading' | 'item', text: string }} Block */

const MARKER = /^(?:\d+[.)]|[-–—•*·▪◦‣⁃])\s+/u;
const HEADING_MAX_WORDS = 6;

/**
 * Splits text into blocks, whichever way it was written:
 * - numbered or bulleted ("1.", "2)", "-", "•"): each marker starts an item,
 *   and unmarked lines continue it (text pasted from a PDF keeps its wraps);
 * - with blank lines: each paragraph is an item, its lines joined;
 * - otherwise: every line is an item.
 * Markers are dropped; Mirepoix numbers steps itself.
 * @param {string} text
 * @param {{ headings: boolean }} options when true, a short line ending in ":" is a heading
 * @returns {Block[]}
 */
export function splitBlocks(text, { headings }) {
  const lines = text.split(/\r?\n/u).map((line) => line.replace(/\s+/gu, ' ').trim());
  const marked = lines.filter((line) => MARKER.test(line)).length >= 2;
  const first = lines.findIndex(Boolean);
  const last = lines.findLastIndex(Boolean);
  const paragraphs = !marked && lines.slice(first, last + 1).includes('');

  /** @type {Block[]} */
  const blocks = [];
  let continues = false;
  for (const line of lines) {
    if (!line) {
      continues = continues && marked;
      continue;
    }
    if (headings && isHeading(line)) {
      blocks.push({ kind: 'heading', text: line.slice(0, -1).trim() });
      continues = false;
      continue;
    }
    const previous = blocks.at(-1);
    const startsItem = marked ? MARKER.test(line) || !continues : !paragraphs || !continues;
    if (!startsItem && previous) previous.text += ` ${line}`;
    else blocks.push({ kind: 'item', text: line.replace(MARKER, '') });
    continues = true;
  }
  return blocks;
}

/**
 * Preparation: steps, grouped under headings like "Massa:".
 * @param {string} text
 * @returns {StepGroup[]}
 */
export function parseSteps(text) {
  /** @type {StepGroup[]} */
  const groups = [];
  /** @type {StepGroup} */
  let group = { heading: '', steps: [] };
  for (const block of splitBlocks(text, { headings: true })) {
    if (block.kind === 'heading') {
      if (group.heading || group.steps.length > 0) groups.push(group);
      group = { heading: block.text, steps: [] };
    } else {
      group.steps.push(block.text);
    }
  }
  if (group.heading || group.steps.length > 0) groups.push(group);
  return groups;
}

/**
 * Variations and Notes: a plain list of items.
 * @param {string} text
 * @returns {string[]}
 */
export function parseItems(text) {
  return splitBlocks(text, { headings: false }).map((block) => block.text);
}

/**
 * Writes steps back as text that reads back to the same groups.
 * @param {StepGroup[]} groups
 */
export function renderSteps(groups) {
  return groups
    .map((group) => [group.heading && `${group.heading}:`, ...group.steps].filter(Boolean).join('\n\n'))
    .join('\n\n');
}

/**
 * Writes items back as text that reads back to the same items.
 * @param {string[]} items
 */
export function renderItems(items) {
  return items.join('\n\n');
}

/** @param {string} line */
function isHeading(line) {
  return line.endsWith(':') && !MARKER.test(line) && line.split(' ').length <= HEADING_MAX_WORDS;
}
