// test/wioska-punkty.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punktyBudynku, punktyWioski } from '../src/wioska/punkty.js';

test('punkty budynku na poziomie 1 to wartosc z tabeli punktow', () => {
  assert.equal(punktyBudynku('ratusz', 1), 10);
  assert.equal(punktyBudynku('palac', 1), 512);
  assert.equal(punktyBudynku('plac', 1), 0);
});

test('punkty budynku sumuja sie po poziomach', () => {
  assert.equal(punktyBudynku('ratusz', 2), 10 + 2);
  assert.equal(punktyBudynku('ratusz', 30), 1978);
});

test('poziom 0 lub brak budynku daje zero punktow', () => {
  assert.equal(punktyBudynku('ratusz', 0), 0);
  assert.equal(punktyBudynku('nieznany', 5), 0);
});

test('punkty wioski sumuja wszystkie budynki', () => {
  assert.equal(punktyWioski({ ratusz: 1 }), 10);
  assert.equal(punktyWioski({ ratusz: 1, tartak: 1 }), 10 + 6);
  assert.equal(punktyWioski({}), 0);
});
