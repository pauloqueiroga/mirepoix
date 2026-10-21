// Offline support (D1, D4): the service worker keeps the app on the device.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Local development skips the service worker so edits show up on reload. Add
 * ?sw to the address to try offline behavior locally.
 * @param {URL} url
 */
export function wantsServiceWorker(url) {
  return !LOCAL_HOSTS.has(url.hostname) || url.searchParams.has('sw');
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !wantsServiceWorker(new URL(location.href))) return;
  try {
    await navigator.serviceWorker.register('sw.js');
  } catch (error) {
    console.warn('Offline support is unavailable:', error);
  }
}
