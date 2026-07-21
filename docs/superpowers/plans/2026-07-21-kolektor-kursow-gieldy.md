# Kolektor kursów giełdy — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Userscript, który przy każdym wejściu na ekran giełdy premium odczytuje z DOM trzy kursy i kontynent bieżącej wioski, trzyma migawkę per kontynent w `localStorage` i pozwala wyeksportować całość do pliku JSON.

**Architecture:** Cztery moduły w `src/` z prefiksem `rates-`. Trzy pierwsze to czyste funkcje (parsowanie, magazyn, generowanie HTML panelu) testowane przez `node --test` bez przeglądarki; czwarty to cienka warstwa przeglądarkowa, która je spina. `build.js` skleja je w jeden plik `dist/kursy.user.js` z nagłówkiem metadanych userscriptu.

**Tech Stack:** Vanilla JS, moduły ES, zero zależności runtime, `node --test`. Dokładnie jak reszta repozytorium.

**Spec:** `docs/superpowers/specs/2026-07-21-kolektor-kursow-gieldy-design.md`

## Global Constraints

- **Zero zapytań sieciowych.** Kod nie może zawierać `fetch`, `XMLHttpRequest`, `navigator.sendBeacon`, `WebSocket`, `EventSource`, ani wymuszać nawigacji (`location.href = …`, `location.reload()`). Test w zadaniu 5 tego pilnuje automatycznie.
- **Zero zależności npm.** Testy budują zastępczy `Document` z fixture przez wyrażenia regularne, jak w `test/collector.test.js`.
- Moduły ES z `export`; `build.js` usuwa `import`/`export` przy sklejaniu.
- Komentarze i teksty interfejsu po polsku, jak w reszcie repozytorium.
- Nazwy plików po angielsku, płasko w `src/` — konwencja istniejącego kodu.
- Jednostka kursu: **ilość surowca za 1 PP**. Brak podziału na kupno/sprzedaż.
- Uruchamiać testy z katalogu głównego repozytorium: `npm test`.

---

## Struktura plików

| Plik | Odpowiedzialność |
|---|---|
| `src/rates-parse.js` | Odczyt kursów i lokalizacji z dokumentu. Czyste funkcje, wejście to `Document`. |
| `src/rates-store.js` | Migawka per kontynent, klucz magazynu, ładunek i nazwa pliku eksportu. Czyste funkcje. |
| `src/rates-panel.js` | HTML panelu (czysta funkcja) + montaż w przeglądarce i obsługa przycisków. |
| `src/rates-collector.js` | Punkt wejścia userscriptu: odczyt → zapis → panel. |
| `build.js` | Nowy cel `buildUserscript()` → `dist/kursy.user.js`. |
| `test/fixtures/exchange-screen.html` | Prawdziwy wycinek ekranu giełdy (już w repozytorium). |
| `test/rates-parse.test.js` | Testy parsowania. |
| `test/rates-store.test.js` | Testy magazynu i eksportu. |
| `test/rates-panel.test.js` | Testy generowanego HTML. |
| `test/build.test.js` | Rozszerzone o userscript i gwarancję braku sieci. |

---

### Task 1: Odczyt kursów

