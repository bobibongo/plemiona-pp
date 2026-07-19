// test/shared-date.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePremiumDate } from '../src/shared-date.js';

const NOW = new Date(2026, 6, 20, 12, 0, 0); // 20 lip 2026

test('data bez roku używa roku bieżącego', () => {
  const d = parsePremiumDate(' 19.07. 22:30 ', NOW);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 6);   // lipiec
  assert.equal(d.getDate(), 19);
  assert.equal(d.getHours(), 22);
  assert.equal(d.getMinutes(), 30);
});

test('data z sufiksem .25 daje rok 2025', () => {
  const d = parsePremiumDate('23.07.25 14:51', NOW);
  assert.equal(d.getFullYear(), 2025);
  assert.equal(d.getMonth(), 6);
  assert.equal(d.getDate(), 23);
  assert.equal(d.getHours(), 14);
  assert.equal(d.getMinutes(), 51);
});

test('rzuca dla nieparsowalnego wejścia', () => {
  assert.throws(() => parsePremiumDate('śmieci', NOW));
});
