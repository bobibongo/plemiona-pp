# Analiza logu punktów premium (Plemiona) — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbudować bookmarklet-kolektor logu PP oraz jednoplikowy, offline dashboard HTML analizujący bilans PP, arbitraż giełdowy i wydatki na usługi.

**Architecture:** Dwa niezależne artefakty dzielące czystą logikę. Cała logika (parsowanie daty, klasyfikacja, deduplikacja, agregacja, wykresy SVG) to czyste funkcje w `src/` testowane `node --test`. Dostawę stanowi malutki własny inliner (`build.js`), który zaszywa logikę + UI + CSS w jeden plik `dist/dashboard.html` oraz generuje bookmarklet. Zero zależności runtime, zero frameworków.

**Tech Stack:** Vanilla JavaScript (ES modules), Node.js `node:test` (wbudowany), własne wykresy SVG, `localStorage`. Konwersja starych plików XLSX → JSON osobnym skryptem Python (openpyxl).

## Global Constraints

- **Zero zależności runtime i zero zależności testowych z npm.** Tylko wbudowane moduły Node (`node:test`, `node:assert`, `node:fs`) i Python `openpyxl` (już zainstalowany) do jednorazowej konwersji XLSX.
- **Dashboard i bookmarklet muszą działać offline z `file://`** — żadnych żądań sieciowych w runtime, wszystko inline.
- **Deliverables w `dist/`**: `dist/dashboard.html` (jeden plik), `dist/collector-install.html` (strona z przeciąganym bookmarkletem).
- **Język UI: polski.** Nazwy surowców: `Drewno`, `Glina`, `Żelazo`.
- **Klasyfikacja transakcji po treści `info`, nie po `txType`** (sprzedaż bywa typu „Przeniesienie", kupno typu „Giełda Premium").
- **Nic nie ginie po cichu**: wpisy niedopasowane trafiają do kategorii `inne`.
- **Format daty w logu:** `DD.MM. HH:MM` = rok bieżący; `DD.MM.YY HH:MM` = rok `20YY`. Komórki bywają otoczone ` ` (nbsp).
- **Klucz deduplikacji:** `world + "|" + ts + "|" + change + "|" + info`.

---

## Struktura plików

- `package.json` — skrypt `test`, `type: module`. Bez dependencies.
- `src/shared-date.js` — `parsePremiumDate`. Współdzielone przez kolektor i dashboard.
- `src/parse.js` — `parseNumber`, `extractResource`, `classify`, `enrich`, `entryKey`.
- `src/merge.js` — `dedupeMerge`.
- `src/aggregate.js` — `bucketKey`, `aggregate`, `effectiveRates`.
- `src/charts.js` — `barChartSVG`, `lineChartSVG`.
- `src/collector.js` — bookmarklet: `buildLogUrl`, `extractRawRows`, `oldestDate`, `shouldStop`, panel UI + pętla pobierania (IIFE).
- `src/ui.js` — logika UI dashboardu (drag&drop, localStorage, render, filtry).
- `src/dashboard.template.html` — szkielet HTML z markerami `<!--INJECT:css-->`, `<!--INJECT:js-->`.
- `build.js` — inliner: generuje `dist/dashboard.html` i `dist/collector-install.html`.
- `tools/xlsx_to_json.py` — konwersja `_share/*.xlsx` → `dist/legacy-<świat>.json`.
- `test/*.test.js` — testy jednostkowe.
- `test/fixtures/` — przykładowe dane (wiersze logu, mały HTML strony).

---

### Task 1: Scaffold projektu

**Files:**
- Create: `package.json`
- Create: `src/.gitkeep`, `test/.gitkeep`, `dist/.gitkeep`, `tools/.gitkeep`, `test/fixtures/.gitkeep`

**Interfaces:**
- Produces: skrypt `npm test` uruchamiający `node --test`.

- [ ] **Step 1: Utwórz `package.json`**

```json
{
  "name": "plemiona-pp-analiza",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "build": "node build.js"
  }
}
```

- [ ] **Step 2: Utwórz puste katalogi**

```bash
mkdir -p src test dist tools test/fixtures
touch src/.gitkeep test/.gitkeep dist/.gitkeep tools/.gitkeep test/fixtures/.gitkeep
```

- [ ] **Step 3: Zweryfikuj, że test runner startuje**

