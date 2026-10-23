import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeText, encodeText, fromBase64, toBase64 } from '../../app/store/base64.js';
import { CryptoError, ITERATIONS, createVault, openVault, readVault, seal, unseal } from '../../app/store/crypto.js';

// The crypto envelope (R2.1, D7). Vaults here use few iterations so the
// tests stay fast; one test checks the real default.

const FAST = { iterations: 1000 };
const recipe = { id: 'r1', title: 'Pão de queijo', ingredients: [{ heading: '', items: [] }] };

/**
 * @param {() => Promise<unknown> | unknown} action
 * @param {import('../../app/store/crypto.js').CryptoProblem} code
 */
async function failsWith(action, code) {
  await assert.rejects(async () => action(), (error) => error instanceof CryptoError && error.code === code);
}

test('base64 carries bytes and UTF-8 text both ways, ignoring line breaks', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 255]);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
  assert.equal(encodeText('Pão ½'), 'UMOjbyDCvQ==');
  assert.equal(decodeText('UMOjbyDC\nvQ==\n'), 'Pão ½');
  const big = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 7919) % 256);
  assert.deepEqual(fromBase64(toBase64(big)), big);
  assert.throws(() => decodeText('not base64!'));
});

test('a new vault opens with its passphrase, and the key opens what it sealed', async () => {
  const { vault, text, key } = await createVault('correct horse', FAST);
  assert.deepEqual(readVault(text), vault);
  const reopened = await openVault(readVault(text), 'correct horse');
  const file = await seal(key, 'recipe:r1', recipe);
  assert.deepEqual(await unseal(reopened, 'recipe:r1', file), recipe);
});

test('vault.json holds the salt, iterations and a check, and nothing secret', async () => {
  const { vault, text } = await createVault('correct horse', FAST);
  assert.equal(vault.format, 'mirepoix-vault');
  assert.equal(vault.version, 1);
  assert.deepEqual({ ...vault.kdf, salt: '…' }, { name: 'PBKDF2', hash: 'SHA-256', iterations: 1000, salt: '…' });
  assert.equal(fromBase64(vault.kdf.salt).length, 16);
  assert.doesNotMatch(text, /correct|horse/);
  const other = await createVault('correct horse', FAST);
  assert.notEqual(other.vault.kdf.salt, vault.kdf.salt, 'every vault gets its own salt');
});

test('new vaults use 600,000 PBKDF2 iterations (D7)', async () => {
  assert.equal(ITERATIONS, 600_000);
  const { vault } = await createVault('correct horse');
  assert.equal(vault.kdf.iterations, 600_000);
});

test('a wrong passphrase is caught by the vault, before anything else is opened', async () => {
  const { text } = await createVault('correct horse', FAST);
  await failsWith(() => openVault(readVault(text), 'correct hose'), 'wrong-passphrase');
  await failsWith(() => openVault(readVault(text), ''), 'wrong-passphrase');
});

test('the passphrase means the same however the keyboard spells its accents', async () => {
  const composed = 'pão de queijo';
  const decomposed = 'pão de queijo';
  const { vault } = await createVault(composed, FAST);
  await assert.doesNotReject(openVault(vault, decomposed));
});

test('the key stays on the device: it can never be read back out (D7)', async () => {
  const { key } = await createVault('correct horse', FAST);
  assert.equal(key.extractable, false);
  assert.deepEqual([...key.usages].sort(), ['decrypt', 'encrypt']);
  await assert.rejects(crypto.subtle.exportKey('raw', key));
});

test('a file that is not a vault is refused as such, and a newer vault as too new', async () => {
  const { vault } = await createVault('correct horse', FAST);
  const variant = (/** @type {Record<string, unknown>} */ change) => JSON.stringify({ ...vault, ...change });
  for (const text of [
    'not json',
    '[]',
    '{"format": "mirepoix-recipes"}',
    variant({ version: 0 }),
    variant({ kdf: { ...vault.kdf, name: 'scrypt' } }),
    variant({ kdf: { ...vault.kdf, iterations: 0 } }),
    variant({ kdf: { ...vault.kdf, iterations: 1.5 } }),
    variant({ kdf: { ...vault.kdf, iterations: 1e9 } }),
    variant({ kdf: { ...vault.kdf, salt: 'no!' } }),
    variant({ kdf: { ...vault.kdf, salt: 'c2FsdA==' } }),
    variant({ check: { ...vault.check, iv: 'AAAA' } }),
    variant({ check: 'yes' }),
  ]) {
    await failsWith(() => readVault(text), 'not-a-vault');
  }
  await failsWith(() => readVault(variant({ version: 2 })), 'too-new');
});

test('sealing the same thing twice gives different files, neither showing it', async () => {
  const { key } = await createVault('correct horse', FAST);
  const first = await seal(key, 'recipe:r1', recipe);
  const second = await seal(key, 'recipe:r1', recipe);
  assert.notEqual(first, second, 'a fresh IV for every write');
  assert.doesNotMatch(first, /queijo|Pão|P\\u00e3o/);
  assert.deepEqual(Object.keys(JSON.parse(first)), ['format', 'version', 'iv', 'data']);
});

test('a changed, renamed or foreign file is reported as tampered, not as a wrong passphrase', async () => {
  const { key } = await createVault('correct horse', FAST);
  const { key: otherKey } = await createVault('correct horse', FAST);
  const file = await seal(key, 'recipe:r1', recipe);
  const envelope = JSON.parse(file);
  const flipped = fromBase64(envelope.data);
  flipped[3] = (flipped[3] ?? 0) ^ 1;

  await failsWith(() => unseal(key, 'recipe:r1', JSON.stringify({ ...envelope, data: toBase64(flipped) })), 'tampered');
  await failsWith(() => unseal(key, 'recipe:r1', JSON.stringify({ ...envelope, iv: toBase64(new Uint8Array(12)) })), 'tampered');
  await failsWith(() => unseal(key, 'recipe:r2', file), 'tampered');
  await failsWith(() => unseal(otherKey, 'recipe:r1', file), 'tampered');
  await failsWith(() => unseal(key, 'recipe:r1', 'plain text'), 'tampered');
  await failsWith(() => unseal(key, 'recipe:r1', '{"format": "mirepoix-sealed", "version": 1}'), 'tampered');
  await failsWith(() => unseal(key, 'recipe:r1', JSON.stringify({ ...envelope, version: 2 })), 'too-new');
});
