// What makes two copies of a recipe the same (R2.3): their content, field by
// field, whatever order the fields were written in. Syncing compares a
// recipe's fingerprint with the one it had when it last matched the remote
// copy, to tell whether it changed on this device since.

/**
 * A short text that changes whenever the value's content does.
 * @param {unknown} value plain data: objects, arrays, text, numbers, booleans
 * @returns {string}
 */
export function fingerprint(value) {
  const text = canonical(value);
  return `${hash(text, 0)}${hash(text, 0x9e3779b9)}`;
}

/**
 * JSON with every object's keys in order, so the same content always reads the same.
 * @param {unknown} value
 */
function canonical(value) {
  return JSON.stringify(value, (_, item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }) ?? '';
}

/**
 * cyrb53, a fast 53-bit string hash: not for secrets, only for noticing change.
 * @param {string} text
 * @param {number} seed
 */
function hash(text, seed) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
