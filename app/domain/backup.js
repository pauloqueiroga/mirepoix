// Export and import (R1.11): every recipe in one versioned JSON file, and
// back. Importing merges by id, so it also combines two devices' recipes, and
// it's how recipes move to a new web address (each address has its own storage).
import { mergeCooksNotes } from './cooks-notes.js';
import { recipeProblems } from './recipe.js';

/** @typedef {import('./recipe.js').Recipe} Recipe */
/** @typedef {{ put: Recipe[], added: number, updated: number, unchanged: number }} Plan */
/** @typedef {'not-an-export' | 'too-new' | 'no-recipes'} ExportError  why a file can't be imported; the screens word it */

export const FORMAT = 'mirepoix-recipes';
export const VERSION = 1;

/**
 * The export file for some recipes, named after the day it was made.
 * @param {Recipe[]} recipes
 * @param {Date} [now]
 * @returns {{ name: string, text: string }}
 */
export function exportFile(recipes, now = new Date()) {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
  return {
    name: `mirepoix-recipes-${day}.json`,
    text: `${JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: now.toISOString(), recipes }, null, 2)}\n`,
  };
}

/**
 * Reads an export file. Recipes that aren't valid are skipped and counted,
 * never stored.
 * @param {string} text
 * @returns {{ recipes: Recipe[], skipped: number } | { error: ExportError }}
 */
export function readExport(text) {
  /** @type {unknown} */
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'not-an-export' };
  }
  if (typeof data !== 'object' || data === null || !('format' in data) || data.format !== FORMAT) {
    return { error: 'not-an-export' };
  }
  if (!('version' in data) || data.version !== VERSION) return { error: 'too-new' };
  if (!('recipes' in data) || !Array.isArray(data.recipes)) return { error: 'no-recipes' };
  /** @type {Recipe[]} */
  const recipes = data.recipes.filter((recipe) => recipeProblems(recipe).length === 0);
  return { recipes, skipped: data.recipes.length - recipes.length };
}

/**
 * What importing does: recipes not here yet are added, and a recipe already
 * here takes the text of whichever copy was edited last. Cook's notes from
 * both copies are kept (R3.3, D16). Nothing is ever removed.
 * @param {Recipe[]} existing
 * @param {Recipe[]} incoming
 * @returns {Plan}
 */
export function mergePlan(existing, incoming) {
  const here = new Map(existing.map((recipe) => [recipe.id, recipe]));
  /** @type {Plan} */
  const plan = { put: [], added: 0, updated: 0, unchanged: 0 };
  for (const recipe of incoming) {
    const current = here.get(recipe.id);
    let merged = recipe;
    if (!current) plan.added += 1;
    else {
      const newer = Date.parse(recipe.updatedAt) > Date.parse(current.updatedAt);
      const cooksNotes = mergeCooksNotes(current.cooksNotes, recipe.cooksNotes);
      if (!newer && cooksNotes.length === current.cooksNotes.length) {
        plan.unchanged += 1;
        continue;
      }
      merged = { ...(newer ? recipe : current), cooksNotes };
      plan.updated += 1;
    }
    here.set(merged.id, merged);
    plan.put.push(merged);
  }
  return plan;
}