**Files:**
- Create: `src/rates-parse.js`
- Create: `test/rates-parse.test.js`
- Fixture: `test/fixtures/exchange-screen.html` (istnieje już w repozytorium — zawiera prawdziwy HTML wiersza „Kurs" oraz `<b class="nowrap">(499|613) K64</b>`)

**Interfaces:**
- Consumes: nic
- Produces:
  - `parseRate(text: string) → number | null`
  - `readRates(doc: Document) → { wood: number, stone: number, iron: number } | null`

- [ ] **Step 1: Napisz test, który ma nie przejść**

Utwórz `test/rates-parse.test.js`:

```js
// test/rates-parse.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRate, readRates } from '../src/rates-parse.js';

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
  assert.equal(parseRate('1 234'), 1234);
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
```

- [ ] **Step 2: Uruchom test i potwierdź, że nie przechodzi**

Run: `npm test -- test/rates-parse.test.js`
Expected: FAIL — `Cannot find module '../src/rates-parse.js'`

- [ ] **Step 3: Napisz minimalną implementację**

Utwórz `src/rates-parse.js`:

```js
// src/rates-parse.js
// Odczyt kursów giełdy premium z dokumentu, który gracz sam otworzył.
// Ten moduł niczego nie pobiera — dostaje gotowy Document i tylko go czyta.

const RATE_IDS = {
  wood: 'premium_exchange_rate_wood',
  stone: 'premium_exchange_rate_stone',
  iron: 'premium_exchange_rate_iron',
};

// Komórka kursu to "<ikona> 378  ⇄  <ikona> 1". Bierzemy pierwszą liczbę, ale
// tak, żeby nie skleiła się z jedynką po strzałce: po spacji akceptujemy dalszy
// ciąg tylko jako pełną trójkę cyfr (separator tysięcy).
export function parseRate(text) {
  const m = String(text ?? '').replace(/ /g, ' ').match(/\d+(?:[ .]\d{3})*/);
  if (!m) return null;
  const n = Number(m[0].replace(/[ .]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Albo komplet trzech kursów, albo null. Częściowy odczyt jest bezużyteczny
// i groziłby nadpisaniem dobrego wiersza połową danych.
export function readRates(doc) {
  const out = {};
  for (const [res, id] of Object.entries(RATE_IDS)) {
    const cell = doc.getElementById(id);
    if (!cell) return null;
    const seps = cell.querySelectorAll ? cell.querySelectorAll('.premium-exchange-sep') : null;
    const source = (seps && seps[0]) || cell;
    const value = parseRate(source.textContent);
    if (value === null) return null;
    out[res] = value;
  }
  return out;
}
```

- [ ] **Step 4: Uruchom testy i potwierdź, że przechodzą**

Run: `npm test -- test/rates-parse.test.js`
Expected: PASS, 7 testów

- [ ] **Step 5: Commit**

```bash
git add src/rates-parse.js test/rates-parse.test.js test/fixtures/exchange-screen.html
git commit -m "feat: odczyt kursow gieldy premium z DOM"
```

---

### Task 2: Kontynent i pełny odczyt

**Files:**
- Modify: `src/rates-parse.js` (dopisanie na końcu pliku)
- Modify: `test/rates-parse.test.js` (dopisanie testów)

**Interfaces:**
- Consumes: `readRates(doc)` z zadania 1
- Produces:
  - `continentFromCoords(x: number, y: number) → string` (np. `'K64'`)
  - `parseLocation(text: string) → { x: number, y: number, continent: string } | null`
  - `findLocation(doc: Document) → { x, y, continent } | null`
  - `readReading(doc: Document, now?: Date) → { continent: string|null, x: number|null, y: number|null, wood: number, stone: number, iron: number, at: string } | null`

- [ ] **Step 1: Napisz testy, które mają nie przejść**

Dopisz na końcu `test/rates-parse.test.js` (rozszerz też pierwszą linię importu):

```js
import {
  parseRate, readRates,
  continentFromCoords, parseLocation, findLocation, readReading,
} from '../src/rates-parse.js';
```

```js
test('continentFromCoords liczy kontynent z dzielenia przez 100', () => {
  assert.equal(continentFromCoords(499, 613), 'K64');
  assert.equal(continentFromCoords(500, 500), 'K55');
  assert.equal(continentFromCoords(99, 61), 'K00');
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
```

- [ ] **Step 2: Uruchom testy i potwierdź, że nie przechodzą**

Run: `npm test -- test/rates-parse.test.js`
Expected: FAIL — `continentFromCoords is not a function`

- [ ] **Step 3: Napisz implementację**

Dopisz na końcu `src/rates-parse.js`:

```js
// Lokalizacja wioski: "(499|613) K64". Oznaczenie kontynentu bywa pominięte,
// dlatego jest w grupie opcjonalnej.
const LOC_RE = /\((\d+)\|(\d+)\)(?:\s*K(\d+))?/;

// Dzielimy przez 100 zamiast brać pierwszą cyfrę, żeby współrzędne
// dwucyfrowe dawały K00, a nie K69.
export function continentFromCoords(x, y) {
  return 'K' + Math.floor(y / 100) + Math.floor(x / 100);
}

export function parseLocation(text) {
  const m = LOC_RE.exec(String(text ?? ''));
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  return { x, y, continent: m[3] ? 'K' + m[3] : continentFromCoords(x, y) };
}

// Nie kotwiczymy się na układzie tabeli — szukamy pierwszego elementu,
// którego treść wygląda jak lokalizacja wioski.
export function findLocation(doc) {
  const els = doc.querySelectorAll('b.nowrap, .nowrap, #header_info b');
  for (const el of els) {
    const loc = parseLocation(el.textContent);
    if (loc) return loc;
  }
  return null;
}

// Pełny odczyt. null oznacza „to nie ten ekran" i nie rusza magazynu.
// Odczyt z continent === null jest ważny do pokazania w panelu, ale magazyn
// go odrzuci — nie wiadomo, który wiersz miałby nadpisać.
export function readReading(doc, now = new Date()) {
  const rates = readRates(doc);
  if (!rates) return null;
  const loc = findLocation(doc);
  return {
    continent: loc ? loc.continent : null,
    x: loc ? loc.x : null,
    y: loc ? loc.y : null,
    wood: rates.wood,
    stone: rates.stone,
    iron: rates.iron,
    at: now.toISOString(),
  };
}
```

- [ ] **Step 4: Uruchom testy i potwierdź, że przechodzą**

Run: `npm test -- test/rates-parse.test.js`
Expected: PASS, 15 testów

- [ ] **Step 5: Commit**

```bash
git add src/rates-parse.js test/rates-parse.test.js
git commit -m "feat: ustalanie kontynentu i pelny odczyt kursow"
```

---

### Task 3: Magazyn migawkowy i eksport

**Files:**
- Create: `src/rates-store.js`
- Create: `test/rates-store.test.js`

**Interfaces:**
- Consumes: kształt odczytu z zadania 2
- Produces:
  - `worldFromHost(host: string) → string`
  - `storageKey(world: string) → string`
  - `sortReadings(readings: Reading[]) → Reading[]`
  - `mergeReading(readings: Reading[], reading: Reading|null) → Reading[]`
  - `buildExport(world: string, readings: Reading[], now?: Date) → { exportedAt, world, readings }`
  - `exportFilename(world: string, now?: Date) → string`

- [ ] **Step 1: Napisz testy, które mają nie przejść**

Utwórz `test/rates-store.test.js`:

```js
// test/rates-store.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  worldFromHost, storageKey, sortReadings, mergeReading, buildExport, exportFilename,
} from '../src/rates-store.js';

const r = (continent, wood, at = '2026-07-21T14:30:12.000Z') =>
  ({ continent, x: 1, y: 2, wood, stone: 2, iron: 3, at });

test('worldFromHost bierze pierwszy człon nazwy hosta', () => {
  assert.equal(worldFromHost('pl231.plemiona.pl'), 'pl231');
});

test('worldFromHost nie wywraca się na pustym wejściu', () => {
  assert.equal(worldFromHost(''), 'nieznany');
  assert.equal(worldFromHost(undefined), 'nieznany');
});

test('storageKey rozdziela światy', () => {
  assert.notEqual(storageKey('pl231'), storageKey('pl217'));
  assert.match(storageKey('pl231'), /pl231/);
});

test('sortReadings układa kontynenty rosnąco po numerze, nie alfabetycznie', () => {
  const out = sortReadings([r('K64', 1), r('K5', 2), r('K45', 3)]);
  assert.deepEqual(out.map(x => x.continent), ['K5', 'K45', 'K64']);
});

test('mergeReading dokłada nowy kontynent', () => {
  const out = mergeReading([r('K45', 325)], r('K64', 378));
  assert.deepEqual(out.map(x => x.continent), ['K45', 'K64']);
});

test('mergeReading nadpisuje kontynent zamiast dokładać drugi wiersz', () => {
  const out = mergeReading([r('K64', 378), r('K45', 325)], r('K64', 401));
  assert.equal(out.length, 2);
  assert.equal(out.find(x => x.continent === 'K64').wood, 401);
});

test('mergeReading odrzuca odczyt bez kontynentu i nie rusza stanu', () => {
  const przed = [r('K64', 378)];
  const out = mergeReading(przed, { continent: null, wood: 999 });
  assert.deepEqual(out, przed);
  assert.deepEqual(mergeReading(przed, null), przed);
});

test('buildExport składa ładunek zgodny ze specyfikacją', () => {
  const out = buildExport('pl231', [r('K64', 378)], new Date('2026-07-21T14:32:00.000Z'));
  assert.equal(out.exportedAt, '2026-07-21T14:32:00.000Z');
  assert.equal(out.world, 'pl231');
  assert.equal(out.readings.length, 1);
  assert.equal(out.readings[0].continent, 'K64');
});

test('exportFilename niesie świat i moment eksportu', () => {
  const name = exportFilename('pl231', new Date(2026, 6, 21, 14, 32));
  assert.equal(name, 'plemiona-kursy-pl231-20260721-1432.json');
});
```

- [ ] **Step 2: Uruchom testy i potwierdź, że nie przechodzą**

Run: `npm test -- test/rates-store.test.js`
Expected: FAIL — `Cannot find module '../src/rates-store.js'`

- [ ] **Step 3: Napisz implementację**

Utwórz `src/rates-store.js`:

```js
// src/rates-store.js
// Migawka kursów: jeden wiersz na kontynent, nadpisywany przy powrocie.

export const STORE_PREFIX = 'plemiona-kursy';

// pl231.plemiona.pl → pl231
export function worldFromHost(host) {
  const first = String(host ?? '').split('.')[0];
  return first || 'nieznany';
}

// Klucz zawiera świat, żeby dane z dwóch światów się nie zmieszały.
export function storageKey(world) {
  return `${STORE_PREFIX}:${world}`;
}

// 'K5' < 'K45' < 'K64' — po numerze, bo alfabetycznie wyszłoby K45, K5, K64.
function continentNumber(continent) {
  const n = Number(String(continent).replace(/^K/, ''));
  return Number.isFinite(n) ? n : Infinity;
}

export function sortReadings(readings) {
  return [...readings].sort((a, b) => continentNumber(a.continent) - continentNumber(b.continent));
}

// Odczyt bez kontynentu nigdy nie trafia do magazynu — nie wiadomo, który
// wiersz miałby nadpisać. Zasada: popsuty odczyt nie psuje dobrego.
export function mergeReading(readings, reading) {
  if (!reading || !reading.continent) return sortReadings(readings);
  const rest = readings.filter(x => x.continent !== reading.continent);
  return sortReadings([...rest, reading]);
}

export function buildExport(world, readings, now = new Date()) {
  return { exportedAt: now.toISOString(), world, readings: sortReadings(readings) };
}

// plemiona-kursy-pl231-20260721-1432.json — kolejne eksporty odkładają się
// obok siebie, więc da się z nich później odtworzyć historię kursu.
export function exportFilename(world, now = new Date()) {
  const p = n => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`
    + `-${p(now.getHours())}${p(now.getMinutes())}`;
  return `plemiona-kursy-${world}-${stamp}.json`;
}
```

- [ ] **Step 4: Uruchom testy i potwierdź, że przechodzą**

Run: `npm test -- test/rates-store.test.js`
Expected: PASS, 9 testów

- [ ] **Step 5: Commit**

```bash
git add src/rates-store.js test/rates-store.test.js
git commit -m "feat: migawkowy magazyn kursow per kontynent"
```

---

### Task 4: Panel

**Files:**
- Create: `src/rates-panel.js`
- Create: `test/rates-panel.test.js`

**Interfaces:**
- Consumes: kształt odczytu z zadania 2
- Produces:
  - `PANEL_ID: string`
  - `PANEL_CSS: string`
  - `panelHTML(state: { readings, justUpdated?, warning?, collapsed? }) → string`
  - `mountPanel(state: { readings, justUpdated, warning, world, key }) → void` (tylko przeglądarka)

`mountPanel` jest warstwą przeglądarkową i nie ma testu jednostkowego; cała logika układu siedzi w `panelHTML`, które testujemy jako czystą funkcję.

- [ ] **Step 1: Napisz testy, które mają nie przejść**

Utwórz `test/rates-panel.test.js`:

```js
// test/rates-panel.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panelHTML, PANEL_ID, PANEL_CSS } from '../src/rates-panel.js';

