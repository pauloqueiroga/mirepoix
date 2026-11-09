import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTime, clock, countdown, findDurations, pause, secondsLeft, start, tick } from '../../app/domain/timers.js';

/**
 * What each time found in a step reads as: [text, seconds, upTo].
 * @param {string} step
 * @param {'en' | 'pt'} [lang]
 */
const times = (step, lang = 'en') => findDurations(step, lang).map(({ text, seconds, upTo }) => [text, seconds, upTo]);

test('finds times in English steps, ranges included', () => {
  assert.deepEqual(times('Bake 10–12 minutes, until golden.'), [['10–12 minutes', 600, 720]]);
  assert.deepEqual(times('Simmer for 2 to 3 hours.'), [['2 to 3 hours', 7200, 10800]]);
  assert.deepEqual(times('Cook 5 or 6 min per side.'), [['5 or 6 min', 300, 360]]);
  assert.deepEqual(times('Rest 30 seconds.'), [['30 seconds', 30, 30]]);
  assert.deepEqual(times('Boil 1 1/2 hours.'), [['1 1/2 hours', 5400, 5400]]);
  assert.deepEqual(times('Proof 1½ hrs.'), [['1½ hrs', 5400, 5400]]);
  assert.deepEqual(times('Chill 1.5 hours.'), [['1.5 hours', 5400, 5400]]);
  assert.deepEqual(times('Let it sit for a minute, then two minutes more.'), [['a minute', 60, 60], ['two minutes', 120, 120]]);
  assert.deepEqual(times('Roast for an hour and a half.'), [['an hour and a half', 5400, 5400]]);
  assert.deepEqual(times('Wait half an hour.'), [['half an hour', 1800, 1800]]);
  assert.deepEqual(times('Bake 1 hour 15 minutes.'), [['1 hour 15 minutes', 4500, 4500]]);
  assert.deepEqual(times('Bake 1 hour and 15 minutes.'), [['1 hour and 15 minutes', 4500, 4500]]);
  assert.deepEqual(times('Give it a 5-minute rest.'), [['5-minute', 300, 300]]);
  assert.deepEqual(times('Cook 10 minutes, stir, then 5 more minutes.'), [['10 minutes', 600, 600], ['5 more minutes', 300, 300]]);
  assert.deepEqual(times('Bake (25 min.) until set.'), [['25 min', 1500, 1500]]);
  assert.deepEqual(times('Simmer twenty minutes.'), [['twenty minutes', 1200, 1200]]);
});

test('finds times in Portuguese steps', () => {
  assert.deepEqual(times('Asse por 25 minutos.', 'pt'), [['25 minutos', 1500, 1500]]);
  assert.deepEqual(times('Cozinhe de 40 a 45 minutos.', 'pt'), [['40 a 45 minutos', 2400, 2700]]);
  assert.deepEqual(times('Deixe crescer por 1 hora e meia.', 'pt'), [['1 hora e meia', 5400, 5400]]);
  assert.deepEqual(times('Deixe descansar meia hora.', 'pt'), [['meia hora', 1800, 1800]]);
  assert.deepEqual(times('Asse por uma hora e 10 minutos.', 'pt'), [['uma hora e 10 minutos', 4200, 4200]]);
  assert.deepEqual(times('Leve ao forno por 1h30.', 'pt'), [['1h30', 5400, 5400]]);
  assert.deepEqual(times('Bata por 1,5 minuto.', 'pt'), [['1,5 minuto', 90, 90]]);
  assert.deepEqual(times('Cozinhe por dois ou três minutos.', 'pt'), [['dois ou três minutos', 120, 180]]);
  assert.deepEqual(times('Deixe 10min e vire.', 'pt'), [['10min', 600, 600]]);
});

test('numbers that are not times are left alone', () => {
  assert.deepEqual(times('Bake at 180 °C until golden, a few minutes.'), []);
  assert.deepEqual(times('Add 2 eggs, one at a time.'), []);
  assert.deepEqual(times('Asse a 200 graus.', 'pt'), []);
  assert.deepEqual(times('Rest overnight.'), []);
  assert.deepEqual(times(''), []);
});

test('where a time is in the step, to show it there', () => {
  const step = 'Bake 10–12 minutes, until golden.';
  const [found] = findDurations(step, 'en');
  assert.equal(step.slice(found?.start, found?.end), '10–12 minutes');
});

test('a timer is set, started, paused, resumed and done, keeping time by the clock', () => {
  let timer = countdown(600);
  assert.deepEqual(timer, { state: 'ready', left: 600 });
  timer = start(timer, 1_000);
  assert.equal(secondsLeft(timer, 1_000), 600);
  assert.equal(secondsLeft(timer, 1_500), 600, 'rounds up');
  assert.equal(secondsLeft(timer, 61_000), 540);
  timer = pause(timer, 61_000);
  assert.deepEqual(timer, { state: 'paused', left: 540 });
  assert.equal(secondsLeft(timer, 999_999), 540, 'paused, time stands still');
  timer = start(timer, 100_000);
  assert.equal(tick(timer, 639_999).state, 'running');
  timer = tick(timer, 640_000);
  assert.deepEqual(timer, { state: 'done', endedAt: 640_000 });
  assert.equal(secondsLeft(timer, 700_000), 0);
});

test('time can be added or taken away before or while it runs', () => {
  assert.deepEqual(addTime(countdown(600), 60, 0), { state: 'ready', left: 660 });
  assert.deepEqual(addTime(countdown(30), -60, 0), { state: 'ready', left: 0 });
  const running = start(countdown(600), 0);
  assert.equal(secondsLeft(addTime(running, -60, 0), 0), 540);
  assert.equal(addTime(running, -60, 590_000).state, 'done', 'less than none left ends it');
  const done = tick(running, 600_000);
  assert.deepEqual(addTime(done, 60, 700_000), { state: 'running', endsAt: 760_000 }, 'more time on a done timer runs again');
  assert.deepEqual(addTime(done, -60, 700_000), done);
  assert.deepEqual(start(countdown(0), 5), { state: 'done', endedAt: 5 });
});

test('seconds show as a clock', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(45), '0:45');
  assert.equal(clock(600), '10:00');
  assert.equal(clock(3723), '1:02:03');
});
