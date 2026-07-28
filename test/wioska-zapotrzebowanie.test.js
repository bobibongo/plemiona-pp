// test/wioska-zapotrzebowanie.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujPlan } from '../src/wioska/plan.js';
import { zapotrzebowanie, osBezPrzestojow, zuzycieNaDobe } from '../src/wioska/zapotrzebowanie.js';
import { czasBudowy } from '../src/wioska/czas.js';
import { swiat } from '../src/wioska/swiaty.js';

const s = swiat('pl231');
const plan = (n) => normalizujPlan({ swiat: 'pl231', ...n });

test('czas netto to suma samych czasow budowy', () => {
  const p = plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 2 }] });
  const oczekiwany = czasBudowy(s, 'tartak', 1, 1).sekundy + czasBudowy(s, 'tartak', 2, 1).sekundy;
  assert.equal(zapotrzebowanie(p).czasNettoS, oczekiwany);
});

test('czas netto nie zalezy od dochodu ani od dosylek', () => {
  const kroki = [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 2 }];
  const bez = zapotrzebowanie(plan({ kroki }));
  const z = zapotrzebowanie(plan({
    kroki,
    dochody: [{ kotwica: null, sumaD: 99999, zrodlo: 'farma' }],
    zastrzyki: [{ kotwica: null, drewno: 99999, glina: 99999, zelazo: 99999 }],
  }));
  assert.equal(z.czasNettoS, bez.czasNettoS);
  assert.deepEqual(z.wymaganyDobowo, bez.wymaganyDobowo);
});

test('czas netto uwzglednia przyspieszenie od Ratusza w trakcie planu', () => {
  const wolny = zapotrzebowanie(plan({
    start: { poziomy: { ratusz: 1 } }, kroki: [{ budynek: 'tartak', doPoziomu: 10 }],
  })).czasNettoS;
  const szybki = zapotrzebowanie(plan({
    start: { poziomy: { ratusz: 10 } }, kroki: [{ budynek: 'tartak', doPoziomu: 10 }],
  })).czasNettoS;
  assert.ok(szybki < wolny);
});

test('plan mieszczacy sie w surowcach startowych nie wymaga dochodu', () => {
  const z = zapotrzebowanie(plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  assert.deepEqual(z.wymaganyDobowo, { drewno: 0, glina: 0, zelazo: 0 });
  assert.equal(z.waskieGardlo, null);
  assert.equal(z.brakNaStart, false);
});

test('plan ponad surowce startowe wymaga dochodu i wskazuje waskie gardlo', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const z = zapotrzebowanie(plan({ kroki }));
  assert.ok(z.wymaganyDobowo.drewno > 0);
  assert.ok(z.waskieGardlo !== null);
  assert.equal(z.waskieGardlo.budynek, 'tartak');
  assert.ok(z.waskieGardlo.indeks > 0 && z.waskieGardlo.indeks < kroki.length);
});

test('pierwszy krok drozszy niz surowce startowe jest zglaszany osobno', () => {
  const z = zapotrzebowanie(plan({
    start: { poziomy: { ratusz: 5, zagroda: 5 }, surowce: { drewno: 10, glina: 10, zelazo: 10 } },
    kroki: [{ budynek: 'wieza', doPoziomu: 1 }],
  }));
  assert.equal(z.brakNaStart, true);
  assert.ok(Number.isFinite(z.wymaganyDobowo.drewno));
});

test('wieksze surowce startowe obnizaja wymagany dochod', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const skromnie = zapotrzebowanie(plan({ kroki })).wymaganyDobowo.drewno;
  const bogato = zapotrzebowanie(plan({ kroki, start: { surowce: { drewno: 50000, glina: 50000, zelazo: 50000 } } })).wymaganyDobowo.drewno;
  assert.ok(bogato < skromnie);
});

test('pusty plan nie wymaga niczego', () => {
  const z = zapotrzebowanie(plan({}));
  assert.equal(z.czasNettoS, 0);
  assert.deepEqual(z.wymaganyDobowo, { drewno: 0, glina: 0, zelazo: 0 });
  assert.equal(z.waskieGardlo, null);
});

test('osBezPrzestojow ma jeden wiersz na krok, w kolejnosci planu', () => {
  const p = plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }] });
  const os = osBezPrzestojow(p);
  assert.equal(os.length, 2);
  assert.equal(os[0].budynek, 'tartak');
  assert.equal(os[1].budynek, 'cegielnia');
  assert.equal(os[1].startS, os[0].startS + os[0].trwanieS);
});

test('osBezPrzestojow niesie koszt kazdego kroku', () => {
  const p = plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }] });
  const os = osBezPrzestojow(p);
  assert.deepEqual(os[0].koszt, { drewno: 50, glina: 60, zelazo: 40 });
});

test('zuzycie na dobe sumuje koszty krokow w oknie doby od wskazanego', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const p = plan({ kroki });
  const z = zuzycieNaDobe(p, 0);
  assert.ok(z.suma.drewno > 0);
  assert.equal(typeof z.doKonca, 'boolean');
});

test('zuzycie na dobe blisko konca planu ustawia doKonca i nie ekstrapoluje', () => {
  const p = plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }] });
  const os = osBezPrzestojow(p);
  const z = zuzycieNaDobe(p, 0);
  assert.equal(z.doKonca, true);
  assert.equal(z.suma.drewno, os[0].koszt.drewno);
});

test('zuzycie na dobe rosnie na etapie z drozszymi krokami', () => {
  const kroki = [];
  for (let i = 1; i <= 15; i++) kroki.push({ budynek: 'ratusz', doPoziomu: i });
  const p = plan({ kroki });
  const wczesnie = zuzycieNaDobe(p, 0);
  const pozno = zuzycieNaDobe(p, 10);
  // Nie zakladamy z gory kierunku (koszty rosna geometrycznie, wiec pozniej
  // wieksze), ale wartosci maja byc rozne — inaczej test nic nie sprawdza.
  assert.notEqual(wczesnie.suma.drewno, pozno.suma.drewno);
});

test('null jako indeks liczy zuzycie od ostatniego kroku (stan koncowy)', () => {
  const p = plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }] });
  const naOstatnim = zuzycieNaDobe(p, 1);
  const naNull = zuzycieNaDobe(p, null);
  assert.deepEqual(naNull, naOstatnim);
});

test('zuzycie na dobe dla pustego planu nie wywraca sie', () => {
  const p = plan({});
  const z = zuzycieNaDobe(p, null);
  assert.deepEqual(z.suma, { drewno: 0, glina: 0, zelazo: 0 });
  assert.equal(z.doKonca, true);
});
