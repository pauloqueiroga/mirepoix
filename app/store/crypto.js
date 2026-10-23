// End-to-end encryption (R2.1, D7). Everything is sealed on the device before
// it travels, with AES-256-GCM and a key derived from the passphrase by
// PBKDF2-SHA-256. Only the browser's Web Crypto API is used.
//
// vault.json holds what every device needs to derive the same key from the
// same passphrase (the salt and the iteration count) and a sealed check
// value, so a wrong passphrase is caught before anything downloads. None of
// it is secret. Each sealed file names what it holds ("recipe:<id>") as
// authenticated data, so a file that was edited, or renamed to stand in for
// another, fails to open and is reported as tampered.
import { fromBase64, toBase64 } from './base64.js';

/**
 * Why a vault or a sealed file can't be opened; the screens put it into words.
 * @typedef {'not-a-vault' | 'too-new' | 'wrong-passphrase' | 'tampered'} CryptoProblem
 */
/** @typedef {{ format: 'mirepoix-sealed', version: 1, iv: string, data: string }} Sealed */
/**
 * @typedef {{
 *   format: 'mirepoix-vault',
 *   version: 1,
 *   kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: number, salt: string },
 *   check: Sealed,
 * }} Vault
 */

/**
 * Whether this page can encrypt at all. Browsers only offer Web Crypto on
 * secure pages: an https:// address, or localhost on the same computer.
 * @param {{ crypto?: { subtle?: unknown } }} [scope]
 */
export function canEncrypt(scope = globalThis) {
  return Boolean(scope.crypto?.subtle);
}

/** PBKDF2 iterations for a new vault (D7). Stored in the vault, so it can be raised later. */
export const ITERATIONS = 600_000;
// A vault asking for more than this is refused rather than left to hang the device.
const MOST_ITERATIONS = 20_000_000;
const VAULT = 'mirepoix-vault';
const SEALED = 'mirepoix-sealed';
const VERSION = 1;
const CHECK = { context: 'vault-check', text: 'Mirepoix' };

export class CryptoError extends Error {
  /** @param {CryptoProblem} code */
  constructor(code) {
    super(`Can't open: ${code}`);
    this.name = 'CryptoError';
    /** @type {CryptoProblem} */
    this.code = code;
  }
}

/**
 * A new vault for a passphrase, with a fresh random salt.
 * @param {string} passphrase
 * @param {{ iterations?: number }} [options] fewer iterations only in tests
 * @returns {Promise<{ vault: Vault, text: string, key: CryptoKey }>} text: vault.json's contents
 */
export async function createVault(passphrase, { iterations = ITERATIONS } = {}) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt, iterations);
  /** @type {Vault} */
  const vault = {
    format: VAULT,
    version: VERSION,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    check: await sealed(key, CHECK.context, CHECK.text),
  };
  return { vault, text: `${JSON.stringify(vault, null, 2)}\n`, key };
}

/**
 * Reads vault.json.
 * @param {string} text
 * @returns {Vault} throws a CryptoError: not-a-vault, or too-new
 */
export function readVault(text) {
  const data = parse(text, 'not-a-vault');
  if (!isRecord(data) || data.format !== VAULT) throw new CryptoError('not-a-vault');
  if (data.version !== VERSION) throw new CryptoError(typeof data.version === 'number' && data.version > VERSION ? 'too-new' : 'not-a-vault');
  const { kdf, check } = data;
  if (!isRecord(kdf) || kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256') throw new CryptoError('not-a-vault');
  const { iterations, salt } = kdf;
  if (typeof iterations !== 'number' || !Number.isInteger(iterations) || iterations < 1 || iterations > MOST_ITERATIONS) {
    throw new CryptoError('not-a-vault');
  }
  if (typeof salt !== 'string' || bytesOf(salt, 'not-a-vault').length < 8) throw new CryptoError('not-a-vault');
  if (!isSealed(check)) throw new CryptoError('not-a-vault');
  return { format: VAULT, version: VERSION, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt }, check };
}

