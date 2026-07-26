// test/wioska-plan.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujPlan, bledyPlanu, PLAN_PUSTY } from '../src/wioska/plan.js';

test('pusty plan jest poprawny', () => {
  assert.deepEqual(bledyPlanu(PLAN_PUSTY), []);
});

test('normalizacja uzupelnia poziomy startowe z configu swiata', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [] });
  assert.equal(p.start.poziomy.ratusz, 1);
  assert.equal(p.start.poziomy.koszary, 0);
});

test('normalizacja ustawia surowce startowe na 1000 kazdego', () => {
  const p = normalizujPlan({ swiat: 'pl231' });
  assert.deepEqual(p.start.surowce, { drewno: 1000, glina: 1000, zelazo: 1000 });
});

test('podane surowce startowe wygrywaja z domyslnymi', () => {
  const p = normalizujPlan({ swiat: 'pl231', start: { surowce: { drewno: 5000 } } });
  assert.equal(p.start.surowce.drewno, 5000);
  assert.equal(p.start.surowce.glina, 1000);
});

test('normalizacja sortuje dochody i zastrzyki po czasie', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    dochody: [{ czasS: 7200, drewnoH: 5000 }, { czasS: 0, drewnoH: 0 }],
    zastrzyki: [{ czasS: 500, drewno: 10 }, { czasS: 100, drewno: 20 }],
  });
  assert.deepEqual(p.dochody.map(d => d.czasS), [0, 7200]);
  assert.deepEqual(p.zastrzyki.map(z => z.czasS), [100, 500]);
});

test('normalizacja domyka niepodane skladowe dochodu zerem', () => {
  const p = normalizujPlan({ swiat: 'pl231', dochody: [{ czasS: 0, drewnoH: 2000 }] });
  assert.deepEqual(p.dochody[0], { czasS: 0, drewnoH: 2000, glinaH: 0, zelazoH: 0 });
});

test('nieznany swiat to blad planu', () => {
  assert.match(bledyPlanu({ swiat: 'pl999', kroki: [] })[0], /pl999/);
});

test('nieznany budynek to blad planu', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'wiatrak', doPoziomu: 1 }] });
  assert.match(bledyPlanu(p)[0], /wiatrak/);
});

test('poziom ponad maksimum swiata to blad planu', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'warsztat', doPoziomu: 16 }] });
  assert.match(bledyPlanu(p)[0], /Warsztat|warsztat/);
});

test('kroki musza isc po jednym poziomie w gore', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 3 }],
  });
  assert.equal(bledyPlanu(p).length, 1);
  assert.match(bledyPlanu(p)[0], /2/);
});

test('poprawna sciezka rozbudowy nie zglasza bledow', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [
      { budynek: 'tartak', doPoziomu: 1 },
      { budynek: 'cegielnia', doPoziomu: 1 },
      { budynek: 'tartak', doPoziomu: 2 },
    ],
  });
  assert.deepEqual(bledyPlanu(p), []);
});
