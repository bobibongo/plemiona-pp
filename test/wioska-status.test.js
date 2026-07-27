// test/wioska-status.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { zapotrzebowanie } from '../src/wioska/zapotrzebowanie.js';
import { pasekStanuHTML } from '../src/wioska/widok-status.js';

const s = swiat('pl231');
const plan = normalizujPlan({
  swiat: 'pl231',
  start: { surowce: { drewno: 99999, glina: 99999, zelazo: 99999 } },
  kroki: [
    { budynek: 'tartak', doPoziomu: 1 },
    { budynek: 'tartak', doPoziomu: 2 },
    { budynek: 'cegielnia', doPoziomu: 1 },
  ],
});
const wynik = symuluj(plan);
const zap = zapotrzebowanie(plan);

test('bez zaznaczenia pasek pokazuje stan koncowy', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, null);
  assert.match(html, /Tartak/);
  assert.match(html, />2</);
});

test('zaznaczenie pierwszego kroku pokazuje poziomy z tamtej chwili', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, 0);
  assert.match(html, /data-poziom-tartak="1"/);
});

test('zaznaczenie ostatniego kroku pokazuje poziomy koncowe', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, 2);
  assert.match(html, /data-poziom-tartak="2"/);
  assert.match(html, /data-poziom-cegielnia="1"/);
});

test('pasek podaje czas netto i laczny', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, null);
  assert.match(html, /netto/i);
});

test('pasek podaje wymagany dochod na dobe', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const p = normalizujPlan({ swiat: 'pl231', kroki });
  const html = pasekStanuHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.match(html, /dobę/);
});

test('pasek podaje ludnosc zajeta i limit zagrody', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, null);
  assert.match(html, /240/);
});

test('pasek nie zawiera znaku przyblizenia', () => {
  assert.doesNotMatch(pasekStanuHTML(s, plan, wynik, zap, null), /≈/);
});

test('pusty plan nie wywraca paska', () => {
  const p = normalizujPlan({ swiat: 'pl231' });
  const html = pasekStanuHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.ok(html.length > 0);
});

test('wydano pomija krok zatrzymany bledem, tak jak podsumowanie planu', () => {
  // Wieza na poziom 1 kosztuje wiecej niz miesci Spichlerz 1, wiec krok
  // zatrzymuje sie bledem 'ponad-spichlerz' — koszt w wynik.kroki jest
  // zamierzony, ale surowce nigdy nie zeszly z magazynu.
  const p = normalizujPlan({
    swiat: 'pl231',
    start: {
      poziomy: { ratusz: 5, zagroda: 5 },
      surowce: { drewno: 99999, glina: 99999, zelazo: 99999 },
    },
    kroki: [
      { budynek: 'wieza', doPoziomu: 1 },
      { budynek: 'tartak', doPoziomu: 1 },
    ],
  });
  const w = symuluj(p);
  assert.equal(w.kroki[0].blad, 'ponad-spichlerz', 'pierwszy krok ma zawiesc, inaczej test nic nie sprawdza');
  const zapP = zapotrzebowanie(p);
  const zZaznaczeniem = pasekStanuHTML(s, p, w, zapP, 1);
  const bezZaznaczenia = pasekStanuHTML(s, p, w, zapP, null);
  const wydanoZ = zZaznaczeniem.match(/<b>Wydano<\/b>[^<]*/)[0];
  const wydanoBez = bezZaznaczenia.match(/<b>Wydano<\/b>[^<]*/)[0];
  assert.equal(wydanoZ, wydanoBez);
});

test('pasek pokazuje waskie gardlo, gdy plan go ma', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const p = normalizujPlan({ swiat: 'pl231', kroki });
  const zapP = zapotrzebowanie(p);
  assert.ok(zapP.waskieGardlo, 'plan ma miec waskie gardlo, inaczej test nic nie sprawdza');
  assert.match(pasekStanuHTML(s, p, symuluj(p), zapP, null), /Wąskie gardło/);
});

test('pasek ostrzega, gdy na pierwszy krok nie starcza surowcow startowych', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { ratusz: 5, zagroda: 5 }, surowce: { drewno: 10, glina: 10, zelazo: 10 } },
    kroki: [{ budynek: 'wieza', doPoziomu: 1 }],
  });
  const zapP = zapotrzebowanie(p);
  assert.equal(zapP.brakNaStart, true, 'plan ma miec ustawiona flage, inaczej test nic nie sprawdza');
  assert.match(pasekStanuHTML(s, p, symuluj(p), zapP, null), /surowców startowych/);
});
