// test/collector.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLogUrl, extractRawRows, oldestDate, shouldStop } from '../src/collector.js';

const NOW = new Date(2026, 6, 20, 12, 0, 0);

// Minimalny Document zastępczy budowany z fixture przez regex — bez npm.
// extractRawRows iteruje po wierszach i pobiera komórki td przez querySelectorAll('td').
function fakeDoc(html) {
  const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => {
    const cells = [...m[1].matchAll(/<t[dh]>([\s\S]*?)<\/t[dh]>/g)]
      .map(c => c[1].replace(/&nbsp;/g, ' '));
    return { cells, isHeader: /<th>/.test(m[1]) };
  });
  const rowObjs = rows.map(r => ({
    _cells: r.cells,
    querySelectorAll: () => r.cells.map(text => ({ textContent: text })),
  }));
  return {
    querySelectorAll() { return rowObjs; },
  };
}

test('buildLogUrl ustawia numer strony', () => {
  assert.equal(
    buildLogUrl('https://pl231.plemiona.pl/game.php?village=9940&screen=premium&mode=log&page=0', 3),
    'https://pl231.plemiona.pl/game.php?village=9940&screen=premium&mode=log&page=3');
});

test('buildLogUrl dodaje page gdy go brak', () => {
  assert.equal(
    buildLogUrl('https://pl231.plemiona.pl/game.php?screen=premium&mode=log', 2),
    'https://pl231.plemiona.pl/game.php?screen=premium&mode=log&page=2');
});

test('extractRawRows czyta wiersze danych', () => {
  const rows = extractRawRows(fakeDoc(readFileSync('test/fixtures/log-page.html', 'utf8')));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].world, 'Świat 231');
  assert.equal(rows[0].info, 'Giełda Premium-kupno: Żelazo (20316)');
});

test('shouldStop true gdy najstarszy wiersz starszy niż sinceDate', () => {
  const rows = extractRawRows(fakeDoc(readFileSync('test/fixtures/log-page.html', 'utf8')));
  // fixture zawiera wpis z 2025 → starszy niż 2026-07-01
  assert.equal(shouldStop(rows, new Date(2026, 6, 1), NOW), true);
  assert.equal(shouldStop(rows, new Date(2020, 0, 1), NOW), false);
});

test('oldestDate zwraca najstarszą datę', () => {
  const rows = extractRawRows(fakeDoc(readFileSync('test/fixtures/log-page.html', 'utf8')));
  assert.equal(oldestDate(rows, NOW).getFullYear(), 2025);
});
