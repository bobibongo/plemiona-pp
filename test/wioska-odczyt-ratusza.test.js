// test/wioska-odczyt-ratusza.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { poziomRatuszaZeStrony, kolejkaZeStrony, pomiaryZeStrony } from '../src/wioska/odczyt-ratusza.js';

// Wycinki prawdziwych ekranow Ratusza — tylko naglowek, kolejka budowy
// i tabela budynkow. Reszta strony nie ma tu znaczenia.
const wczytaj = (nazwa) => readFileSync(new URL(`./fixtures/${nazwa}.html`, import.meta.url), 'utf8');

const a004 = wczytaj('ratusz-a004');
const yozeek = wczytaj('ratusz-yozeek');

test('odczytuje poziom Ratusza z naglowka strony', () => {
  assert.equal(poziomRatuszaZeStrony(a004), 14);
  assert.equal(poziomRatuszaZeStrony(yozeek), 3);
});

test('odczytuje kolejke budowy', () => {
  assert.deepEqual(kolejkaZeStrony(a004), [
    { budynek: 'spichlerz', poziom: 20 },
    { budynek: 'zagroda', poziom: 11 },
    { budynek: 'zagroda', poziom: 12 },
    { budynek: 'zagroda', poziom: 13 },
  ]);
});

test('pusta kolejka daje pusta liste, nie wyjatek', () => {
  assert.deepEqual(kolejkaZeStrony(yozeek), []);
});

// To jest sedno narzedzia: Spichlerz stoi na 19 i ma 20 w kolejce,
// wiec wiersz w tabeli dotyczy poziomu 21, a nie 20.
test('poziom docelowy uwzglednia kolejke budowy', () => {
  const p = pomiaryZeStrony(a004);
  const spichlerz = p.find(x => x.budynek === 'spichlerz');
  assert.equal(spichlerz.poziom, 21);
  assert.equal(spichlerz.sekundy, 22183);
  const zagroda = p.find(x => x.budynek === 'zagroda');
  assert.equal(zagroda.poziom, 14);
});

test('budynek bez kolejki ma poziom o jeden wyzszy od obecnego', () => {
  const p = pomiaryZeStrony(a004);
  assert.equal(p.find(x => x.budynek === 'ratusz').poziom, 15);
  assert.equal(p.find(x => x.budynek === 'ratusz').sekundy, 6404);
});

test('budynek nieistniejacy startuje z poziomu 1', () => {
  const p = pomiaryZeStrony(a004);
  assert.equal(p.find(x => x.budynek === 'mur').poziom, 1);
});

test('kazdy pomiar niesie poziom Ratusza swojej wioski', () => {
  assert.ok(pomiaryZeStrony(a004).every(x => x.poziomRatusza === 14));
  assert.ok(pomiaryZeStrony(yozeek).every(x => x.poziomRatusza === 3));
});

test('budynki calkowicie rozbudowane nie daja pomiaru', () => {
  const p = pomiaryZeStrony(a004);
  assert.ok(!p.some(x => x.budynek === 'plac'));
});