const r = (continent, wood, stone, iron, at = '2026-07-21T14:30:00') =>
  ({ continent, x: 1, y: 2, wood, stone, iron, at });

test('panelHTML pokazuje wiersz na kontynent z trzema kursami', () => {
  const html = panelHTML({ readings: [r('K64', 378, 372, 406)] });
  assert.match(html, /K64/);
  assert.match(html, /378/);
  assert.match(html, /372/);
  assert.match(html, /406/);
});

test('panelHTML ma nagłówki kolumn surowców', () => {
  const html = panelHTML({ readings: [] });
  assert.match(html, /Drewno/);
  assert.match(html, /Glina/);
  assert.match(html, /Żelazo/);
});

test('panelHTML podświetla wiersz właśnie zaktualizowany', () => {
  const html = panelHTML({ readings: [r('K64', 1, 2, 3), r('K45', 4, 5, 6)], justUpdated: 'K45' });
  const wiersze = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g);
  const k45 = wiersze.find(w => w.includes('K45'));
  const k64 = wiersze.find(w => w.includes('K64'));
  assert.match(k45, /kp-hit/);
  assert.doesNotMatch(k64, /kp-hit/);
});

test('panelHTML blokuje eksport przy pustej pamięci', () => {
  assert.match(panelHTML({ readings: [] }), /data-act="export"[^>]*disabled/);
  assert.doesNotMatch(panelHTML({ readings: [r('K64', 1, 2, 3)] }), /data-act="export"[^>]*disabled/);
});

