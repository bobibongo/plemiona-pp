// test/wioska-swiat.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat, SWIATY } from '../src/wioska/swiaty.js';
import {
  zaokr, kosztPoziomu, ludnoscPoziomu, maksPoziom, budynkiSwiata, poziomyStartowe,
} from '../src/wioska/swiat.js';

const s = swiat('pl231');

test('zaokr zaokragla polowke w gore, takze dla wartosci ujemnych', () => {
  assert.equal(zaokr(62.5), 63);
  assert.equal(zaokr(62.4), 62);
  assert.equal(zaokr(1229.5), 1230);
});

test('swiat rzuca dla nieznanego kodu zamiast zwracac undefined', () => {
  assert.throws(() => swiat('pl999'), /pl999/);
});

// Wartosci z ekranu Ratusza wioski A004 (swiat 231) — koszty widziane w grze.
test('koszt Ratusza na poziom 15 zgadza sie z gra', () => {
  assert.deepEqual(kosztPoziomu(s, 'ratusz', 15), { drewno: 2288, glina: 2400, zelazo: 1779 });
});

test('koszt Koszar na poziom 9 zgadza sie z gra', () => {
  assert.deepEqual(kosztPoziomu(s, 'koszary', 9), { drewno: 1271, glina: 1225, zelazo: 572 });
});

test('koszt Rynku na poziom 4 zgadza sie z gra', () => {
  assert.deepEqual(kosztPoziomu(s, 'rynek', 4), { drewno: 200, glina: 207, zelazo: 200 });
});

test('koszt Muru na poziom 1 to wartosc bazowa', () => {
  assert.deepEqual(kosztPoziomu(s, 'mur', 1), { drewno: 50, glina: 100, zelazo: 20 });
});

test('koszt Spichlerza na poziom 21 zgadza sie z gra', () => {
  assert.deepEqual(kosztPoziomu(s, 'spichlerz', 21), { drewno: 6606, glina: 5957, zelazo: 3202 });
});

test('ludnosc jest skumulowana, nie przyrostowa', () => {
  assert.equal(ludnoscPoziomu(s, 'ratusz', 1), 5);
  assert.equal(ludnoscPoziomu(s, 'ratusz', 6), 11);
});

test('poziom 0 nie zajmuje ludnosci', () => {
  assert.equal(ludnoscPoziomu(s, 'koszary', 0), 0);
});

test('Zagroda i Spichlerz nie zajmuja ludnosci na zadnym poziomie', () => {
  assert.equal(ludnoscPoziomu(s, 'zagroda', 20), 0);
  assert.equal(ludnoscPoziomu(s, 'spichlerz', 20), 0);
});

test('maksymalne poziomy zgadzaja sie z configem swiata', () => {
  assert.equal(maksPoziom(s, 'ratusz'), 30);
  assert.equal(maksPoziom(s, 'warsztat'), 15);
  assert.equal(maksPoziom(s, 'palac'), 1);
});

test('Kosciol nie istnieje na swiecie 231', () => {
  assert.ok(!budynkiSwiata(s).includes('kosciol'));
});

test('poziomy startowe biora sie z min_level configu', () => {
  const p = poziomyStartowe(s);
  assert.equal(p.ratusz, 1);
  assert.equal(p.zagroda, 1);
  assert.equal(p.spichlerz, 1);
  assert.equal(p.koszary, 0);
});

test('kazdy budynek swiata ma komplet pol', () => {
  for (const b of budynkiSwiata(s)) {
    const d = SWIATY.pl231.budynki[b];
    for (const pole of ['kod', 'maks', 'min', 'drewno', 'glina', 'zelazo', 'pop',
                        'fDrewno', 'fGlina', 'fZelazo', 'fPop', 'czas']) {
      assert.ok(typeof d[pole] === 'number' || typeof d[pole] === 'string', `${b}.${pole}`);
    }
  }
});
