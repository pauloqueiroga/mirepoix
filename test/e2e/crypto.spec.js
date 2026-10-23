import { expect, test } from './fixtures.js';

// The crypto envelope (R2.1, D7) in real browsers, under the production
// security policy: Safari's Web Crypto has to agree with Chrome's.

test('a vault made here opens, and its key seals and opens recipes, even after a stay in IndexedDB', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { createVault, openVault, readVault, seal, unseal } = await import('/store/crypto.js');
    const { text, key } = await createVault('pão de queijo');
    const reopened = await openVault(readVault(text), 'pão de queijo');

    // The key goes into IndexedDB as it is, never readable, and comes back usable.
    const db = await new Promise((resolve, reject) => {
      const opening = indexedDB.open(`crypto-${crypto.randomUUID()}`, 1);
      opening.onupgradeneeded = () => opening.result.createObjectStore('keys');
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    const kept = await new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      tx.objectStore('keys').put(reopened, 'key');
      tx.oncomplete = () => {
        const get = db.transaction('keys').objectStore('keys').get('key');
        get.onsuccess = () => resolve(get.result);
      };
      tx.onerror = () => reject(tx.error);
    });

    const file = await seal(key, 'recipe:r1', { title: 'Pão de queijo' });
    const opened = await unseal(kept, 'recipe:r1', file);
    let wrong = '';
    await openVault(readVault(text), 'pao de queijo').catch((error) => { wrong = error.code; });
    let tampered = '';
    await unseal(kept, 'recipe:r2', file).catch((error) => { tampered = error.code; });
    return { opened, wrong, tampered, extractable: kept.extractable, iterations: readVault(text).kdf.iterations };
  });
  expect(result).toEqual({ opened: { title: 'Pão de queijo' }, wrong: 'wrong-passphrase', tampered: 'tampered', extractable: false, iterations: 600000 });
});
