// test/parse.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, extractResource, classify, enrich, entryKey } from '../src/parse.js';

const NOW = new Date(2026, 6, 20, 12, 0, 0);

test('parseNumber usuwa nbsp i znak', () => {
  assert.equal(parseNumber(' -47 '), -47);
  assert.equal(parseNumber(' 1500 '), 1500);
  assert.equal(parseNumber('66'), 66);
});

test('extractResource wykrywa surowiec i ilość', () => {
  assert.deepEqual(extractResource('Giełda Premium-kupno: Żelazo (20316)'),
    { resource: 'zelazo', amount: 20316 });
  assert.deepEqual(extractResource('Giełda Premium-sprzedaż: Glina (905)'),
    { resource: 'glina', amount: 905 });
  assert.deepEqual(extractResource('Redukcja czasu budowy - pl231 - Mur (Poziom 19)'),
    { resource: null, amount: null });
});

test('classify: kupno surowca = arbitraz/kupno', () => {
  const c = classify({ txType: 'Giełda Premium', changeRaw: '-47',
    info: 'Giełda Premium-kupno: Żelazo (20316)' });
  assert.equal(c.category, 'arbitraz');
  assert.equal(c.subtype, 'kupno');
  assert.equal(c.resource, 'zelazo');
  assert.equal(c.amount, 20316);
});

test('classify: sprzedaż mimo typu Przeniesienie = arbitraz/sprzedaz', () => {
  const c = classify({ txType: 'Przeniesienie', changeRaw: '9',
    info: 'Giełda Premium-sprzedaż: Glina (905)' });
  assert.equal(c.category, 'arbitraz');
  assert.equal(c.subtype, 'sprzedaz');
});

test('classify: Użycie = usluga z podtypem', () => {
  assert.equal(classify({ txType: 'Użycie', changeRaw: '-10',
    info: 'Redukcja czasu budowy - pl231 - Mur (Poziom 19)' }).subtype, 'redukcja_czasu');
  assert.equal(classify({ txType: 'Użycie', changeRaw: '-10',
    info: 'Natychmiastowe zakończenie - Spichlerz (Poziom 30)' }).subtype, 'natychmiastowe_zakonczenie');
  assert.equal(classify({ txType: 'Użycie', changeRaw: '-10',
    info: 'Handluj surowcami z miejscowym kupcem' }).subtype, 'handel_kupiec');
  assert.equal(classify({ txType: 'Użycie', changeRaw: '-10',
    info: 'Wskrzeszenie rycerza, skrócenie czasu - Paul' }).subtype, 'rycerz');
  const u = classify({ txType: 'Użycie', changeRaw: '-10',
    info: 'Redukcja czasu budowy - pl231 - Mur (Poziom 19)' });
  assert.equal(u.category, 'usluga');
});

test('classify: Kupno za pieniądze = zewnetrzne_pp/zakup_pp', () => {
  const c = classify({ txType: 'Kupno', changeRaw: '1500',
    info: 'Metoda płatności: przelewy24-worldpay.' });
  assert.equal(c.category, 'zewnetrzne_pp');
  assert.equal(c.subtype, 'zakup_pp');
});

test('classify: Premium subskrypcja = zewnetrzne_pp/subskrypcja', () => {
  const c = classify({ txType: 'Użycie', changeRaw: '-30', info: 'Premium 3' });
  assert.equal(c.category, 'zewnetrzne_pp');
  assert.equal(c.subtype, 'subskrypcja');
});

test('classify: nierozpoznane = inne', () => {
  assert.equal(classify({ txType: 'Coś', changeRaw: '0', info: 'dziwne' }).category, 'inne');
});

test('enrich buduje pełny Entry i entryKey jest stabilny', () => {
  const raw = { dateRaw: '19.07. 11:13', world: 'Świat 231', txType: 'Giełda Premium',
    changeRaw: '-47', balanceRaw: '974', info: 'Giełda Premium-kupno: Żelazo (20316)' };
  const e = enrich(raw, NOW);
  assert.equal(e.world, 'Świat 231');
  assert.equal(e.change, -47);
  assert.equal(e.balance, 974);
  assert.equal(e.category, 'arbitraz');
  assert.equal(typeof e.ts, 'string');
  assert.equal(entryKey(e), `Świat 231|${e.ts}|-47|Giełda Premium-kupno: Żelazo (20316)`);
});
