// test/wioska-strona.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { wierszBudynkuHTML, krokHTML, podsumowanieHTML } from '../src/wioska/strona.js';

const s = swiat('pl231');

test('wiersz budynku pokazuje koszt nastepnego poziomu', () => {
  const html = wierszBudynkuHTML(s, 'tartak', { ratusz: 1, tartak: 0 }, 1);
  assert.match(html, /Tartak/);
  assert.match(html, /50/);
  assert.match(html, />60</);
});

test('wiersz budynku z niespelnionym wymaganiem jest zablokowany z podanym powodem', () => {
  const html = wierszBudynkuHTML(s, 'koszary', { ratusz: 1 }, 1);
  assert.match(html, /zablokowany/);
  assert.match(html, /Ratusz 3/);
  assert.match(html, /disabled/);
});

test('budynek na maksymalnym poziomie nie ma przycisku rozbudowy', () => {
  const html = wierszBudynkuHTML(s, 'plac', { plac: 1, ratusz: 1 }, 1);
  assert.match(html, /rozbudowany/);
  assert.doesNotMatch(html, /data-dodaj/);
});

test('wiersz budynku niesie identyfikator do wpiecia zdarzenia', () => {
  const html = wierszBudynkuHTML(s, 'tartak', { ratusz: 1, tartak: 0 }, 1);
  assert.match(html, /data-dodaj="tartak"/);
});

test('krok z przestojem pokazuje, na co czekal', () => {
  const w = symuluj(normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoH: 60, glinaH: 60, zelazoH: 60 }],
  }));
  assert.match(krokHTML(w.kroki[0], 0), /czeka/);
});

test('krok z bledem dostaje klase blad', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'koszary', doPoziomu: 1 }] }));
  assert.match(krokHTML(w.kroki[0], 0), /class="[^"]*blad/);
});

test('krok z poziomu bez pomiaru jest oznaczony', () => {
  const w = symuluj(normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { tartak: 4 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 5 }],
  }));
  assert.match(krokHTML(w.kroki[0], 0), /niepewny/);
});

test('krok niesie pozycje w kolejce, na ktorej opiera sie przeciaganie', () => {
  const w = symuluj(normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
  }));
  assert.match(krokHTML(w.kroki[0], 0), /data-krok="0"/);
  assert.match(krokHTML(w.kroki[1], 1), /data-krok="1"/);
});

test('podsumowanie podaje laczny czas i sumy surowcow', () => {
  const w = symuluj(normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
  }));
  const html = podsumowanieHTML(w);
  assert.match(html, /Łączny czas/);
  assert.match(html, /115/);
});
