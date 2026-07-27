// test/wioska-widoki.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { esc, wierszBudynkuHTML } from '../src/wioska/widok-budynki.js';
import { krokHTML, wtracenieHTML } from '../src/wioska/widok-kolejka.js';

const s = swiat('pl231');

test('esc ucieka znaki, ktore zepsulyby HTML', () => {
  assert.equal(esc('<b>&"'), '&lt;b&gt;&amp;&quot;');
});

test('wiersz budynku pokazuje ikone, nazwe i koszt nastepnego poziomu', () => {
  const html = wierszBudynkuHTML(s, 'tartak', { ratusz: 1, tartak: 0 }, 1);
  assert.match(html, /Tartak/);
  assert.match(html, /wood\.webp|data:image/);
  assert.match(html, /50/);
  assert.match(html, />60</);
});

test('wiersz budynku nigdy nie zawiera znaku przyblizenia', () => {
  const html = wierszBudynkuHTML(s, 'tartak', { ratusz: 1, tartak: 4 }, 1);
  assert.doesNotMatch(html, /≈/);
});

test('wiersz budynku z niespelnionym wymaganiem jest zablokowany z powodem', () => {
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

test('kafelek kroku nie pokazuje juz czasu', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  const html = krokHTML(w.kroki[0], 0, false);
  assert.match(html, /Tartak/);
  assert.doesNotMatch(html, /\d+\s*(s|min|h)\b/);
});

test('kafelek kroku niesie indeks, na ktorym opiera sie przeciaganie', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  assert.match(krokHTML(w.kroki[0], 0, false), /data-krok="0"/);
});

test('zaznaczony kafelek dostaje wlasna klase', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  assert.doesNotMatch(krokHTML(w.kroki[0], 0, false), /zaznaczony/);
  assert.match(krokHTML(w.kroki[0], 0, true), /zaznaczony/);
});

test('kafelek z bledem dostaje klase blad', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'koszary', doPoziomu: 1 }] }));
  assert.match(krokHTML(w.kroki[0], 0, false), /class="[^"]*blad/);
});

test('wiersz budynku niesie identyfikator do wpiecia zdarzenia', () => {
  const html = wierszBudynkuHTML(s, 'tartak', { ratusz: 1, tartak: 0 }, 1);
  assert.match(html, /data-dodaj="tartak"/);
});

test('kafelek kroku z przestojem mowi, na ktory surowiec czeka', () => {
  const w = symuluj(normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoD: 1440, glinaD: 1440, zelazoD: 1440 }],
  }));
  assert.ok(w.kroki[0].czekanieS > 0, 'krok ma czekac, inaczej test nic nie sprawdza');
  assert.match(krokHTML(w.kroki[0], 0, false), /czekanie/);
});

test('wtracenie dochodu podaje moment i wartosci na dobe', () => {
  const html = wtracenieHTML('dochod', { czasS: 172800, drewnoD: 2000, glinaD: 1000, zelazoD: 0 });
  assert.match(html, /2 d/);
  assert.match(html, /2000/);
  assert.match(html, /dobę/);
});

test('wtracenie dosylki podaje moment i ilosci', () => {
  const html = wtracenieHTML('dosylka', { czasS: 86400, drewno: 5000, glina: 5000, zelazo: 5000 });
  assert.match(html, /1 d/);
  assert.match(html, /5000/);
});

test('wtracenie w srodku kolejki niesie indeks kroku, przed ktorym stoi', () => {
  const html = wtracenieHTML('dosylka', { czasS: 86400, drewno: 5000, glina: 5000, zelazo: 5000 }, 3);
  assert.match(html, /data-przed-krokiem="3"/);
});

test('wtracenie na koncu kolejki nie niesie indeksu, bo koniec listy jest poprawnym celem', () => {
  const html = wtracenieHTML('dochod', { czasS: 86400, drewnoD: 1, glinaD: 1, zelazoD: 1 });
  assert.doesNotMatch(html, /data-przed-krokiem/);
});