test('panelHTML pokazuje ostrzeżenie, gdy jest', () => {
  const html = panelHTML({ readings: [], warning: 'Nie rozpoznano kontynentu' });
  assert.match(html, /Nie rozpoznano kontynentu/);
});

test('panelHTML zwinięty pokazuje sam pasek, bez tabeli', () => {
  const html = panelHTML({ readings: [r('K64', 378, 372, 406)], collapsed: true });
  assert.doesNotMatch(html, /<table/);
  assert.match(html, /Kursy giełdy/);
});

test('panelHTML odmienia liczbę kontynentów po polsku', () => {
  assert.match(panelHTML({ readings: [r('K1', 1, 2, 3)] }), /1 kontynent\b/);
  assert.match(panelHTML({ readings: [r('K1', 1, 2, 3), r('K2', 1, 2, 3)] }), /2 kontynenty\b/);
  const piec = ['K1', 'K2', 'K3', 'K4', 'K5'].map(c => r(c, 1, 2, 3));
  assert.match(panelHTML({ readings: piec }), /5 kontynentów\b/);
});

test('panelHTML nie wpuszcza surowego HTML z odczytu', () => {
  const html = panelHTML({ readings: [r('<img src=x>', 1, 2, 3)] });
  assert.doesNotMatch(html, /<img src=x>/);
  assert.match(html, /&lt;img/);
});

