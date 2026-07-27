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

test('zastrzyk skraca oczekiwanie', () => {
  const bez = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoH: 10, glinaH: 10, zelazoH: 10 }],
  }));
  const z = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoH: 10, glinaH: 10, zelazoH: 10 }],
    zastrzyki: [{ czasS: 60, drewno: 500, glina: 500, zelazo: 500 }],
  }));
  assert.ok(z.kroki[0].startS < bez.kroki[0].startS);
  assert.equal(z.podsumowanie.zZastrzykow.drewno, 500);
});

test('zmiana dochodu w trakcie oczekiwania przyspiesza zbieranie', () => {
  const wolno = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoH: 10, glinaH: 10, zelazoH: 10 }],
  }));
  const szybciej = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [
      { czasS: 0, drewnoH: 10, glinaH: 10, zelazoH: 10 },
      { czasS: 600, drewnoH: 5000, glinaH: 5000, zelazoH: 5000 },
    ],
  }));
  assert.ok(szybciej.kroki[0].startS < wolno.kroki[0].startS);
});

// Magazyn stoi pod sufitem (Spichlerz 1 = 1000), kopalnie sypia po 530/h,
// a krok czeka na zelazo — wiec drewno i glina przelewaja sie przez ten czas.
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

// Wymagania Wiezy sa spelnione, wiec zatrzymac ja moze dopiero pojemnosc.
test('krok drozszy niz spichlerz to blad twardy', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 1, ratusz: 5, zagroda: 5 } },
    kroki: [{ budynek: 'wieza', doPoziomu: 1 }],
  }));
  assert.equal(w.kroki[0].blad, 'ponad-spichlerz');
  assert.ok(w.ostrzezenia.some(o => o.typ === 'ponad-spichlerz'));
});

// Spichlerz 25 miesci koszt Wiezy, wiec zostaje sama Zagroda: 500 ludnosci
// przy limicie 452 z poziomu 5.
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

test('dlugi przestoj daje ostrzezenie', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoH: 1, glinaH: 1, zelazoH: 1 }],
  }));
  assert.ok(w.ostrzezenia.some(o => o.typ === 'przestoj'));
});

// Pulapka: stawka produkcji w fazie budowy liczona raz na starcie kroku,
// zamiast przeliczana po kazdym zdarzeniu dochodu w oknie budowy — zmiana
// dochodu w polowie dlugiej budowy byla po cichu ignorowana.
test('zmiana dochodu w trakcie trwania budowy zwieksza zebrane zasoby', () => {
  const zBudowa = (dochody) => plan({
    start: {
      poziomy: { tartak: 14, ratusz: 1, spichlerz: 20 },
      surowce: { drewno: 2000, glina: 3000, zelazo: 2000 },
    },
    kroki: [{ budynek: 'tartak', doPoziomu: 15 }],
    dochody,
  });
  const bez = symuluj(zBudowa([{ czasS: 0, drewnoH: 100, glinaH: 100, zelazoH: 100 }]));
  const z = symuluj(zBudowa([
    { czasS: 0, drewnoH: 100, glinaH: 100, zelazoH: 100 },
    { czasS: 6000, drewnoH: 5000, glinaH: 5000, zelazoH: 5000 },
  ]));
  // Krok jest oplacalny od reki w obu wariantach — cala roznica w zasobyPo
  // musi pochodzic z przeliczenia stawki w trakcie budowy, nie z czekania.
  assert.equal(bez.kroki[0].czekanieS, 0);
  assert.equal(z.kroki[0].czekanieS, 0);
  assert.ok(z.kroki[0].zasobyPo.glina > bez.kroki[0].zasobyPo.glina + 1000);
});

// Pulapka: ostrzezenie o przepelnieniu sprawdzane bylo przed faza budowy, wiec
// przelanie magazynu wylacznie podczas budowy (bez zadnego oczekiwania) nigdy
// nie generowalo ostrzezenia, mimo ze podsumowanie.zmarnowane bylo niezerowe.
test('przelanie magazynu wylacznie w trakcie budowy tez daje ostrzezenie o przepelnieniu', () => {
  const w = symuluj(plan({
    start: {
      poziomy: { ratusz: 3, spichlerz: 1, tartak: 20, cegielnia: 20, huta: 20, zagroda: 10 },
      surowce: { drewno: 1000, glina: 1000, zelazo: 1000 },
    },
    kroki: [{ budynek: 'koszary', doPoziomu: 6 }],
  }));
  assert.equal(w.kroki[0].czekanieS, 0);
  assert.ok(w.podsumowanie.zmarnowane.zelazo > 0);
  assert.ok(w.ostrzezenia.some(o => o.typ === 'przepelnienie'));
});
