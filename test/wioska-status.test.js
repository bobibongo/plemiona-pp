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
