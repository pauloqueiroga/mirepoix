// Tiny DOM builder. Text always goes in as text, never parsed as HTML, so
// recipe content can't inject markup.
import { messages, pickLang, t, uiLang } from './i18n.js';

/** @typedef {Node | string | null | undefined | false} Child */

/**
 * Creates an element with attributes, event listeners and children.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, string | boolean | ((event: Event) => void)> | null} [attributes]
 *   names starting with "on" (onclick, oninput, …) take a listener
 * @param {...Child} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, attributes, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes ?? {})) {
    if (typeof value === 'function') element.addEventListener(name.slice(2), value);
    else if (value === true) element.setAttribute(name, '');
    else if (value !== false) element.setAttribute(name, value);
  }
  for (const child of children) {
    if (child || child === '') element.append(child);
  }
  return element;
}

/**
 * The small print at the bottom of a screen: the privacy page, and the other
 * language, named in itself (R1.17).
 */
export function footer() {
  const other = uiLang === 'pt' ? 'en' : 'pt';
  return h('footer', { class: 'app-footer' },
    h('a', { href: t.privacyPage }, t.privacy),
    h('button', { type: 'button', class: 'link', lang: other, onclick: () => pickLang(other) }, messages[other].langName));
}

/**
 * The mark alone, as decoration.
 */
export function logo() {
  return h('img', { class: 'logo', src: 'icons/icon.svg', alt: '', width: '72', height: '72' });
}

/**
 * The mark with the name "mirepoix" lettered beside it, in the version for
 * the current light or dark theme. The lettering is part of the image (D13).
 */
export function brand() {
  return h('picture', { class: 'brand' },
    h('source', { media: '(prefers-color-scheme: dark)', srcset: 'icons/logo-horizontal-dark.svg' }),
    h('img', { src: 'icons/logo-horizontal.svg', alt: 'Mirepoix' }));
}