Run: `npm test`
Expected: `node --test` kończy się bez błędu (0 testów — „tests 0").

- [ ] **Step 4: Commit**

```bash
git add package.json src test dist tools
git commit -m "chore: scaffold projektu analizy PP"
```

---

### Task 2: Parsowanie daty (`shared-date.js`)

**Files:**
- Create: `src/shared-date.js`
- Test: `test/shared-date.test.js`

**Interfaces:**
- Produces: `parsePremiumDate(dateRaw: string, now?: Date): Date`
  - Wejście np. `" 19.07. 22:30 "` lub `"23.07.25 14:51"`.
  - Brak roku → rok z `now` (domyślnie `new Date()`). Sufiks `.YY` → `2000+YY`.
  - Zwraca `Date` w czasie lokalnym.

- [ ] **Step 1: Napisz failing test**

```javascript
// test/shared-date.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePremiumDate } from '../src/shared-date.js';

const NOW = new Date(2026, 6, 20, 12, 0, 0); // 20 lip 2026

test('data bez roku używa roku bieżącego', () => {
  const d = parsePremiumDate(' 19.07. 22:30 ', NOW);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 6);   // lipiec
  assert.equal(d.getDate(), 19);
  assert.equal(d.getHours(), 22);
  assert.equal(d.getMinutes(), 30);
});

test('data z sufiksem .25 daje rok 2025', () => {
  const d = parsePremiumDate('23.07.25 14:51', NOW);
  assert.equal(d.getFullYear(), 2025);
  assert.equal(d.getMonth(), 6);
  assert.equal(d.getDate(), 23);
  assert.equal(d.getHours(), 14);
  assert.equal(d.getMinutes(), 51);
});

test('rzuca dla nieparsowalnego wejścia', () => {
  assert.throws(() => parsePremiumDate('śmieci', NOW));
});
```

- [ ] **Step 2: Uruchom test — ma padać**

Run: `node --test test/shared-date.test.js`
Expected: FAIL — „Cannot find module '../src/shared-date.js'".

- [ ] **Step 3: Implementacja**

```javascript
// src/shared-date.js
// Format: "DD.MM. HH:MM" (rok bieżący) lub "DD.MM.YY HH:MM" (rok 20YY).
const RE = /^(\d{2})\.(\d{2})\.(?:(\d{2}))?\s+(\d{2}):(\d{2})$/;

export function parsePremiumDate(dateRaw, now = new Date()) {
  const s = String(dateRaw).replace(/ /g, ' ').trim();
  const m = RE.exec(s);
  if (!m) throw new Error(`Nieparsowalna data: ${JSON.stringify(dateRaw)}`);
  const [, dd, mm, yy, hh, min] = m;
  const year = yy !== undefined ? 2000 + Number(yy) : now.getFullYear();
  return new Date(year, Number(mm) - 1, Number(dd), Number(hh), Number(min), 0, 0);
}
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run: `node --test test/shared-date.test.js`
Expected: PASS (3 testy).

- [ ] **Step 5: Commit**

```bash
git add src/shared-date.js test/shared-date.test.js
git commit -m "feat: parsowanie daty logu PP z obsługą roku"
```

---

### Task 3: Parsowanie liczb, surowca i klasyfikacja (`parse.js`)

**Files:**
- Create: `src/parse.js`
- Test: `test/parse.test.js`

**Interfaces:**
- Consumes: `parsePremiumDate` z `src/shared-date.js`.
- Produces:
  - `parseNumber(raw: string): number` — usuwa nbsp/spacje, obsługuje `+`/`-`.
  - `extractResource(info: string): { resource: 'drewno'|'glina'|'zelazo'|null, amount: number|null }`
  - `classify(raw: RawEntry): { category, subtype, resource, amount }`
    - `category ∈ {'arbitraz','usluga','zewnetrzne_pp','inne'}`
    - `RawEntry = { dateRaw, world, txType, changeRaw, balanceRaw, info }`
  - `enrich(raw: RawEntry, now?: Date): Entry`
    - `Entry = { ts, world, txType, change, balance, info, category, subtype, resource, amount }`
    - `ts` = ISO string z `parsePremiumDate`.
  - `entryKey(e: Entry): string` = `` `${e.world}|${e.ts}|${e.change}|${e.info}` ``

- [ ] **Step 1: Napisz failing test**

```javascript
// test/parse.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, extractResource, classify, enrich, entryKey } from '../src/parse.js';

const NOW = new Date(2026, 6, 20, 12, 0, 0);

test('parseNumber usuwa nbsp i znak', () => {
  assert.equal(parseNumber(' -47 '), -47);
  assert.equal(parseNumber(' 1500 '), 1500);
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
```

- [ ] **Step 2: Uruchom test — ma padać**

Run: `node --test test/parse.test.js`
Expected: FAIL — brak modułu `../src/parse.js`.

- [ ] **Step 3: Implementacja**

```javascript
// src/parse.js
import { parsePremiumDate } from './shared-date.js';

export function parseNumber(raw) {
  const s = String(raw).replace(/ /g, '').replace(/\s/g, '').replace('+', '');
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`Nieparsowalna liczba: ${JSON.stringify(raw)}`);
  return n;
}

const RESOURCE_MAP = [
  [/drewno/i, 'drewno'],
  [/glina/i, 'glina'],
  [/(żelazo|zelazo)/i, 'zelazo'],
];

export function extractResource(info) {
  const s = String(info);
  const amountMatch = /\((\d+)\)/.exec(s);
  for (const [re, key] of RESOURCE_MAP) {
    if (re.test(s)) {
      return { resource: key, amount: amountMatch ? Number(amountMatch[1]) : null };
    }
  }
  return { resource: null, amount: null };
}

const SERVICE_SUBTYPES = [
  [/natychmiastowe zako[ńn]czenie/i, 'natychmiastowe_zakonczenie'],
  [/redukcja czasu/i, 'redukcja_czasu'],
  [/miejscowym kupcem/i, 'handel_kupiec'],
  [/rycerz/i, 'rycerz'],
  [/zmniejsz koszt budowy/i, 'zmniejsz_koszt'],
];

export function classify(raw) {
  const info = String(raw.info || '');
  const txType = String(raw.txType || '').replace(/ /g, '').trim();
  const { resource, amount } = extractResource(info);

  if (/-kupno:/i.test(info)) return { category: 'arbitraz', subtype: 'kupno', resource, amount };
  if (/-sprzeda[żz]:/i.test(info)) return { category: 'arbitraz', subtype: 'sprzedaz', resource, amount };

  if (/^Premium\b/i.test(info)) return { category: 'zewnetrzne_pp', subtype: 'subskrypcja', resource: null, amount: null };
  if (txType === 'Kupno') return { category: 'zewnetrzne_pp', subtype: 'zakup_pp', resource: null, amount: null };

  if (txType === 'Użycie') {
    for (const [re, sub] of SERVICE_SUBTYPES) {
      if (re.test(info)) return { category: 'usluga', subtype: sub, resource: null, amount: null };
    }
    return { category: 'usluga', subtype: 'inne', resource: null, amount: null };
  }
  return { category: 'inne', subtype: 'inne', resource: null, amount: null };
}

export function enrich(raw, now = new Date()) {
  const ts = parsePremiumDate(raw.dateRaw, now).toISOString();
  const change = parseNumber(raw.changeRaw);
  const balance = parseNumber(raw.balanceRaw);
  const world = String(raw.world).replace(/ /g, '').trim();
  const info = String(raw.info).trim();
  const cls = classify(raw);
  return { ts, world, txType: String(raw.txType).replace(/ /g, '').trim(),
    change, balance, info, ...cls };
}

export function entryKey(e) {
  return `${e.world}|${e.ts}|${e.change}|${e.info}`;
}
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run: `node --test test/parse.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parse.js test/parse.test.js
git commit -m "feat: klasyfikacja i wzbogacanie wpisów logu PP"
```

---

### Task 4: Deduplikacja i scalanie (`merge.js`)

**Files:**
- Create: `src/merge.js`
- Test: `test/merge.test.js`

**Interfaces:**
- Consumes: `entryKey` z `src/parse.js`.
- Produces: `dedupeMerge(existing: Entry[], incoming: Entry[]): Entry[]`
  - Zwraca nową tablicę bez duplikatów (klucz = `entryKey`), posortowaną malejąco po `ts` (najnowsze pierwsze). Istniejący wpis wygrywa przy kolizji.

- [ ] **Step 1: Napisz failing test**

```javascript
// test/merge.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeMerge } from '../src/merge.js';

const mk = (ts, info, change = -10, world = 'Świat 231') =>
  ({ ts, world, change, info, category: 'usluga' });

test('scala i usuwa duplikaty po kluczu', () => {
  const a = [mk('2026-07-19T11:13:00.000Z', 'X'), mk('2026-07-18T10:00:00.000Z', 'Y')];
  const b = [mk('2026-07-19T11:13:00.000Z', 'X'), mk('2026-07-20T09:00:00.000Z', 'Z')];
  const out = dedupeMerge(a, b);
  assert.equal(out.length, 3);
});

test('sortuje malejąco po ts', () => {
  const out = dedupeMerge([mk('2026-07-18T10:00:00.000Z', 'Y')],
                          [mk('2026-07-20T09:00:00.000Z', 'Z')]);
  assert.equal(out[0].info, 'Z');
  assert.equal(out[1].info, 'Y');
});

test('nie mutuje wejścia', () => {
  const a = [mk('2026-07-18T10:00:00.000Z', 'Y')];
  const b = [mk('2026-07-20T09:00:00.000Z', 'Z')];
  dedupeMerge(a, b);
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
});
```

- [ ] **Step 2: Uruchom test — ma padać**

Run: `node --test test/merge.test.js`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja**

```javascript
// src/merge.js
import { entryKey } from './parse.js';

export function dedupeMerge(existing, incoming) {
  const byKey = new Map();
  for (const e of incoming) byKey.set(entryKey(e), e);   // incoming jako baza
  for (const e of existing) byKey.set(entryKey(e), e);   // existing nadpisuje (wygrywa)
  return [...byKey.values()].sort((x, y) => (x.ts < y.ts ? 1 : x.ts > y.ts ? -1 : 0));
}
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run: `node --test test/merge.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/merge.js test/merge.test.js
git commit -m "feat: deduplikacja i scalanie wpisów"
```

---

### Task 5: Agregacja i efektywny kurs (`aggregate.js`)

**Files:**
- Create: `src/aggregate.js`
- Test: `test/aggregate.test.js`

**Interfaces:**
- Produces:
  - `bucketKey(ts: string, granularity: 'day'|'week'): string`
    - `'day'` → `'YYYY-MM-DD'`; `'week'` → `'YYYY-Www'` (ISO tydzień).
  - `aggregate(entries: Entry[], opts: { granularity }): { buckets, totals }`
    - `buckets`: tablica `{ key, earned, spent, net, arbitrageProfit, serviceCost, externalPP }` posortowana rosnąco po `key`.
      - `earned` = suma dodatnich `change`; `spent` = suma ujemnych `change` (wartość ujemna); `net = earned + spent`.
      - `arbitrageProfit` = suma `change` dla `category==='arbitraz'`.
      - `serviceCost` = suma `change` dla `category==='usluga'` (ujemna).
      - `externalPP` = suma `change` dla `category==='zewnetrzne_pp'`.
    - `totals`: te same pola zsumowane globalnie + `resources: { drewno:{bought,sold}, glina:{...}, zelazo:{...} }` (sumy `amount`) + `serviceBreakdown: { <subtype>: ppSum }`.
  - `effectiveRates(entries: Entry[]): { drewno:{buy,sell}, glina:{...}, zelazo:{...} }`
    - `buy`/`sell` = PP na 1000 jednostek = `sum(|change|)/sum(amount)*1000` dla kupna/sprzedaży danego surowca; `null` gdy brak danych.

- [ ] **Step 1: Napisz failing test**

```javascript
// test/aggregate.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketKey, aggregate, effectiveRates } from '../src/aggregate.js';

const E = (ts, change, category, extra = {}) =>
  ({ ts, world: 'Świat 231', change, category, info: '', ...extra });

test('bucketKey day/week', () => {
  assert.equal(bucketKey('2026-07-19T22:30:00.000Z', 'day'), '2026-07-19');
  assert.match(bucketKey('2026-07-19T22:30:00.000Z', 'week'), /^2026-W\d{2}$/);
});

test('aggregate sumuje earned/spent/net i kategorie', () => {
  const entries = [
    E('2026-07-19T10:00:00.000Z', 30, 'arbitraz', { subtype: 'sprzedaz' }),
    E('2026-07-19T11:00:00.000Z', -47, 'arbitraz', { subtype: 'kupno' }),
    E('2026-07-19T12:00:00.000Z', -10, 'usluga', { subtype: 'redukcja_czasu' }),
    E('2026-07-19T13:00:00.000Z', 1500, 'zewnetrzne_pp', { subtype: 'zakup_pp' }),
  ];
  const { buckets, totals } = aggregate(entries, { granularity: 'day' });
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].earned, 1530);
  assert.equal(buckets[0].spent, -57);
  assert.equal(buckets[0].net, 1473);
  assert.equal(buckets[0].arbitrageProfit, -17);
  assert.equal(totals.serviceCost, -10);
  assert.equal(totals.externalPP, 1500);
  assert.equal(totals.serviceBreakdown.redukcja_czasu, -10);
});

