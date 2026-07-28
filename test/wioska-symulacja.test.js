// test/wioska-symulacja.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';

const plan = (nadpisz) => normalizujPlan({ swiat: 'pl231', ...nadpisz });

test('pusty plan konczy sie natychmiast', () => {
  const w = symuluj(plan({}));
  assert.equal(w.kroki.length, 0);
  assert.equal(w.podsumowanie.czasS, 0);
});

test('krok oplacalny od reki nie czeka', () => {
  const w = symuluj(plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  assert.equal(w.kroki[0].czekanieS, 0);
  assert.equal(w.kroki[0].startS, 0);
  assert.equal(w.kroki[0].trwanieS, 10);
  assert.equal(w.podsumowanie.czasS, 10);
});

test('koszt schodzi z magazynu', () => {
  const w = symuluj(plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  assert.equal(w.kroki[0].zasobyPo.drewno, 1000 - 50);
  assert.equal(w.kroki[0].zasobyPo.glina, 1000 - 60);
});

test('krok ponad stan magazynu czeka na produkcje i mowi na co czekal', () => {
  const w = symuluj(plan({
    start: { poziomy: { tartak: 5, cegielnia: 5, huta: 5, spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 6 }],
  }));
  assert.ok(w.kroki[0].czekanieS > 0);
  assert.ok(['drewno', 'glina', 'zelazo'].includes(w.kroki[0].czekanieNa));
});

test('rozbudowa Ratusza skraca kolejne budowy', () => {
  const bez = symuluj(plan({
    start: { poziomy: { ratusz: 5 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 10 }],
  }));
  const po = symuluj(plan({
    start: { poziomy: { ratusz: 10 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 10 }],
  }));
  assert.ok(po.kroki[0].trwanieS < bez.kroki[0].trwanieS);
});

test('zastrzyk przypiety do startu planu (kotwica null) dziala od pierwszego kroku', () => {
  const bez = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ kotwica: null, sumaD: 30, zrodlo: 'farma' }],
  }));
  const z = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ kotwica: null, sumaD: 30, zrodlo: 'farma' }],
    zastrzyki: [{ kotwica: null, drewno: 500, glina: 500, zelazo: 500 }],
  }));
  assert.ok(z.kroki[0].startS < bez.kroki[0].startS);
  assert.equal(z.podsumowanie.zZastrzykow.drewno, 500);
});

test('zastrzyk przypiety do drugiego kroku nie dziala jeszcze podczas pierwszego', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 60, glina: 60, zelazo: 40 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    zastrzyki: [{ kotwica: { budynek: 'tartak', doPoziomu: 1 }, drewno: 999999, glina: 999999, zelazo: 999999 }],
  }));
  // Pierwszy krok placi od reki, nie z zastrzyku (ktory dziala dopiero PO nim).
  assert.equal(w.kroki[0].zasobyPo.drewno, 60 - 50);
  // Drugi krok korzysta juz z zastrzyku.
  assert.ok(w.kroki[1].zasobyPo.drewno > 1000);
});

test('dochod zmienia sie miedzy krokami wedlug kotwicy, nie polowy trwania kroku', () => {
  const wolno = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    dochody: [{ kotwica: null, sumaD: 30, zrodlo: 'farma' }],
  }));
  const szybciej = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    dochody: [
      { kotwica: null, sumaD: 30, zrodlo: 'farma' },
      { kotwica: { budynek: 'tartak', doPoziomu: 1 }, sumaD: 15000, zrodlo: 'farma' },
    ],
  }));
  assert.ok(szybciej.kroki[1].czekanieS < wolno.kroki[1].czekanieS);
});

test('nadwyzka ponad pojemnosc spichlerza przepada i jest raportowana', () => {
  const w = symuluj(plan({
    start: {
      poziomy: { spichlerz: 1, tartak: 20, cegielnia: 20, huta: 20, ratusz: 5, koszary: 1, zagroda: 20 },
      surowce: { drewno: 1000, glina: 1000, zelazo: 0 },
    },
    kroki: [{ budynek: 'kuznia', doPoziomu: 1 }],
  }));
  assert.ok(w.podsumowanie.zmarnowane.drewno > 0);
  assert.ok(w.ostrzezenia.some(o => o.typ === 'przepelnienie'));
});

