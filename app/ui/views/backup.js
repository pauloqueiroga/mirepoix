import { exportFile, mergePlan, readExport } from '../../domain/backup.js';
import { footer, h } from '../dom.js';
import { t } from '../i18n.js';

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
    status.textContent = t.saved(name);
  };

  const file = h('input', { id: 'import-file', type: 'file', accept: '.json,application/json', class: 'visually-hidden' });
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    const read = readExport(await chosen.text());
    file.value = '';
    if ('error' in read) {
      status.textContent = t.exportErrors[read.error];
      return;
    }
    const plan = mergePlan(await list(), read.recipes);
    for (const recipe of plan.put) await put(recipe);
    status.replaceChildren(t.imported({ ...plan, skipped: read.skipped }), ' ', h('a', { href: '#/' }, t.seeRecipes));
  });

  return [
    h('header', { class: 'bar' },
      h('a', { class: 'back', href: '#/' }, t.recipes)),
    h('main', { class: 'page backup' },
      h('h1', { class: 'recipe-title' }, t.keepACopy),
      h('p', { class: 'lead' }, t.keepACopyLead),
      h('section', { class: 'recipe-section', 'aria-labelledby': 'export-heading' },
        h('h2', { id: 'export-heading', class: 'section-label' }, t.export),
        h('p', null, count > 0 ? t.exportCount(count) : t.nothingToExport),
        count > 0 && h('button', { type: 'button', class: 'button primary', onclick: exportAll }, t.exportAll)),
      h('section', { class: 'recipe-section', 'aria-labelledby': 'import-heading' },
        h('h2', { id: 'import-heading', class: 'section-label' }, t.import),
        h('p', null, t.importText),
        file,
        h('label', { for: 'import-file', class: 'button secondary' }, t.importFromFile)),
      status,
      footer()),
  ];
}
