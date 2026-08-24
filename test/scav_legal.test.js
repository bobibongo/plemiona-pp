// test/scav_legal.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  kluczPostepu, wczytajPostep, zapiszPostep, wyczyscPostep,
  stanSekwencji, nastepnyIndeks, poprzedniIndeks,
  polaDoWyczyszczenia, opisKroku, checkboxyPoziomu,
} from '../src/scav_legal.js';

function pamiecStorage(dane = {}) {
  const mapa = new Map(Object.entries(dane));
  return {
    getItem: k => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: k => mapa.delete(k),
  };
}

const KROKI = [
  { jednostka: 'light', poziom: 4, liczba: 30 },
  { jednostka: 'light', poziom: 3, liczba: 45 },
  { jednostka: 'light', poziom: 2, liczba: 90 },
];

// --- klucz postepu: osobny per wioska ---

test('kluczPostepu rozroznia wioski', () => {
  assert.notEqual(kluczPostepu('10235'), kluczPostepu('10236'));
});

test('kluczPostepu dla nieznanej wioski nadal zwraca stabilny klucz', () => {
  assert.equal(kluczPostepu(null), kluczPostepu(null));
});

// --- zapis / odczyt postepu ---

test('wczytajPostep bez zapisu zwraca zero', () => {
  assert.equal(wczytajPostep(pamiecStorage(), '10235'), 0);
});

test('zapiszPostep i wczytajPostep robia runde w obie strony', () => {
  const storage = pamiecStorage();
  zapiszPostep(storage, '10235', 2);
  assert.equal(wczytajPostep(storage, '10235'), 2);
});

test('postep jednej wioski nie przecieka do drugiej', () => {
  const storage = pamiecStorage();
  zapiszPostep(storage, '10235', 2);
  assert.equal(wczytajPostep(storage, '10236'), 0);
});

test('wczytajPostep ignoruje uszkodzony zapis', () => {
  const storage = pamiecStorage({ [kluczPostepu('10235')]: 'abc' });
  assert.equal(wczytajPostep(storage, '10235'), 0);
});

test('wczytajPostep ignoruje wartosc ujemna', () => {
  const storage = pamiecStorage({ [kluczPostepu('10235')]: '-3' });
  assert.equal(wczytajPostep(storage, '10235'), 0);
});

test('wyczyscPostep wraca do zera', () => {
  const storage = pamiecStorage();
  zapiszPostep(storage, '10235', 2);
  wyczyscPostep(storage, '10235');
  assert.equal(wczytajPostep(storage, '10235'), 0);
});

// --- nawigacja po sekwencji ---

test('nastepnyIndeks przesuwa o jeden', () => {
  assert.equal(nastepnyIndeks(0, KROKI), 1);
});

test('nastepnyIndeks zatrzymuje sie na dlugosci listy', () => {
  assert.equal(nastepnyIndeks(3, KROKI), 3);
});

test('poprzedniIndeks cofa o jeden', () => {
  assert.equal(poprzedniIndeks(2, KROKI), 1);
});

test('poprzedniIndeks nie schodzi ponizej zera', () => {
  assert.equal(poprzedniIndeks(0, KROKI), 0);
});

// --- stan sekwencji ---

test('stanSekwencji na starcie wskazuje pierwszy krok', () => {
  const stan = stanSekwencji(0, KROKI);
  assert.equal(stan.zakonczona, false);
  assert.deepEqual(stan.krok, KROKI[0]);
  assert.equal(stan.numer, 1);
  assert.equal(stan.wszystkich, 3);
});

test('stanSekwencji po ostatnim kroku jest zakonczona', () => {
  const stan = stanSekwencji(3, KROKI);
  assert.equal(stan.zakonczona, true);
  assert.equal(stan.krok, null);
});

test('stanSekwencji dla pustej listy jest zakonczona', () => {
  const stan = stanSekwencji(0, []);
  assert.equal(stan.zakonczona, true);
  assert.equal(stan.wszystkich, 0);
});

test('stanSekwencji numeruje kroki od jednego', () => {
  assert.equal(stanSekwencji(2, KROKI).numer, 3);
});

// --- pola do wyczyszczenia ---

test('polaDoWyczyszczenia pomija jednostke aktywnego kroku', () => {
  const pola = polaDoWyczyszczenia('light');
  assert.equal(pola.includes('light'), false);
});

test('polaDoWyczyszczenia zwraca pozostale jednostki', () => {
  const pola = polaDoWyczyszczenia('light');
  assert.ok(pola.includes('spear'));
  assert.ok(pola.includes('axe'));
});

// --- opis kroku dla UI ---

test('opisKroku zawiera nazwe jednostki, liczbe i poziom', () => {
  const opis = opisKroku({ jednostka: 'light', poziom: 4, liczba: 30 });
  assert.match(opis, /30/);
  assert.match(opis, /4/);
  assert.match(opis, /Lekka/i);
});

// Ekran zbieractwa masowego zawiera wiele wiosek, a wiec wiele checkboxow
// z tym samym data-option. Musimy zaznaczyc WSZYSTKIE dla danego poziomu,
// nie tylko ostatni znaleziony.
test('checkboxyPoziomu zwraca wszystkie checkboxy danego poziomu', () => {
  const checkboxy = [
    { poziom: '4', disabled: false },
    { poziom: '3', disabled: false },
    { poziom: '4', disabled: false },
  ];
  const wybrane = checkboxyPoziomu(checkboxy, 4, c => c.poziom, c => c.disabled);
  assert.equal(wybrane.length, 2);
});

test('checkboxyPoziomu pomija zablokowane checkboxy', () => {
  const checkboxy = [
    { poziom: '4', disabled: true },
    { poziom: '4', disabled: false },
  ];
  const wybrane = checkboxyPoziomu(checkboxy, 4, c => c.poziom, c => c.disabled);
  assert.equal(wybrane.length, 1);
});

test('checkboxyPoziomu dla braku pasujacych zwraca pusta liste', () => {
  const wybrane = checkboxyPoziomu([{ poziom: '2', disabled: false }], 4, c => c.poziom, c => c.disabled);
  assert.deepEqual(wybrane, []);
});
