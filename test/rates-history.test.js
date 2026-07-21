// test/rates-history.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseImport, recordKey, mergeHistory,
  average, worlds, forWorld, continentsOf, latestPerContinent, seriesByContinent,
} from '../src/rates-history.js';

const eksport = (readings, world = 'pl231') =>
  JSON.stringify({ exportedAt: '2026-07-21T14:32:00.000Z', world, readings });

const odczyt = (continent, wood, at) =>
  ({ continent, x: 499, y: 613, wood, stone: 372, iron: 406, at });

test('parseImport przyjmuje eksport z kolektora', () => {
  const out = parseImport(eksport([odczyt('K64', 378, '2026-07-21T14:30:00.000Z')]));
  assert.equal(out.ok, true);
  assert.equal(out.world, 'pl231');
  assert.equal(out.skipped, 0);
  assert.deepEqual(out.records[0], {
    world: 'pl231', continent: 'K64', x: 499, y: 613,
    wood: 378, stone: 372, iron: 406, at: '2026-07-21T14:30:00.000Z',
  });
});

test('parseImport odrzuca tekst, który nie jest JSON-em', () => {
  const out = parseImport('to nie jest json');
  assert.equal(out.ok, false);
  assert.match(out.error, /kolektora/);
});

test('parseImport odrzuca JSON bez pola readings — nie zgadujemy kształtu', () => {
  assert.equal(parseImport('{"world":"pl231"}').ok, false);
  assert.equal(parseImport('[]').ok, false);
});

test('parseImport pomija zepsute wiersze i przyjmuje resztę', () => {
  const out = parseImport(eksport([
    odczyt('K64', 378, '2026-07-21T14:30:00.000Z'),
    { continent: null, wood: 1, stone: 2, iron: 3, at: '2026-07-21T14:31:00.000Z' },
    { continent: 'K55', wood: 'brak', stone: 2, iron: 3, at: '2026-07-21T14:32:00.000Z' },
  ]));
  assert.equal(out.ok, true);
  assert.equal(out.records.length, 1);
  assert.equal(out.skipped, 2);
});

test('recordKey rozróżnia świat, kontynent i moment odczytu', () => {
  const a = { world: 'pl231', continent: 'K64', at: '2026-07-21T14:30:00.000Z' };
  assert.equal(recordKey(a), recordKey({ ...a }));
  assert.notEqual(recordKey(a), recordKey({ ...a, continent: 'K55' }));
  assert.notEqual(recordKey(a), recordKey({ ...a, world: 'pl217' }));
  assert.notEqual(recordKey(a), recordKey({ ...a, at: '2026-07-21T15:00:00.000Z' }));
});

test('mergeHistory dokłada nowe odczyty i sortuje po czasie', () => {
  const stare = parseImport(eksport([odczyt('K64', 378, '2026-07-20T10:00:00.000Z')])).records;
  const nowe = parseImport(eksport([odczyt('K64', 390, '2026-07-21T10:00:00.000Z')])).records;
  const out = mergeHistory(stare, nowe);
  assert.equal(out.added, 1);
  assert.equal(out.history.length, 2);
  assert.equal(out.history[0].at, '2026-07-20T10:00:00.000Z');
});

test('mergeHistory nie duplikuje tego samego eksportu wklejonego drugi raz', () => {
  const r = parseImport(eksport([odczyt('K64', 378, '2026-07-20T10:00:00.000Z')])).records;
  const raz = mergeHistory([], r);
  const dwa = mergeHistory(raz.history, r);
  assert.equal(dwa.added, 0);
  assert.equal(dwa.duplicates, 1);
  assert.equal(dwa.history.length, 1);
});

test('mergeHistory nie zmienia przekazanej historii', () => {
  const historia = [];
  const r = parseImport(eksport([odczyt('K64', 378, '2026-07-20T10:00:00.000Z')])).records;
  mergeHistory(historia, r);
  assert.equal(historia.length, 0);
});

const rec = (world, continent, at, wood = 300, stone = 300, iron = 300) =>
  ({ world, continent, x: 1, y: 2, wood, stone, iron, at });

test('average zaokrągla średnią z trzech surowców', () => {
  assert.equal(average(rec('pl231', 'K64', 'x', 378, 372, 406)), 385);
  assert.equal(average(rec('pl231', 'K64', 'x', 300, 300, 300)), 300);
});

test('worlds zwraca posortowane światy bez powtórzeń', () => {
  const h = [rec('pl231', 'K64', 'a'), rec('pl217', 'K55', 'b'), rec('pl231', 'K55', 'c')];
  assert.deepEqual(worlds(h), ['pl217', 'pl231']);
});

test('forWorld filtruje po świecie', () => {
  const h = [rec('pl231', 'K64', 'a'), rec('pl217', 'K55', 'b')];
  assert.deepEqual(forWorld(h, 'pl217').map(r => r.continent), ['K55']);
});

test('continentsOf sortuje po numerze, nie alfabetycznie', () => {
  const h = [rec('pl231', 'K64', 'a'), rec('pl231', 'K5', 'b'), rec('pl231', 'K45', 'c')];
  assert.deepEqual(continentsOf(h), ['K5', 'K45', 'K64']);
});

test('latestPerContinent bierze najświeższy odczyt każdego kontynentu', () => {
  const h = [
    rec('pl231', 'K64', '2026-07-20T10:00:00.000Z', 300, 300, 300),
    rec('pl231', 'K64', '2026-07-21T10:00:00.000Z', 400, 400, 400),
    rec('pl231', 'K55', '2026-07-19T10:00:00.000Z', 350, 350, 350),
  ];
  const out = latestPerContinent(h);
  assert.deepEqual(out.map(r => r.continent), ['K55', 'K64']);
  assert.equal(out.find(r => r.continent === 'K64').wood, 400);
});

test('seriesByContinent daje serię punktów na kontynent, rosnąco w czasie', () => {
  const h = [
    rec('pl231', 'K64', '2026-07-21T10:00:00.000Z', 400, 400, 400),
    rec('pl231', 'K64', '2026-07-20T10:00:00.000Z', 300, 300, 300),
    rec('pl231', 'K55', '2026-07-20T10:00:00.000Z', 350, 350, 350),
  ];
  const out = seriesByContinent(h);
  assert.deepEqual(out.map(s => s.continent), ['K55', 'K64']);
  const k64 = out.find(s => s.continent === 'K64');
  assert.deepEqual(k64.points.map(p => p.y), [300, 400]);
  assert.ok(k64.points[0].t < k64.points[1].t);
  assert.equal(k64.points[1].rec.wood, 400);
});
