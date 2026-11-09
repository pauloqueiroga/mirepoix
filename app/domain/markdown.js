// Recipes as Markdown: plain text that reads well anywhere, in a text editor,
// a notes app or an email, and renders nicely where Markdown does. A copy for
// people to read, not for Mirepoix to import (the JSON export is that), but
// each section pastes back into the editor's boxes as it is: ingredient lines
// are written the way the editor writes them, so they read back the same.
import { renderIngredient } from './ingredients.js';
import { byTitle } from './recipe.js';
import { tagsOf } from './tags.js';

/** @typedef {import('./recipe.js').Recipe} Recipe */
/** @typedef {import('./recipe.js').Lang} Lang */
/**
 * Mirepoix's own words in a file, in the recipe's language, so each recipe
 * reads as one piece wherever it goes.
 * @typedef {{
 *   makes: (amount: string) => string,
 *   tags: string,
 *   ingredients: string,
 *   preparation: string,
 *   variations: string,
 *   notes: string,
 *   cooksNotes: string,
 *   day: (at: string) => string,
 * }} Words
 */

/**
 * One recipe as Markdown.
 * @param {Recipe} recipe
 * @param {Words} words
 */
export function recipeMarkdown(recipe, words) {
  const { lang } = recipe;
  const meta = [recipe.source, recipe.yield && words.makes(recipe.yield)].filter(Boolean).join(' · ');
  const tags = tagsOf(recipe);
  /** @type {string[]} */
  const blocks = [`# ${oneLine(recipe.title)}`];
  if (meta || tags.length > 0) {
    blocks.push([meta && oneLine(meta), tags.length > 0 && `${words.tags}: ${tags.join(', ')}`].filter(Boolean).join('  \n'));
  }

  const ingredients = recipe.ingredients.filter((group) => group.heading || group.items.length > 0);
  if (ingredients.length > 0) {
    blocks.push(`## ${words.ingredients}`);
    for (const group of ingredients) {
      // "For the sauce:", the way the editor starts a group.
      if (group.heading) blocks.push(`${oneLine(group.heading)}:`);
      if (group.items.length > 0) blocks.push(group.items.map((item) => `- ${renderIngredient(item, lang)}`).join('\n'));
    }
  }

  const preparation = recipe.preparation.filter((group) => group.heading || group.steps.length > 0);
  if (preparation.length > 0) {
    blocks.push(`## ${words.preparation}`);
    // Numbered straight through the groups, as the recipe shows them.
    let number = 0;
    for (const group of preparation) {
      if (group.heading) blocks.push(`${oneLine(group.heading)}:`);
      if (group.steps.length > 0) blocks.push(group.steps.map((step) => `${(number += 1)}. ${item(step, 3 + String(number).length)}`).join('\n'));
    }
  }

  if (recipe.variations.length > 0) {
    blocks.push(`## ${words.variations}`, recipe.variations.map((variation) => `- ${item(variation, 2)}`).join('\n'));
  }
  if (recipe.notes.length > 0) blocks.push(`## ${words.notes}`, ...recipe.notes);
  if (recipe.cooksNotes.length > 0) {
    const notes = [...recipe.cooksNotes].sort((a, b) => a.at.localeCompare(b.at));
    blocks.push(`## ${words.cooksNotes}`, notes.map((note) => `- ${words.day(note.at)}: ${item(note.text, 2)}`).join('\n'));
  }
  return `${blocks.join('\n\n')}\n`;
}

/**
 * The Markdown file for one recipe, named after it: "pao-de-queijo.md".
 * @param {Recipe} recipe
 * @param {Words} words
 * @returns {{ name: string, text: string }}
 */
export function recipeFile(recipe, words) {
  return { name: `${slug(recipe.title)}.md`, text: recipeMarkdown(recipe, words) };
}

/**
 * Every recipe in one Markdown file, by title, a line between each, named
 * after the day it was made.
 * @param {Recipe[]} recipes
 * @param {(lang: Lang) => Words} wordsFor the words in each recipe's language
 * @param {Date} [now]
 * @returns {{ name: string, text: string }}
 */
export function recipesFile(recipes, wordsFor, now = new Date()) {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
  const text = [...recipes].sort(byTitle).map((recipe) => recipeMarkdown(recipe, wordsFor(recipe.lang))).join('\n---\n\n');
  return { name: `mirepoix-recipes-${day}.md`, text };
}

/**
 * A file name from a title: lowercase, no accents, words joined by hyphens.
 * @param {string} title
 */
export function slug(title) {
  const words = title.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/gu, '');
  return words.slice(0, 60).replace(/-+$/u, '') || 'recipe';
}

/**
 * Text kept to one line, for headings.
 * @param {string} text
 */
function oneLine(text) {
  return text.replace(/\s+/gu, ' ').trim();
}

/**
 * A list item's text, its later lines indented to stay in the item.
 * @param {string} text
 * @param {number} indent the width of the item's marker
 */
function item(text, indent) {
  return text.trim().split(/\r?\n/u).join(`\n${' '.repeat(indent)}`);
}
