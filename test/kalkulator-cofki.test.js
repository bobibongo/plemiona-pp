// test/kalkulator-cofki.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ustalCelSekundy, obliczPrzerwanie, formatZegara, formatOdliczania,
  koniecOknaPrzerwania, OKNO_PRZERWANIA_SEKUND, licznikPrzerwaniaWChwili,
} from '../src/kalkulator-cofki.js';

// Pomocnik: sekundy "czasu gry" dla podanej godziny dnia 2026-08-23.
const gra = (gg, mm, ss) => Date.UTC(2026, 7, 23, gg, mm, ss) / 1000;

test('ustalCelSekundy parsuje GG:MM:SS i zwraca ten sam dzien gdy godzina jest w przyszlosci', () => {
  assert.equal(ustalCelSekundy('22:00:00', gra(21, 0, 0)), gra(22, 0, 0));
});

test('ustalCelSekundy akceptuje i ignoruje milisekundy w formacie GG:MM:SS:mmm', () => {
  assert.equal(ustalCelSekundy('22:00:00:523', gra(21, 0, 0)), gra(22, 0, 0));
});

test('ustalCelSekundy przesuwa na nastepny dzien gdy podana godzina juz minela', () => {
  const oczekiwany = Date.UTC(2026, 7, 24, 22, 0, 0) / 1000;
  assert.equal(ustalCelSekundy('22:00:00', gra(22, 30, 0)), oczekiwany);
});

test('ustalCelSekundy zwraca null dla niepoprawnego formatu', () => {
  assert.equal(ustalCelSekundy('nie-czas', 0), null);
  assert.equal(ustalCelSekundy('25:00:00', 0), null);
  assert.equal(ustalCelSekundy('12:60:00', 0), null);
});

// Przyklad podany wprost przez uzytkownika: wyslane 10:01:33, powrot 10:03:33,
// wiec przerwac trzeba o 10:02:33 - dokladnie minute po wyslaniu.
test('przyklad uzytkownika: wyslano 10:01:33, powrot 10:03:33 -> przerwij 10:02:33 (minute po wyslaniu)', () => {
  const start = gra(10, 1, 33);
  const cel = ustalCelSekundy('10:03:33', gra(10, 1, 40));
  const wynik = obliczPrzerwanie(start, cel);
  assert.equal(formatZegara(wynik.przerwanieSekundy), '10:02:33');
  assert.equal(wynik.czasDoPrzerwaniaSekund, 60);
  assert.equal(formatOdliczania(wynik.czasDoPrzerwaniaSekund), '0:01:00');
  assert.equal(wynik.parzysta, true);
});

// Regresja na blad ze zrzutu: godzina wpisana przez gracza jest w czasie gry,
// wiec nie wolno jej przesuwac o strefe serwera - wynik ma zostac tego samego dnia.
test('cel wpisany w czasie gry nie przeskakuje o godziny (regresja: +2h ze strefy serwera)', () => {
  const cel = ustalCelSekundy('23:30:59', gra(23, 27, 0));
  assert.equal(formatZegara(cel), '23:30:59', 'cel zostaje o wpisanej godzinie');
  assert.equal(cel, gra(23, 30, 59), 'cel zostaje tego samego dnia, bez przesuniecia o strefe');
});

test('obliczPrzerwanie zwraca srodek miedzy startem a celem dla parzystego odstepu', () => {
  const wynik = obliczPrzerwanie(1000, 1120);
  assert.equal(wynik.przerwanieSekundy, 1060);
  assert.equal(wynik.parzysta, true);
  assert.equal(wynik.roznicaSekund, 120);
  assert.equal(wynik.czasDoPrzerwaniaSekund, 60);
});

test('obliczPrzerwanie dla nieparzystego odstepu zaokragla w dol i oznacza jako nieparzyste', () => {
  const wynik = obliczPrzerwanie(1000, 1121);
  assert.equal(wynik.parzysta, false);
  assert.equal(wynik.przerwanieSekundy, 1060);
  assert.equal(wynik.roznicaSekund, 121);
});

test('obliczPrzerwanie zwraca null gdy cel nie jest pozniejszy niz start', () => {
  assert.equal(obliczPrzerwanie(1000, 1000), null);
  assert.equal(obliczPrzerwanie(1000, 900), null);
});

