// test/handlarz-pp.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUROWCE_OK, TRYBY_OK, ZAOKRAGLENIA_OK, PROG_DOMYSLNY, ZAOKRAGLENIE_DOMYSLNE,
  zaokraglijWDol, obliczProg, obliczIlosc, polaDlaTrybu, walidujDaneGieldy, ograniczDoDostepnych,
  zaokraglijProcent, wczytajZapisanyProg, zapiszProg,
  wczytajZapisanyTryb, zapiszTryb,
  wczytajZapisaneZaokraglenie, zapiszZaokraglenie,
} from '../src/handlarz-pp.js';

test('SUROWCE_OK zawiera trzy surowce', () => {
  assert.deepEqual(SUROWCE_OK, ['wood', 'stone', 'iron']);
});

test('TRYBY_OK zawiera sell, buy, buyAll', () => {
  assert.deepEqual(TRYBY_OK, ['sell', 'buy', 'buyAll']);
});

test('ZAOKRAGLENIA_OK zawiera brak (0), 10, 100, 1000', () => {
  assert.deepEqual(ZAOKRAGLENIA_OK, [0, 10, 100, 1000]);
});

test('zaokraglijWDol bez zaokraglenia (0) zwraca floor wartosci', () => {
  assert.equal(zaokraglijWDol(15269.7, 0), 15269);
});

test('zaokraglijWDol do 10 nigdy nie przekracza wartosci wejsciowej', () => {
  assert.equal(zaokraglijWDol(15269, 10), 15260);
  assert.equal(zaokraglijWDol(15260, 10), 15260);
});

test('zaokraglijWDol do 100', () => {
  assert.equal(zaokraglijWDol(15269, 100), 15200);
});

test('zaokraglijWDol do 1000', () => {
  assert.equal(zaokraglijWDol(15269, 1000), 15000);
});

test('zaokraglijWDol nigdy nie daje wartosci wiekszej niz wejsciowa (rozne kroki)', () => {
  for (const krok of ZAOKRAGLENIA_OK) {
    for (const wartosc of [0, 1, 9, 10, 99, 100, 999, 1000, 15269, 999999]) {
      assert.ok(zaokraglijWDol(wartosc, krok) <= wartosc);
    }
  }
});

test('zaokraglijProcent zaokragla do 0.1', () => {
  assert.equal(zaokraglijProcent(98.04), 98.0);
  assert.equal(zaokraglijProcent(98.05), 98.1);
  assert.equal(zaokraglijProcent(96.66), 96.7);
});

test('obliczProg liczy procent pojemnosci', () => {
  assert.equal(obliczProg(100, 98), 98);
  assert.equal(obliczProg(1000000, 96.5), 965000);
});

// Stan/pojemnosc odnosza sie do GIELDY (nie magazynu wioski): stan to ile
// gielda ma aktualnie na zapasie, pojemnosc to jej maksymalny limit.
// Prog = pojemnosc * procentWypelnienia/100 (np. 98% pojemnosci).

test('obliczIlosc dla sell liczy wolne miejsce do progu (pojemnosc*procent) minus stan', () => {
  // pojemnosc=698143, prog przy 100% = 698143, stan=694378 -> wolne miejsce do pelna
  assert.equal(obliczIlosc(698143, 694378, 100, 'sell'), 698143 - 694378);
});

test('obliczIlosc dla sell z przykladu real-world (98% progu)', () => {
  const pojemnosc = 815249;
  const stan = 623337; // wypelnienie ok. 76.46%, ponizej progu 98% -> spore wolne miejsce
  assert.equal(obliczIlosc(pojemnosc, stan, 98, 'sell'), pojemnosc * 0.98 - stan);
});

test('obliczIlosc dla buy liczy nadwyzke stanu ponad prog (pojemnosc*procent)', () => {
  // Przyklady z rozmowy: gielda ma pojemnosc 100, prog 80% -> prog=80.
  assert.equal(obliczIlosc(100, 90, 80, 'buy'), 10);
  assert.equal(obliczIlosc(100, 95, 80, 'buy'), 15);
});

