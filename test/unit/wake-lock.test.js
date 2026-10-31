import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepScreenOn } from '../../app/ui/wake-lock.js';

// The screen stays on in cook mode (R3.1), told apart from the browser here
// by a stand-in device that records what was asked of it.

function device({ refuse = false } = {}) {
  /** @type {string[]} */
  const log = [];
  const doc = Object.assign(new EventTarget(), { visibilityState: /** @type {DocumentVisibilityState} */ ('visible') });
  /** @type {(EventTarget & { release: () => Promise<void> }) | null} */
  let held = null;
  const wakeLock = {
    async request(/** @type {string} */ type) {
      log.push(`request ${type}`);
      if (refuse) throw new DOMException('Low battery', 'NotAllowedError');
      const sentinel = Object.assign(new EventTarget(), {
        released: false,
        async release() {
          if (sentinel.released) return;
          sentinel.released = true;
          log.push('release');
          sentinel.dispatchEvent(new Event('release'));
        },
      });
      held = sentinel;
      return sentinel;
    },
  };
  return {
    log,
    /** Hides or shows the page; hiding lets go of the lock, as browsers do. @param {DocumentVisibilityState} state */
    async show(state) {
      doc.visibilityState = state;
      if (state === 'hidden') await held?.release();
      doc.dispatchEvent(new Event('visibilitychange'));
      await settle();
    },
    options: /** @type {any} */ ({ wakeLock, doc }),
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('asks for the screen to stay on, and says when it is', async () => {
  const { log, options } = device();
  /** @type {boolean[]} */
  const states = [];
  const stop = keepScreenOn((on) => states.push(on), options);
  await settle();
  assert.deepEqual(log, ['request screen']);
  assert.deepEqual(states, [true]);
  stop();
  await settle();
  assert.deepEqual(log, ['request screen', 'release']);
  assert.deepEqual(states, [true], 'stopping is not news to the screen that asked');
});

test('asks again whenever the page comes back into view', async () => {
  const phone = device();
  /** @type {boolean[]} */
  const states = [];
  const stop = keepScreenOn((on) => states.push(on), phone.options);
  await settle();
  await phone.show('hidden');
  assert.deepEqual(states, [true, false]);
  await phone.show('visible');
  assert.deepEqual(states, [true, false, true]);
  assert.deepEqual(phone.log, ['request screen', 'release', 'request screen']);
  stop();
  await phone.show('visible');
  assert.deepEqual(phone.log, ['request screen', 'release', 'request screen', 'release'], 'nothing more after stopping');
});

test('a refusal leaves the screen to sleep as usual, quietly', async () => {
  const { log, options } = device({ refuse: true });
  /** @type {boolean[]} */
  const states = [];
  const stop = keepScreenOn((on) => states.push(on), options);
  await settle();
  assert.deepEqual(log, ['request screen']);
  assert.deepEqual(states, []);
  stop();
});

test('stopping before the device answers still lets go', async () => {
  const { log, options } = device();
  /** @type {boolean[]} */
  const states = [];
  const stop = keepScreenOn((on) => states.push(on), options);
  stop();
  await settle();
  assert.deepEqual(log, ['request screen', 'release']);
  assert.deepEqual(states, []);
});

test('a page that opens hidden waits until it is seen', async () => {
  const phone = device();
  phone.options.doc.visibilityState = 'hidden';
  const stop = keepScreenOn(() => {}, phone.options);
  await settle();
  assert.deepEqual(phone.log, []);
  await phone.show('visible');
  assert.deepEqual(phone.log, ['request screen']);
  stop();
});

test('without the API, nothing happens at all', () => {
  const stop = keepScreenOn(() => assert.fail('never told'), /** @type {any} */ ({ wakeLock: undefined, doc: new EventTarget() }));
  stop();
});