test('aggregate sumuje wolumen surowców', () => {
  const entries = [
    E('2026-07-19T10:00:00.000Z', 9, 'arbitraz', { subtype: 'sprzedaz', resource: 'glina', amount: 905 }),
    E('2026-07-19T11:00:00.000Z', -47, 'arbitraz', { subtype: 'kupno', resource: 'glina', amount: 20076 }),
  ];
  const { totals } = aggregate(entries, { granularity: 'day' });
  assert.equal(totals.resources.glina.sold, 905);
  assert.equal(totals.resources.glina.bought, 20076);
});

test('effectiveRates liczy PP na 1000', () => {
  const entries = [
    E('t', -47, 'arbitraz', { subtype: 'kupno', resource: 'zelazo', amount: 20000 }),
    E('t', 23, 'arbitraz', { subtype: 'sprzedaz', resource: 'zelazo', amount: 10000 }),
  ];
  const r = effectiveRates(entries);
  assert.ok(Math.abs(r.zelazo.buy - 2.35) < 1e-9);   // 47/20000*1000
  assert.ok(Math.abs(r.zelazo.sell - 2.3) < 1e-9);   // 23/10000*1000
  assert.equal(r.drewno.buy, null);
});
```

- [ ] **Step 2: Uruchom test — ma padać**

Run: `node --test test/aggregate.test.js`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja**

```javascript
// src/aggregate.js
function isoWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (date.getUTCDay() + 6) % 7;          // pon=0
  date.setUTCDate(date.getUTCDate() - day + 3);     // czwartek tego tygodnia
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { year: date.getUTCFullYear(), week };
}

