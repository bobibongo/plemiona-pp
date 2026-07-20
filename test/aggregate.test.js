// test/aggregate.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketKey, aggregate, effectiveRates } from '../src/aggregate.js';

const E = (ts, change, category, extra = {}) =>
  ({ ts, world: 'Świat 231', change, category, info: '', ...extra });

test('bucketKey day/week', () => {
  assert.equal(bucketKey('2026-07-19T22:30:00.000Z', 'day'), '2026-07-19');
  assert.match(bucketKey('2026-07-19T22:30:00.000Z', 'week'), /^2026-W\d{2}$/);
});

test('aggregate sumuje kategorie i netto', () => {
  const entries = [
    E('2026-07-19T10:00:00.000Z', 30, 'handel', { subtype: 'sprzedaz', label: 'Sprzedaż' }),
    E('2026-07-19T11:00:00.000Z', -47, 'handel', { subtype: 'kupno', label: 'Kupno' }),
    E('2026-07-19T12:00:00.000Z', -10, 'uslugi', { label: 'Redukcja czasu budowy' }),
    E('2026-07-19T13:00:00.000Z', -30, 'subskrypcje', { label: 'Konto premium' }),
    E('2026-07-19T14:00:00.000Z', 1500, 'zakup_pp', { label: 'Zakup PP' }),
    E('2026-07-19T15:00:00.000Z', 5, 'eventy', { label: 'Otwarcie prezentu' }),
  ];
  const { buckets, totals } = aggregate(entries, { granularity: 'day' });
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].net, 30 - 47 - 10 - 30 + 1500 + 5);
  assert.equal(totals.net, 1448);
  assert.equal(totals.handel, -17);        // 30 - 47
  assert.equal(totals.uslugi, -10);
  assert.equal(totals.subskrypcje, -30);
  assert.equal(totals.zakup_pp, 1500);
  assert.equal(totals.eventy, 5);
});

test('aggregate: rozbicie po label w kategoriach', () => {
  const entries = [
    E('t', -10, 'uslugi', { label: 'Redukcja czasu budowy' }),
    E('t', -10, 'uslugi', { label: 'Redukcja czasu budowy' }),
    E('t', -30, 'subskrypcje', { label: 'Konto premium' }),
    E('t', 5, 'eventy', { label: 'Otwarcie prezentu' }),
  ];
  const { totals } = aggregate(entries, { granularity: 'day' });
  assert.equal(totals.breakdown.uslugi['Redukcja czasu budowy'], -20);
  assert.equal(totals.breakdown.subskrypcje['Konto premium'], -30);
  assert.equal(totals.breakdown.eventy['Otwarcie prezentu'], 5);
  assert.equal(totals.breakdown.handel['Kupno'] ?? 0, 0);
});

test('aggregate: wolumen surowców z różnicą', () => {
  const entries = [
    E('t', 9, 'handel', { subtype: 'sprzedaz', resource: 'glina', amount: 905 }),
    E('t', -47, 'handel', { subtype: 'kupno', resource: 'glina', amount: 20076 }),
  ];
  const { totals } = aggregate(entries, { granularity: 'day' });
  assert.equal(totals.resources.glina.sold, 905);
  assert.equal(totals.resources.glina.bought, 20076);
  assert.equal(totals.resources.glina.diff, 20076 - 905);   // kupione - sprzedane
});

test('effectiveRates: surowce na 1 PP', () => {
  const entries = [
    E('t', -47, 'handel', { subtype: 'kupno', resource: 'zelazo', amount: 20000 }),
    E('t', 23, 'handel', { subtype: 'sprzedaz', resource: 'zelazo', amount: 10000 }),
  ];
  const r = effectiveRates(entries);
  assert.ok(Math.abs(r.zelazo.buy - (20000 / 47)) < 1e-9);   // surowce / PP
  assert.ok(Math.abs(r.zelazo.sell - (10000 / 23)) < 1e-9);
  assert.equal(r.drewno.buy, null);
});
