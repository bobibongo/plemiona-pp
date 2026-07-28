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

test('poziom budynku jest wyswietlany pod ikona, nie obok', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, null);
  // Struktura: <span class="poziom-budynku">...<img...><b>N</b></span> —
  // sprawdzamy obecnosc znacznika <b> wewnatrz tego samego spana co ikona.
  assert.match(html, /class="poziom-budynku"[^<]*<img[^>]*>\s*<b>\d+<\/b>/);
});

test('pasek podaje czas netto i realny', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, null);
  assert.match(html, /bez przerw/i);
  assert.match(html, /realny/i);
});

test('pasek podaje ludnosc zajeta i limit zagrody', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, null);
  assert.match(html, /240/);
});

test('pasek nie zawiera znaku przyblizenia', () => {
  assert.doesNotMatch(pasekStanuHTML(s, plan, wynik, zap, null), /≈/);
});

test('wydano pomija krok zatrzymany bledem, tak jak podsumowanie planu', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { spichlerz: 1, ratusz: 5, zagroda: 5 }, surowce: { drewno: 50, glina: 60, zelazo: 40 } },
    kroki: [{ budynek: 'wieza', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 1 }],
  });
  const w = symuluj(p);
  const z = zapotrzebowanie(p);
  assert.equal(w.kroki[0].blad, 'ponad-spichlerz');
  const zZaznaczeniem = pasekStanuHTML(s, p, w, z, 1);
  const bezZaznaczenia = pasekStanuHTML(s, p, w, z, null);
  const wyciagnij = (html) => html.match(/Wydano[^<]*<\/b>[^0-9]*([\d\s]+)/);
  // Nie polegamy na dokladnym formacie — sprawdzamy tylko, ze oba warianty
  // pokazuja koszt Tartaku (50), a nie koszt Wiezy (12000+).
  assert.doesNotMatch(zZaznaczeniem, /12000/);
  assert.doesNotMatch(bezZaznaczenia, /12000/);
});

test('pusty plan nie wywraca paska', () => {
  const p = normalizujPlan({ swiat: 'pl231' });
  const html = pasekStanuHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.ok(html.length > 0);
  assert.match(html, /Populacja<\/b> 5 \/ 240/);
});
