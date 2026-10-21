// Export and import (R1.11): every recipe in one versioned JSON file, and
// back. Importing merges by id, so it also combines two devices' recipes, and
// it's how recipes move to a new web address (each address has its own storage).
import { recipeProblems } from './recipe.js';

/** @typedef {import('./recipe.js').Recipe} Recipe */
/** @typedef {{ put: Recipe[], added: number, updated: number, unchanged: number }} Plan */

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
 * @returns {{ recipes: Recipe[], skipped: number } | { error: string }}
 */
export function readExport(text) {
  /** @type {unknown} */
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'That file isn’t a Mirepoix export.' };
  }
  if (typeof data !== 'object' || data === null || !('format' in data) || data.format !== FORMAT) {
    return { error: 'That file isn’t a Mirepoix export.' };
  }
  if (!('version' in data) || data.version !== VERSION) {
    return { error: 'That export comes from a newer Mirepoix. Update this one, then try again.' };
  }
  if (!('recipes' in data) || !Array.isArray(data.recipes)) return { error: 'That export has no recipes in it.' };
  /** @type {Recipe[]} */
  const recipes = data.recipes.filter((recipe) => recipeProblems(recipe).length === 0);
  return { recipes, skipped: data.recipes.length - recipes.length };
}

/**
 * What importing does: recipes not here yet are added, and a recipe already
 * here is replaced only by a newer version of itself. Nothing is ever removed.
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
    if (!current) plan.added += 1;
    else if (Date.parse(recipe.updatedAt) > Date.parse(current.updatedAt)) plan.updated += 1;
    else {
      plan.unchanged += 1;
      continue;
    }
    here.set(recipe.id, recipe);
    plan.put.push(recipe);
  }
  return plan;
}

/**
 * "Added 3 recipes and updated 1. 2 were already here." and so on.
 * @param {{ added: number, updated: number, unchanged: number, skipped: number }} result
 */
export function describeImport({ added, updated, unchanged, skipped }) {
  const recipes = (/** @type {number} */ n) => `${n} ${n === 1 ? 'recipe' : 'recipes'}`;
  const changes = [added > 0 && `added ${recipes(added)}`, updated > 0 && `updated ${updated}`].filter(Boolean).join(' and ');
  const sentences = [
    changes ? `${changes[0]?.toUpperCase()}${changes.slice(1)}.` : 'Nothing new to add.',
    unchanged > 0 && `${unchanged === 1 ? '1 was' : `${unchanged} were`} already here.`,
    skipped > 0 && `${skipped === 1 ? '1 couldn’t' : `${skipped} couldn’t`} be read and ${skipped === 1 ? 'was' : 'were'} skipped.`,
  ];
  return sentences.filter(Boolean).join(' ');
}
