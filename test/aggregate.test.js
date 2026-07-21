// test/aggregate.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketKey, aggregate, effectiveRates, logHealth } from '../src/aggregate.js';

const E = (ts, change, category, extra = {}) =>
  ({ ts, world: 'Świat 231', change, category, info: '', ...extra });

test('bucketKey day/week/month', () => {
  assert.equal(bucketKey('2026-07-19T22:30:00.000Z', 'day'), '2026-07-19');
  assert.match(bucketKey('2026-07-19T22:30:00.000Z', 'week'), /^2026-W\d{2}$/);
  assert.equal(bucketKey('2026-07-19T22:30:00.000Z', 'month'), '2026-07');
});

test('aggregate sumuje kategorie, netto oraz przychody/wydatki', () => {
  const entries = [
    E('2026-07-19T10:00:00.000Z', 30, 'handel', { subtype: 'sprzedaz', label: 'Sprzedaż' }),
    E('2026-07-19T11:00:00.000Z', -47, 'handel', { subtype: 'kupno', label: 'Kupno' }),
    E('2026-07-19T12:00:00.000Z', -10, 'uslugi', { label: 'Redukcja czasu budowy' }),
    E('2026-07-19T13:00:00.000Z', -30, 'subskrypcje', { label: 'Konto premium' }),
    E('2026-07-19T14:00:00.000Z', 1500, 'zakup_pp', { label: 'Zakup PP' }),
    E('2026-07-19T15:00:00.000Z', -5, 'eventy', { label: 'Zakręcenie kołem' }),
  ];
  const { buckets, totals } = aggregate(entries, { granularity: 'day' });
  assert.equal(buckets.length, 1);
  assert.equal(totals.net, 30 - 47 - 10 - 30 + 1500 - 5);
  assert.equal(totals.handel, -17);
  assert.equal(totals.uslugi, -10);
  assert.equal(totals.subskrypcje, -30);
  assert.equal(totals.zakup_pp, 1500);
  assert.equal(totals.eventy, -5);
  assert.equal(totals.earned, 30 + 1500);       // wszystkie dodatnie
  assert.equal(totals.spent, -47 - 10 - 30 - 5); // wszystkie ujemne
  // per okres główne pozycje
  assert.equal(buckets[0].handel, -17);
  assert.equal(buckets[0].subskrypcje, -30);
  assert.equal(buckets[0].uslugi, -10);
  assert.equal(buckets[0].eventy, -5);
  assert.equal(buckets[0].zakup_pp, 1500);
  assert.equal(buckets[0].net, totals.net);
});

test('aggregate: wolumen surowców z różnicą (per surowiec i sumarycznie)', () => {
  const entries = [
    E('2026-07-19T10:00:00.000Z', 9, 'handel', { subtype: 'sprzedaz', resource: 'glina', amount: 905 }),
    E('2026-07-19T11:00:00.000Z', -47, 'handel', { subtype: 'kupno', resource: 'glina', amount: 20076 }),
    E('2026-07-19T12:00:00.000Z', -20, 'handel', { subtype: 'kupno', resource: 'drewno', amount: 8000 }),
  ];
  const { buckets, totals } = aggregate(entries, { granularity: 'day' });
  assert.equal(totals.resources.glina.diff, 20076 - 905);
  assert.equal(totals.resTotal.bought, 20076 + 8000);
  assert.equal(totals.resTotal.sold, 905);
  assert.equal(totals.resTotal.diff, 20076 + 8000 - 905);
  assert.equal(buckets[0].resDiff, 20076 + 8000 - 905);   // różnica surowców w okresie
});

test('logHealth: ciągły łańcuch salda = bez luk', () => {
  const H = (ts, change, balance) => ({ ts, change, balance, world: 'Świat 1' });
  // saldo przed pierwszym = 100
  const e = [H('2026-07-19T10:00:00Z', 10, 110), H('2026-07-19T11:00:00Z', -5, 105), H('2026-07-19T12:00:00Z', 20, 125)];
  const h = logHealth(e);
  assert.equal(h.complete, true);
  assert.equal(h.gapCount, 0);
  assert.equal(h.count, 3);
  assert.equal(h.worlds, 1);
});

test('logHealth: brak strony = wykryta luka i brakujące PP', () => {
  const H = (ts, change, balance) => ({ ts, change, balance, world: 'Świat 1' });
  // 110 -> (brak wpisów o zmianie -530) -> 580, potem +20 = 600
  const e = [H('2026-07-19T10:00:00Z', 10, 110), H('2026-07-19T12:00:00Z', 20, 600)];
  const h = logHealth(e);
  assert.equal(h.complete, false);
  assert.equal(h.gapCount, 1);
  assert.equal(h.missingPP, 470);   // (600-20) - 110
});

test('logHealth: odtwarza kolejność w obrębie minuty', () => {
  const H = (ts, change, balance) => ({ ts, change, balance, world: 'Świat 1' });
  // ta sama minuta, podane w złej kolejności; łańcuch: 100 -> 90 -> 80 -> 70
  const e = [H('2026-07-19T09:34:00Z', -10, 70), H('2026-07-19T09:34:00Z', -10, 90), H('2026-07-19T09:34:00Z', -10, 80)];
  const h = logHealth(e);
  assert.equal(h.complete, true);
});

test('effectiveRates: surowce na 1 PP', () => {
  const entries = [
    E('t', -47, 'handel', { subtype: 'kupno', resource: 'zelazo', amount: 20000 }),
    E('t', 23, 'handel', { subtype: 'sprzedaz', resource: 'zelazo', amount: 10000 }),
  ];
  const r = effectiveRates(entries);
  assert.ok(Math.abs(r.zelazo.buy - (20000 / 47)) < 1e-9);
  assert.ok(Math.abs(r.zelazo.sell - (10000 / 23)) < 1e-9);
  assert.equal(r.drewno.buy, null);
});
