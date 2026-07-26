// test/wioska-wymagania.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brakujaceWymagania, opisWymagan } from '../src/wioska/wymagania.js';
import { WYMAGANIA } from '../src/wioska/wymagania-dane.js';

test('budynek bez wymagan mozna budowac od zera', () => {
  assert.deepEqual(brakujaceWymagania('tartak', {}), []);
  assert.deepEqual(brakujaceWymagania('spichlerz', {}), []);
});

test('Koszary wymagaja Ratusza na 3', () => {
  assert.deepEqual(brakujaceWymagania('koszary', { ratusz: 2 }), [{ budynek: 'ratusz', poziom: 3 }]);
  assert.deepEqual(brakujaceWymagania('koszary', { ratusz: 3 }), []);
});

test('Stajnia wymaga trzech budynkow naraz', () => {
  const brak = brakujaceWymagania('stajnia', { ratusz: 10, koszary: 5, kuznia: 1 });
  assert.deepEqual(brak, [{ budynek: 'kuznia', poziom: 5 }]);
});

test('brak wpisu o budynku znaczy poziom zero', () => {
  const brak = brakujaceWymagania('rynek', { ratusz: 3 });
  assert.deepEqual(brak, [{ budynek: 'spichlerz', poziom: 2 }]);
});

test('Wieza straznicza wymaga Ratusza i Zagrody na 5', () => {
  assert.deepEqual(brakujaceWymagania('wieza', { ratusz: 5, zagroda: 5 }), []);
  assert.equal(brakujaceWymagania('wieza', { ratusz: 5, zagroda: 4 }).length, 1);
});

test('Palac wymaga Ratusza 20, Kuzni 20 i Rynku 10', () => {
  assert.deepEqual(WYMAGANIA.palac, { ratusz: 20, kuznia: 20, rynek: 10 });
});

test('opisWymagan sklada czytelny komunikat', () => {
  const nazwy = { ratusz: 'Ratusz', kuznia: 'Kuźnia' };
  assert.equal(
    opisWymagan([{ budynek: 'ratusz', poziom: 10 }, { budynek: 'kuznia', poziom: 5 }], nazwy),
    'Wymaga: Ratusz 10, Kuźnia 5',
  );
});
