// test/rates-signals.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseThreshold, evaluateSignals } from '../src/rates-signals.js';

const rec = (continent, v) =>
  ({ world: 'pl231', continent, x: 1, y: 2, wood: v, stone: v, iron: v, at: '2026-07-21T14:30:00.000Z' });

test('parseThreshold przyjmuje liczby i teksty, odrzuca resztę', () => {
  assert.equal(parseThreshold('380'), 380);
  assert.equal(parseThreshold(380), 380);
  assert.equal(parseThreshold(''), null);
  assert.equal(parseThreshold('brak'), null);
  assert.equal(parseThreshold(null), null);
  assert.equal(parseThreshold(-5), null);
});

test('bez ustawionych progów prosi o ich wpisanie', () => {
  const out = evaluateSignals([rec('K64', 400)], { high: null, low: null });
  assert.equal(out.ready, false);
  assert.equal(out.signals.length, 0);
  assert.match(out.message, /progi/i);
});

test('próg dolny nie może być większy od górnego', () => {
  const out = evaluateSignals([rec('K64', 400)], { high: 300, low: 400 });
  assert.equal(out.ready, false);
  assert.match(out.message, /dolny/i);
});

test('średnia powyżej progu górnego to sygnał kupna', () => {
  const out = evaluateSignals([rec('K64', 412)], { high: 400, low: 320 });
  assert.equal(out.ready, true);
  assert.deepEqual(out.signals, [{ continent: 'K64', avg: 412, action: 'kupuj' }]);
});

test('średnia poniżej progu dolnego to sygnał sprzedaży', () => {
  const out = evaluateSignals([rec('K55', 310)], { high: 400, low: 320 });
  assert.deepEqual(out.signals, [{ continent: 'K55', avg: 310, action: 'sprzedawaj' }]);
});

test('progi działają domknięte — równość też jest sygnałem', () => {
  const out = evaluateSignals([rec('K64', 400), rec('K55', 320)], { high: 400, low: 320 });
  assert.deepEqual(out.signals.map(s => s.action), ['sprzedawaj', 'kupuj']);
});

test('kurs między progami nie daje sygnału', () => {
  const out = evaluateSignals([rec('K64', 360)], { high: 400, low: 320 });
  assert.equal(out.ready, true);
  assert.equal(out.signals.length, 0);
  assert.match(out.message, /brak okazji/i);
});

test('brak okazji mówi to wprost zamiast milczeć', () => {
  const out = evaluateSignals([], { high: 400, low: 320 });
  assert.equal(out.signals.length, 0);
  assert.ok(out.message.length > 0);
});
