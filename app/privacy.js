// The privacy page's one live part (R1.13): your analytics choice on this
// device, and a way to change it.
import { analyticsAvailable, analyticsChoice, setAnalyticsChoice, startAnalytics, trackScreen } from './analytics.js';
import { h } from './ui/dom.js';

const box = document.getElementById('analytics-choice');
startAnalytics();
trackScreen('privacy');

const show = () => {
  if (!box) return;
  if (!analyticsAvailable()) {
    box.replaceChildren(h('p', null, 'Usage statistics are switched off on this site, so nothing is sent.'));
    return;
  }
  const allowed = analyticsChoice() === 'granted';
  box.replaceChildren(
    h('p', null, allowed
      ? 'On this device, you allow usage statistics.'
      : 'On this device, usage statistics are not allowed, so nothing is sent.'),
    h('button', {
      type: 'button',
      class: 'button secondary',
      onclick: () => {
        setAnalyticsChoice(allowed ? 'denied' : 'granted');
        if (!allowed) trackScreen('privacy');
        show();
      },
    }, allowed ? 'Stop sharing usage statistics' : 'Allow usage statistics'));
};
show();
