// test/build.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboard, buildBookmarklet, buildUserscript, buildRatesPage, buildWioskaPage, buildRozdzielnik, buildLanding } from '../build.js';

test('dashboard nie zawiera markerów ani importów', () => {
  const html = buildDashboard();
  assert.doesNotMatch(html, /INJECT:/);
  assert.doesNotMatch(html, /^\s*import\s/m);
  assert.doesNotMatch(html, /^\s*export\s/m);
  assert.match(html, /barChartSVG/); // logika obecna
});

test('bookmarklet jest jedną linią javascript:', () => {
  const bm = buildBookmarklet();
  assert.match(bm, /^javascript:/);
  assert.doesNotMatch(bm, /\bimport\b/);
  assert.doesNotMatch(bm, /\n/);
});

test('bookmarklet nie zawiera komentarzy // (nie połknąłby kodu po sklejeniu)', () => {
  const bm = buildBookmarklet();
  assert.doesNotMatch(bm, /\/\//);
});

test('bookmarklet ma wykonywalny kod tuż po otwarciu IIFE (nie komentarz)', () => {
  const bm = buildBookmarklet();
  const body = bm.replace(/^javascript:\(\(\)=>\{/, '');
  assert.doesNotMatch(body.trimStart().slice(0, 3), /^\/\//);
  assert.match(bm, /parsePremiumDate/);
});

test('userscript ma nagłówek metadanych i pasuje do stron gry', () => {
  const js = buildUserscript();
  assert.match(js, /^\/\/ ==UserScript==/m);
  assert.match(js, /\/\/ ==\/UserScript==/m);
  assert.match(js, /@match\s+https:\/\/\*\.plemiona\.pl\/game\.php\*/);
  assert.match(js, /@grant\s+none/);
});

test('userscript nie zawiera markerów modułów', () => {
  const js = buildUserscript();
  assert.doesNotMatch(js, /^\s*import\s/m);
  assert.doesNotMatch(js, /^\s*export\s/m);
});

test('userscript zawiera logikę odczytu i panelu', () => {
  const js = buildUserscript();
  assert.match(js, /premium_exchange_rate_wood/);
  assert.match(js, /mergeReading/);
  assert.match(js, /panelHTML/);
});

// Warunek nadrzędny specyfikacji: skrypt czyta wyłącznie to, co gracz sam
// otworzył, i nie generuje żadnego ruchu sieciowego. Ten test pilnuje, żeby
// nikt tego nie rozmył przypadkiem przy późniejszej zmianie.
test('userscript nie wykonuje żadnych zapytań sieciowych', () => {
  const js = buildUserscript();
  const zakazane = [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /sendBeacon/,
    /new\s+WebSocket/,
    /EventSource/,
    /\bimportScripts\s*\(/,
    /location\s*\.\s*href\s*=[^=]/,
    /location\s*\.\s*(reload|assign|replace)\s*\(/,
    /\bform\s*\.\s*submit\s*\(/,
  ];
  for (const re of zakazane) {
    assert.doesNotMatch(js, re, `userscript zawiera zakazaną konstrukcję: ${re}`);
  }
});

test('strona kursów nie zawiera markerów ani importów', () => {
  const html = buildRatesPage();
  assert.doesNotMatch(html, /INJECT:/);
  assert.doesNotMatch(html, /^\s*import\s/m);
  assert.doesNotMatch(html, /^\s*export\s/m);
});

test('strona kursów zawiera logikę historii, sygnałów i wykresu', () => {
  const html = buildRatesPage();
  assert.match(html, /mergeHistory/);
  assert.match(html, /evaluateSignals/);
  assert.match(html, /ratesChartSVG/);
});

// Strona ma działać otwarta z dysku, więc nie wolno jej sięgać po nic z sieci.
test('strona kursów jest samowystarczalna — zero odwołań na zewnątrz', () => {
  const html = buildRatesPage();
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /https?:\/\/(?!www\.w3\.org)/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/);
});

test('strona wioski nie zawiera markerów ani importów', () => {
  const html = buildWioskaPage();
  assert.doesNotMatch(html, /INJECT:/);
  assert.doesNotMatch(html, /^\s*import\s/m);
  assert.doesNotMatch(html, /^\s*export\s/m);
});

test('strona wioski zawiera silnik symulacji i dane świata', () => {
  const html = buildWioskaPage();
  assert.match(html, /function symuluj/);
  assert.match(html, /pl231/);
  assert.match(html, /TABELA_G/);
});

// Strona ma dzialac otwarta z dysku, wiec nie wolno jej siegac po nic z sieci.
test('strona wioski jest samowystarczalna — zero odwołań na zewnątrz', () => {
  const html = buildWioskaPage();
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /https?:\/\/(?!www\.w3\.org)/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/);
});

test('strona wioski ma pasek narzędzi, pasek stanu i trzy kolumny', () => {
  const html = buildWioskaPage();
  assert.match(html, /id="pasek-narzedzi"/);
  assert.match(html, /id="stan-wioski"/);
  assert.match(html, /id="lista-dochodow"/);
  assert.match(html, /id="lista-dosylek"/);
});

test('strona wioski nie ma już pól surowców startowych', () => {
  const html = buildWioskaPage();
  assert.doesNotMatch(html, /id="start-drewno"/);
});

test('strona wioski zawiera moduł zapotrzebowania i widoki', () => {
  const html = buildWioskaPage();
  assert.match(html, /function zapotrzebowanie/);
  assert.match(html, /function pasekStanuHTML/);
  assert.match(html, /function wtracenieHTML/);
});

test('rozdzielnik linkuje do wszystkich trzech narzędzi', () => {
  const html = buildRozdzielnik();
  assert.match(html, /href="\.\/pp\/"/);
  assert.match(html, /href="\.\/kursy\/"/);
  assert.match(html, /href="\.\/wioska\/"/);
});

test('strona kolektora wskazuje na dashboard pod nowym adresem', () => {
  const html = buildLanding('javascript:void 0');
  assert.match(html, /href="\.\.\/pp\/"/);
});

test('strona wioski zawiera bilans i kolejnosc budynkow', () => {
  const html = buildWioskaPage();
  assert.match(html, /function bilansHTML/);
  assert.match(html, /function kolejnoscBudynkow/);
});

test('strona wioski nie zawiera osobnego wiersza powodu blokady', () => {
  assert.doesNotMatch(buildWioskaPage(), /class="powod"/);
});