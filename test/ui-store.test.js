// test/ui-store.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImport, parseCSV, countLogRows } from '../src/ui.js';

const NOW = new Date(2026, 6, 20, 12, 0, 0);

test('parseCSV wykrywa separator średnik', () => {
  const rows = parseCSV('a;b;c\n1;2;3');
  assert.deepEqual(rows[1], ['1', '2', '3']);
});

test('normalizeImport z JSON kolektora wzbogaca wiersze', () => {
  const json = JSON.stringify({ rows: [{
    dateRaw: '19.07. 11:13', world: 'Świat 231', txType: 'Giełda Premium',
    changeRaw: '-47', balanceRaw: '974', info: 'Giełda Premium-kupno: Żelazo (20316)' }] });
  const out = normalizeImport(json, 'x.json', NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].category, 'handel');
  assert.equal(out[0].change, -47);
});

test('normalizeImport z CSV logu', () => {
  const csv = 'Data;Świat;Transakcja;Zmiana;Nowe saldo PP;Dalsze informacje\n' +
    '19.07. 11:13;Świat 231;Giełda Premium;-47;974;Giełda Premium-kupno: Żelazo (20316)';
  const out = normalizeImport(csv, 'x.csv', NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].resource, 'zelazo');
});

test('wklejka TSV (kopia tabeli) z wieloma stronami i powtórzonymi nagłówkami', () => {
  const H = 'Data\tŚwiat\tTransakcja\tZmiana\tNowe saldo PP\tDalsze informacje';
  const r1 = '19.07. 11:13\tŚwiat 231\tGiełda Premium\t-47\t974\tGiełda Premium-kupno: Żelazo (20316)';
  const r2 = '19.07. 09:39\tŚwiat 231\tUżycie\t-10\t1114\tHandluj surowcami z miejscowym kupcem';
  const paste = [H, r1, r2, '', H, r2].join('\n');   // druga „strona” z powtórzonym nagłówkiem
  const out = normalizeImport(paste, 'wklejka', NOW);
  assert.equal(out.length, 3);                 // 3 wiersze danych (nagłówki odsiane)
  assert.equal(countLogRows(paste), 3);
  assert.equal(out[0].category, 'handel');
});

test('countLogRows ignoruje śmieci i nagłówki', () => {
  const junk = 'Premium\t944 punkty\n>1< [2] [3] ... [470]\nData\tŚwiat\n19.07. 11:13\tŚwiat 231\tGiełda Premium\t-47\t974\tX';
  assert.equal(countLogRows(junk), 1);
});

test('normalizeImport z legacy Entry[] zwraca jak jest', () => {
  const arr = JSON.stringify([{ ts: '2026-07-19T11:13:00.000Z', world: 'Świat 231', change: -47, info: 'x', category: 'arbitraz' }]);
  const out = normalizeImport(arr, 'legacy.json', NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].category, 'arbitraz');
});
