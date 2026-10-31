// Keeps the screen on while cooking (R3.1, D10), on devices that allow it,
// through the Screen Wake Lock API.

/**
 * Asks the device to keep the screen on. The browser lets go whenever the
 * page is hidden (another app, a locked phone), so it's asked again each time
 * the page is back in view.
 * @param {(on: boolean) => void} changed told each time the screen starts or stops being kept on
 * @param {{ wakeLock?: WakeLock, doc?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> }} [device]
 *   the browser's, unless a test gives its own
 * @returns {() => void} lets the screen sleep again
 */
export function keepScreenOn(changed, {
  wakeLock = 'wakeLock' in navigator ? navigator.wakeLock : undefined,
  doc = document,
} = {}) {
  if (!wakeLock) return () => {};
  let stopped = false;
  let asking = false;
  /** @type {WakeLockSentinel | null} */
  let lock = null;

  const ask = async () => {
    if (stopped || asking || lock || doc.visibilityState !== 'visible') return;
    asking = true;
    try {
      const granted = await wakeLock.request('screen');
      if (stopped) {
        await granted.release();
        return;
      }
      lock = granted;
      granted.addEventListener('release', () => {
        lock = null;
        if (!stopped) changed(false);
      }, { once: true });
      changed(true);
    } catch {
      // Refused, e.g. on low battery. The screen sleeps as usual.
    } finally {
      asking = false;
    }
  };
  const visible = () => void ask();

  doc.addEventListener('visibilitychange', visible);
  void ask();
  return () => {
    stopped = true;
    doc.removeEventListener('visibilitychange', visible);
    lock?.release().catch(() => {});
    lock = null;
  };
}
