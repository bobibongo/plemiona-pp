// test/wioska-strona.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KLUCZ_MAGAZYNU, uruchom } from '../src/wioska/strona.js';

test('klucz magazynu jest staly', () => {
  assert.equal(KLUCZ_MAGAZYNU, 'plemiona-wioska');
});

// Modul jest sklejany do strony i importowany w testach, wiec bez dokumentu
// musi wyjsc natychmiast, zamiast sie wywrocic.
test('uruchom nie wywraca sie bez dokumentu', () => {
  assert.doesNotThrow(() => uruchom());
});

test('podsumowanieHTML zniklo — zastapil je pasek stanu', async () => {
  const m = await import('../src/wioska/strona.js');
  assert.equal(m.podsumowanieHTML, undefined);
});
