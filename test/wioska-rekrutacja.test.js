// test/wioska-rekrutacja.test.js
// Model rekrutacji odwzorowujacy Menedzera Konta: kolejka wypelnia sie
// paczkami (50 piechoty / 20 kawalerii / 10 machin), a kolejnosc paczek
// wyrownuje proporcje do celu, wliczajac to, co juz stoi w wiosce.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujPlan } from '../src/wioska/plan.js';
import { swiat } from '../src/wioska/swiaty.js';
import { ROZMIAR_PACZKI, rozmiarPaczki, kolejnoscPaczek } from '../src/wioska/rekrutacja.js';
import { osRekrutacjiBezPrzestojow, wojskoNaCzas } from '../src/wioska/zapotrzebowanie.js';
import { czasRekrutacji } from '../src/wioska/jednostki.js';

const s = swiat('pl231');

test('rozmiar paczki zalezy od rodzaju jednostki', () => {
  assert.equal(rozmiarPaczki(s, 'pikinier'), 50, 'piechota po 50');
  assert.equal(rozmiarPaczki(s, 'lucznik'), 50);
  assert.equal(rozmiarPaczki(s, 'zwiadowca'), 20, 'kawaleria po 20');
  assert.equal(rozmiarPaczki(s, 'ciezka'), 20);
  assert.equal(rozmiarPaczki(s, 'lekka'), 20);
  assert.equal(rozmiarPaczki(s, 'taran'), 10, 'machiny po 10');
  assert.equal(rozmiarPaczki(s, 'katapulta'), 10);
});

test('paczki wyrownuja proporcje: brakujaca jednostka idzie pierwsza', () => {
  // Cel 5000 pik + 5000 luk, ale 1000 pik juz stoi. Najpierw same luki,
  // az dogonia pikinierow.
  const paczki = kolejnoscPaczek(s, { pikinier: 5000, lucznik: 5000 }, { pikinier: 1000 });
  const pierwsze20 = paczki.slice(0, 20);
  assert.ok(pierwsze20.every(p => p.jednostka === 'lucznik'),
    `pierwsze paczki maja nadrabiac luki, dostalismy: ${pierwsze20.slice(0, 5).map(p => p.jednostka).join(',')}`);
  // 1000 luku to 20 paczek po 50 — dopiero potem wchodzi pikinier.
  assert.equal(paczki[20].jednostka, 'pikinier', 'po wyrownaniu wraca pikinier');
});

test('po wyrownaniu paczki ida naprzemiennie', () => {
  const paczki = kolejnoscPaczek(s, { pikinier: 1000, lucznik: 1000 }, {});
  const pik = paczki.filter(p => p.jednostka === 'pikinier').length;
  const luk = paczki.filter(p => p.jednostka === 'lucznik').length;
  assert.equal(pik, luk, 'rowny cel daje rowna liczbe paczek');
  // W kazdym oknie czterech paczek maja byc oba rodzaje.
  const okno = paczki.slice(0, 4).map(p => p.jednostka);
  assert.ok(new Set(okno).size > 1, `paczki maja sie przeplatac, jest: ${okno.join(',')}`);
});

test('suma paczek daje dokladnie zamowiona ilosc', () => {
  const cel = { pikinier: 7000, lucznik: 7000, zwiadowca: 1000, ciezka: 333, katapulta: 100 };
  const paczki = kolejnoscPaczek(s, cel, {});
  const suma = {};
  for (const p of paczki) suma[p.jednostka] = (suma[p.jednostka] ?? 0) + p.sztuk;
  assert.deepEqual(suma, cel, 'zadna sztuka nie moze zginac ani sie zdublowac');
});

test('cel juz osiagniety nie generuje zadnych paczek', () => {
  assert.deepEqual(kolejnoscPaczek(s, { pikinier: 100 }, { pikinier: 100 }), []);
});

test('stan wiekszy niz cel nie tworzy ujemnych paczek', () => {
  const paczki = kolejnoscPaczek(s, { pikinier: 100, lucznik: 200 }, { pikinier: 500 });
  assert.ok(paczki.every(p => p.sztuk > 0), 'kazda paczka ma dodatnia liczbe sztuk');
  assert.ok(paczki.every(p => p.jednostka === 'lucznik'), 'nadmiar pikinierow nie generuje paczek');
});

test('kolejki roznych budynkow ida rownolegle, ale wewnatrz budynku po kolei', () => {
  // Pik i luk to oba koszary — musza sie ustawic w jednej kolejce, wiec
  // laczny czas rosnie. Zwiad (stajnia) biegnie obok, niezaleznie.
  const p = normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { koszary: 10, stajnia: 10 } },
    rekrutacje: [
      { kotwica: null, jednostka: 'pikinier', ilosc: 500 },
      { kotwica: null, jednostka: 'lucznik', ilosc: 500 },
      { kotwica: null, jednostka: 'zwiadowca', ilosc: 100 },
    ],
  });
  const os = osRekrutacjiBezPrzestojow(p);
  const pik = os.find(r => r.jednostka === 'pikinier');
  const luk = os.find(r => r.jednostka === 'lucznik');
  const zwiad = os.find(r => r.jednostka === 'zwiadowca');

  // Jedne koszary: sumaryczny czas obu partii to suma ich czasow produkcji,
  // wiec ostatnia sztuka nie moze byc gotowa wczesniej niz ta suma.
  const koniecKoszar = Math.max(pik.koniecS, luk.koniecS);
  const czasSamejPiechoty = czasRekrutacji(s, 'pikinier', 10) * 500
    + czasRekrutacji(s, 'lucznik', 10) * 500;
  assert.ok(koniecKoszar >= czasSamejPiechoty - 1,
    `koszary maja jedna kolejke: ${koniecKoszar} < ${czasSamejPiechoty}`);

  // Stajnia jest niezalezna — zwiad konczy sie wg wlasnego tempa.
  const czasZwiadu = czasRekrutacji(s, 'zwiadowca', 10) * 100;
  assert.ok(zwiad.koniecS <= czasZwiadu + 1,
    `stajnia biegnie rownolegle: ${zwiad.koniecS} > ${czasZwiadu}`);
});

test('pik i luk rosna rownolegle, a nie jeden po drugim', () => {
  // Przy paczkowaniu obie jednostki maja byc czesciowo gotowe w polowie
  // laczego czasu — inaczej znaczyloby, ze robimy najpierw cale 500 pik.
  const p = normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { koszary: 10 } },
    rekrutacje: [
      { kotwica: null, jednostka: 'pikinier', ilosc: 500 },
      { kotwica: null, jednostka: 'lucznik', ilosc: 500 },
    ],
  });
  const os = osRekrutacjiBezPrzestojow(p);
  const koniec = Math.max(...os.map(r => r.koniecS));
  const wPolowie = wojskoNaCzas(p, koniec / 2);
  assert.ok(wPolowie.pikinier > 0, 'pikinierzy sa juz czesciowo gotowi');
  assert.ok(wPolowie.lucznik > 0, 'lucznicy tez, a nie dopiero po pikinierach');
});
