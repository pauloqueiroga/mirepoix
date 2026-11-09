// Timers in cook mode: set from a time in a step, adjusted before they start
// or while they run, and ringing when they're done. They live on the screen
// only, like the ticks: nothing about them is ever saved.
import { addTime, clock, countdown, pause, secondsLeft, start, tick } from '../domain/timers.js';
import { h } from './dom.js';
import { t } from './i18n.js';

/** @typedef {import('../domain/timers.js').Countdown} Countdown */
/** @typedef {import('./dom.js').Child} Child */
/**
 * @typedef {{
 *   key: string,
 *   countdown: Countdown,
 *   step: number,
 *   label: string,
 *   row: HTMLLIElement,
 *   shown: Countdown['state'] | '',
 *   clock: HTMLElement,
 *   less: HTMLButtonElement,
 *   more: HTMLButtonElement,
 *   main: HTMLButtonElement,
 * }} Timer
 *   step: how much − and + change it, in seconds; label: what it's for, as text
 */

/** A done timer rings for this long at most, if nobody stops it. */
const RING_FOR = 2 * 60_000;

/**
 * The tray of timers, shown above cook mode's bottom bar while it has any.
 * @param {{ now?: () => number }} [clockSource] the time, unless a test gives its own
 */
export function timerTray({ now = () => Date.now() } = {}) {
  /** @type {Timer[]} */
  const timers = [];
  const list = h('ul', { class: 'timer-list' });
  const announce = h('p', { class: 'visually-hidden', role: 'alert' });
  const element = h('section', { class: 'timers', 'aria-label': t.timers, hidden: true }, list, announce);
  const alarm = createAlarm();
  let interval = 0;

  const refresh = () => {
    const at = now();
    let ringing = false;
    for (const timer of timers) {
      const next = tick(timer.countdown, at);
      if (timer.countdown.state === 'running' && next.state === 'done') announce.textContent = t.timeIsUp(timer.label);
      if (next.state === 'done' && at - next.endedAt < RING_FOR) ringing = true;
      timer.countdown = next;
      show(timer, at);
    }
    if (ringing) alarm.ring();
    else alarm.quiet();
    const busy = timers.some((timer) => timer.countdown.state === 'running') || ringing;
    if (busy && !interval) interval = window.setInterval(refresh, 250);
    if (!busy && interval) {
      clearInterval(interval);
      interval = 0;
    }
    element.hidden = timers.length === 0;
  };

  /**
   * @param {Timer} timer
   * @param {number} at
   */
  const show = (timer, at) => {
    const { state } = timer.countdown;
    const left = secondsLeft(timer.countdown, at);
    timer.clock.textContent = clock(left);
    timer.less.disabled = state === 'done' || left === 0;
    if (timer.shown === state) return;
    timer.shown = state;
    timer.row.dataset.state = state;
    timer.main.textContent = { ready: t.startTimer, running: t.pauseTimer, paused: t.resumeTimer, done: t.stopTimer }[state];
    timer.main.classList.toggle('primary', state === 'done');
  };

  /** @param {Timer} timer */
  const remove = (timer) => {
    timers.splice(timers.indexOf(timer), 1);
    timer.row.remove();
    refresh();
  };

  /**
   * Sets a timer, not started, or brings back the one already set for the same thing.
   * @param {{ key: string, seconds: number, label: Child[] }} wanted
   *   key: one timer per key, e.g. a time in a step; label: what it's for
   */
  const add = ({ key, seconds, label }) => {
    const existing = timers.find((timer) => timer.key === key);
    if (existing) {
      existing.main.focus();
      return;
    }
    const name = h('span', { class: 'timer-label' }, ...label);
    const step = seconds < 120 ? 10 : 60;
    const change = step === 60 ? '1 min' : `${step} s`;
    /** @type {Timer} */
    const timer = {
      key,
      countdown: countdown(seconds),
      step,
      label: name.textContent ?? '',
      row: h('li', { class: 'timer' }),
      shown: '',
      clock: h('span', { class: 'timer-clock', role: 'timer' }),
      less: h('button', { type: 'button', class: 'button quiet', 'aria-label': t.lessTime(change) }, `−${change}`),
      more: h('button', { type: 'button', class: 'button quiet', 'aria-label': t.moreTime(change) }, `+${change}`),
      main: h('button', { type: 'button', class: 'button timer-main' }),
    };
    timer.less.addEventListener('click', () => {
      timer.countdown = addTime(timer.countdown, -timer.step, now());
      refresh();
    });
    timer.more.addEventListener('click', () => {
      timer.countdown = addTime(timer.countdown, timer.step, now());
      refresh();
    });
    timer.main.addEventListener('click', () => {
      const { state } = timer.countdown;
      if (state === 'done') {
        remove(timer);
        return;
      }
      if (state === 'running') timer.countdown = pause(timer.countdown, now());
      else {
        alarm.prime();
        timer.countdown = start(timer.countdown, now());
      }
      refresh();
    });
    timer.row.append(
      h('div', { class: 'timer-head' },
        name,
        h('button', { type: 'button', class: 'timer-remove', 'aria-label': t.removeTimer(timer.label), onclick: () => remove(timer) }, '×')),
      h('div', { class: 'timer-body' }, timer.clock, timer.less, timer.more, timer.main));
    timers.push(timer);
    list.append(timer.row);
    refresh();
    timer.main.focus();
  };

  // Back in view after a while away: show where the timers are now.
  const visible = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  document.addEventListener('visibilitychange', visible);

  return {
    element,
    add,
    /** Whether any timer is still going: set, running, paused or ringing. */
    active: () => timers.length > 0,
    /** Stops every timer and the sound, for when cook mode goes. */
    stop: () => {
      clearInterval(interval);
      interval = 0;
      document.removeEventListener('visibilitychange', visible);
      alarm.close();
    },
  };
}

/**
 * Beeps, made by the browser (no sound file), and a buzz where phones allow
 * it. Browsers only let a page make sound after a tap, so starting a timer
 * gets the sound ready.
 */
function createAlarm() {
  /** @type {AudioContext | null} */
  let context = null;
  let ringing = 0;

  const beep = () => {
    if (context && context.state === 'running') {
      for (const at of [0, 0.25, 0.5]) {
        const start = context.currentTime + at;
        const tone = context.createOscillator();
        const volume = context.createGain();
        tone.frequency.value = 880;
        volume.gain.setValueAtTime(0.0001, start);
        volume.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
        volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
        tone.connect(volume).connect(context.destination);
        tone.start(start);
        tone.stop(start + 0.2);
      }
    }
    navigator.vibrate?.([200, 100, 200, 100, 200]);
  };

  return {
    prime() {
      /** @type {typeof AudioContext | undefined} */
      const Audio = window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext;
      if (!Audio) return;
      try {
        context ??= new Audio();
        void context.resume();
      } catch {
        context = null; // no sound, then; the timer still shows it's done
      }
    },
    ring() {
      if (ringing) return;
      beep();
      ringing = window.setInterval(beep, 1500);
    },
    quiet() {
      clearInterval(ringing);
      ringing = 0;
    },
    close() {
      this.quiet();
      void context?.close();
      context = null;
    },
  };
}
