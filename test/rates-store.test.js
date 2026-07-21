// test/rates-store.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  worldFromHost, storageKey, sortReadings, mergeReading, buildExport, exportFilename,
} from '../src/rates-store.js';

const r = (continent, wood, at = '2026-07-21T14:30:12.000Z') =>
  ({ continent, x: 1, y: 2, wood, stone: 2, iron: 3, at });

test('worldFromHost bierze pierwszy człon nazwy hosta', () => {
  assert.equal(worldFromHost('pl231.plemiona.pl'), 'pl231');
});

test('worldFromHost nie wywraca się na pustym wejściu', () => {
  assert.equal(worldFromHost(''), 'nieznany');
  assert.equal(worldFromHost(undefined), 'nieznany');
});

test('storageKey rozdziela światy', () => {
  assert.notEqual(storageKey('pl231'), storageKey('pl217'));
  assert.match(storageKey('pl231'), /pl231/);
});

test('sortReadings układa kontynenty rosnąco po numerze, nie alfabetycznie', () => {
  const out = sortReadings([r('K64', 1), r('K5', 2), r('K45', 3)]);
  assert.deepEqual(out.map(x => x.continent), ['K5', 'K45', 'K64']);
});

test('mergeReading dokłada nowy kontynent', () => {
  const out = mergeReading([r('K45', 325)], r('K64', 378));
  assert.deepEqual(out.map(x => x.continent), ['K45', 'K64']);
});

test('mergeReading nadpisuje kontynent zamiast dokładać drugi wiersz', () => {
  const out = mergeReading([r('K64', 378), r('K45', 325)], r('K64', 401));
  assert.equal(out.length, 2);
  assert.equal(out.find(x => x.continent === 'K64').wood, 401);
});

test('mergeReading odrzuca odczyt bez kontynentu i nie rusza stanu', () => {
  const przed = [r('K64', 378)];
  const out = mergeReading(przed, { continent: null, wood: 999 });
  assert.deepEqual(out, przed);
  assert.deepEqual(mergeReading(przed, null), przed);
});

test('buildExport składa ładunek zgodny ze specyfikacją', () => {
  const out = buildExport('pl231', [r('K64', 378)], new Date('2026-07-21T14:32:00.000Z'));
  assert.equal(out.exportedAt, '2026-07-21T14:32:00.000Z');
  assert.equal(out.world, 'pl231');
  assert.equal(out.readings.length, 1);
  assert.equal(out.readings[0].continent, 'K64');
});

test('exportFilename niesie świat i moment eksportu', () => {
  const name = exportFilename('pl231', new Date(2026, 6, 21, 14, 32));
  assert.equal(name, 'plemiona-kursy-pl231-20260721-1432.json');
});
