// test/wioska-wykres.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { punktyWioski } from '../src/wioska/punkty.js';
import { punktyWDniach, wykresHTML } from '../src/wioska/widok-wykres.js';

function zbuduj(kroki, poziomyStart = {}) {
  const plan = normalizujPlan({ swiat: 'pl231', kroki });
  Object.assign(plan.start.poziomy, poziomyStart);
  return { plan, wynik: symuluj(plan) };
}

test('plan bez krokow nie ma zadnego punktu na wykresie', () => {
  const { plan, wynik } = zbuduj([]);
  assert.deepEqual(punktyWDniach(plan, wynik), []);
});

test('plan mieszczacy sie w jednym dniu daje jeden punkt z suma koncowych punktow', () => {
  const { plan, wynik } = zbuduj([{ budynek: 'tartak', doPoziomu: 1 }]);
  const seria = punktyWDniach(plan, wynik);
  assert.equal(seria.length, 1);
  assert.equal(seria[0].indeksKroku, 0);
  assert.equal(seria[0].punkty, punktyWioski(wynik.kroki[0].poziomyPo));
});

test('krok zatrzymany bledem niesie punkty sprzed proby jego budowy', () => {
  const { plan, wynik } = zbuduj([
    { budynek: 'ratusz', doPoziomu: 2 },
    { budynek: 'palac', doPoziomu: 1 },
  ]);
  assert.equal(wynik.kroki[1].blad, 'wymagania');
  const seria = punktyWDniach(plan, wynik);
  assert.equal(seria[seria.length - 1].punkty, punktyWioski(wynik.kroki[0].poziomyPo));
});

test('wykres pustego planu pokazuje komunikat zamiast svg', () => {
  const { plan, wynik } = zbuduj([]);
  const html = wykresHTML(plan, wynik, null);
  assert.doesNotMatch(html, /<svg/);
});

test('wykres niepustego planu zawiera svg z tyloma slupkami ile dni', () => {
  const { plan, wynik } = zbuduj([{ budynek: 'tartak', doPoziomu: 1 }]);
  const html = wykresHTML(plan, wynik, null);
  assert.match(html, /<svg/);
  assert.equal((html.match(/wykres-slupek/g) ?? []).length, 1);
});

test('slupek odpowiadajacy zaznaczonemu krokowi dostaje klase aktywna', () => {
  const { plan, wynik } = zbuduj([{ budynek: 'tartak', doPoziomu: 1 }]);
  const html = wykresHTML(plan, wynik, 0);
  assert.match(html, /wykres-slupek aktywna/);
});

test('kazdy slupek niesie indeks kroku do zaznaczenia po kliknieciu', () => {
  const { plan, wynik } = zbuduj([{ budynek: 'tartak', doPoziomu: 1 }]);
  const html = wykresHTML(plan, wynik, null);
  assert.match(html, /data-dzien-krok="0"/);
});

test('kazdy slupek pokazuje numer dnia od jednego', () => {
  const { plan, wynik } = zbuduj([{ budynek: 'ratusz', doPoziomu: 30 }, { budynek: 'tartak', doPoziomu: 1 }]);
  const html = wykresHTML(plan, wynik, null);
  const seria = punktyWDniach(plan, wynik);
  for (let i = 0; i < seria.length; i++) assert.match(html, new RegExp(`>${i + 1}</text>`));
});
