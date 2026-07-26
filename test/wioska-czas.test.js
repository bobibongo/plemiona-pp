// test/wioska-czas.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { czasBudowy } from '../src/wioska/czas.js';
import { TABELA_G } from '../src/wioska/czas-dane.js';

const s = swiat('pl231');
// Gra pokazuje czasy w pelnych sekundach, wiec porownujemy z tolerancja 1 s.
const blisko = (a, b, opis) => assert.ok(Math.abs(a - b) <= 1, `${opis}: ${a} vs ${b}`);

test('tabela G pokrywa poziomy 1-30 i rosnie', () => {
  for (let l = 1; l <= 30; l++) assert.ok(TABELA_G[l], `brak poziomu ${l}`);
  for (let l = 2; l <= 30; l++) {
    assert.ok(TABELA_G[l].g >= TABELA_G[l - 1].g, `G maleje na poziomie ${l}`);
  }
});

// Wioska A004, Ratusz 14. Spichlerz mial poziom 20 w kolejce, wiec ekran
// pokazywal poziom 21 — to jest juz uwzglednione w oczekiwanych wartosciach.
test('czasy z ekranu Ratusza wioski A004 (Ratusz 14)', () => {
  blisko(czasBudowy(s, 'ratusz', 15, 14).sekundy, 6404, 'Ratusz 15');
  blisko(czasBudowy(s, 'koszary', 9, 14).sekundy, 3479, 'Koszary 9');
  blisko(czasBudowy(s, 'kuznia', 7, 14).sekundy, 6542, 'Kuźnia 7');
  blisko(czasBudowy(s, 'tartak', 12, 14).sekundy, 3482, 'Tartak 12');
  blisko(czasBudowy(s, 'cegielnia', 10, 14).sekundy, 2224, 'Cegielnia 10');
  blisko(czasBudowy(s, 'huta', 11, 14).sekundy, 3359, 'Huta 11');
  blisko(czasBudowy(s, 'zagroda', 14, 14).sekundy, 7010, 'Zagroda 14');
  blisko(czasBudowy(s, 'spichlerz', 21, 14).sekundy, 22183, 'Spichlerz 21');
  blisko(czasBudowy(s, 'stajnia', 3, 14).sekundy, 489, 'Stajnia 3');
  blisko(czasBudowy(s, 'rynek', 4, 14).sekundy, 682, 'Rynek 4');
  blisko(czasBudowy(s, 'schowek', 4, 14).sekundy, 455, 'Schowek 4');
  blisko(czasBudowy(s, 'wieza', 1, 14).sekundy, 50, 'Wieża 1');
});

// Zagroda 11, 12 i 13 stala w kolejce budowy — to sa czasy pelnych rozbudow.
test('czasy z kolejki budowy wioski A004', () => {
  blisko(czasBudowy(s, 'zagroda', 11, 14).sekundy, 3732, 'Zagroda 11');
  blisko(czasBudowy(s, 'zagroda', 12, 14).sekundy, 4642, 'Zagroda 12');
  blisko(czasBudowy(s, 'zagroda', 13, 14).sekundy, 5724, 'Zagroda 13');
});

// Druga wioska, Ratusz 3 — pilnuje, zeby czlon Ratusza nie wsiakl w tabele G.
test('czasy z ekranu Ratusza wioski yozeek (Ratusz 3)', () => {
  blisko(czasBudowy(s, 'ratusz', 4, 3).sekundy, 389, 'Ratusz 4');
  blisko(czasBudowy(s, 'koszary', 4, 3).sekundy, 778, 'Koszary 4');
  blisko(czasBudowy(s, 'rynek', 3, 3).sekundy, 377, 'Rynek 3');
  blisko(czasBudowy(s, 'tartak', 4, 3).sekundy, 389, 'Tartak 4');
  blisko(czasBudowy(s, 'cegielnia', 4, 3).sekundy, 389, 'Cegielnia 4');
  blisko(czasBudowy(s, 'huta', 4, 3).sekundy, 467, 'Huta 4');
  blisko(czasBudowy(s, 'zagroda', 4, 3).sekundy, 519, 'Zagroda 4');
  blisko(czasBudowy(s, 'spichlerz', 4, 3).sekundy, 441, 'Spichlerz 4');
  blisko(czasBudowy(s, 'schowek', 3, 3).sekundy, 251, 'Schowek 3');
  blisko(czasBudowy(s, 'mur', 3, 3).sekundy, 502, 'Mur 3');
});

test('minimum dziesieciu sekund obowiazuje na najnizszych poziomach', () => {
  assert.equal(czasBudowy(s, 'tartak', 1, 1).sekundy, 10);
  assert.equal(czasBudowy(s, 'ratusz', 2, 1).sekundy, 10);
  assert.equal(czasBudowy(s, 'zagroda', 2, 1).sekundy, 10);
});

test('budynki powyzej minimum pokazuja wartosc dokladna, nie dziesiec', () => {
  blisko(czasBudowy(s, 'schowek', 2, 1).sekundy, 13, 'Schowek 2');
  blisko(czasBudowy(s, 'piedestal', 1, 1).sekundy, 11, 'Piedestał 1');
});

test('Mur na poziomach 1 i 2 trwa rowne cztery minuty niezaleznie od Ratusza', () => {
  assert.equal(czasBudowy(s, 'mur', 1, 14).sekundy, 240);
  assert.equal(czasBudowy(s, 'mur', 2, 3).sekundy, 240);
  assert.equal(czasBudowy(s, 'mur', 1, 1).sekundy, 240);
});

test('poziomy bez pomiaru sa oznaczone jako niepewne', () => {
  assert.equal(czasBudowy(s, 'tartak', 10, 14).pewny, true);
  assert.equal(czasBudowy(s, 'tartak', 5, 14).pewny, false);
  assert.equal(czasBudowy(s, 'tartak', 18, 14).pewny, false);
});

test('predkosc swiata skraca czas budowy', () => {
  const szybki = { ...s, predkosc: 2 };
  const wolny = czasBudowy(s, 'ratusz', 15, 14).sekundy;
  blisko(czasBudowy(szybki, 'ratusz', 15, 14).sekundy, wolny / 2, 'świat x2');
});
