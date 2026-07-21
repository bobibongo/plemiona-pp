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

test('Handel: kupno surowca', () => {
  const c = classify({ txType: 'Giełda Premium', changeRaw: '-47',
    info: 'Giełda Premium-kupno: Żelazo (20316)' });
  assert.equal(c.category, 'handel');
  assert.equal(c.subtype, 'kupno');
  assert.equal(c.label, 'Kupno');
  assert.equal(c.resource, 'zelazo');
  assert.equal(c.amount, 20316);
});

test('Handel: sprzedaż mimo typu Przeniesienie', () => {
  const c = classify({ txType: 'Przeniesienie', changeRaw: '9',
    info: 'Giełda Premium-sprzedaż: Glina (905)' });
  assert.equal(c.category, 'handel');
  assert.equal(c.subtype, 'sprzedaz');
  assert.equal(c.label, 'Sprzedaż');
});

test('Zakup PP: typ Kupno (realne pieniądze)', () => {
  const c = classify({ txType: 'Kupno', changeRaw: '1500',
    info: 'Metoda płatności: przelewy24-worldpay.' });
  assert.equal(c.category, 'zakup_pp');
  assert.equal(c.label, 'Zakup PP');
});

test('Zakup PP: Przeniesienie od gracza (nie handel)', () => {
  const c = classify({ txType: 'Przeniesienie', changeRaw: '500',
    info: 'Przeniesienie punktów premium od gracza XYZ' });
  assert.equal(c.category, 'zakup_pp');
  assert.equal(c.label, 'Zakup PP');
});

test('Subskrypcje: różne typy', () => {
  const cases = [
    ['Konto premium - 30 dni', 'Konto premium'],
    ['Premium 3', 'Konto premium'],
    ['Menadżer konta', 'Menadżer konta'],
    ['Asystent farmera', 'Asystent farmera'],
    ['+20% wydobywanego żelaza', '+20% żelaza'],
    ['+20% produkowanej gliny', '+20% gliny'],
    ['+20% produkowanego drewna', '+20% drewna'],
  ];
  for (const [info, label] of cases) {
    const c = classify({ txType: 'Użycie', changeRaw: '-30', info });
    assert.equal(c.category, 'subskrypcje', `kategoria dla: ${info}`);
    assert.equal(c.label, label, `label dla: ${info}`);
  }
});

test('Usługi: różne typy', () => {
  const cases = [
    ['Redukcja czasu budowy - pl231 - Mur (Poziom 19)', 'Redukcja czasu budowy'],
    ['Natychmiastowe zakończenie - Spichlerz (Poziom 30)', 'Natychmiastowe zakończenie'],
    ['Handluj surowcami z miejscowym kupcem', 'Handel z miejscowym kupcem'],
    ['Wymiana manuskryptu', 'Wymiana manuskryptu'],
    ['Wskrzeszenie rycerza, skrócenie czasu - Paul', 'Wskrzeszenie rycerza'],
    ['Rekrutacja rycerza, skrócenie czasu - Paul', 'Rekrutacja rycerza'],
    ['Przekwalifikowanie rycerza', 'Przekwalifikowanie rycerza'],
    ['Zmniejsz koszt budowy - - Pałac (Poziom 1)', 'Zmniejsz koszt budowy'],
  ];
  for (const [info, label] of cases) {
    const c = classify({ txType: 'Użycie', changeRaw: '-10', info });
    assert.equal(c.category, 'uslugi', `kategoria dla: ${info}`);
    assert.equal(c.label, label, `label dla: ${info}`);
  }
});

test('Eventy: nieznane, grupowane po nazwie', () => {
  assert.equal(classify({ txType: 'Użycie', changeRaw: '5', info: 'Otwarcie prezentu' }).category, 'eventy');
  assert.equal(classify({ txType: 'Użycie', changeRaw: '5', info: 'Otwarcie prezentu' }).label, 'Otwarcie prezentu');
  assert.equal(classify({ txType: 'Coś', changeRaw: '0', info: 'Zakręcenie kołem - nagroda (10)' }).label, 'Zakręcenie kołem');
});

test('Eventy: pusty opis -> etykieta z typu transakcji', () => {
  assert.equal(classify({ txType: 'Darmowe PP', changeRaw: '100', info: '' }).label, 'Darmowe PP');
  assert.equal(classify({ txType: 'Nagroda końcowa', changeRaw: '500', info: 'World winner' }).label, 'World winner');
  assert.equal(classify({ txType: 'Ręcznie', changeRaw: '30', info: '' }).label, 'Ręcznie');
});

test('enrich buduje pełny Entry i entryKey jest stabilny', () => {
  const raw = { dateRaw: '19.07. 11:13', world: 'Świat 231', txType: 'Giełda Premium',
    changeRaw: '-47', balanceRaw: '974', info: 'Giełda Premium-kupno: Żelazo (20316)' };
  const e = enrich(raw, NOW);
  assert.equal(e.world, 'Świat 231');
  assert.equal(e.change, -47);
  assert.equal(e.balance, 974);
  assert.equal(e.category, 'handel');
  assert.equal(e.label, 'Kupno');
  assert.equal(typeof e.ts, 'string');
  assert.equal(entryKey(e), `Świat 231|${e.ts}|-47|974|Giełda Premium-kupno: Żelazo (20316)`);
});
