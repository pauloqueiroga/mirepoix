import { describeImport, exportFile, mergePlan, readExport } from '../../domain/backup.js';
import { h } from '../dom.js';

/** @typedef {import('../../domain/recipe.js').Recipe} Recipe */

/**
 * Keep a copy (R1.11): save every recipe to a file, or bring recipes in from
 * one. Until syncing arrives (R2), this is the safety net and the way recipes
 * move between devices or to a new web address.
 * @param {{ count: number, list: () => Promise<Recipe[]>, put: (recipe: Recipe) => Promise<void> }} options
 */
export function backupView({ count, list, put }) {
  const status = h('p', { class: 'status', role: 'status' });

  const exportAll = async () => {
    const { name, text } = exportFile(await list());
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = h('a', { href: url, download: name, hidden: true });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `Saved ${name}. Keep it somewhere safe, like your cloud drive or your email.`;
  };

  const file = h('input', { id: 'import-file', type: 'file', accept: '.json,application/json', class: 'visually-hidden' });
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    const read = readExport(await chosen.text());
    file.value = '';
    if ('error' in read) {
      status.textContent = read.error;
      return;
    }
    const plan = mergePlan(await list(), read.recipes);
    for (const recipe of plan.put) await put(recipe);
    status.replaceChildren(describeImport({ ...plan, skipped: read.skipped }), ' ', h('a', { href: '#/' }, 'See your recipes'));
  });

  return [
    h('header', { class: 'bar' },
      h('a', { class: 'back', href: '#/' }, 'Recipes')),
    h('main', { class: 'page backup' },
      h('h1', { class: 'recipe-title' }, 'Keep a copy'),
      h('p', { class: 'lead' },
        'Your recipes live in this browser, on this device. Until syncing arrives, export them now and then and keep the file somewhere safe. If this browser’s data is ever cleared, the file brings them back.'),
      h('section', { class: 'recipe-section', 'aria-labelledby': 'export-heading' },
        h('h2', { id: 'export-heading', class: 'section-label' }, 'Export'),
        count > 0
          ? h('p', null, `Saves all ${count} ${count === 1 ? 'recipe' : 'recipes'} in one file.`)
          : h('p', null, 'Nothing to export yet.'),
        count > 0 && h('button', { type: 'button', class: 'button primary', onclick: exportAll }, 'Export all recipes')),
      h('section', { class: 'recipe-section', 'aria-labelledby': 'import-heading' },
        h('h2', { id: 'import-heading', class: 'section-label' }, 'Import'),
        h('p', null,
          'Adds the recipes from an export file, made on this device or another one. Nothing here is removed, and a recipe already here is only replaced by a newer version of itself. Moving Mirepoix to a new address? Export there, import here.'),
        file,
        h('label', { for: 'import-file', class: 'button secondary' }, 'Import from a file')),
      status),
  ];
}