test('krok drozszy niz spichlerz to blad twardy', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 1, ratusz: 5, zagroda: 5 } },
    kroki: [{ budynek: 'wieza', doPoziomu: 1 }],
  }));
  assert.equal(w.kroki[0].blad, 'ponad-spichlerz');
  assert.ok(w.ostrzezenia.some(o => o.typ === 'ponad-spichlerz'));
});

test('przekroczenie zagrody zatrzymuje krok', () => {
  const w = symuluj(plan({
    start: { poziomy: { zagroda: 5, ratusz: 5, spichlerz: 25 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'wieza', doPoziomu: 1 }],
  }));
  assert.equal(w.kroki[0].blad, 'ponad-zagrode');
});

test('niespelnione wymaganie zatrzymuje krok', () => {
  const w = symuluj(plan({ kroki: [{ budynek: 'koszary', doPoziomu: 1 }] }));
  assert.equal(w.kroki[0].blad, 'wymagania');
  assert.ok(w.ostrzezenia.some(o => o.typ === 'wymagania' && /Ratusz|ratusz/.test(o.tekst)));
});

test('podsumowanie sumuje koszt wszystkich krokow', () => {
  const w = symuluj(plan({
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
  }));
  assert.equal(w.podsumowanie.koszt.drewno, 50 + 65);
  assert.equal(w.podsumowanie.koszt.zelazo, 40 + 40);
});

test('podsumowanie liczy czas pochodzacy z poziomow bez pomiaru', () => {
  const w = symuluj(plan({
    start: { poziomy: { tartak: 4 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 5 }],
  }));
  assert.equal(w.kroki[0].pewny, false);
  assert.equal(w.podsumowanie.czasNiepewnyS, w.kroki[0].trwanieS);
});

test('kotwica wskazujaca nieistniejacy krok dziala jak start planu', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ kotwica: { budynek: 'cegielnia', doPoziomu: 9 }, sumaD: 15000000, zrodlo: 'farma' }],
  }));
  assert.ok(w.kroki[0].startS < 100);
});

test('dwa wpisy dochodu na tym samym kroku — wygrywa ostatni w tablicy', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    dochody: [
      { kotwica: { budynek: 'tartak', doPoziomu: 1 }, sumaD: 30, zrodlo: 'farma' },
      { kotwica: { budynek: 'tartak', doPoziomu: 1 }, sumaD: 15000000, zrodlo: 'farma' },
    ],
  }));
  assert.ok(w.kroki[1].czekanieS < 100);
});

test('dwie dosylki na tym samym kroku sumuja sie obie', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    zastrzyki: [
      { kotwica: { budynek: 'tartak', doPoziomu: 1 }, drewno: 100, glina: 0, zelazo: 0 },
      { kotwica: { budynek: 'tartak', doPoziomu: 1 }, drewno: 100, glina: 0, zelazo: 0 },
    ],
  }));
  assert.equal(w.podsumowanie.zZastrzykow.drewno, 200);
});

test('farma i zbieractwo sa niezaleznymi aktywnymi strumieniami i sumuja sie', () => {
  const kroki = [{ budynek: 'tartak', doPoziomu: 1 }];
  const wspolne = { start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } }, kroki };
  const jedno = symuluj(plan({ ...wspolne, dochody: [{ kotwica: null, sumaD: 3000, zrodlo: 'zbieractwo' }] }));
  const oba = symuluj(plan({ ...wspolne, dochody: [
    { kotwica: null, sumaD: 9000, zrodlo: 'farma' },
    { kotwica: null, sumaD: 3000, zrodlo: 'zbieractwo' },
  ] }));
  assert.ok(oba.kroki[0].czekanieS < jedno.kroki[0].czekanieS);
});