export function bucketKey(ts, granularity) {
  const d = new Date(ts);
  if (granularity === 'week') {
    const { year, week } = isoWeek(d);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const RES = ['drewno', 'glina', 'zelazo'];

export function aggregate(entries, { granularity }) {
  const map = new Map();
  const totals = {
    earned: 0, spent: 0, net: 0, arbitrageProfit: 0, serviceCost: 0, externalPP: 0,
    resources: Object.fromEntries(RES.map(r => [r, { bought: 0, sold: 0 }])),
    serviceBreakdown: {},
  };
  for (const e of entries) {
    const key = bucketKey(e.ts, granularity);
    if (!map.has(key)) map.set(key, { key, earned: 0, spent: 0, net: 0, arbitrageProfit: 0, serviceCost: 0, externalPP: 0 });
    const b = map.get(key);
    if (e.change >= 0) { b.earned += e.change; totals.earned += e.change; }
    else { b.spent += e.change; totals.spent += e.change; }
    b.net += e.change; totals.net += e.change;
    if (e.category === 'arbitraz') { b.arbitrageProfit += e.change; totals.arbitrageProfit += e.change; }
    if (e.category === 'usluga') {
      b.serviceCost += e.change; totals.serviceCost += e.change;
      totals.serviceBreakdown[e.subtype] = (totals.serviceBreakdown[e.subtype] || 0) + e.change;
    }
    if (e.category === 'zewnetrzne_pp') { b.externalPP += e.change; totals.externalPP += e.change; }
    if (e.category === 'arbitraz' && e.resource && e.amount) {
      totals.resources[e.resource][e.subtype === 'kupno' ? 'bought' : 'sold'] += e.amount;
    }
  }
  const buckets = [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { buckets, totals };
}

export function effectiveRates(entries) {
  const acc = Object.fromEntries(RES.map(r => [r, { buyPP: 0, buyAmt: 0, sellPP: 0, sellAmt: 0 }]));
  for (const e of entries) {
    if (e.category !== 'arbitraz' || !e.resource || !e.amount) continue;
    const a = acc[e.resource];
    if (e.subtype === 'kupno') { a.buyPP += Math.abs(e.change); a.buyAmt += e.amount; }
    else { a.sellPP += Math.abs(e.change); a.sellAmt += e.amount; }
  }
  const out = {};
  for (const r of RES) {
    const a = acc[r];
    out[r] = {
      buy: a.buyAmt ? (a.buyPP / a.buyAmt) * 1000 : null,
      sell: a.sellAmt ? (a.sellPP / a.sellAmt) * 1000 : null,
    };
  }
  return out;
}
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run: `node --test test/aggregate.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aggregate.js test/aggregate.test.js
git commit -m "feat: agregacja dzienna/tygodniowa i efektywny kurs"
```

---

### Task 6: Wykresy SVG (`charts.js`)

**Files:**
- Create: `src/charts.js`
- Test: `test/charts.test.js`

**Interfaces:**
- Produces:
  - `barChartSVG(series: {label:string, value:number, color?:string}[], opts?: {width,height,title}): string`
  - `lineChartSVG(points: {x:string, y:number}[], opts?: {width,height,title}): string`
  - Obie zwracają poprawny string `<svg ...>...</svg>`, skalują wartości do wysokości, obsługują wartości ujemne (linia zera). Pusta seria → svg z tekstem „brak danych".

- [ ] **Step 1: Napisz failing test**

```javascript
// test/charts.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barChartSVG, lineChartSVG } from '../src/charts.js';

test('barChartSVG zwraca svg z tyloma słupkami ile pozycji', () => {
  const svg = barChartSVG([{ label: 'a', value: 10 }, { label: 'b', value: -5 }]);
  assert.match(svg, /^<svg/);
  assert.match(svg, /<\/svg>$/);
  assert.equal((svg.match(/<rect/g) || []).length >= 2, true);
});

test('barChartSVG pusty = komunikat', () => {
  assert.match(barChartSVG([]), /brak danych/);
});

test('lineChartSVG rysuje polyline dla >=2 punktów', () => {
  const svg = lineChartSVG([{ x: '2026-07-18', y: 1 }, { x: '2026-07-19', y: 3 }]);
  assert.match(svg, /<(polyline|path)/);
});
```

- [ ] **Step 2: Uruchom test — ma padać**

Run: `node --test test/charts.test.js`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja**

```javascript
// src/charts.js
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function empty(width, height) {
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">` +
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#888">brak danych</text></svg>`;
}

export function barChartSVG(series, opts = {}) {
  const { width = 640, height = 240, title = '' } = opts;
  if (!series.length) return empty(width, height);
  const pad = 30;
  const max = Math.max(1, ...series.map(s => Math.abs(s.value)));
  const zeroY = height / 2;
  const bw = (width - pad * 2) / series.length;
  const bars = series.map((s, i) => {
    const h = (Math.abs(s.value) / max) * (height / 2 - pad);
    const x = pad + i * bw + bw * 0.15;
    const w = bw * 0.7;
    const y = s.value >= 0 ? zeroY - h : zeroY;
    const color = s.color || (s.value >= 0 ? '#2e7d32' : '#c62828');
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" fill="${color}"><title>${esc(s.label)}: ${s.value}</title></rect>`;
  }).join('');
  const t = title ? `<text x="8" y="16" font-size="13" fill="#333">${esc(title)}</text>` : '';
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${t}` +
    `<line x1="${pad}" y1="${zeroY}" x2="${width - pad}" y2="${zeroY}" stroke="#ccc"/>${bars}</svg>`;
}

export function lineChartSVG(points, opts = {}) {
  const { width = 640, height = 240, title = '' } = opts;
  if (!points.length) return empty(width, height);
  const pad = 30;
  const ys = points.map(p => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((p.y - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const t = title ? `<text x="8" y="16" font-size="13" fill="#333">${esc(title)}</text>` : '';
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${t}` +
    `<polyline fill="none" stroke="#1565c0" stroke-width="2" points="${coords}"/></svg>`;
}
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run: `node --test test/charts.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/charts.js test/charts.test.js
git commit -m "feat: własne wykresy SVG (słupki i linia)"
```

---

### Task 7: Czyste funkcje kolektora (`collector.js` — część logiczna)

**Files:**
- Create: `src/collector.js`
- Test: `test/collector.test.js`
- Create fixture: `test/fixtures/log-page.html`

**Interfaces:**
- Consumes: `parsePremiumDate` z `src/shared-date.js`.
- Produces (eksporty testowalne; reszta pliku to IIFE panelu — Task 8):
  - `buildLogUrl(baseHref: string, page: number): string` — podmienia/ustawia `page=` w URL.
  - `extractRawRows(doc: Document): RawEntry[]` — czyta wiersze tabeli logu.
  - `oldestDate(rows: RawEntry[], now: Date): Date` — najstarsza data w zbiorze wierszy.
  - `shouldStop(rows: RawEntry[], sinceDate: Date, now: Date): boolean` — true, gdy najstarszy wiersz jest starszy niż `sinceDate`.

**Uwaga:** `extractRawRows` przyjmuje `Document`. W teście budujemy go bez zależności — z fixture HTML użyjemy globalnego `DOMParser`, jeśli dostępny; w Node 24 użyjemy prostego parsera fixturowego opisanego w kroku 1 (bez npm).

- [ ] **Step 1: Utwórz fixture i failing test**

`test/fixtures/log-page.html` (minimalny, odwzorowuje strukturę logu):

```html
<table id="premium_history_table">
<tr><th>Data</th><th>Świat</th><th>Transakcja</th><th>Zmiana</th><th>Nowe saldo PP</th><th>Dalsze informacje</th></tr>
<tr><td>&nbsp;19.07. 11:13&nbsp;</td><td>Świat 231</td><td>&nbsp;Giełda Premium&nbsp;</td><td>&nbsp;-47&nbsp;</td><td>&nbsp;974&nbsp;</td><td>Giełda Premium-kupno: Żelazo (20316)</td></tr>
<tr><td>&nbsp;23.07.25 14:51&nbsp;</td><td>Świat 217</td><td>&nbsp;Użycie&nbsp;</td><td>&nbsp;-10&nbsp;</td><td>&nbsp;1031&nbsp;</td><td>Redukcja czasu budowy - pl217 - Mur (Poziom 19)</td></tr>
</table>
```

```javascript
// test/collector.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLogUrl, extractRawRows, oldestDate, shouldStop } from '../src/collector.js';

const NOW = new Date(2026, 6, 20, 12, 0, 0);

// Minimalny Document zastępczy budowany z fixture przez regex — bez npm.
// extractRawRows używa doc.querySelectorAll; w teście podajemy obiekt zgodny z tym API.
function fakeDoc(html) {
  const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => {
    const cells = [...m[1].matchAll(/<t[dh]>([\s\S]*?)<\/t[dh]>/g)]
      .map(c => c[1].replace(/&nbsp;/g, ' '));
    return { cells, isHeader: /<th>/.test(m[1]) };
  });
  return {
    querySelectorAll(sel) {
      // obsługujemy tylko selektor wierszy danych
      return rows.filter(r => !r.isHeader).map(r => ({
        querySelectorAll: () => r.cells.map(text => ({ textContent: text })),
      }));
    },
  };
}

test('buildLogUrl ustawia numer strony', () => {
  assert.equal(
    buildLogUrl('https://pl231.plemiona.pl/game.php?village=9940&screen=premium&mode=log&page=0', 3),
    'https://pl231.plemiona.pl/game.php?village=9940&screen=premium&mode=log&page=3');
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
```

- [ ] **Step 2: Uruchom test — ma padać**

Run: `node --test test/collector.test.js`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja (część eksportowana)**

```javascript
// src/collector.js
import { parsePremiumDate } from './shared-date.js';

export function buildLogUrl(baseHref, page) {
  if (/([?&])page=\d+/.test(baseHref)) return baseHref.replace(/([?&]page=)\d+/, `$1${page}`);
  return baseHref + (baseHref.includes('?') ? '&' : '?') + `page=${page}`;
}

// Selektor wierszy tabeli logu. Bierzemy wiersze z dokładnie 6 komórkami danych.
export function extractRawRows(doc) {
  const trs = doc.querySelectorAll('#premium_history_table tr, table tr');
  const out = [];
  for (const tr of trs) {
    const cells = tr.querySelectorAll('td');
    if (!cells || cells.length < 6) continue;
    const t = i => (cells[i].textContent || '').replace(/ /g, ' ').trim();
    const dateRaw = t(0);
    if (!/^\s*\d{2}\.\d{2}\./.test(dateRaw)) continue; // pomija nagłówek/śmieci
    out.push({ dateRaw, world: t(1), txType: t(2), changeRaw: t(3), balanceRaw: t(4), info: t(5) });
  }
  return out;
}

export function oldestDate(rows, now) {
  let oldest = null;
  for (const r of rows) {
    const d = parsePremiumDate(r.dateRaw, now);
    if (!oldest || d < oldest) oldest = d;
  }
  return oldest;
}

export function shouldStop(rows, sinceDate, now) {
  const oldest = oldestDate(rows, now);
  return oldest !== null && oldest < sinceDate;
}
```

**Uwaga do selektora:** w prawdziwej stronie tabela logu ma id/klasę do potwierdzenia w Task 8 (wtedy dopasujemy selektor do realnego DOM). Fixture i `fakeDoc` w teście używają uproszczonego API `querySelectorAll('td')` per wiersz — implementacja `extractRawRows` iteruje po wierszach i pobiera komórki `td`, więc jest zgodna z realnym `Document` i z `fakeDoc`.

- [ ] **Step 4: Uruchom test — ma przejść**

Run: `node --test test/collector.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/collector.js test/collector.test.js test/fixtures/log-page.html
git commit -m "feat: czyste funkcje kolektora (URL, ekstrakcja wierszy, warunek stopu)"
```

---

### Task 8: Panel i pętla pobierania kolektora (IIFE, weryfikacja w przeglądarce)

**Files:**
- Modify: `src/collector.js` (dopisanie IIFE panelu na końcu pliku, po eksportach)

**Interfaces:**
- Consumes: `buildLogUrl`, `extractRawRows`, `shouldStop` (z tego samego pliku).
- Produces: efekt uboczny — po uruchomieniu w przeglądarce wstrzykuje panel; pętla pobiera strony `fetch`em, parsuje i zapisuje plik JSON. Brak nowych eksportów.

**Uwaga:** IIFE nie wykonuje się przy `import` w Node, bo jest owinięte warunkiem `if (typeof document !== 'undefined')`. Dzięki temu testy z Task 7 dalej działają.

- [ ] **Step 1: Dopisz IIFE panelu na końcu `src/collector.js`**

```javascript
// ——— Panel uruchamiany tylko w przeglądarce ———
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  (async function () {
    const now = new Date();
    const trybNowe = confirm('OK = pobierz NOWE od daty; Anuluj = pobierz WSZYSTKO');
    let sinceDate = null;
    if (trybNowe) {
      const v = prompt('Pobierz wpisy od daty (RRRR-MM-DD):',
        new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
      if (!v) return;
      sinceDate = new Date(v + 'T00:00:00');
    }
    const delayMs = Number(prompt('Opóźnienie między stronami (ms), 0 = bez:', '0')) || 0;
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const all = [];
    let page = 0;
    for (;;) {
      const url = buildLogUrl(location.href, page);
      let doc;
      try {
        const res = await fetch(url, { credentials: 'include' });
        const html = await res.text();
        doc = new DOMParser().parseFromString(html, 'text/html');
      } catch (e) { alert('Błąd pobierania strony ' + page + ': ' + e.message); break; }
      const rows = extractRawRows(doc);
      if (!rows.length) break;                 // koniec paginacji
      all.push(...rows);
      console.log('strona', page, '→', rows.length, 'wierszy (łącznie', all.length + ')');
      if (sinceDate && shouldStop(rows, sinceDate, now)) break;
      page++;
      if (delayMs) await sleep(delayMs);
    }

    // filtr trybu przyrostowego: odetnij wpisy starsze niż sinceDate
    let outRows = all;
    if (sinceDate) {
      outRows = all.filter(r => {
        try { return parsePremiumDate(r.dateRaw, now) >= sinceDate; } catch { return true; }
      });
    }
    const payload = { exportedAt: now.toISOString(), count: outRows.length, rows: outRows };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plemiona-log-' + now.toISOString().slice(0, 16).replace(/[-:T]/g, '') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    alert('Zapisano ' + outRows.length + ' wpisów do pliku JSON.');
  })();
}
```

- [ ] **Step 2: Uruchom testy — mają dalej przechodzić (IIFE nie odpala się w Node)**

Run: `npm test`
Expected: PASS wszystkie (IIFE pominięte przez `typeof document`).

- [ ] **Step 3: Weryfikacja w przeglądarce (ręczna, po zbudowaniu w Task 10)**

Instrukcja weryfikacji (do wykonania po Task 10, który generuje bookmarklet):
1. Zaloguj się w grze, wejdź na stronę logu premium (`...&screen=premium&mode=log&page=0`).
2. Kliknij bookmarklet. Wybierz „Anuluj" (WSZYSTKO), opóźnienie 0.
3. Sprawdź w konsoli logi „strona N → …" oraz że pobrał się plik JSON z sensowną liczbą wpisów.
4. Otwórz JSON — pola `rows[].dateRaw/world/txType/changeRaw/balanceRaw/info` mają dane.

- [ ] **Step 4: Commit**

```bash
git add src/collector.js
git commit -m "feat: panel i pętla pobierania kolektora (browser IIFE)"
```

---

### Task 9: Szablon i logika UI dashboardu (`ui.js`, `dashboard.template.html`)

**Files:**
- Create: `src/ui.js`
- Create: `src/dashboard.template.html`
- Test: `test/ui-store.test.js`

**Interfaces:**
- Consumes: `enrich`, `entryKey` (parse.js), `dedupeMerge` (merge.js), `aggregate`, `effectiveRates` (aggregate.js), `barChartSVG`, `lineChartSVG` (charts.js).
- Produces (eksporty czyste, testowalne):
  - `normalizeImport(fileText: string, fileName: string, now?: Date): Entry[]`
    - JSON z kolektora (`{rows:[...]}`) → `enrich` każdego wiersza.
    - CSV (nagłówki jak w logu, separator `;` lub `,`, kodowanie już zdekodowane do stringa) → mapuje kolumny → `enrich`.
    - JSON „legacy" (tablica gotowych `Entry`) → zwraca jak jest.
  - `parseCSV(text: string): string[][]` — prosty parser (separator auto `;`/`,`, cudzysłowy).
- Reszta `ui.js` to funkcje DOM (`renderDashboard`, `wireDropzone`, `loadStore`, `saveStore`) — weryfikowane w przeglądarce, owinięte `if (typeof document !== 'undefined')`.

- [ ] **Step 1: Napisz failing test dla importu**

```javascript
// test/ui-store.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImport, parseCSV } from '../src/ui.js';

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
  assert.equal(out[0].category, 'arbitraz');
  assert.equal(out[0].change, -47);
});

test('normalizeImport z CSV logu', () => {
  const csv = 'Data;Świat;Transakcja;Zmiana;Nowe saldo PP;Dalsze informacje\n' +
    '19.07. 11:13;Świat 231;Giełda Premium;-47;974;Giełda Premium-kupno: Żelazo (20316)';
  const out = normalizeImport(csv, 'x.csv', NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].resource, 'zelazo');
});
```

- [ ] **Step 2: Uruchom test — ma padać**

Run: `node --test test/ui-store.test.js`
Expected: FAIL — brak modułu / eksportów.

- [ ] **Step 3: Implementacja czystej części `ui.js`**

```javascript
// src/ui.js
import { enrich, entryKey } from './parse.js';
import { dedupeMerge } from './merge.js';
import { aggregate, effectiveRates } from './aggregate.js';
import { barChartSVG, lineChartSVG } from './charts.js';

export function parseCSV(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length >=
              (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (line === '') continue;
    const cells = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

const COLS = ['dateRaw', 'world', 'txType', 'changeRaw', 'balanceRaw', 'info'];

export function normalizeImport(fileText, fileName, now = new Date()) {
  const trimmed = fileText.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const data = JSON.parse(trimmed);
    if (Array.isArray(data)) return data;                 // legacy Entry[]
    if (Array.isArray(data.rows)) return data.rows.map(r => enrich(r, now));
    throw new Error('Nieznany format JSON');
  }
  // CSV
  const rows = parseCSV(fileText);
  const start = /data/i.test(rows[0]?.[0] || '') ? 1 : 0;   // pomiń nagłówek
  return rows.slice(start).filter(r => r.length >= 6).map(cells => {
    const raw = {}; COLS.forEach((k, i) => raw[k] = cells[i]);
    return enrich(raw, now);
  });
}

// ——— Część DOM (przeglądarka) ———
if (typeof document !== 'undefined') {
  const KEY = 'plemiona_pp_store_v1';
  const $ = sel => document.querySelector(sel);

  const loadStore = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const saveStore = arr => localStorage.setItem(KEY, JSON.stringify(arr));

  const fmt = n => (n > 0 ? '+' : '') + n.toLocaleString('pl-PL');

  function applyFilters(entries) {
    const world = $('#f-world').value;
    const from = $('#f-from').value ? new Date($('#f-from').value + 'T00:00:00') : null;
    const to = $('#f-to').value ? new Date($('#f-to').value + 'T23:59:59') : null;
    return entries.filter(e => {
      const d = new Date(e.ts);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (world && world !== '__all__' && e.world !== world) return false;
      return true;
    });
  }

  function render() {
    const store = loadStore();
    // filtr świata: '' = sumarycznie wszystkie; konkretny świat = szczegóły
    const worlds = [...new Set(store.map(e => e.world))].sort();
    const sel = $('#f-world');
    if (sel.dataset.filled !== '1') {
      sel.innerHTML = `<option value="__all__">Wszystkie (sumarycznie)</option>` +
        worlds.map(w => `<option value="${w}">${w}</option>`).join('');
      sel.dataset.filled = '1';
    }
    const gran = $('#f-gran').value;
    const filtered = applyFilters(store);
    const { buckets, totals } = aggregate(filtered, { granularity: gran });
    const rates = effectiveRates(filtered);

    $('#kpis').innerHTML = `
      <div class="kpi"><span>Arbitraż (PP)</span><b class="${totals.arbitrageProfit >= 0 ? 'pos' : 'neg'}">${fmt(totals.arbitrageProfit)}</b></div>
      <div class="kpi"><span>Usługi (PP)</span><b class="neg">${fmt(totals.serviceCost)}</b></div>
      <div class="kpi"><span>Zewnętrzne PP</span><b>${fmt(totals.externalPP)}</b></div>
      <div class="kpi"><span>Bilans netto</span><b class="${totals.net >= 0 ? 'pos' : 'neg'}">${fmt(totals.net)}</b></div>`;

    $('#chart-balance').innerHTML = barChartSVG(
      buckets.map(b => ({ label: b.key, value: b.net })), { title: 'Bilans netto PP', width: 900 });
    $('#chart-saldo').innerHTML = lineChartSVG(
      [...filtered].reverse().map(e => ({ x: e.ts, y: e.balance })), { title: 'Saldo PP w czasie', width: 900 });

    const rateRow = r => `<tr><td>${r}</td><td>${rates[r].buy?.toFixed(2) ?? '—'}</td><td>${rates[r].sell?.toFixed(2) ?? '—'}</td></tr>`;
    $('#rates').innerHTML = `<tr><th>Surowiec</th><th>Kupno PP/1000</th><th>Sprzedaż PP/1000</th></tr>` +
      ['drewno', 'glina', 'zelazo'].map(rateRow).join('');

    $('#svc').innerHTML = `<tr><th>Usługa</th><th>PP</th></tr>` +
      Object.entries(totals.serviceBreakdown).sort((a, b) => a[1] - b[1])
        .map(([k, v]) => `<tr><td>${k}</td><td>${fmt(v)}</td></tr>`).join('');

    $('#buckets').innerHTML = `<tr><th>Okres</th><th>Zarobione</th><th>Wydane</th><th>Netto</th><th>Arbitraż</th></tr>` +
      buckets.map(b => `<tr><td>${b.key}</td><td>${fmt(b.earned)}</td><td>${fmt(b.spent)}</td><td>${fmt(b.net)}</td><td>${fmt(b.arbitrageProfit)}</td></tr>`).join('');

    $('#count').textContent = `${store.length} wpisów w magazynie, ${filtered.length} po filtrach`;
  }

  async function handleFiles(fileList) {
    let store = loadStore();
    for (const f of fileList) {
      const buf = await f.arrayBuffer();
      // heurystyka kodowania: spróbuj UTF-8, przy podejrzeniu Windows-1250 użyj dekodera
      let text = new TextDecoder('utf-8').decode(buf);
      if (/�/.test(text)) text = new TextDecoder('windows-1250').decode(buf);
      try {
        const entries = normalizeImport(text, f.name, new Date());
        store = dedupeMerge(store, entries);
      } catch (e) { alert('Błąd importu ' + f.name + ': ' + e.message); }
    }
    saveStore(store);
    render();
  }

  window.addEventListener('DOMContentLoaded', () => {
    const dz = $('#dropzone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); handleFiles(e.dataTransfer.files); });
    $('#file').addEventListener('change', e => handleFiles(e.target.files));
    ['#f-world', '#f-from', '#f-to', '#f-gran'].forEach(s => $(s).addEventListener('change', render));
    $('#export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(loadStore(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'plemiona-scalone.json'; a.click();
    });
    $('#reset').addEventListener('click', () => { if (confirm('Wyczyścić magazyn?')) { localStorage.removeItem(KEY); location.reload(); } });
    render();
  });
}
```

- [ ] **Step 4: Utwórz `src/dashboard.template.html`**

```html
<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Analiza PP — Plemiona</title>
<style>/*INJECT:css*/</style>
</head>
<body>
<header>
  <h1>Analiza punktów premium</h1>
  <p id="count">0 wpisów</p>
</header>
<section id="dropzone">
  Przeciągnij tu pliki JSON (z bookmarkletu) lub CSV — albo <label class="link">wybierz<input id="file" type="file" multiple hidden></label>.
  <div class="actions"><button id="export">Eksportuj scalone</button><button id="reset">Wyczyść magazyn</button></div>
</section>
<section class="filters">
  Świat: <select id="f-world"></select>
  Od: <input id="f-from" type="date"> Do: <input id="f-to" type="date">
  Granulacja: <select id="f-gran"><option value="day">dzień</option><option value="week">tydzień</option></select>
</section>
<section id="kpis" class="kpis"></section>
<section class="card"><div id="chart-balance"></div></section>
<section class="card"><div id="chart-saldo"></div></section>
<section class="grid">
  <div class="card"><h3>Efektywny kurs (PP/1000)</h3><table id="rates"></table></div>
  <div class="card"><h3>Wydatki na usługi</h3><table id="svc"></table></div>
</section>
<section class="card"><h3>Bilans wg okresu</h3><table id="buckets"></table></section>
<script type="module">/*INJECT:js*/</script>
</body>
</html>
```

CSS do wstrzyknięcia trzymamy w Task 10 (build) — na tym etapie marker wystarcza.

- [ ] **Step 5: Uruchom testy — mają przejść**

Run: `npm test`
Expected: PASS (część DOM pominięta w Node).

- [ ] **Step 6: Commit**

```bash
git add src/ui.js src/dashboard.template.html test/ui-store.test.js
git commit -m "feat: import danych i logika UI dashboardu"
```

---

### Task 10: Inliner build (`build.js`) → jednoplikowy dashboard + bookmarklet

**Files:**
- Create: `build.js`
- Create: `src/dashboard.css`
- Test: `test/build.test.js`

**Interfaces:**
- Produces:
  - `buildDashboard(): string` — składa `dashboard.template.html`, wstrzykuje `dashboard.css` w `/*INJECT:css*/` oraz połączony kod modułów (`shared-date.js`+`parse.js`+`merge.js`+`aggregate.js`+`charts.js`+`ui.js` ze zdjętymi `import ...` i `export `) w `/*INJECT:js*/`. Zwraca kompletny HTML.
  - `buildBookmarklet(): string` — składa `shared-date.js`+`collector.js` (bez `import/export`), minifikuje do jednej linii, opakowuje `javascript:(()=>{...})()`.
  - Zapisuje `dist/dashboard.html` i `dist/collector-install.html`.

- [ ] **Step 1: Napisz failing test**

```javascript
// test/build.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboard, buildBookmarklet } from '../build.js';

test('dashboard nie zawiera markerów ani importów', () => {
  const html = buildDashboard();
  assert.doesNotMatch(html, /INJECT:/);
  assert.doesNotMatch(html, /^\s*import\s/m);
  assert.doesNotMatch(html, /^\s*export\s/m);
  assert.match(html, /<svg|barChartSVG/); // logika obecna
});

test('bookmarklet jest jedną linią javascript:', () => {
  const bm = buildBookmarklet();
  assert.match(bm, /^javascript:/);
  assert.doesNotMatch(bm, /\bimport\b/);
});
```

- [ ] **Step 2: Uruchom test — ma padać**

Run: `node --test test/build.test.js`
Expected: FAIL — brak `build.js`.

- [ ] **Step 3: Utwórz `src/dashboard.css`**

```css
* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; margin: 0; background: #f4f1ea; color: #222; }
header { background: #5b3a1e; color: #f4e9d8; padding: 12px 20px; }
header h1 { margin: 0; font-size: 20px; }
section { margin: 14px 20px; }
#dropzone { border: 2px dashed #b08a5a; border-radius: 8px; padding: 20px; text-align: center; background: #fffdf8; }
#dropzone.over { background: #f0e6d2; }
.link { color: #1565c0; cursor: pointer; text-decoration: underline; }
.actions { margin-top: 10px; }
button { margin: 0 4px; padding: 6px 12px; cursor: pointer; }
.filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
.kpi { background: #fffdf8; border: 1px solid #e0d6c0; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; }
.kpi b { font-size: 22px; }
.pos { color: #2e7d32; } .neg { color: #c62828; }
.card { background: #fffdf8; border: 1px solid #e0d6c0; border-radius: 8px; padding: 12px; overflow-x: auto; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { border: 1px solid #e0d6c0; padding: 4px 8px; text-align: right; }
th:first-child, td:first-child { text-align: left; }
svg { width: 100%; height: auto; }
```

- [ ] **Step 4: Implementacja `build.js`**

```javascript
// build.js
import { readFileSync, writeFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const stripModule = code => code
  .replace(/^\s*import[^\n]*\n/gm, '')
  .replace(/^\s*export\s+/gm, '');

const LOGIC = ['src/shared-date.js', 'src/parse.js', 'src/merge.js', 'src/aggregate.js', 'src/charts.js', 'src/ui.js'];

export function buildDashboard() {
  const css = read('./src/dashboard.css');
  const js = LOGIC.map(p => stripModule(read('./' + p))).join('\n');
  return read('./src/dashboard.template.html')
    .replace('/*INJECT:css*/', () => css)
    .replace('/*INJECT:js*/', () => js);
}

export function buildBookmarklet() {
  const js = ['src/shared-date.js', 'src/collector.js'].map(p => stripModule(read('./' + p))).join('\n');
  const oneLine = 'javascript:(()=>{' + js.replace(/\n\s*/g, ' ') + '})()';
  return oneLine;
}

function buildInstallPage(bm) {
  const href = bm.replace(/"/g, '&quot;');
  return `<!doctype html><meta charset="utf-8"><title>Instalacja kolektora</title>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h1>Kolektor logu PP</h1>
<p>Przeciągnij poniższy przycisk na pasek zakładek. Potem wejdź na stronę logu premium w grze i kliknij zakładkę.</p>
<p><a href="${href}" style="display:inline-block;padding:10px 16px;background:#5b3a1e;color:#f4e9d8;border-radius:6px;text-decoration:none">Pobierz log PP</a></p>
<p style="color:#666">Tryb pobierania i opóźnienie wybierzesz w oknach dialogowych po kliknięciu.</p>`;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('build.js')) {
  const html = buildDashboard();
  writeFileSync(new URL('./dist/dashboard.html', import.meta.url), html);
  const bm = buildBookmarklet();
  writeFileSync(new URL('./dist/collector-install.html', import.meta.url), buildInstallPage(bm));
  console.log('Zbudowano dist/dashboard.html oraz dist/collector-install.html');
}
```

- [ ] **Step 5: Uruchom testy i build**

Run: `node --test test/build.test.js` → PASS
Run: `npm run build`
Expected: powstają `dist/dashboard.html` i `dist/collector-install.html`; log „Zbudowano…".

- [ ] **Step 6: Weryfikacja w przeglądarce**

1. Otwórz `dist/dashboard.html` dwuklikiem — strona się renderuje, brak błędów w konsoli.
2. Otwórz `dist/collector-install.html` — przeciągnij bookmarklet na pasek. Wykonaj weryfikację z Task 8 Step 3.
3. Przeciągnij testowy JSON na dashboard — pojawiają się KPI, wykresy, tabele.

- [ ] **Step 7: Commit**

```bash
git add build.js src/dashboard.css test/build.test.js dist/dashboard.html dist/collector-install.html
git commit -m "feat: inliner build — jednoplikowy dashboard i bookmarklet"
```

---

### Task 11: Konwersja istniejących XLSX → JSON (`tools/xlsx_to_json.py`)

**Files:**
- Create: `tools/xlsx_to_json.py`
- Test: `test/xlsx_tool.test.js` (uruchamia skrypt i sprawdza wynik) — LUB weryfikacja ręczna, jeśli brak Node↔Python w CI.

**Interfaces:**
- Produces: dla każdego `_share/*.xlsx` plik `dist/legacy-<basename>.json` w formacie kolektora (`{rows:[{dateRaw,world,txType,changeRaw,balanceRaw,info}]}`), gotowy do wczytania w dashboardzie.

- [ ] **Step 1: Implementacja skryptu**

```python
# tools/xlsx_to_json.py
import json, sys, glob, os
import openpyxl

HEADER = {'data', 'świat', 'swiat', 'transakcja'}

def looks_like_header(row):
    first = (str(row[0]) if row and row[0] is not None else '').strip().lower()
    return first in HEADER

def convert(path, outdir):
    wb = openpyxl.load_workbook(path, read_only=True)
    rows = []
    for ws in wb.worksheets:
        for r in ws.iter_rows(values_only=True):
            if r is None or len(r) < 6 or r[0] is None:
                continue
            if looks_like_header(r):
                continue
            rows.append({
                'dateRaw': str(r[0]).replace('\xa0', ' ').strip(),
                'world': str(r[1]).replace('\xa0', ' ').strip(),
                'txType': str(r[2]).replace('\xa0', ' ').strip(),
                'changeRaw': str(r[3]).replace('\xa0', ' ').strip(),
                'balanceRaw': str(r[4]).replace('\xa0', ' ').strip(),
                'info': str(r[5]).replace('\xa0', ' ').strip(),
            })
    base = os.path.splitext(os.path.basename(path))[0]
    out = os.path.join(outdir, f'legacy-{base}.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'source': os.path.basename(path), 'count': len(rows), 'rows': rows}, f, ensure_ascii=False, indent=2)
    print(f'{path} -> {out} ({len(rows)} wierszy)')

if __name__ == '__main__':
    outdir = 'dist'
    os.makedirs(outdir, exist_ok=True)
    files = sys.argv[1:] or glob.glob('_share/*.xlsx')
    for f in files:
        convert(f, outdir)
```

- [ ] **Step 2: Uruchom konwersję na realnych plikach**

Run: `python tools/xlsx_to_json.py`
Expected: powstają `dist/legacy-s229.json` i `dist/legacy-s331.json` z liczbą wierszy > 0; polskie znaki poprawne (`Świat`, `Żelazo`).

- [ ] **Step 3: Weryfikacja end-to-end w dashboardzie**

1. Otwórz `dist/dashboard.html`.
2. Przeciągnij `dist/legacy-s229.json` i `dist/legacy-s331.json`.
3. Sprawdź: licznik wpisów rośnie, filtr świata pokazuje „Świat 229" i „Świat 231/217", KPI i kursy mają sensowne wartości. Ponowne przeciągnięcie tych samych plików NIE zwiększa licznika (dedup działa).

- [ ] **Step 4: Commit**

```bash
git add tools/xlsx_to_json.py dist/legacy-s229.json dist/legacy-s331.json
git commit -m "feat: konwersja istniejących XLSX logów do JSON"
```

---

## Weryfikacja końcowa (całość)

- [ ] `npm test` — wszystkie testy zielone.
- [ ] `npm run build` — `dist/dashboard.html` i `dist/collector-install.html` powstają.
- [ ] Bookmarklet pobiera log z gry do JSON (tryb „wszystko" i „nowe od daty").
- [ ] Dashboard (jeden plik, offline) wczytuje JSON+CSV, deduplikuje, filtruje po świecie i dacie, pokazuje KPI, wykresy i tabele.
- [ ] Stare XLSX (229/331) przekonwertowane i wczytane bez utraty historii.
- [ ] README z krótką instrukcją użycia (opcjonalny commit domykający).
