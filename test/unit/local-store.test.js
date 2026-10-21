// IndexedDB itself is covered in the browser (test/e2e/local-store.spec.js);
// this covers the parts that run without it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestPersistentStorage } from '../../app/store/local-store.js';

/** @param {{ persisted?: boolean, grant?: boolean, fail?: boolean }} behavior */
function fakeStorage({ persisted = false, grant = true, fail = false }) {
  const calls = { persist: 0 };
  return {
    calls,
    persisted: async () => {
      if (fail) throw new Error('not allowed');
      return persisted;
    },
    persist: async () => {
      calls.persist += 1;
      return grant;
    },
  };
}

test('asks for persistent storage when the site does not have it yet', async () => {
  const storage = fakeStorage({ persisted: false, grant: true });
  assert.equal(await requestPersistentStorage(storage), true);
  assert.equal(storage.calls.persist, 1);
});

test('does not ask again once storage is persistent', async () => {
  const storage = fakeStorage({ persisted: true });
  assert.equal(await requestPersistentStorage(storage), true);
  assert.equal(storage.calls.persist, 0);
});

test('reports a refusal, a failure or a missing API as not persistent', async () => {
  assert.equal(await requestPersistentStorage(fakeStorage({ grant: false })), false);
  assert.equal(await requestPersistentStorage(fakeStorage({ fail: true })), false);
  assert.equal(await requestPersistentStorage(undefined), false);
});