test('koniecOknaPrzerwania to 10 minut od wyslania dla dlugiego rozkazu', () => {
  const start = gra(21, 30, 30);
  const przybycie = start + 28 * 60; // rozkaz na 28 minut
  assert.equal(koniecOknaPrzerwania(start, przybycie), start + OKNO_PRZERWANIA_SEKUND);
  assert.equal(formatZegara(koniecOknaPrzerwania(start, przybycie)), '21:40:30');
});

// Ze zrzutu: rozkaz na 9 minut mial "przerwij (0:08:50)" rowne licznikowi
// przybycia - czyli krotszy rozkaz mozna przerwac az do samego przybycia.
test('koniecOknaPrzerwania dla rozkazu krotszego niz 10 minut to moment przybycia', () => {
  const start = gra(23, 30, 30);
  const przybycie = start + 9 * 60;
  assert.equal(koniecOknaPrzerwania(start, przybycie), przybycie);
  assert.equal(formatZegara(koniecOknaPrzerwania(start, przybycie)), '23:39:30');
});

test('koniecOknaPrzerwania bez znanego przybycia spada do limitu 10 minut', () => {
  const start = gra(12, 0, 0);
  assert.equal(koniecOknaPrzerwania(start, NaN), start + OKNO_PRZERWANIA_SEKUND);
});

// Gra przy "przerwij" odlicza do zamkniecia okna, nie od wyslania.
test('licznik "przerwij" pokazuje czas do zamkniecia okna, nie czas od wyslania', () => {
  const start = gra(12, 0, 0);
  const przybycie = start + 30 * 60; // dlugi rozkaz, wiec okno to pelne 10 minut
  const koniecOkna = koniecOknaPrzerwania(start, przybycie);
  const przerwanie = start + 150; // 2:30 po wyslaniu
  assert.equal(formatOdliczania(licznikPrzerwaniaWChwili(przerwanie, koniecOkna)), '0:07:30');
});

// Rachunek podany przez gracza, liczony na piechote:
//   okno - (cel - wyslano) / 2 = 0:10:00 - 0:01:38 = 0:08:22
// oraz godzina przerwania:
//   wyslano + (cel - wyslano) / 2 = 17:32:11 + 0:01:38 = 17:33:49
test('zgodnosc z rachunkiem gracza (wyslano 17:32:11, cel 17:35:27)', () => {
  const start = gra(17, 32, 11);
  const przybycie = gra(18, 8, 11); // rozkaz 36-minutowy, okno to pelne 10 minut
  const koniecOkna = koniecOknaPrzerwania(start, przybycie);
  assert.equal(formatZegara(koniecOkna), '17:42:11');

  const cel = ustalCelSekundy('17:35:27', start + 1);
  const wynik = obliczPrzerwanie(start, cel);
  assert.equal(formatZegara(wynik.przerwanieSekundy), '17:33:49');
  assert.equal(
    formatOdliczania(licznikPrzerwaniaWChwili(wynik.przerwanieSekundy, koniecOkna)),
    '0:08:22'
  );
});

// Rozkaz krotszy niz 10 minut: okno konczy sie na przybyciu, nie po 10 minutach.
test('licznik "przerwij" dla krotkiego rozkazu liczy do przybycia', () => {
  const start = gra(23, 30, 30);
  const przybycie = start + 9 * 60;
  const koniecOkna = koniecOknaPrzerwania(start, przybycie);
  const przerwanie = start + 10;
  assert.equal(formatOdliczania(licznikPrzerwaniaWChwili(przerwanie, koniecOkna)), '0:08:50');
});

test('licznikPrzerwaniaWChwili nie schodzi ponizej zera po zamknieciu okna', () => {
  const koniecOkna = gra(16, 48, 35);
  assert.equal(licznikPrzerwaniaWChwili(koniecOkna, koniecOkna), 0);
  assert.equal(licznikPrzerwaniaWChwili(koniecOkna + 30, koniecOkna), 0);
});

test('formatZegara formatuje sekundy czasu gry jako GG:MM:SS', () => {
  assert.equal(formatZegara(gra(9, 5, 3)), '09:05:03');
});

test('formatOdliczania pokazuje TERAZ! gdy czas juz minal', () => {
  assert.equal(formatOdliczania(0), 'TERAZ!');
  assert.equal(formatOdliczania(-5), 'TERAZ!');
});

test('formatOdliczania formatuje dodatnie sekundy jako G:MM:SS, zawsze z godzina (jak w grze)', () => {
  assert.equal(formatOdliczania(65), '0:01:05');
  assert.equal(formatOdliczania(3661), '1:01:01');
  assert.equal(formatOdliczania(530), '0:08:50');
});
