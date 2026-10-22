// The privacy page's one live part (R1.13): your analytics choice on this
// device, and a way to change it. It speaks the page's language (R1.17).
import { analyticsAvailable, analyticsChoice, setAnalyticsChoice, startAnalytics, trackScreen } from './analytics.js';
import { h } from './ui/dom.js';
import { messages } from './ui/i18n.js';

const words = messages[document.documentElement.lang === 'pt' ? 'pt' : 'en'];

const box = document.getElementById('analytics-choice');
startAnalytics();
trackScreen('privacy');

const show = () => {
  if (!box) return;
  if (!analyticsAvailable()) {
    box.replaceChildren(h('p', null, words.statisticsOff));
    return;
  }
  const allowed = analyticsChoice() === 'granted';
  box.replaceChildren(
    h('p', null, allowed ? words.statisticsAllowed : words.statisticsNotAllowed),
    h('button', {
      type: 'button',
      class: 'button secondary',
      onclick: () => {
        setAnalyticsChoice(allowed ? 'denied' : 'granted');
        if (!allowed) trackScreen('privacy');
        show();
      },
    }, allowed ? words.stopStatistics : words.allowStatistics));
};
show();
