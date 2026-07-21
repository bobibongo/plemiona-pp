// test/rates-parse.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseRate, readRates,
  continentFromCoords, parseLocation, findLocation, readReading,
} from '../src/rates-parse.js';

// Zastępczy Document budowany z fixture przez regex — bez npm.
// readRates używa getElementById i querySelectorAll('.premium-exchange-sep').
export function fakeDoc(html) {
  const cells = {};
  for (const m of html.matchAll(/<td id="([^"]+)"[^>]*>([\s\S]*?)<\/td>/g)) {
    const seps = [...m[2].matchAll(/<div class="premium-exchange-sep">([\s\S]*?)<\/div>/g)]
      .map(s => ({ textContent: s[1].replace(/<[^>]+>/g, '').trim() }));
    cells[m[1]] = {
      textContent: m[2].replace(/<[^>]+>/g, ' '),
      querySelectorAll: () => seps,
    };
  }
  const bolds = [...html.matchAll(/<b class="nowrap">([\s\S]*?)<\/b>/g)]
    .map(b => ({ textContent: b[1].replace(/<[^>]+>/g, '').trim() }));
  return {
    getElementById: id => cells[id] || null,
    querySelectorAll: () => bolds,
  };
}

const HTML = readFileSync('test/fixtures/exchange-screen.html', 'utf8');

test('parseRate czyta liczbę z komórki kursu', () => {
  assert.equal(parseRate(' 378'), 378);
});

test('parseRate radzi sobie z separatorem tysięcy i spacją nierozdzielającą', () => {
  assert.equal(parseRate('1.234'), 1234);
  assert.equal(parseRate('1 234'), 1234);
});

test('parseRate bierze tylko pierwszą liczbę, nie sklejając jej z "1" po strzałce', () => {
  assert.equal(parseRate('378 1'), 378);
});

test('parseRate zwraca null dla śmieci', () => {
  assert.equal(parseRate(''), null);
  assert.equal(parseRate('brak'), null);
  assert.equal(parseRate(null), null);
});

test('readRates czyta trzy kursy z prawdziwego HTML giełdy', () => {
  assert.deepEqual(readRates(fakeDoc(HTML)), { wood: 378, stone: 372, iron: 406 });
});

test('readRates zwraca null, gdy na stronie nie ma giełdy', () => {
  assert.equal(readRates(fakeDoc('<table><tr><td>nic</td></tr></table>')), null);
});

test('readRates zwraca null, gdy któryś kurs jest nieczytelny — albo komplet, albo nic', () => {
  const zepsute = HTML.replace(
    /<div class="premium-exchange-sep"><img[^>]*stone[^>]*> 372<\/div>/,
    '<div class="premium-exchange-sep">—</div>');
  assert.equal(readRates(fakeDoc(zepsute)), null);
});

test('continentFromCoords bierze pierwszą cyfrę Y, potem pierwszą cyfrę X', () => {
  assert.equal(continentFromCoords(499, 613), 'K64');
  assert.equal(continentFromCoords(500, 500), 'K55');
  assert.equal(continentFromCoords(123, 987), 'K91');
});

test('parseLocation woli kontynent podany wprost przez stronę', () => {
  assert.deepEqual(parseLocation('(499|613) K64'), { x: 499, y: 613, continent: 'K64' });
});

test('parseLocation wylicza kontynent, gdy strona go nie podaje', () => {
  assert.deepEqual(parseLocation('(499|613)'), { x: 499, y: 613, continent: 'K64' });
});

test('parseLocation zwraca null bez współrzędnych', () => {
  assert.equal(parseLocation('Wioska barbarzyńska'), null);
  assert.equal(parseLocation(undefined), null);
});

test('findLocation znajduje lokalizację w prawdziwym HTML', () => {
  assert.deepEqual(findLocation(fakeDoc(HTML)), { x: 499, y: 613, continent: 'K64' });
});

test('readReading składa kursy, kontynent i znacznik czasu', () => {
  const now = new Date('2026-07-21T14:30:12.000Z');
  assert.deepEqual(readReading(fakeDoc(HTML), now), {
    continent: 'K64', x: 499, y: 613,
    wood: 378, stone: 372, iron: 406,
    at: '2026-07-21T14:30:12.000Z',
  });
});

test('readReading zwraca null poza ekranem giełdy', () => {
  assert.equal(readReading(fakeDoc('<table><tr><td>nic</td></tr></table>')), null);
});

test('readReading oddaje odczyt bez kontynentu, gdy lokalizacji nie widać', () => {
  const bezLokacji = HTML.replace(/<b class="nowrap">[\s\S]*?<\/b>/, '<b class="nowrap">brak</b>');
  const r = readReading(fakeDoc(bezLokacji), new Date('2026-07-21T14:30:12.000Z'));
  assert.equal(r.continent, null);
  assert.equal(r.wood, 378);
});
