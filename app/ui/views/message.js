import { brand, h } from '../dom.js';

/**
 * A full-page message, such as "Page not found".
 * @param {{ title: string, text: string, back?: boolean }} message
 */
export function messageView({ title, text, back = false }) {
  return [
    h('header', { class: 'bar' },
      back
        ? h('a', { class: 'back', href: '#/' }, 'Recipes')
        : h('span', { class: 'wordmark' }, brand())),
    h('main', { class: 'page' },
      h('div', { class: 'empty' },
        h('h1', null, title),
        h('p', null, text))),
  ];
}
