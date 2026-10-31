// Base64 for bytes and for text, the way GitHub's API and the crypto
// envelope (R2.1) write them. btoa and atob work in every browser Mirepoix
// supports; they only speak in "binary strings", so these turn bytes into
// those and back.

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Line breaks are ignored, since GitHub wraps the base64 it sends.
 * @param {string} text
 * @returns {Uint8Array<ArrayBuffer>} throws when text isn't base64
 */
export function fromBase64(text) {
  const binary = atob(text.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** @param {string} text */
export function encodeText(text) {
  return toBase64(new TextEncoder().encode(text));
}

/**
 * @param {string} base64
 * @returns {string} throws when it isn't base64 of UTF-8 text
 */
export function decodeText(base64) {
  return new TextDecoder('utf-8', { fatal: true }).decode(fromBase64(base64));
}