test('panel ma własne style i stały identyfikator', () => {
  assert.equal(typeof PANEL_ID, 'string');
  assert.match(PANEL_CSS, new RegExp('#' + PANEL_ID));
});
```

- [ ] **Step 2: Uruchom testy i potwierdź, że nie przechodzą**

Run: `npm test -- test/rates-panel.test.js`
Expected: FAIL — `Cannot find module '../src/rates-panel.js'`

- [ ] **Step 3: Napisz implementację**

Utwórz `src/rates-panel.js`:

```js
// src/rates-panel.js
// Panel w rogu ekranu gry. Układ generuje czysta funkcja panelHTML, więc da się
// go testować bez przeglądarki; mountPanel to cienka warstwa DOM nad nią.

import { buildExport, exportFilename } from './rates-store.js';

export const PANEL_ID = 'kursy-panel';
const COLLAPSE_KEY = 'plemiona-kursy:zwiniety';

const RES = [['wood', 'Drewno'], ['stone', 'Glina'], ['iron', 'Żelazo']];

// Styl własny panelu — nie zależymy od CSS gry, żeby zmiana skórki go nie zepsuła.
// Motyw jak w dashboardzie: pergamin, oksbloodowy akcent.
export const PANEL_CSS = `
#${PANEL_ID} { position: fixed; top: 12px; right: 12px; z-index: 2147483000;
  font: 12px system-ui, -apple-system, "Segoe UI", sans-serif; color: #38291a;
  background: #f4ead2; border: 1px solid #c4ac7c; border-radius: 6px;
  box-shadow: 0 8px 22px rgba(0,0,0,.38); min-width: 240px; }
#${PANEL_ID} .kp-bar { display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  background: #7c2b2b; color: #f6ecd4; border-radius: 5px 5px 0 0; }
#${PANEL_ID} .kp-title { font-weight: 700; font-size: 11px; letter-spacing: .08em;
  text-transform: uppercase; flex: 1; }
#${PANEL_ID} .kp-btn-icon { background: none; border: none; color: #f6ecd4; cursor: pointer;
  font-size: 13px; line-height: 1; padding: 2px 4px; }
#${PANEL_ID} table { border-collapse: collapse; width: 100%; }
#${PANEL_ID} th, #${PANEL_ID} td { padding: 4px 8px; text-align: right;
  border-bottom: 1px solid #dccca4; }
#${PANEL_ID} th { font-size: 10px; letter-spacing: .06em; text-transform: uppercase;
  color: #7c2b2b; }
#${PANEL_ID} th:first-child, #${PANEL_ID} td:first-child { text-align: left; }
#${PANEL_ID} td { font-family: ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums; }
#${PANEL_ID} tr.kp-hit td { background: rgba(168,132,44,.3); }
#${PANEL_ID} .kp-empty { text-align: center; color: #93805f; font-style: italic; }
#${PANEL_ID} .kp-warn { padding: 5px 8px; background: #f6dcd6; color: #a5372a; font-size: 11px; }
#${PANEL_ID} .kp-foot { display: flex; align-items: center; gap: 6px; padding: 6px 8px; }
#${PANEL_ID} .kp-count { flex: 1; color: #6b543a; font-size: 11px; }
#${PANEL_ID} .kp-btn { padding: 4px 10px; border: 1px solid #c4ac7c; border-radius: 4px;
  background: #ecdfbf; color: #38291a; font: inherit; font-weight: 600; cursor: pointer; }
#${PANEL_ID} .kp-btn[disabled] { opacity: .45; cursor: default; }
`;

