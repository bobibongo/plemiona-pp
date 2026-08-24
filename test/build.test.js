// test/build.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { buildDashboard, buildBookmarklet, buildUserscript, buildRatesPage, buildWioskaPage, buildRozdzielnik, buildLanding, buildScavBookmarklet, buildScavLanding, buildHandlarzPPBookmarklet, buildHandlarzPPUserscript, buildHandlarzPPLanding, buildKalkulatorCofkiBookmarklet, buildKalkulatorCofkiLanding, buildScavLegalBookmarklet, WIOSKA_LOGIC } from '../build.js';

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

// Regresja: kazdy nowy plik src/wioska/*.js musi trafic do WIOSKA_LOGIC w
// build.js, inaczej strona uzywa funkcji, ktorych bundel nigdy nie zdefiniuje
// — blad ReferenceError wywraca caly skrypt i strona wychodzi pusta.
test('strona wioski definiuje punkty wioski i wykres, nie tylko je wywoluje', () => {
  const html = buildWioskaPage();
  assert.match(html, /function punktyWioski/);
  assert.match(html, /function wykresHTML/);
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

test('rozdzielnik publiczny linkuje do narzędzi bezpiecznych, bez zbieractwa, handlarza PP ani cofki', () => {
  const html = buildRozdzielnik();
  assert.match(html, /href="\.\/pp\/"/);
  assert.match(html, /href="\.\/kursy\/"/);
  assert.match(html, /href="\.\/wioska\/"/);
  assert.match(html, /href="\.\/kolektor\/"/);
  assert.doesNotMatch(html, /zbieractwo/);
  assert.doesNotMatch(html, /handlarz-pp/);
  assert.doesNotMatch(html, /cofka/);
});

test('rozdzielnik rozszerzony dolacza karty zbieractwa, handlarza PP i cofki z poprawnym base', () => {
  const html = buildRozdzielnik({ base: '../', rozszerzony: true });
  assert.match(html, /href="\.\.\/pp\/"/);
  assert.match(html, /href="\.\.\/zbieractwo\/"/);
  assert.match(html, /href="\.\.\/handlarz-pp\/"/);
  assert.match(html, /href="\.\.\/cofka\/"/);
});

test('bookmarklet kalkulatora cofki jest jedną linią javascript: bez importów/komentarzy', () => {
  const bm = buildKalkulatorCofkiBookmarklet();
  assert.match(bm, /^javascript:/);
  assert.doesNotMatch(bm, /\bimport\b/);
  assert.doesNotMatch(bm, /\n/);
  assert.doesNotMatch(bm, /\/\//);
  assert.match(bm, /obliczPrzerwanie/);
});

test('bookmarklet kalkulatora cofki nie klika i nie wysyla nic — tylko liczy i wyswietla', () => {
  const bm = buildKalkulatorCofkiBookmarklet();
  assert.doesNotMatch(bm, /action=cancel/);
  assert.doesNotMatch(bm, /\.submit\s*\(/);
});

test('strona kalkulatora cofki zawiera bookmarklet i instrukcję', () => {
  const html = buildKalkulatorCofkiLanding('javascript:void 0');
  assert.match(html, /javascript:void 0/);
  assert.match(html, /Kalkulator cofki/);
});

test('bookmarklet zbieractwa jest jedną linią javascript: bez importów/komentarzy', () => {
  const bm = buildScavBookmarklet();
  assert.match(bm, /^javascript:/);
  assert.doesNotMatch(bm, /\bimport\b/);
  assert.doesNotMatch(bm, /\n/);
  assert.doesNotMatch(bm, /\/\//);
  assert.match(bm, /czasZbieractwaSekundy/);
});

test('strona zbieractwa zawiera bookmarklet i instrukcję', () => {
  const html = buildScavLanding('javascript:void 0');
  assert.match(html, /javascript:void 0/);
  assert.match(html, /Zbieractwo masowe/);
});

test('bookmarklet handlarza PP jest jedną linią javascript: bez importów/komentarzy', () => {
  const bm = buildHandlarzPPBookmarklet();
  assert.match(bm, /^javascript:/);
  assert.doesNotMatch(bm, /\bimport\b/);
  assert.doesNotMatch(bm, /\n/);
  assert.doesNotMatch(bm, /\/\//);
  assert.match(bm, /obliczIlosc/);
});

test('bookmarklet handlarza PP nie klika i nie wysyla nic — tylko odczyt i wypelnienie pola', () => {
  const bm = buildHandlarzPPBookmarklet();
  assert.doesNotMatch(bm, /\.submit\s*\(/);
  assert.doesNotMatch(bm, /btn-premium-exchange-buy/);
});

test('userscript handlarza PP ma naglowek metadanych i pasuje tylko do strony gieldy premium', () => {
  const us = buildHandlarzPPUserscript();
  assert.match(us, /^\/\/ ==UserScript==/m);
  assert.match(us, /\/\/ ==\/UserScript==/m);
  assert.match(us, /@match\s+https:\/\/\*\.plemiona\.pl\/game\.php\?\*screen=market\*mode=exchange\*/);
  assert.doesNotMatch(us, /^\s*import\s/m);
  assert.doesNotMatch(us, /^\s*export\s/m);
  assert.match(us, /obliczIlosc/);
});

test('strona handlarza PP zawiera bookmarklet, link do userscriptu i instrukcję', () => {
  const html = buildHandlarzPPLanding('javascript:void 0');
  assert.match(html, /javascript:void 0/);
  assert.match(html, /handlarz-pp\.user\.js/);
  assert.match(html, /Handlarz PP/);
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

// Regresja konkretna: kazdy plik src/wioska/*.js musi byc wymieniony w
// WIOSKA_LOGIC (build.js), inaczej strona po sklejeniu uzywa funkcji, ktorych
// bundel nigdy nie zdefiniowal — a testy jednostkowe tego nie widza, bo
// importuja moduly bezposrednio z node, nie ze sklejonego bundla.
test('strona wioski zawiera silnik rekrutacji', () => {
  const html = buildWioskaPage();
  assert.match(html, /function czasRekrutacji/);
  assert.match(html, /function osRekrutacjiBezPrzestojow/);
  assert.match(html, /id="lista-rekrutacji"/);
});

test('kazdy plik src/wioska/*.js jest wymieniony w WIOSKA_LOGIC', () => {
  // odczyt-ratusza.js sluzy wylacznie kalibracji tabeli G i testom (patrz
  // naglowek pliku) — strona symulatora swiadomie go nie uzywa.
  const SWIADOMIE_POZA_BUNDLEM = new Set(['odczyt-ratusza.js']);
  const naDysku = readdirSync(new URL('../src/wioska/', import.meta.url))
    .filter(f => f.endsWith('.js') && !SWIADOMIE_POZA_BUNDLEM.has(f))
    .map(f => `src/wioska/${f}`)
    .sort();
  const wBundlu = [...WIOSKA_LOGIC].sort();
  assert.deepEqual(wBundlu, naDysku);
});
// Bookmarklety sa sklejane z modulow ES i wstrzykiwane jako jedna linia
// javascript:. Jesli stripModule zostawi ogon wielolinijkowego importu albo
// eksportu, przegladarka odrzuci CALY bookmarklet z SyntaxError i skrypt sie
// nie odpali. Sprawdzamy wiec, ze wynik da sie w ogole sparsowac.
test('kazdy bookmarklet jest skladniowo poprawnym JS', () => {
  const bookmarklety = {
    kolektor: buildBookmarklet(),
    zbieractwo: buildScavBookmarklet(),
    'zbieractwo-legal': buildScavLegalBookmarklet(),
    'handlarz-pp': buildHandlarzPPBookmarklet(),
    cofka: buildKalkulatorCofkiBookmarklet(),
  };
  for (const [nazwa, bm] of Object.entries(bookmarklety)) {
    const cialo = bm.replace(/^javascript:/, '');
    assert.doesNotThrow(() => new Function(cialo), nazwa + ': bookmarklet nie parsuje sie jako JS');
  }
});

test('sklejone zrodla bookmarkletow nie zawieraja resztek import/export', () => {
  const bookmarklety = [buildScavBookmarklet(), buildScavLegalBookmarklet(), buildHandlarzPPBookmarklet()];
  for (const bm of bookmarklety) {
    assert.equal(/\bfrom\s+'\.\//.test(bm), false, 'zostal ogon instrukcji import/export');
  }
});
