import { brand, h, logo } from '../dom.js';

/**
 * The home screen: every recipe on this device, in the order given.
 * @param {{ id: string, title: string, source: string }[]} recipes
 */
export function listView(recipes) {
  return [
    h('header', { class: 'bar' },
      h('h1', { class: 'wordmark' }, brand()),
      h('span', { class: 'chip warn', title: 'Recipes are saved in this browser, on this device.' },
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        'This device only')),
    h('main', { class: 'page' },
      recipes.length === 0
        ? h('div', { class: 'empty' },
          logo(),
          h('h2', null, 'No recipes yet'),
          h('p', null, 'Tap + to add your first one. Recipes are kept in this browser, on this device.'))
        : h('ul', { class: 'list', 'aria-label': 'Recipes' }, ...recipes.map(row))),
    h('a', { class: 'fab', href: '#/new', 'aria-label': 'New recipe', title: 'New recipe' }),
  ];
}

/** @param {{ id: string, title: string, source: string }} recipe */
function row({ id, title, source }) {
  return h('li', null,
    h('a', { href: `#/recipes/${encodeURIComponent(id)}` },
      h('div', { class: 'title' }, title),
      source && h('div', { class: 'source' }, source)));
}
