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

test('dochod ma kotwice, sume dobowa i zrodlo', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ kotwica: { budynek: 'tartak', doPoziomu: 1 }, sumaD: 15000, zrodlo: 'zbieractwo' }],
  });
  assert.deepEqual(p.dochody[0], {
    kotwica: { budynek: 'tartak', doPoziomu: 1 }, sumaD: 15000, zrodlo: 'zbieractwo',
  });
});

test('dochod bez zrodla trafia do farmy', () => {
  const p = normalizujPlan({ swiat: 'pl231', dochody: [{ kotwica: null, sumaD: 300 }] });
  assert.equal(p.dochody[0].zrodlo, 'farma');
});

test('stary trojpolowy dochod sumuje sie do jednej wartosci dobowej', () => {
  const p = normalizujPlan({ swiat: 'pl231', dochody: [{ czasS: 0, drewnoD: 100, glinaD: 200, zelazoD: 300 }] });
  assert.equal(p.dochody[0].sumaD, 600);
});

test('stary zapis godzinowy zachowuje laczna wartosc dobowa', () => {
  const p = normalizujPlan({ swiat: 'pl231', dochody: [{ czasS: 0, drewnoH: 100, glinaH: 50 }] });
  assert.equal(p.dochody[0].sumaD, 3600);
});

test('zastrzyk ma kotwice zamiast czasu', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'ratusz', doPoziomu: 2 }],
    zastrzyki: [{ kotwica: { budynek: 'ratusz', doPoziomu: 2 }, drewno: 1000, glina: 500, zelazo: 0 }],
  });
  assert.deepEqual(p.zastrzyki[0].kotwica, { budynek: 'ratusz', doPoziomu: 2 });
});

test('stary czas przypina wpis do pierwszego kroku startujacego nie wczesniej', () => {
  const kroki = [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 2 }, { budynek: 'tartak', doPoziomu: 3 }];
  const p = normalizujPlan({ swiat: 'pl231', kroki, dochody: [{ czasS: 15, drewnoD: 100 }] });
  assert.deepEqual(p.dochody[0].kotwica, { budynek: 'tartak', doPoziomu: 3 });
});

test('czas na starcie planu dostaje kotwice null', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }], dochody: [{ czasS: 0, drewnoD: 100 }] });
  assert.equal(p.dochody[0].kotwica, null);
});

test('czas po koncu osi przypina wpis do ostatniego kroku', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }], dochody: [{ czasS: 999999, drewnoD: 100 }] });
  assert.deepEqual(p.dochody[0].kotwica, { budynek: 'tartak', doPoziomu: 1 });
});

test('wtracenie w planie bez krokow dostaje kotwice null', () => {
  const p = normalizujPlan({ swiat: 'pl231', dochody: [{ czasS: 500, drewnoD: 100 }] });
  assert.equal(p.dochody[0].kotwica, null);
});

test('wiszaca kotwica jest normalizowana do startu planu', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }], dochody: [{ kotwica: { budynek: 'huta', doPoziomu: 9 }, sumaD: 10 }] });
  assert.equal(p.dochody[0].kotwica, null);
});

test('normalizacja jest idempotentna dla nowego formatu', () => {
  const a = normalizujPlan({
    swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ kotwica: { budynek: 'tartak', doPoziomu: 1 }, sumaD: 900, zrodlo: 'farma' }],
    zastrzyki: [{ kotwica: null, drewno: 10, glina: 20, zelazo: 30 }],
  });
  assert.deepEqual(a, normalizujPlan(JSON.parse(JSON.stringify(a))));
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

test('PLAN_PUSTY jest zamrozony i nie da sie go po cichu zepsuc', () => {
  assert.throws(() => { PLAN_PUSTY.kroki.push({ budynek: 'tartak', doPoziomu: 1 }); }, TypeError);
  assert.throws(() => { PLAN_PUSTY.start.surowce.drewno = 42; }, TypeError);
});

test('normalizacja PLAN_PUSTY daje kopie, ktora wolno modyfikowac', () => {
  const kopia = normalizujPlan(PLAN_PUSTY);
  kopia.kroki.push({ budynek: 'tartak', doPoziomu: 1 });
  assert.equal(kopia.kroki.length, 1);
  assert.equal(PLAN_PUSTY.kroki.length, 0);
});

test('plan w calosci starego formatu migruje sie do nowego bez utraty wtracen', () => {
  const kroki = [
    { budynek: 'tartak', doPoziomu: 1 },
    { budynek: 'tartak', doPoziomu: 2 },
    { budynek: 'cegielnia', doPoziomu: 1 },
  ];
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki,
    dochody: [
      { czasS: 0, drewnoD: 100, glinaD: 100, zelazoD: 100 },
      { czasS: 50, drewnoD: 5000, glinaD: 5000, zelazoD: 5000 },
    ],
    zastrzyki: [{ czasS: 5, drewno: 200, glina: 0, zelazo: 0 }],
  });
  assert.equal(p.dochody.length, 2);
  assert.equal(p.zastrzyki.length, 1);
  assert.equal(p.dochody[0].sumaD, 300);
  assert.equal(p.dochody[1].sumaD, 15000);
  for (const d of p.dochody) assert.equal(d.czasS, undefined);
  for (const d of p.dochody) assert.equal(d.drewnoD, undefined);
});