test('obliczIlosc dla buy zwraca zero gdy stan jest ponizej progu (kurs juz za drogi)', () => {
  assert.equal(obliczIlosc(100, 70, 80, 'buy'), 0);
});

test('obliczIlosc dla buyAll skupuje caly aktualny stan gieldy, prog ignorowany', () => {
  assert.equal(obliczIlosc(100, 90, 80, 'buyAll'), 90);
  assert.equal(obliczIlosc(16269, 12345, 96, 'buyAll'), 12345);
});

test('obliczIlosc dla buyAll zwraca zero gdy gielda jest pusta', () => {
  assert.equal(obliczIlosc(100, 0, 96, 'buyAll'), 0);
});

test('obliczIlosc nie schodzi ponizej zera gdy prog jest nizszy niz stan (sell)', () => {
  assert.equal(obliczIlosc(1000, 900, 50, 'sell'), 0);
});

test('polaDlaTrybu mapuje sell na sell, buy/buyAll na buy', () => {
  assert.equal(polaDlaTrybu('sell'), 'sell');
  assert.equal(polaDlaTrybu('buy'), 'buy');
  assert.equal(polaDlaTrybu('buyAll'), 'buy');
});

test('walidujDaneGieldy przechodzi dla poprawnych danych', () => {
  assert.deepEqual(walidujDaneGieldy({ pojemnosc: 1000, stan: 500, procentWypelnienia: 98 }), []);
});

test('walidujDaneGieldy odrzuca NaN pojemnosc lub stan', () => {
  assert.ok(walidujDaneGieldy({ pojemnosc: NaN, stan: 500, procentWypelnienia: 98 }).length > 0);
  assert.ok(walidujDaneGieldy({ pojemnosc: 1000, stan: NaN, procentWypelnienia: 98 }).length > 0);
});

test('walidujDaneGieldy odrzuca procent poza zakresem 0-100 albo NaN', () => {
  assert.ok(walidujDaneGieldy({ pojemnosc: 1000, stan: 500, procentWypelnienia: -1 }).length > 0);
  assert.ok(walidujDaneGieldy({ pojemnosc: 1000, stan: 500, procentWypelnienia: 100.1 }).length > 0);
  assert.ok(walidujDaneGieldy({ pojemnosc: 1000, stan: 500, procentWypelnienia: NaN }).length > 0);
});

function fakeStorage() {
  const dane = {};
  return {
    getItem: k => (k in dane ? dane[k] : null),
    setItem: (k, v) => { dane[k] = v; },
  };
}

test('PROG_DOMYSLNY ma 96.5% dla sell i 98.5% dla buy/buyAll', () => {
  assert.equal(PROG_DOMYSLNY.sell, 96.5);
  assert.equal(PROG_DOMYSLNY.buy, 98.5);
  assert.equal(PROG_DOMYSLNY.buyAll, 98.5);
});

test('ZAOKRAGLENIE_DOMYSLNE jest 100 dla wszystkich trybow', () => {
  assert.equal(ZAOKRAGLENIE_DOMYSLNE.sell, 100);
  assert.equal(ZAOKRAGLENIE_DOMYSLNE.buy, 100);
  assert.equal(ZAOKRAGLENIE_DOMYSLNE.buyAll, 100);
});

test('wczytajZapisanyProg zwraca domyslny gdy nic nie zapisano', () => {
  assert.equal(wczytajZapisanyProg(fakeStorage(), 'sell', 98), 98);
});

test('zapiszProg i wczytajZapisanyProg dzialaja w parze, osobno per tryb', () => {
  const storage = fakeStorage();
  zapiszProg(storage, 'sell', 97.5);
  zapiszProg(storage, 'buy', 95.2);
  assert.equal(wczytajZapisanyProg(storage, 'sell', 98), 97.5);
  assert.equal(wczytajZapisanyProg(storage, 'buy', 96), 95.2);
});

test('wczytajZapisanyProg wraca do domyslnego gdy zapis jest uszkodzony', () => {
  const storage = fakeStorage();
  storage.setItem('handlarzPPProg_sell', 'nie-liczba');
  assert.equal(wczytajZapisanyProg(storage, 'sell', 98), 98);
});

