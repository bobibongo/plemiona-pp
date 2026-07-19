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

test('aggregate sumuje earned/spent/net i kategorie', () => {
  const entries = [
    E('2026-07-19T10:00:00.000Z', 30, 'arbitraz', { subtype: 'sprzedaz' }),
    E('2026-07-19T11:00:00.000Z', -47, 'arbitraz', { subtype: 'kupno' }),
    E('2026-07-19T12:00:00.000Z', -10, 'usluga', { subtype: 'redukcja_czasu' }),
    E('2026-07-19T13:00:00.000Z', 1500, 'zewnetrzne_pp', { subtype: 'zakup_pp' }),
  ];
  const { buckets, totals } = aggregate(entries, { granularity: 'day' });
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].earned, 1530);
  assert.equal(buckets[0].spent, -57);
  assert.equal(buckets[0].net, 1473);
  assert.equal(buckets[0].arbitrageProfit, -17);
  assert.equal(totals.serviceCost, -10);
  assert.equal(totals.externalPP, 1500);
  assert.equal(totals.serviceBreakdown.redukcja_czasu, -10);
});

test('aggregate sumuje wolumen surowców', () => {
  const entries = [
    E('2026-07-19T10:00:00.000Z', 9, 'arbitraz', { subtype: 'sprzedaz', resource: 'glina', amount: 905 }),
    E('2026-07-19T11:00:00.000Z', -47, 'arbitraz', { subtype: 'kupno', resource: 'glina', amount: 20076 }),
  ];
  const { totals } = aggregate(entries, { granularity: 'day' });
  assert.equal(totals.resources.glina.sold, 905);
  assert.equal(totals.resources.glina.bought, 20076);
});

test('effectiveRates liczy PP na 1000', () => {
  const entries = [
    E('t', -47, 'arbitraz', { subtype: 'kupno', resource: 'zelazo', amount: 20000 }),
    E('t', 23, 'arbitraz', { subtype: 'sprzedaz', resource: 'zelazo', amount: 10000 }),
  ];
  const r = effectiveRates(entries);
  assert.ok(Math.abs(r.zelazo.buy - 2.35) < 1e-9);   // 47/20000*1000
  assert.ok(Math.abs(r.zelazo.sell - 2.3) < 1e-9);   // 23/10000*1000
  assert.equal(r.drewno.buy, null);
});