function esc(value) {
  return String(value).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function hhmm(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// 1 kontynent / 2–4 kontynenty / 5+ kontynentów, z wyjątkiem nastolatek (12–14).
function odmiana(n) {
  if (n === 1) return 'kontynent';
  const dwie = n % 100;
  const jedna = n % 10;
  if (jedna >= 2 && jedna <= 4 && !(dwie >= 12 && dwie <= 14)) return 'kontynenty';
  return 'kontynentów';
}

export function panelHTML({ readings, justUpdated = null, warning = null, collapsed = false }) {
  const bar = `<div class="kp-bar"><span class="kp-title">Kursy giełdy</span>`
    + `<button class="kp-btn-icon" data-act="collapse" title="${collapsed ? 'Rozwiń' : 'Zwiń'}">`
    + `${collapsed ? '▣' : '─'}</button>`
    + `<button class="kp-btn-icon" data-act="hide" title="Ukryj">✕</button></div>`;
  if (collapsed) return bar;

  const head = `<tr><th>K</th>${RES.map(([, label]) => `<th>${label}</th>`).join('')}</tr>`;
  const body = readings.length
    ? readings.map(row => {
        const hit = row.continent === justUpdated ? ' class="kp-hit"' : '';
        const cells = RES.map(([key]) => `<td>${esc(row[key])}</td>`).join('');
        return `<tr${hit}><td>${esc(row.continent)}</td>${cells}</tr>`;
      }).join('')
    : `<tr><td colspan="4" class="kp-empty">Brak odczytów</td></tr>`;

  const warn = warning ? `<div class="kp-warn">${esc(warning)}</div>` : '';
  const latest = readings.reduce((max, row) => (row.at > max ? row.at : max), '');
  const stamp = latest ? ` · ${hhmm(latest)}` : '';
  const count = `${readings.length} ${odmiana(readings.length)}${stamp}`;
  const disabled = readings.length ? '' : ' disabled';

  return bar + `<table><thead>${head}</thead><tbody>${body}</tbody></table>` + warn
    + `<div class="kp-foot"><span class="kp-count">${count}</span>`
    + `<button class="kp-btn" data-act="export"${disabled}>Eksportuj</button>`
    + `<button class="kp-btn" data-act="clear">Wyczyść</button></div>`;
}

// ——— Warstwa przeglądarkowa ———

function pobierzPlik(world, readings) {
  const now = new Date();
  const tekst = JSON.stringify(buildExport(world, readings, now), null, 2);
  const url = URL.createObjectURL(new Blob([tekst], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFilename(world, now);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function mountPanel(state) {
  if (!document.getElementById(PANEL_ID + '-css')) {
    const style = document.createElement('style');
    style.id = PANEL_ID + '-css';
    style.textContent = PANEL_CSS;
    document.head.appendChild(style);
  }

  let el = document.getElementById(PANEL_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = PANEL_ID;
    document.body.appendChild(el);
  }

  let collapsed = false;
  try { collapsed = localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { collapsed = false; }

  const render = () => { el.innerHTML = panelHTML({ ...state, collapsed }); };
  render();

  el.addEventListener('click', event => {
    const act = event.target && event.target.getAttribute
      ? event.target.getAttribute('data-act') : null;
    if (!act) return;

    if (act === 'collapse') {
      collapsed = !collapsed;
      try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* pełny magazyn */ }
      render();
      return;
    }
    // Ukrycie dotyczy tylko oglądanej strony i nie wyłącza zbierania —
    // przy następnym wejściu na giełdę panel wraca z kompletem danych.
    if (act === 'hide') { el.remove(); return; }
    if (act === 'export') { pobierzPlik(state.world, state.readings); return; }
    if (act === 'clear') {
      if (!confirm('Wyczyścić zebrane kursy dla świata ' + state.world + '?')) return;
      try { localStorage.removeItem(state.key); } catch { /* nic nie szkodzi */ }
      state.readings = [];
      state.justUpdated = null;
      state.warning = null;
      render();
    }
  });
}
```

- [ ] **Step 4: Uruchom testy i potwierdź, że przechodzą**

Run: `npm test -- test/rates-panel.test.js`
Expected: PASS, 9 testów

- [ ] **Step 5: Commit**

```bash
git add src/rates-panel.js test/rates-panel.test.js
git commit -m "feat: panel kursow w rogu ekranu gry"
```

---

### Task 5: Punkt wejścia userscriptu i budowa

**Files:**
- Create: `src/rates-collector.js`
- Modify: `build.js` (dodanie `buildUserscript()` i zapisu `dist/kursy.user.js`)
- Modify: `test/build.test.js` (dopisanie testów)

**Interfaces:**
- Consumes: `readReading` (zadanie 2), `worldFromHost`/`storageKey`/`mergeReading` (zadanie 3), `mountPanel` (zadanie 4)
- Produces: `buildUserscript() → string` eksportowane z `build.js`

- [ ] **Step 1: Napisz testy, które mają nie przejść**

Dopisz do `test/build.test.js` (rozszerz też import w pierwszej linii):

```js
import { buildDashboard, buildBookmarklet, buildUserscript } from '../build.js';
```

```js
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
```

- [ ] **Step 2: Uruchom testy i potwierdź, że nie przechodzą**

Run: `npm test -- test/build.test.js`
Expected: FAIL — `buildUserscript is not a function`

- [ ] **Step 3: Napisz punkt wejścia**

Utwórz `src/rates-collector.js`:

```js
// src/rates-collector.js
// Punkt wejścia userscriptu. Budzi się przy każdym wejściu na ekran giełdy
// premium, czyta to, co strona już wyświetliła, i odświeża panel.
//
// Ten plik nie wysyła i nie może wysyłać żadnego zapytania — patrz test
// „userscript nie wykonuje żadnych zapytań sieciowych" w test/build.test.js.

import { readReading } from './rates-parse.js';
import { worldFromHost, storageKey, mergeReading } from './rates-store.js';
import { mountPanel } from './rates-panel.js';

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  (function () {
    const reading = readReading(document);
    if (!reading) return;              // inny ekran — panelu nie pokazujemy

    const world = worldFromHost(location.hostname);
    const key = storageKey(world);

    let readings = [];
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(raw)) readings = raw;
    } catch { readings = []; }         // popsuty magazyn zaczynamy od zera

    // mergeReading sam odrzuci odczyt bez kontynentu, żeby nie nadpisał
    // niewłaściwego wiersza. Gracz dowiaduje się o tym z panelu.
    const warning = reading.continent
      ? null
      : 'Nie rozpoznano kontynentu — tego odczytu nie zapisano.';

    readings = mergeReading(readings, reading);
    try { localStorage.setItem(key, JSON.stringify(readings)); } catch { /* pełny magazyn */ }

    mountPanel({ readings, justUpdated: reading.continent, warning, world, key });
  })();
}
```

- [ ] **Step 4: Dodaj cel budowy**

W `build.js` dopisz po `buildBookmarklet()`:

```js
// Userscript (dist/kursy.user.js) — kolektor kursów giełdy premium.
// Zostawiamy komentarze i nowe linie: userscript jest wielolinijkowy,
// więc nie grozi mu problem sklejania, który dotyczy bookmarkletu.
const USERSCRIPT_META = `// ==UserScript==
// @name         Plemiona — kursy giełdy
// @namespace    plemiona-pp
// @version      1.0.0
// @description  Odczytuje kursy giełdy premium z otwartej strony i zbiera je per kontynent. Nie wysyła żadnych zapytań.
// @author       plemiona-pp
// @match        https://*.plemiona.pl/game.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
`;

export function buildUserscript() {
  const js = ['src/rates-parse.js', 'src/rates-store.js', 'src/rates-panel.js', 'src/rates-collector.js']
    .map(p => stripModule(read('./' + p))).join('\n');
  return USERSCRIPT_META + '\n(function () {\n' + js + '\n})();\n';
}
```

W bloku uruchamianym z linii poleceń (na końcu `build.js`) dopisz zapis pliku i popraw komunikat:

```js
  writeFileSync(new URL('./dist/kursy.user.js', import.meta.url), buildUserscript());
  console.log('Zbudowano dist/: index.html (dashboard), kolektor/index.html (kolektor), kursy.user.js (kursy giełdy)');
```

- [ ] **Step 5: Uruchom testy i potwierdź, że przechodzą**

Run: `npm test`
Expected: PASS — wszystkie testy repozytorium, w tym 4 nowe w `build.test.js`

- [ ] **Step 6: Zbuduj i obejrzyj wynik**

Run: `npm run build`
Expected: `Zbudowano dist/: index.html (dashboard), kolektor/index.html (kolektor), kursy.user.js (kursy giełdy)`

Sprawdź, że plik istnieje i zaczyna się nagłówkiem metadanych:

Run: `Get-Content dist/kursy.user.js -TotalCount 12`
Expected: bloczek `// ==UserScript==` … `// ==/UserScript==`

- [ ] **Step 7: Commit**

```bash
git add src/rates-collector.js build.js test/build.test.js
git commit -m "feat: userscript kursow gieldy z gwarancja braku ruchu sieciowego"
```

---

## Weryfikacja końcowa

Po zadaniu 5 sprawdź kryteria ukończenia ze specyfikacji. Kroki 1–2 są automatyczne; kroki 3–5 wymagają gry i wykonuje je użytkownik.

- [ ] `npm test` — wszystkie testy przechodzą
- [ ] Test „userscript nie wykonuje żadnych zapytań sieciowych" jest w zestawie i przechodzi
- [ ] Instalacja: otwórz `dist/kursy.user.js` w przeglądarce z Tampermonkey — powinien zaproponować instalację
- [ ] Wejście na giełdę na trzech kontynentach daje panel z trzema wierszami i poprawnymi kursami
- [ ] Powrót na wcześniej odwiedzony kontynent nadpisuje jego wiersz, nie dokłada nowego
- [ ] **Eksportuj** pobiera plik `plemiona-kursy-<świat>-<data>.json` zgodny z modelem ze specyfikacji
- [ ] W narzędziach deweloperskich, zakładka **Sieć**: wejście na giełdę z włączonym skryptem nie generuje żadnego dodatkowego zapytania względem stanu bez skryptu
