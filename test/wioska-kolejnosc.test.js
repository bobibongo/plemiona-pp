// test/wioska-kolejnosc.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { kolejnoscBudynkow } from '../src/wioska/kolejnosc-budynkow.js';

const s = swiat('pl231');

test('plac, piedestal i palac sa na koncu listy', () => {
  assert.deepEqual(kolejnoscBudynkow(s).slice(-3).sort(), ['palac', 'piedestal', 'plac'].sort());
});

test('kazdy budynek swiata wystepuje dokladnie raz', () => {
  const lista = kolejnoscBudynkow(s);
  assert.equal(new Set(lista).size, lista.length);
  assert.equal(lista.length, Object.keys(s.budynki).length);
});

test('budynek nieobecny na swiecie nie pojawia sie w liscie', () => {
  assert.ok(!kolejnoscBudynkow(s).includes('kosciol'));
});