test('zapiszTryb i wczytajZapisanyTryb dzialaja w parze', () => {
  const storage = fakeStorage();
  zapiszTryb(storage, 'buyAll');
  assert.equal(wczytajZapisanyTryb(storage, 'sell'), 'buyAll');
});

test('wczytajZapisanyTryb wraca do domyslnego gdy zapis jest niepoprawny', () => {
  const storage = fakeStorage();
  storage.setItem('handlarzPPTryb', 'cos-innego');
  assert.equal(wczytajZapisanyTryb(storage, 'sell'), 'sell');
});

test('zapiszZaokraglenie i wczytajZapisaneZaokraglenie dzialaja w parze, osobno per tryb', () => {
  const storage = fakeStorage();
  zapiszZaokraglenie(storage, 'sell', 100);
  zapiszZaokraglenie(storage, 'buy', 1000);
  assert.equal(wczytajZapisaneZaokraglenie(storage, 'sell', 0), 100);
  assert.equal(wczytajZapisaneZaokraglenie(storage, 'buy', 0), 1000);
});

test('wczytajZapisaneZaokraglenie wraca do domyslnego gdy zapis jest niepoprawny', () => {
  const storage = fakeStorage();
  storage.setItem('handlarzPPZaokraglenie_sell', '7');
  assert.equal(wczytajZapisaneZaokraglenie(storage, 'sell', 0), 0);
});

test('ograniczDoDostepnych dla sell obcina do limitu kupcow gdy jest nizszy niz wynik', () => {
  const wynik = ograniczDoDostepnych(50000, 'sell', { stanMagazynu: 100000, maxTransportKupcow: 20000, pojemnoscSpichlerza: NaN });
  assert.equal(wynik.wynik, 20000);
  assert.equal(wynik.obciete, true);
  assert.match(wynik.powod, /kupców/);
});

test('ograniczDoDostepnych dla sell obcina do stanu magazynu gdy jest nizszy niz wynik i limit kupcow', () => {
  const wynik = ograniczDoDostepnych(50000, 'sell', { stanMagazynu: 5000, maxTransportKupcow: 20000, pojemnoscSpichlerza: NaN });
  assert.equal(wynik.wynik, 5000);
  assert.equal(wynik.obciete, true);
  assert.match(wynik.powod, /magazynu/);
});

test('ograniczDoDostepnych dla sell nie obcina gdy oba limity sa wyzsze niz wynik', () => {
  const wynik = ograniczDoDostepnych(1000, 'sell', { stanMagazynu: 5000, maxTransportKupcow: 20000, pojemnoscSpichlerza: NaN });
  assert.equal(wynik.wynik, 1000);
  assert.equal(wynik.obciete, false);
  assert.equal(wynik.powod, null);
});

test('ograniczDoDostepnych dla buy obcina do wolnego miejsca w spichlerzu', () => {
  const wynik = ograniczDoDostepnych(50000, 'buy', { stanMagazynu: 380000, maxTransportKupcow: NaN, pojemnoscSpichlerza: 400000 });
  assert.equal(wynik.wynik, 20000);
  assert.equal(wynik.obciete, true);
  assert.match(wynik.powod, /spichlerza/);
});

test('ograniczDoDostepnych dla buyAll rowniez obcina do wolnego miejsca w spichlerzu', () => {
  const wynik = ograniczDoDostepnych(50000, 'buyAll', { stanMagazynu: 395000, maxTransportKupcow: NaN, pojemnoscSpichlerza: 400000 });
  assert.equal(wynik.wynik, 5000);
  assert.equal(wynik.obciete, true);
});

test('ograniczDoDostepnych dla buy nie schodzi ponizej zera gdy spichlerz juz pelny', () => {
  const wynik = ograniczDoDostepnych(50000, 'buy', { stanMagazynu: 400000, maxTransportKupcow: NaN, pojemnoscSpichlerza: 400000 });
  assert.equal(wynik.wynik, 0);
  assert.equal(wynik.obciete, true);
});
