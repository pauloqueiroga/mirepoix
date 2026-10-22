// Usage statistics (R1.14, D14): Google Analytics, opt-in. Nothing loads until
// a visitor says yes, and only screen names are sent: never recipe titles,
// ingredients, notes or searches.
import { ANALYTICS_ID } from './config.js';
import { h } from './ui/dom.js';
import { t } from './ui/i18n.js';

const KEY = 'mirepoix.analytics';
const GTAG = 'https://www.googletagmanager.com/gtag/js';

/** @typedef {'granted' | 'denied'} Choice */

let loaded = false;

/** Whether this site has analytics set up at all (a Measurement ID in config.js). */
export function analyticsAvailable() {
  return ANALYTICS_ID !== '';
}

/** Whether statistics are being sent right now. */
export function analyticsActive() {
  return analyticsAvailable() && analyticsChoice() === 'granted';
}

/** @returns {Choice | null} the visitor's answer on this device, if any */
export function analyticsChoice() {
  try {
    const choice = localStorage.getItem(KEY);
    return choice === 'granted' || choice === 'denied' ? choice : null;
  } catch {
    return null;
  }
}

/** @param {Choice} choice */
export function setAnalyticsChoice(choice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Without storage the question comes back next time; nothing else changes.
  }
  if (choice === 'granted') startAnalytics();
  else stopAnalytics();
}

/** Loads Google's script, only for a visitor who said yes. */
export function startAnalytics() {
  if (loaded || !analyticsActive()) return;
  loaded = true;
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  gtag('js', new Date());
  gtag('config', ANALYTICS_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...screenParameters('recipes'),
  });
  document.head.append(h('script', { async: true, src: `${GTAG}?id=${encodeURIComponent(ANALYTICS_ID)}` }));
}

/**
 * Counts one view of a screen, by its name alone ("recipe", "edit recipe"…).
 * @param {string} screen
 */
export function trackScreen(screen) {
  if (!loaded) return;
  gtag('set', screenParameters(screen));
  gtag('event', 'page_view', screenParameters(screen));
}

/**
 * Asks once, at the bottom of the screen, when analytics is set up and the
 * visitor hasn't answered yet.
 */
export function askForAnalytics() {
  if (!analyticsAvailable() || analyticsChoice() !== null) return;
  /** @param {Choice} choice */
  const answer = (choice) => () => {
    banner.remove();
    setAnalyticsChoice(choice);
    if (choice === 'granted') trackScreen(currentScreen);
  };
  const banner = h('aside', { class: 'consent', 'aria-label': t.statistics },
    h('p', null, t.statisticsAsk, h('a', { href: t.privacyPage }, t.privacy)),
    h('div', { class: 'consent-actions' },
      h('button', { type: 'button', class: 'button quiet', onclick: answer('denied') }, t.noThanks),
      h('button', { type: 'button', class: 'button primary', onclick: answer('granted') }, t.allow)));
  document.body.append(banner);
}

let currentScreen = 'recipes';
/** Remembers which screen is showing, so a yes can count it. @param {string} screen */
export function screenShown(screen) {
  currentScreen = screen;
  trackScreen(screen);
}

function stopAnalytics() {
  if (loaded) gtag('consent', 'update', { analytics_storage: 'denied' });
  // Forget the cookies Google set, on this host and the domains above it.
  const names = document.cookie.split(';').map((cookie) => cookie.split('=')[0]?.trim() ?? '').filter((name) => /^_ga(_|$)/.test(name));
  const parts = location.hostname.split('.');
  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
    for (let i = 0; i < parts.length - 1; i++) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${parts.slice(i).join('.')}`;
    }
  }
}

/**
 * What every hit says about where it came from: the screen's name, and an
 * address with nothing but that name in it.
 * @param {string} screen
 */
function screenParameters(screen) {
  return {
    page_title: screen,
    page_location: `${location.origin}${location.pathname}?screen=${encodeURIComponent(screen)}`,
    page_referrer: '',
  };
}

/** Google's command queue; gtag.js reads it once it loads. @param {...unknown} _args */
function gtag(..._args) {
  const page = /** @type {{ dataLayer?: unknown[] }} */ (/** @type {unknown} */ (window));
  // gtag.js expects the arguments object itself, not an array.
  (page.dataLayer ??= []).push(arguments);
}
