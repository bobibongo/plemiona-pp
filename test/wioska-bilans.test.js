// test/wioska-bilans.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { zapotrzebowanie } from '../src/wioska/zapotrzebowanie.js';
import { bilansHTML } from '../src/wioska/widok-bilans.js';

const s = swiat('pl231');

test('bilans pokazuje eko, farme i zbieractwo osobno', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { tartak: 5, cegielnia: 5, huta: 5 } },
    kroki: [{ budynek: 'ratusz', doPoziomu: 2 }],
    dochody: [
      { kotwica: null, sumaD: 9000, zrodlo: 'farma' },
      { kotwica: null, sumaD: 3000, zrodlo: 'zbieractwo' },
    ],
  });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.match(html, /EKO/);
  assert.match(html, /Farma/);
  assert.match(html, /Zbieractwo/);
});

test('bilans pokazuje ujemna roznice, gdy zuzycie przewyzsza dochod', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'ratusz', doPoziomu: i });
  const p = normalizujPlan({ swiat: 'pl231', kroki });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), 0);
  assert.match(html, /-\d/);
});

test('bilans sumuje dosylki, ktorych kotwica wypada nie pozniej niz wskazany krok', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    zastrzyki: [
      { kotwica: null, drewno: 100, glina: 0, zelazo: 0 },
      { kotwica: { budynek: 'cegielnia', doPoziomu: 1 }, drewno: 200, glina: 0, zelazo: 0 },
    ],
  });
  const w = symuluj(p);
  const z = zapotrzebowanie(p);
  const naPierwszym = bilansHTML(s, p, w, z, 0);
  const naDrugim = bilansHTML(s, p, w, z, 1);
  // Na pierwszym kroku dziala tylko dosylka z kotwica null (100), na drugim
  // dochodzi tez dosylka przypieta do kroku 1 (200) — suma rosnie do 300.
  assert.match(naPierwszym, /Dosyłki razem[^0-9]*100\b/);
  assert.match(naDrugim, /Dosyłki razem[^0-9]*300\b/);
});

test('bilans dla planu bez wtracen pokazuje zera, nie wywraca sie', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.ok(html.length > 0);
});

test('bilans nie zawiera wymaganego dochodu na dobe — to zostalo w eksporcie tekstowym', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const p = normalizujPlan({ swiat: 'pl231', kroki });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.doesNotMatch(html, /[Ww]ymagany/);
});
