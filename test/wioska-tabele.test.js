// test/wioska-tabele.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { pojemnosc, maksLudnosc, produkcjaGodzinowa, schowane, kupcy } from '../src/wioska/tabele.js';

const s = swiat('pl231');

test('pojemnosc spichlerza na skrajach', () => {
  assert.equal(pojemnosc(1), 1000);
  assert.equal(pojemnosc(20), 50675);
  assert.equal(pojemnosc(30), 400000);
});

test('maksymalna ludnosc zagrody na skrajach', () => {
  assert.equal(maksLudnosc(1), 240);
  assert.equal(maksLudnosc(30), 24000);
});

test('produkcja na swiecie o predkosci 1 zaczyna sie od produkcjaBazowa', () => {
  assert.equal(produkcjaGodzinowa(s, 1), 30);
  assert.equal(produkcjaGodzinowa(s, 30), 2400);
});

test('poziom 0 kopalni nie produkuje nic', () => {
  assert.equal(produkcjaGodzinowa(s, 0), 0);
});

test('produkcja skaluje sie z produkcjaBazowa swiata', () => {
  const szybki = { ...s, produkcjaBazowa: 60 };
  assert.equal(produkcjaGodzinowa(szybki, 1), 60);
  assert.equal(produkcjaGodzinowa(szybki, 30), 4800);
});

test('schowek i kupcy', () => {
  assert.equal(schowane(1), 150);
  assert.equal(schowane(10), 2000);
  assert.equal(kupcy(1), 1);
  assert.equal(kupcy(25), 235);
});

test('poziom spoza zakresu rzuca zamiast zwracac undefined', () => {
  assert.throws(() => pojemnosc(31), /poziom/i);
  assert.throws(() => maksLudnosc(0), /poziom/i);
});