/**
 * The key a passphrase gives for a vault. It can encrypt and decrypt, and
 * can never be read back out, so it can be kept on the device (D7).
 * @param {Vault} vault from readVault
 * @param {string} passphrase
 * @returns {Promise<CryptoKey>} throws a CryptoError: wrong-passphrase
 */
export async function openVault(vault, passphrase) {
  const key = await deriveKey(passphrase, fromBase64(vault.kdf.salt), vault.kdf.iterations);
  if (!(await keyOpens(vault, key))) throw new CryptoError('wrong-passphrase');
  return key;
}

/**
 * Whether a key kept on this device still opens a vault, which may have been
 * written again since (R2.5).
 * @param {Vault} vault
 * @param {CryptoKey} key
 */
export async function keyOpens(vault, key) {
  try {
    return new TextDecoder().decode(await open(key, CHECK.context, vault.check)) === CHECK.text;
  } catch {
    return false;
  }
}

/**
 * Seals a value: its JSON, encrypted, as the text of a file. Every call uses
 * a fresh random IV, so sealing the same value twice gives different files.
 * @param {CryptoKey} key
 * @param {string} context what the file holds, e.g. "recipe:<id>"; opening must name the same
 * @param {unknown} value anything JSON can hold
 * @returns {Promise<string>}
 */
export async function seal(key, context, value) {
  return `${JSON.stringify(await sealed(key, context, JSON.stringify(value)))}\n`;
}

/**
 * Opens a sealed file.
 * @param {CryptoKey} key
 * @param {string} context what the file should hold
 * @param {string} text
 * @returns {Promise<unknown>} the value; throws a CryptoError: tampered, or too-new
 */
export async function unseal(key, context, text) {
  const data = parse(text, 'tampered');
  if (isRecord(data) && data.format === SEALED && typeof data.version === 'number' && data.version > VERSION) {
    throw new CryptoError('too-new');
  }
  if (!isSealed(data)) throw new CryptoError('tampered');
  let plain;
  try {
    plain = new TextDecoder('utf-8', { fatal: true }).decode(await open(key, context, data));
  } catch {
    throw new CryptoError('tampered');
  }
  return parse(plain, 'tampered');
}

/**
 * @param {string} passphrase
 * @param {Uint8Array<ArrayBuffer>} salt
 * @param {number} iterations
 */
async function deriveKey(passphrase, salt, iterations) {
  // The same passphrase typed on different keyboards can arrive as different
  // code points ("ã" as one, or as "a" plus a tilde); NFC makes them one.
  const secret = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    secret,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * @param {CryptoKey} key
 * @param {string} context
 * @param {string} text
 * @returns {Promise<Sealed>}
 */
async function sealed(key, context, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(context) },
    key,
    new TextEncoder().encode(text),
  );
  return { format: SEALED, version: VERSION, iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}

/**
 * @param {CryptoKey} key
 * @param {string} context
 * @param {Sealed} envelope
 * @returns {Promise<ArrayBuffer>} rejects when the key, the context or the bytes don't match
 */
function open(key, context, envelope) {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.iv), additionalData: new TextEncoder().encode(context) },
    key,
    fromBase64(envelope.data),
  );
}

/**
 * @param {unknown} value
 * @returns {value is Sealed}
 */
function isSealed(value) {
  if (!isRecord(value) || value.format !== SEALED || value.version !== VERSION) return false;
  const { iv, data } = value;
  if (typeof iv !== 'string' || typeof data !== 'string') return false;
  try {
    return fromBase64(iv).length === 12 && fromBase64(data).length >= 16;
  } catch {
    return false;
  }
}

/**
 * @param {string} text
 * @param {CryptoProblem} problem thrown when text isn't JSON
 * @returns {unknown}
 */
function parse(text, problem) {
  try {
    return JSON.parse(text);
  } catch {
    throw new CryptoError(problem);
  }
}

/**
 * @param {string} base64
 * @param {CryptoProblem} problem thrown when it isn't base64
 */
function bytesOf(base64, problem) {
  try {
    return fromBase64(base64);
  } catch {
    throw new CryptoError(problem);
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
