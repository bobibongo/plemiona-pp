# Symulator rekrutacji jednostek — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Osobna strona `dist/jednostki/index.html`, która dla zadanego składu wojska i poziomów koszar/stajni/warsztatu policzy koszt, zajętą populację, czas rekrutacji per budynek i pokaże radar siły bojowej.

**Architecture:** Nowy katalog `src/jednostki/` z czystymi modułami logiki (bez DOM) plus jeden moduł UI. Koszty, populacja i czas rekrutacji pochodzą z istniejących `src/wioska/jednostki.js` i `src/wioska/swiaty.js` — nie duplikujemy wzorów. Staty bojowe to nowe dane (świat nie ma ich w `swiaty.js`).

**Tech Stack:** Czysty ES2020, zero zależności runtime. Testy: wbudowany `node:test` + `node:assert/strict`. Build: `node build.js` skleja moduły przez `stripModule` i wstrzykuje do szablonu HTML.

**Spec:** `docs/superpowers/specs/2026-08-30-symulator-rekrutacji-design.md`

## Global Constraints

- Język kodu i komentarzy: polski, bez polskich znaków w nazwach identyfikatorów (`lucznikNaKoniu`, nie `łucznikNaKoniu`). Komentarze i komunikaty UI — pełna polszczyzna z diakrytykami.
- Komentarze wyjaśniają **dlaczego**, nie **co**. Tak jak w `src/wioska/jednostki.js` i `src/handlarz-pp.js`.
- Każdy moduł logiki musi dać się zaimportować w Node bez DOM. Tylko `strona.js` dotyka `document`.
- Testy: `test/jednostki-<obszar>.test.js`, uruchamiane przez `node --test`. Nazwy testów po polsku, bez diakrytyków (konwencja z `test/handlarz-pp.test.js`).
- Build musi przechodzić `node build.js` po każdym zadaniu dotykającym `build.js`.
- Świat: `pl231`. Staty bojowe to wartości **bez modyfikatorów** z API świata — nigdy z podglądu jednostki w grze (ten pokazuje staty z bonusami wioski).
- Bez limitu zagrody. Populacja to sama informacja.
- Prędkość i ładowność jednostek: poza zakresem, nie dodawać.

---

### Task 1: Dane statystyk bojowych

**Files:**
- Create: `src/jednostki/staty-dane.js`
- Test: `test/jednostki-staty.test.js`

**Interfaces:**
- Consumes: nic (pierwszy task)
- Produces: `STATY_BOJOWE` — obiekt `{ [jednostka]: { atak, obrona, obronaKawaleria, obronaLucznicy } }`, zamrożony przez `Object.freeze`. Klucze jednostek identyczne jak w `src/wioska/swiaty.js` (`pikinier`, `miecznik`, `topornik`, `lucznik`, `zwiadowca`, `lekka`, `lucznikNaKoniu`, `ciezka`, `taran`, `katapulta`).

- [ ] **Step 1: Write the failing test**

```js
// test/jednostki-staty.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATY_BOJOWE } from '../src/jednostki/staty-dane.js';

test('STATY_BOJOWE zawiera wszystkie 10 jednostek rekrutowanych z koszar/stajni/warsztatu', () => {
  assert.deepEqual(Object.keys(STATY_BOJOWE).sort(), [
    'ciezka', 'katapulta', 'lekka', 'lucznik', 'lucznikNaKoniu',
    'miecznik', 'pikinier', 'taran', 'topornik', 'zwiadowca',
  ]);
});

test('STATY_BOJOWE ma wartosci bazowe z API swiata, bez bonusow wioski', () => {
  assert.deepEqual(STATY_BOJOWE.pikinier, { atak: 10, obrona: 15, obronaKawaleria: 45, obronaLucznicy: 20 });
  assert.deepEqual(STATY_BOJOWE.ciezka, { atak: 150, obrona: 200, obronaKawaleria: 80, obronaLucznicy: 180 });
  assert.deepEqual(STATY_BOJOWE.zwiadowca, { atak: 0, obrona: 2, obronaKawaleria: 1, obronaLucznicy: 2 });
});

test('STATY_BOJOWE jest zamrozone, zeby nikt nie nadpisal statow w locie', () => {
  assert.throws(() => { STATY_BOJOWE.pikinier = null; }, TypeError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/jednostki-staty.test.js`
Expected: FAIL — `Cannot find module '../src/jednostki/staty-dane.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// src/jednostki/staty-dane.js
// Statystyki bojowe jednostek — wartosci BAZOWE, bez zadnych modyfikatorow.
//
// Zrodlo: _share/jednostki.json, zaciagniete z API swiata
// (pl231.plemiona.pl/interface.php?func=get_unit_info).
//
// UWAGA: podglad jednostki w grze pokazuje staty Z BONUSAMI ogladanej wioski
// (np. wioska z bonusem obronnym pokaze pikiniera 15,6 zamiast 15). Te liczby
// NIE moga trafic tutaj — model ma operowac na czystej bazie, inaczej wyniki
// przestana byc porownywalne miedzy wioskami.

export const STATY_BOJOWE = Object.freeze({
  pikinier:       Object.freeze({ atak: 10,  obrona: 15,  obronaKawaleria: 45, obronaLucznicy: 20 }),
  miecznik:       Object.freeze({ atak: 25,  obrona: 50,  obronaKawaleria: 15, obronaLucznicy: 40 }),
  topornik:       Object.freeze({ atak: 40,  obrona: 10,  obronaKawaleria: 5,  obronaLucznicy: 10 }),
  lucznik:        Object.freeze({ atak: 15,  obrona: 50,  obronaKawaleria: 40, obronaLucznicy: 5 }),
  zwiadowca:      Object.freeze({ atak: 0,   obrona: 2,   obronaKawaleria: 1,  obronaLucznicy: 2 }),
  lekka:          Object.freeze({ atak: 130, obrona: 30,  obronaKawaleria: 40, obronaLucznicy: 30 }),
  lucznikNaKoniu: Object.freeze({ atak: 120, obrona: 40,  obronaKawaleria: 30, obronaLucznicy: 50 }),
  ciezka:         Object.freeze({ atak: 150, obrona: 200, obronaKawaleria: 80, obronaLucznicy: 180 }),
  taran:          Object.freeze({ atak: 2,   obrona: 20,  obronaKawaleria: 50, obronaLucznicy: 20 }),
  katapulta:      Object.freeze({ atak: 100, obrona: 100, obronaKawaleria: 50, obronaLucznicy: 100 }),
});

export const OSIE_BOJOWE = Object.freeze(['atak', 'obrona', 'obronaKawaleria', 'obronaLucznicy']);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/jednostki-staty.test.js`
Expected: PASS — 3 testy

- [ ] **Step 5: Commit**

```bash
git add src/jednostki/staty-dane.js test/jednostki-staty.test.js
git commit -m "feat: statystyki bojowe jednostek (baza z API swiata)"
```

---

### Task 2: Suma siły bojowej składu

**Files:**
- Create: `src/jednostki/staty.js`
- Modify: `test/jednostki-staty.test.js` (dopisz testy na końcu)

**Interfaces:**
- Consumes: `STATY_BOJOWE`, `OSIE_BOJOWE` z `./staty-dane.js`
- Produces: `silaSkladu(sklad)` → `{ atak, obrona, obronaKawaleria, obronaLucznicy }`. `sklad` to `{ [jednostka]: ilosc }`. Nieznana jednostka rzuca `Error`.

- [ ] **Step 1: Write the failing test**

```js
// dopisz na koncu test/jednostki-staty.test.js
// (dodaj import na gorze pliku: import { silaSkladu } from '../src/jednostki/staty.js';)

test('silaSkladu mnozy staty przez ilosc jednostek', () => {
  assert.deepEqual(silaSkladu({ pikinier: 100 }), {
    atak: 1000, obrona: 1500, obronaKawaleria: 4500, obronaLucznicy: 2000,
  });
});

test('silaSkladu sumuje kilka roznych jednostek', () => {
  assert.deepEqual(silaSkladu({ pikinier: 10, miecznik: 10 }), {
    atak: 350, obrona: 650, obronaKawaleria: 600, obronaLucznicy: 600,
  });
});

test('silaSkladu jest liniowa — podwojony sklad daje podwojona sile', () => {
  const poj = silaSkladu({ pikinier: 7000, lucznik: 7000 });
  const podw = silaSkladu({ pikinier: 14000, lucznik: 14000 });
  for (const os of Object.keys(poj)) assert.equal(podw[os], poj[os] * 2);
});

test('silaSkladu dla pustego skladu daje same zera, nie NaN', () => {
  assert.deepEqual(silaSkladu({}), { atak: 0, obrona: 0, obronaKawaleria: 0, obronaLucznicy: 0 });
});

test('silaSkladu pomija jednostki o ilosci zero', () => {
  assert.deepEqual(silaSkladu({ pikinier: 0 }), { atak: 0, obrona: 0, obronaKawaleria: 0, obronaLucznicy: 0 });
});

test('silaSkladu odrzuca nieznana jednostke z czytelnym komunikatem', () => {
  assert.throws(() => silaSkladu({ smok: 10 }), /smok/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/jednostki-staty.test.js`
Expected: FAIL — `Cannot find module '../src/jednostki/staty.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// src/jednostki/staty.js
// Sumaryczna sila bojowa skladu. Suma, nie srednia — 7000 pikinierow ma dawac
// wiekszy wielokat na radarze niz 700, bo porownujemy realne armie.

import { STATY_BOJOWE, OSIE_BOJOWE } from './staty-dane.js';

export function silaSkladu(sklad) {
  const wynik = {};
  for (const os of OSIE_BOJOWE) wynik[os] = 0;

  for (const [jednostka, ilosc] of Object.entries(sklad ?? {})) {
    const n = Number(ilosc) || 0;
    if (n <= 0) continue;
    const staty = STATY_BOJOWE[jednostka];
    if (!staty) throw new Error(`Nieznana jednostka: ${jednostka}`);
    for (const os of OSIE_BOJOWE) wynik[os] += staty[os] * n;
  }
  return wynik;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/jednostki-staty.test.js`
Expected: PASS — 9 testów łącznie

- [ ] **Step 5: Commit**

```bash
git add src/jednostki/staty.js test/jednostki-staty.test.js
git commit -m "feat: suma sily bojowej skladu wojska"
```

---

### Task 3: Koszt surowców i zajęta populacja

**Files:**
- Create: `src/jednostki/koszty.js`
- Test: `test/jednostki-koszty.test.js`

**Interfaces:**
- Consumes: `kosztJednostki(s, jednostka)`, `populacjaJednostki(s, jednostka)` z `../wioska/jednostki.js`; `swiat(kod)` z `../wioska/swiaty.js`
- Produces: `kosztSkladu(s, sklad)` → `{ drewno, glina, zelazo, populacja }`. `s` to obiekt świata z `swiat('pl231')`.

- [ ] **Step 1: Write the failing test**

```js
// test/jednostki-koszty.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { kosztSkladu } from '../src/jednostki/koszty.js';

const s = swiat('pl231');

test('kosztSkladu liczy koszt jednej jednostki wg danych swiata', () => {
  // pikinier: 50 drewna, 30 gliny, 10 zelaza, 1 populacji
  assert.deepEqual(kosztSkladu(s, { pikinier: 1 }), {
    drewno: 50, glina: 30, zelazo: 10, populacja: 1,
  });
});

test('kosztSkladu mnozy przez ilosc', () => {
  assert.deepEqual(kosztSkladu(s, { pikinier: 100 }), {
    drewno: 5000, glina: 3000, zelazo: 1000, populacja: 100,
  });
});

test('kosztSkladu sumuje rozne jednostki i ich populacje', () => {
  // ciezka: 200/150/600, populacja 6
  const w = kosztSkladu(s, { pikinier: 10, ciezka: 10 });
  assert.deepEqual(w, { drewno: 2500, glina: 1800, zelazo: 6100, populacja: 70 });
});

test('kosztSkladu dla pustego skladu daje zera', () => {
  assert.deepEqual(kosztSkladu(s, {}), { drewno: 0, glina: 0, zelazo: 0, populacja: 0 });
});

test('kosztSkladu odrzuca nieznana jednostke', () => {
  assert.throws(() => kosztSkladu(s, { smok: 1 }), /smok/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/jednostki-koszty.test.js`
Expected: FAIL — `Cannot find module '../src/jednostki/koszty.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// src/jednostki/koszty.js
// Koszt surowcow i zajeta populacja dla skladu wojska.
//
// Swiadomie NIE ma tu limitu zagrody: rozbudowana wioska ma ok. 24 000 miejsca,
// z czego ok. 4 000 zjadaja budynki, ale to zalezy od konkretnej wioski.
// Symulator podaje samo zapotrzebowanie, a ile kto ma wolnego — wie sam.

import { kosztJednostki, populacjaJednostki } from '../wioska/jednostki.js';

export function kosztSkladu(s, sklad) {
  const wynik = { drewno: 0, glina: 0, zelazo: 0, populacja: 0 };

  for (const [jednostka, ilosc] of Object.entries(sklad ?? {})) {
    const n = Number(ilosc) || 0;
    if (n <= 0) continue;
    // kosztJednostki rzuca czytelnym bledem dla nieznanej jednostki —
    // nie duplikujemy tu walidacji.
    const k = kosztJednostki(s, jednostka);
    wynik.drewno += k.drewno * n;
    wynik.glina += k.glina * n;
    wynik.zelazo += k.zelazo * n;
    wynik.populacja += populacjaJednostki(s, jednostka) * n;
  }
  return wynik;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/jednostki-koszty.test.js`
Expected: PASS — 5 testów

- [ ] **Step 5: Commit**

```bash
git add src/jednostki/koszty.js test/jednostki-koszty.test.js
git commit -m "feat: koszt surowcow i populacja skladu wojska"
```

---

### Task 4: Czas rekrutacji per budynek

To jest sedno modelu. Koszary, stajnia i warsztat mają **osobne kolejki i produkują równolegle** — więc realny czas to `max` z trzech, nie suma. Suma zawyżałaby wynik nawet kilkukrotnie.

**Files:**
- Create: `src/jednostki/czas.js`
- Test: `test/jednostki-czas.test.js`

**Interfaces:**
- Consumes: `czasRekrutacji(s, jednostka, poziomBudynku)`, `budynekJednostki(s, jednostka)` z `../wioska/jednostki.js`
- Produces:
  - `BUDYNKI_REKRUTACJI` — `['koszary', 'stajnia', 'warsztat']`
  - `czasSkladu(s, sklad, poziomy, bonusy)` → `{ perBudynek: { koszary, stajnia, warsztat }, calosc, waskieGardlo }`. Czasy w sekundach. `poziomy` i `bonusy` to `{ koszary, stajnia, warsztat }`; brakujące pola → poziom 0, bonus 0. `waskieGardlo` to nazwa najdłuższego budynku albo `null` dla pustego składu.

- [ ] **Step 1: Write the failing test**

```js
// test/jednostki-czas.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { czasRekrutacji } from '../src/wioska/jednostki.js';
import { czasSkladu, BUDYNKI_REKRUTACJI } from '../src/jednostki/czas.js';

const s = swiat('pl231');
const POZIOMY = { koszary: 25, stajnia: 20, warsztat: 15 };
const BEZ_BONUSU = { koszary: 0, stajnia: 0, warsztat: 0 };

test('BUDYNKI_REKRUTACJI to koszary, stajnia, warsztat', () => {
  assert.deepEqual(BUDYNKI_REKRUTACJI, ['koszary', 'stajnia', 'warsztat']);
});

test('czasSkladu dla jednej jednostki rowna sie czasowi rekrutacji tej jednostki', () => {
  const w = czasSkladu(s, { pikinier: 1 }, POZIOMY, BEZ_BONUSU);
  assert.equal(w.perBudynek.koszary, czasRekrutacji(s, 'pikinier', 25));
  assert.equal(w.calosc, w.perBudynek.koszary);
});

test('czasSkladu sumuje jednostki w obrebie jednego budynku (jedna kolejka)', () => {
  const w = czasSkladu(s, { pikinier: 10 }, POZIOMY, BEZ_BONUSU);
  assert.equal(w.perBudynek.koszary, czasRekrutacji(s, 'pikinier', 25) * 10);
});

test('sklad tylko z koszar nie generuje czasu stajni ani warsztatu', () => {
  const w = czasSkladu(s, { pikinier: 100 }, POZIOMY, BEZ_BONUSU);
  assert.equal(w.perBudynek.stajnia, 0);
  assert.equal(w.perBudynek.warsztat, 0);
});

// SEDNO MODELU: budynki pracuja rownolegle.
test('czas calosci to MAKSIMUM z budynkow, nie suma', () => {
  const w = czasSkladu(s, { pikinier: 1000, lekka: 10 }, POZIOMY, BEZ_BONUSU);
  const suma = w.perBudynek.koszary + w.perBudynek.stajnia;
  assert.equal(w.calosc, Math.max(w.perBudynek.koszary, w.perBudynek.stajnia));
  assert.ok(w.calosc < suma, 'calosc musi byc krotsza niz suma, bo budynki pracuja rownolegle');
});

test('czasSkladu wskazuje waskie gardlo — budynek o najdluzszym czasie', () => {
  const w = czasSkladu(s, { pikinier: 1000, lekka: 10 }, POZIOMY, BEZ_BONUSU);
  assert.equal(w.waskieGardlo, 'koszary');
});

test('bonus 0% nie zmienia czasu', () => {
  const bez = czasSkladu(s, { pikinier: 100 }, POZIOMY, BEZ_BONUSU);
  const zero = czasSkladu(s, { pikinier: 100 }, POZIOMY, { koszary: 0, stajnia: 0, warsztat: 0 });
  assert.equal(zero.perBudynek.koszary, bez.perBudynek.koszary);
});

test('bonus 100% polowi czas', () => {
  const bez = czasSkladu(s, { pikinier: 100 }, POZIOMY, BEZ_BONUSU);
  const zbon = czasSkladu(s, { pikinier: 100 }, POZIOMY, { koszary: 100, stajnia: 0, warsztat: 0 });
  assert.equal(zbon.perBudynek.koszary, Math.round(bez.perBudynek.koszary / 2));
});

test('bonus dotyczy tylko swojego budynku', () => {
  const w = czasSkladu(s, { pikinier: 100, lekka: 100 }, POZIOMY, { koszary: 100, stajnia: 0, warsztat: 0 });
  const bez = czasSkladu(s, { pikinier: 100, lekka: 100 }, POZIOMY, BEZ_BONUSU);
  assert.equal(w.perBudynek.stajnia, bez.perBudynek.stajnia);
  assert.ok(w.perBudynek.koszary < bez.perBudynek.koszary);
});

test('wyzszy poziom budynku skraca czas rekrutacji', () => {
  const niski = czasSkladu(s, { pikinier: 100 }, { koszary: 1 }, BEZ_BONUSU);
  const wysoki = czasSkladu(s, { pikinier: 100 }, { koszary: 25 }, BEZ_BONUSU);
  assert.ok(wysoki.perBudynek.koszary < niski.perBudynek.koszary);
});

test('pusty sklad daje zera i brak waskiego gardla, bez NaN', () => {
  const w = czasSkladu(s, {}, POZIOMY, BEZ_BONUSU);
  assert.deepEqual(w.perBudynek, { koszary: 0, stajnia: 0, warsztat: 0 });
  assert.equal(w.calosc, 0);
  assert.equal(w.waskieGardlo, null);
});

test('czasSkladu odrzuca ujemny bonus', () => {
  assert.throws(() => czasSkladu(s, { pikinier: 1 }, POZIOMY, { koszary: -10 }), /bonus/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/jednostki-czas.test.js`
Expected: FAIL — `Cannot find module '../src/jednostki/czas.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// src/jednostki/czas.js
// Czas rekrutacji skladu, liczony OSOBNO dla kazdego budynku.
//
// Koszary, stajnia i warsztat maja niezalezne kolejki i pracuja ROWNOLEGLE.
// Dlatego czas calosci to maksimum z trzech, a nie ich suma — suma zawyzalaby
// wynik nawet kilkukrotnie i czynila plan bezuzytecznym.
// W obrebie jednego budynku jednostki ida sekwencyjnie (jedna kolejka), wiec
// tam czasy sie sumuja.

import { czasRekrutacji, budynekJednostki } from '../wioska/jednostki.js';

export const BUDYNKI_REKRUTACJI = Object.freeze(['koszary', 'stajnia', 'warsztat']);

// Bonus w % skraca czas: 100% oznacza dwa razy szybciej.
// Trzymamy to w jednym miejscu, bo jesli premie w grze skladaja sie inaczej
// (np. multiplikatywnie z innymi efektami), poprawka bedzie dotyczyc tylko tej funkcji.
function zBonusem(czas, bonusProcent) {
  const b = Number(bonusProcent) || 0;
  if (b < 0) throw new Error(`Bonus rekrutacji nie moze byc ujemny: ${b}%`);
  return czas / (1 + b / 100);
}

export function czasSkladu(s, sklad, poziomy = {}, bonusy = {}) {
  const perBudynek = {};
  for (const b of BUDYNKI_REKRUTACJI) perBudynek[b] = 0;

  // Walidujemy bonusy niezaleznie od skladu — ujemny bonus to blad danych
  // wejsciowych, nawet jesli akurat zaden budynek nic nie produkuje.
  for (const b of BUDYNKI_REKRUTACJI) zBonusem(0, bonusy[b]);

  for (const [jednostka, ilosc] of Object.entries(sklad ?? {})) {
    const n = Number(ilosc) || 0;
    if (n <= 0) continue;
    const budynek = budynekJednostki(s, jednostka);
    const poziom = poziomy[budynek] ?? 0;
    perBudynek[budynek] += czasRekrutacji(s, jednostka, poziom) * n;
  }

  for (const b of BUDYNKI_REKRUTACJI) {
    perBudynek[b] = Math.round(zBonusem(perBudynek[b], bonusy[b]));
  }

  const calosc = Math.max(...BUDYNKI_REKRUTACJI.map(b => perBudynek[b]));
  const waskieGardlo = calosc > 0
    ? BUDYNKI_REKRUTACJI.find(b => perBudynek[b] === calosc)
    : null;

  return { perBudynek, calosc, waskieGardlo };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/jednostki-czas.test.js`
Expected: PASS — 12 testów

- [ ] **Step 5: Commit**

```bash
git add src/jednostki/czas.js test/jednostki-czas.test.js
git commit -m "feat: czas rekrutacji per budynek, calosc jako maksimum"
```

---

### Task 5: Geometria radaru

Czysta matematyka, bez DOM — dzięki temu da się ją przetestować w Node i podmienić rendering bez ruszania logiki.

**Files:**
- Create: `src/jednostki/radar.js`
- Test: `test/jednostki-radar.test.js`

**Interfaces:**
- Consumes: `OSIE_BOJOWE` z `./staty-dane.js`
- Produces:
  - `normalizuj(wartosci, maksima)` → `{ [os]: 0..1 }`; oś o maksimum 0 daje 0 (nie NaN)
  - `maksimaOsi(listaSil)` → `{ [os]: max }` — wspólna skala dla porównywanych składów
  - `punktyWielokata(znormalizowane, promien)` → `[{ x, y }]`, pierwszy punkt na godzinie 12, dalej zgodnie z ruchem wskazówek

- [ ] **Step 1: Write the failing test**

```js
// test/jednostki-radar.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizuj, maksimaOsi, punktyWielokata } from '../src/jednostki/radar.js';

test('maksimaOsi bierze najwieksza wartosc kazdej osi ze wszystkich skladow', () => {
  const m = maksimaOsi([
    { atak: 100, obrona: 50, obronaKawaleria: 10, obronaLucznicy: 5 },
    { atak: 20, obrona: 200, obronaKawaleria: 30, obronaLucznicy: 1 },
  ]);
  assert.deepEqual(m, { atak: 100, obrona: 200, obronaKawaleria: 30, obronaLucznicy: 5 });
});

test('normalizuj skaluje wartosc do udzialu w maksimum', () => {
  const n = normalizuj(
    { atak: 50, obrona: 100, obronaKawaleria: 0, obronaLucznicy: 25 },
    { atak: 100, obrona: 100, obronaKawaleria: 100, obronaLucznicy: 100 },
  );
  assert.equal(n.atak, 0.5);
  assert.equal(n.obrona, 1);
  assert.equal(n.obronaKawaleria, 0);
  assert.equal(n.obronaLucznicy, 0.25);
});

// Sam zwiadowca ma atak 0 — bez tego zabezpieczenia wyszloby 0/0 = NaN
// i wielokat zniknalby z ekranu.
test('normalizuj przy maksimum zero daje 0, nie NaN', () => {
  const n = normalizuj({ atak: 0 }, { atak: 0 });
  assert.equal(n.atak, 0);
  assert.ok(Number.isFinite(n.atak));
});

test('punktyWielokata zwraca tyle punktow ile osi', () => {
  const p = punktyWielokata({ atak: 1, obrona: 1, obronaKawaleria: 1, obronaLucznicy: 1 }, 100);
  assert.equal(p.length, 4);
});

test('pierwszy punkt lezy na godzinie 12 — nad srodkiem', () => {
  const p = punktyWielokata({ atak: 1, obrona: 1, obronaKawaleria: 1, obronaLucznicy: 1 }, 100);
  assert.ok(Math.abs(p[0].x) < 1e-9, 'x pierwszego punktu ma byc 0');
  assert.equal(Math.round(p[0].y), -100, 'y ma byc -promien (w gore w ukladzie SVG)');
});

test('punkt o wartosci zero lezy w srodku wielokata', () => {
  const p = punktyWielokata({ atak: 0, obrona: 1, obronaKawaleria: 1, obronaLucznicy: 1 }, 100);
  assert.ok(Math.abs(p[0].x) < 1e-9 && Math.abs(p[0].y) < 1e-9);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/jednostki-radar.test.js`
Expected: FAIL — `Cannot find module '../src/jednostki/radar.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// src/jednostki/radar.js
// Geometria wykresu radarowego — czysta matematyka, zero DOM.
// Dzieki temu da sie ja przetestowac w Node i wymienic rendering
// bez dotykania logiki.

import { OSIE_BOJOWE } from './staty-dane.js';

// Wspolna skala dla porownywanych skladow: kazda os normalizowana do
// wlasnego maksimum, zeby os ataku (setki tysiecy) nie splaszczyla obrony.
export function maksimaOsi(listaSil) {
  const maks = {};
  for (const os of OSIE_BOJOWE) {
    maks[os] = Math.max(0, ...listaSil.map(s => s[os] ?? 0));
  }
  return maks;
}

export function normalizuj(wartosci, maksima) {
  const wynik = {};
  for (const os of Object.keys(wartosci)) {
    const maks = maksima[os] ?? 0;
    // Maksimum 0 znaczy, ze zaden porownywany sklad nie ma nic na tej osi
    // (np. same zwiadowcy — atak 0). Dzielenie dalo by NaN i wielokat
    // zniknalby z ekranu, wiec jawnie zwracamy 0.
    wynik[os] = maks > 0 ? (wartosci[os] ?? 0) / maks : 0;
  }
  return wynik;
}

// Punkty na okregu: pierwsza os na godzinie 12, kolejne zgodnie z ruchem
// wskazowek. Uklad SVG ma os Y skierowana w dol, stad minus przy cos.
export function punktyWielokata(znormalizowane, promien) {
  const osie = OSIE_BOJOWE.filter(os => os in znormalizowane);
  const krok = (2 * Math.PI) / osie.length;
  return osie.map((os, i) => {
    const kat = i * krok;
    const r = (znormalizowane[os] ?? 0) * promien;
    return { x: r * Math.sin(kat), y: -r * Math.cos(kat) };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/jednostki-radar.test.js`
Expected: PASS — 6 testów

- [ ] **Step 5: Commit**

```bash
git add src/jednostki/radar.js test/jednostki-radar.test.js
git commit -m "feat: geometria wykresu radarowego"
```

---

### Task 6: Walidacja i normalizacja szablonu JSON

**Files:**
- Create: `src/jednostki/szablon.js`
- Test: `test/jednostki-szablon.test.js`

**Interfaces:**
- Consumes: `STATY_BOJOWE` z `./staty-dane.js`, `BUDYNKI_REKRUTACJI` z `./czas.js`
- Produces: `normalizujSzablon(obiekt)` → `{ swiat, nazwa, poziomy: {koszary,stajnia,warsztat}, bonusRekrutacji: {koszary,stajnia,warsztat}, sklad }`. Braki dostają domyślne (poziom 1, bonus 0, skład pusty). Nieznana jednostka lub ujemna ilość rzuca `Error`.

- [ ] **Step 1: Write the failing test**

```js
// test/jednostki-szablon.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujSzablon } from '../src/jednostki/szablon.js';

test('normalizujSzablon przepuszcza kompletny szablon bez zmian', () => {
  const w = normalizujSzablon({
    swiat: 'pl231', nazwa: 'def pik+luk',
    poziomy: { koszary: 25, stajnia: 20, warsztat: 15 },
    bonusRekrutacji: { koszary: 10, stajnia: 0, warsztat: 0 },
    sklad: { pikinier: 7000, lucznik: 7000 },
  });
  assert.equal(w.swiat, 'pl231');
  assert.equal(w.nazwa, 'def pik+luk');
  assert.deepEqual(w.poziomy, { koszary: 25, stajnia: 20, warsztat: 15 });
  assert.deepEqual(w.bonusRekrutacji, { koszary: 10, stajnia: 0, warsztat: 0 });
  assert.deepEqual(w.sklad, { pikinier: 7000, lucznik: 7000 });
});

test('normalizujSzablon uzupelnia brakujace poziomy i bonusy domyslnymi', () => {
  const w = normalizujSzablon({ sklad: { pikinier: 10 } });
  assert.deepEqual(w.poziomy, { koszary: 1, stajnia: 1, warsztat: 1 });
  assert.deepEqual(w.bonusRekrutacji, { koszary: 0, stajnia: 0, warsztat: 0 });
});

test('normalizujSzablon domyslnie ustawia swiat pl231 i pusty sklad', () => {
  const w = normalizujSzablon({});
  assert.equal(w.swiat, 'pl231');
  assert.deepEqual(w.sklad, {});
});

test('normalizujSzablon odrzuca nieznana jednostke z jej nazwa w komunikacie', () => {
  assert.throws(() => normalizujSzablon({ sklad: { smok: 5 } }), /smok/);
});

test('normalizujSzablon odrzuca ujemna ilosc jednostek', () => {
  assert.throws(() => normalizujSzablon({ sklad: { pikinier: -1 } }), /pikinier/);
});

test('normalizujSzablon odrzuca ujemny bonus', () => {
  assert.throws(() => normalizujSzablon({ bonusRekrutacji: { koszary: -5 } }), /bonus/i);
});

test('normalizujSzablon odrzuca wejscie ktore nie jest obiektem', () => {
  assert.throws(() => normalizujSzablon(null), /szablon/i);
  assert.throws(() => normalizujSzablon('tekst'), /szablon/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/jednostki-szablon.test.js`
Expected: FAIL — `Cannot find module '../src/jednostki/szablon.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// src/jednostki/szablon.js
// Walidacja szablonu wklejanego przez uzytkownika. Blad ma wskazywac
// KTORA jednostka albo KTORY budynek jest zly — inaczej przy skladzie
// z kilkunastu pozycji szukanie literowki to loteria.

import { STATY_BOJOWE } from './staty-dane.js';
import { BUDYNKI_REKRUTACJI } from './czas.js';

const SWIAT_DOMYSLNY = 'pl231';
const POZIOM_DOMYSLNY = 1;

export function normalizujSzablon(obiekt) {
  if (!obiekt || typeof obiekt !== 'object' || Array.isArray(obiekt)) {
    throw new Error('Szablon musi być obiektem JSON.');
  }

  const poziomy = {};
  const bonusRekrutacji = {};
  for (const b of BUDYNKI_REKRUTACJI) {
    poziomy[b] = Number(obiekt.poziomy?.[b] ?? POZIOM_DOMYSLNY);
    const bonus = Number(obiekt.bonusRekrutacji?.[b] ?? 0);
    if (!Number.isFinite(bonus) || bonus < 0) {
      throw new Error(`Bonus rekrutacji dla "${b}" musi być liczbą nieujemną.`);
    }
    bonusRekrutacji[b] = bonus;
  }

  const sklad = {};
  for (const [jednostka, ilosc] of Object.entries(obiekt.sklad ?? {})) {
    if (!STATY_BOJOWE[jednostka]) {
      throw new Error(`Nieznana jednostka w składzie: "${jednostka}".`);
    }
    const n = Number(ilosc);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`Ilość jednostki "${jednostka}" musi być liczbą nieujemną.`);
    }
    sklad[jednostka] = n;
  }

  return {
    swiat: obiekt.swiat ?? SWIAT_DOMYSLNY,
    nazwa: obiekt.nazwa ?? '',
    poziomy,
    bonusRekrutacji,
    sklad,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/jednostki-szablon.test.js`
Expected: PASS — 7 testów

- [ ] **Step 5: Commit**

```bash
git add src/jednostki/szablon.js test/jednostki-szablon.test.js
git commit -m "feat: walidacja szablonu skladu wojska"
```

---

### Task 7: Podsumowanie — spina model w jeden wynik

Jedno wejście dla UI, żeby `strona.js` nie musiał znać kolejności wywołań.

**Files:**
- Create: `src/jednostki/podsumowanie.js`
- Test: `test/jednostki-podsumowanie.test.js`

**Interfaces:**
- Consumes: `swiat` z `../wioska/swiaty.js`, `kosztSkladu`, `czasSkladu`, `silaSkladu`, `normalizujSzablon`
- Produces: `podsumowanie(szablonSurowy)` → `{ szablon, koszt, czas, sila }`, gdzie `koszt` z Task 3, `czas` z Task 4, `sila` z Task 2.

- [ ] **Step 1: Write the failing test**

```js
// test/jednostki-podsumowanie.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { podsumowanie } from '../src/jednostki/podsumowanie.js';

const SZABLON = {
  swiat: 'pl231',
  poziomy: { koszary: 25, stajnia: 20, warsztat: 15 },
  bonusRekrutacji: { koszary: 0, stajnia: 0, warsztat: 0 },
  sklad: { pikinier: 7000, lucznik: 7000 },
};

test('podsumowanie zwraca koszt, czas i sile dla szablonu', () => {
  const w = podsumowanie(SZABLON);
  assert.ok(w.koszt.drewno > 0);
  assert.ok(w.czas.calosc > 0);
  assert.ok(w.sila.obrona > 0);
  assert.equal(w.szablon.swiat, 'pl231');
});

test('podsumowanie liczy populacje 7000 pik + 7000 luk jako 14000', () => {
  assert.equal(podsumowanie(SZABLON).koszt.populacja, 14000);
});

test('podsumowanie dla skladu z koszar wskazuje koszary jako waskie gardlo', () => {
  assert.equal(podsumowanie(SZABLON).czas.waskieGardlo, 'koszary');
});

test('podsumowanie pustego skladu nie wysypuje sie i daje zera', () => {
  const w = podsumowanie({ sklad: {} });
  assert.equal(w.koszt.drewno, 0);
  assert.equal(w.czas.calosc, 0);
  assert.equal(w.sila.atak, 0);
});

test('podsumowanie propaguje blad walidacji szablonu', () => {
  assert.throws(() => podsumowanie({ sklad: { smok: 1 } }), /smok/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/jednostki-podsumowanie.test.js`
Expected: FAIL — `Cannot find module '../src/jednostki/podsumowanie.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// src/jednostki/podsumowanie.js
// Jedno wejscie dla UI: z surowego szablonu robi komplet wynikow.
// Dzieki temu strona.js nie musi znac kolejnosci wywolan modelu.

import { swiat } from '../wioska/swiaty.js';
import { normalizujSzablon } from './szablon.js';
import { kosztSkladu } from './koszty.js';
import { czasSkladu } from './czas.js';
import { silaSkladu } from './staty.js';

export function podsumowanie(szablonSurowy) {
  const szablon = normalizujSzablon(szablonSurowy);
  const s = swiat(szablon.swiat);
  return {
    szablon,
    koszt: kosztSkladu(s, szablon.sklad),
    czas: czasSkladu(s, szablon.sklad, szablon.poziomy, szablon.bonusRekrutacji),
    sila: silaSkladu(szablon.sklad),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/jednostki-podsumowanie.test.js`
Expected: PASS — 5 testów

- [ ] **Step 5: Commit**

```bash
git add src/jednostki/podsumowanie.js test/jednostki-podsumowanie.test.js
git commit -m "feat: podsumowanie spinajace model rekrutacji"
```

---

### Task 8: Szablon HTML i CSS strony

**Files:**
- Create: `src/jednostki.template.html`
- Create: `src/jednostki.css`

**Interfaces:**
- Consumes: nic (statyczne pliki)
- Produces: znaczniki `/*INJECT:css*/` i `/*INJECT:js*/` podmieniane przez `build.js` w Task 9. Elementy o `id`, na których operuje `strona.js` w Task 10: `poziom-koszary`, `poziom-stajnia`, `poziom-warsztat`, `bonus-koszary`, `bonus-stajnia`, `bonus-warsztat`, `sklad-pola`, `wynik-koszt`, `wynik-czas`, `wynik-sila`, `radar`, `szablon-pole`, `szablon-wczytaj`, `szablon-kopiuj`, `blad`.

- [ ] **Step 1: Create the HTML template**

```html
<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Symulator rekrutacji — Plemiona</title>
<style>/*INJECT:css*/</style>
</head>
<body>
<header>
  <h1>Symulator rekrutacji</h1>
  <p class="podtytul">Ile to kosztuje, jak długo trwa i jaką siłę daje. Model teoretyczny — w grze dochodzą przestoje i braki surowców.</p>
  <p><a href="../index.html">← Powrót</a></p>
</header>

<main>
  <section class="panel">
    <h2>Budynki</h2>
    <div class="siatka-budynkow">
      <label>Koszary <input type="number" id="poziom-koszary" min="0" max="25" value="25"></label>
      <label>Stajnia <input type="number" id="poziom-stajnia" min="0" max="20" value="20"></label>
      <label>Warsztat <input type="number" id="poziom-warsztat" min="0" max="15" value="15"></label>
    </div>
    <h3>Bonus rekrutacji (%)</h3>
    <div class="siatka-budynkow">
      <label>Koszary <input type="number" id="bonus-koszary" min="0" value="0"></label>
      <label>Stajnia <input type="number" id="bonus-stajnia" min="0" value="0"></label>
      <label>Warsztat <input type="number" id="bonus-warsztat" min="0" value="0"></label>
    </div>
  </section>

  <section class="panel">
    <h2>Skład wojska</h2>
    <div id="sklad-pola" class="siatka-jednostek"></div>
  </section>

  <section class="panel">
    <h2>Wynik</h2>
    <p id="blad" class="blad" hidden></p>
    <div id="wynik-koszt"></div>
    <div id="wynik-czas"></div>
    <div id="wynik-sila"></div>
  </section>

  <section class="panel">
    <h2>Siła bojowa</h2>
    <svg id="radar" viewBox="-140 -140 280 280" role="img" aria-label="Wykres siły bojowej składu"></svg>
  </section>

  <section class="panel">
    <h2>Szablon</h2>
    <p class="podtytul">Wklej JSON i wczytaj, albo skopiuj bieżący skład.</p>
    <textarea id="szablon-pole" rows="10" spellcheck="false"></textarea>
    <div class="przyciski">
      <button id="szablon-wczytaj">Wczytaj</button>
      <button id="szablon-kopiuj">Kopiuj bieżący</button>
    </div>
  </section>
</main>

<script type="module">/*INJECT:js*/</script>
</body>
</html>
```

- [ ] **Step 2: Create the CSS**

```css
/* src/jednostki.css — spojne z panel-theme.js: ciemne tlo, pomaranczowy akcent */
:root {
  --tlo: #12181a; --tlo2: #0c1113; --ramka: #2a3436;
  --tekst: #d8e0e0; --przygas: #7f9494; --akcent: #ff8c1a; --ok: #3ad6b8; --zle: #f0a294;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 20px; background: var(--tlo2); color: var(--tekst);
  font-family: 'JetBrains Mono', Consolas, ui-monospace, monospace; font-size: 13px; line-height: 1.5;
}
h1 { color: var(--akcent); font-size: 20px; text-transform: uppercase; letter-spacing: .1em; margin: 0 0 4px; }
h2 { color: var(--akcent); font-size: 13px; text-transform: uppercase; letter-spacing: .08em; margin: 0 0 10px; }
h3 { color: var(--przygas); font-size: 11px; text-transform: uppercase; margin: 14px 0 6px; }
a { color: var(--ok); }
.podtytul { color: var(--przygas); margin: 0 0 10px; }
main { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); align-items: start; }
.panel { background: var(--tlo); border: 1px solid var(--ramka); padding: 14px; }
.siatka-budynkow, .siatka-jednostek { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); }
label { display: flex; flex-direction: column; gap: 3px; color: var(--przygas); font-size: 11px; }
input, textarea {
  background: var(--tlo2); color: var(--tekst); border: 1px solid var(--ramka);
  padding: 7px; font-family: inherit; font-size: 13px; width: 100%;
}
input:focus-visible, textarea:focus-visible, button:focus-visible { outline: 1px solid var(--ok); outline-offset: 1px; }
button {
  background: #1a2224; color: var(--tekst); border: 1px solid #33403f; padding: 8px 14px;
  font-family: inherit; font-size: 11px; text-transform: uppercase; cursor: pointer;
}
button:hover { background: #212b2d; }
.przyciski { display: flex; gap: 8px; margin-top: 8px; }
.blad { color: var(--zle); border-left: 2px solid var(--zle); padding-left: 8px; }
table { width: 100%; border-collapse: collapse; }
td { padding: 3px 0; }
td:last-child { text-align: right; font-weight: bold; }
.wartosc-akcent { color: var(--akcent); }
#radar { width: 100%; height: auto; max-width: 320px; display: block; margin: 0 auto; }
```

- [ ] **Step 3: Verify the files exist and are non-empty**

Run: `node -e "const fs=require('fs');for(const f of ['src/jednostki.template.html','src/jednostki.css']){const n=fs.statSync(f).size;if(n<100)throw new Error(f+' za maly');console.log(f,n,'B')}"`
Expected: obie ścieżki wypisane z rozmiarem > 100 B

- [ ] **Step 4: Commit**

```bash
git add src/jednostki.template.html src/jednostki.css
git commit -m "feat: szablon HTML i styl strony symulatora rekrutacji"
```

---

### Task 9: Wpięcie w build

**Files:**
- Modify: `build.js` — dodaj `JEDNOSTKI_LOGIC`, `buildJednostkiPage()`, wpis w `main()` i kafelek w rozdzielniku
- Modify: `test/build.test.js` — dopisz testy na końcu

**Interfaces:**
- Consumes: `stripModule`, `read` (istniejące w `build.js`)
- Produces: `buildJednostkiPage()` → string HTML; `dist/jednostki/index.html` przy `node build.js`

- [ ] **Step 1: Write the failing test**

```js
// dopisz na koncu test/build.test.js
// (dodaj buildJednostkiPage do istniejacego importu z '../build.js')

test('strona symulatora rekrutacji zawiera model i szablon HTML', () => {
  const html = buildJednostkiPage();
  assert.match(html, /Symulator rekrutacji/);
  assert.match(html, /function silaSkladu/);
  assert.match(html, /function czasSkladu/);
  assert.match(html, /id="radar"/);
});

test('strona symulatora rekrutacji nie zawiera skladni modulow ES po sklejeniu', () => {
  const html = buildJednostkiPage();
  const js = html.split('<script type="module">')[1] ?? '';
  assert.doesNotMatch(js, /^\s*import\s/m);
  assert.doesNotMatch(js, /^\s*export\s/m);
});

test('rozdzielnik linkuje do symulatora rekrutacji', () => {
  assert.match(buildRozdzielnik({ base: '' }), /href="jednostki\/index\.html"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build.test.js`
Expected: FAIL — `buildJednostkiPage is not a function` (lub błąd importu)

- [ ] **Step 3: Add the builder to build.js**

Wstaw po `buildWioskaPage()` (ok. linii 176):

```js
// Symulator rekrutacji jednostek — osobna strona, wspoldzieli moduly modelu
// z symulatorem wioski (koszty, czas rekrutacji), zeby nie duplikowac wzorow.
export const JEDNOSTKI_LOGIC = [
  'src/wioska/swiaty.js',
  'src/wioska/jednostki.js',
  'src/jednostki/staty-dane.js',
  'src/jednostki/staty.js',
  'src/jednostki/koszty.js',
  'src/jednostki/czas.js',
  'src/jednostki/radar.js',
  'src/jednostki/szablon.js',
  'src/jednostki/podsumowanie.js',
  'src/jednostki/strona.js',
];

export function buildJednostkiPage() {
  const css = read('./src/jednostki.css');
  const js = JEDNOSTKI_LOGIC.map(p => stripModule(read('./' + p))).join('\n').replace(/\r\n/g, '\n');
  return read('./src/jednostki.template.html')
    .replace('/*INJECT:css*/', () => css)
    .replace('/*INJECT:js*/', () => js);
}
```

W `main()`, przed linią `console.log('Zbudowano dist/...`:

```js
  mkdirSync(new URL('./dist/jednostki/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./dist/jednostki/index.html', import.meta.url), buildJednostkiPage());
```

W `buildRozdzielnik`, zaraz po kafelku wioski:

```js
  <a class="karta" href="${base}jednostki/index.html">
    <h2>Symulator rekrutacji</h2>
    <p>Koszt, czas produkcji w koszarach/stajni/warsztacie i siła bojowa składu wojska. Szablony w JSON.</p>
  </a>
```

- [ ] **Step 4: Run test and build to verify**

Run: `node --test test/build.test.js && node build.js`
Expected: testy PASS, build wypisuje listę wygenerowanych plików

- [ ] **Step 5: Commit**

```bash
git add build.js test/build.test.js
git commit -m "feat: wpiecie symulatora rekrutacji w build i rozdzielnik"
```

---

### Task 10: UI — spięcie modelu ze stroną

**Files:**
- Create: `src/jednostki/strona.js`

**Interfaces:**
- Consumes: `podsumowanie` z `./podsumowanie.js`, `STATY_BOJOWE`, `OSIE_BOJOWE` z `./staty-dane.js`, `maksimaOsi`, `normalizuj`, `punktyWielokata` z `./radar.js`
- Produces: nic (moduł UI, uruchamiany efektem ubocznym)

- [ ] **Step 1: Write the implementation**

```js
// src/jednostki/strona.js
// UI symulatora rekrutacji — jedyny modul dotykajacy DOM.
// Cala matematyka siedzi w modelu; tutaj tylko odczyt pol, render i zdarzenia.
//
// Importy sa potrzebne, mimo ze build.js i tak je usuwa przy sklejaniu stron:
// bez nich plik nie dalby sie zaimportowac ani sprawdzic w Node.

import { podsumowanie } from './podsumowanie.js';
import { OSIE_BOJOWE } from './staty-dane.js';
import { maksimaOsi, normalizuj, punktyWielokata } from './radar.js';

const NAZWY_JEDNOSTEK = {
  pikinier: 'Pikinier', miecznik: 'Miecznik', topornik: 'Topornik', lucznik: 'Łucznik',
  zwiadowca: 'Zwiadowca', lekka: 'Lekka kawaleria', lucznikNaKoniu: 'Łucznik na koniu',
  ciezka: 'Ciężka kawaleria', taran: 'Taran', katapulta: 'Katapulta',
};
const NAZWY_OSI = {
  atak: 'Atak', obrona: 'Obrona', obronaKawaleria: 'Obrona p. kawalerii', obronaLucznicy: 'Obrona p. łucznikom',
};
const BUDYNKI = ['koszary', 'stajnia', 'warsztat'];
const NAZWY_BUDYNKOW = { koszary: 'Koszary', stajnia: 'Stajnia', warsztat: 'Warsztat' };

if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const liczba = n => Math.round(n).toLocaleString('pl-PL');

  // Czas podajemy w dniach i godzinach — przy 100 dniach same sekundy
  // sa nieczytelne, a przy kilku godzinach same dni gubia informacje.
  function czasTekst(sekundy) {
    if (sekundy <= 0) return '—';
    const g = Math.floor(sekundy / 3600);
    const dni = Math.floor(g / 24);
    return dni > 0 ? `${dni} dni ${g % 24} h` : `${g} h ${Math.floor((sekundy % 3600) / 60)} min`;
  }

  // Pola skladu budujemy z danych, zeby dodanie jednostki nie wymagalo
  // ruszania HTML-a.
  for (const [kod, nazwa] of Object.entries(NAZWY_JEDNOSTEK)) {
    const label = document.createElement('label');
    label.textContent = nazwa;
    const input = document.createElement('input');
    input.type = 'number'; input.min = '0'; input.value = '0';
    input.id = 'sklad-' + kod;
    label.appendChild(input);
    $('sklad-pola').appendChild(label);
  }

  function zbierzSzablon() {
    const poziomy = {}, bonusRekrutacji = {}, sklad = {};
    for (const b of BUDYNKI) {
      poziomy[b] = Number($('poziom-' + b).value) || 0;
      bonusRekrutacji[b] = Number($('bonus-' + b).value) || 0;
    }
    for (const kod of Object.keys(NAZWY_JEDNOSTEK)) {
      const n = Number($('sklad-' + kod).value) || 0;
      if (n > 0) sklad[kod] = n;
    }
    return { swiat: 'pl231', poziomy, bonusRekrutacji, sklad };
  }

  function tabela(wiersze) {
    return '<table>' + wiersze.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('') + '</table>';
  }

  function rysujRadar(sila) {
    const svg = $('radar');
    const R = 110;
    const maks = maksimaOsi([sila]);
    const punkty = punktyWielokata(normalizuj(sila, maks), R);
    const siatka = [0.25, 0.5, 0.75, 1].map(f => {
      const p = punktyWielokata(Object.fromEntries(OSIE_BOJOWE.map(o => [o, f])), R);
      return `<polygon points="${p.map(q => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#2a3436"/>`;
    }).join('');
    const etykiety = OSIE_BOJOWE.map((os, i) => {
      const p = punktyWielokata(Object.fromEntries(OSIE_BOJOWE.map(o => [o, o === os ? 1.28 : 0])), R)[i];
      return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" fill="#7f9494" font-size="9" text-anchor="middle">${NAZWY_OSI[os]}</text>`;
    }).join('');
    const ksztalt = `<polygon points="${punkty.map(q => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}" fill="rgba(255,140,26,.25)" stroke="#ff8c1a" stroke-width="2"/>`;
    svg.innerHTML = siatka + ksztalt + etykiety;
  }

  function przelicz() {
    try {
      const w = podsumowanie(zbierzSzablon());
      $('blad').hidden = true;

      $('wynik-koszt').innerHTML = '<h3>Koszt</h3>' + tabela([
        ['Drewno', liczba(w.koszt.drewno)], ['Glina', liczba(w.koszt.glina)],
        ['Żelazo', liczba(w.koszt.zelazo)],
        ['Populacja', `<span class="wartosc-akcent">${liczba(w.koszt.populacja)}</span>`],
      ]);

      // Czas calosci to maksimum, bo budynki produkuja rownolegle — piszemy
      // to wprost, zeby nikt nie czytal tego jako sumy.
      $('wynik-czas').innerHTML = '<h3>Czas</h3>' + tabela([
        ...BUDYNKI.map(b => [NAZWY_BUDYNKOW[b], czasTekst(w.czas.perBudynek[b])]),
        ['Łącznie (równolegle)', `<span class="wartosc-akcent">${czasTekst(w.czas.calosc)}</span>`],
        ['Wąskie gardło', w.czas.waskieGardlo ? NAZWY_BUDYNKOW[w.czas.waskieGardlo] : '—'],
      ]);

      $('wynik-sila').innerHTML = '<h3>Siła</h3>' + tabela(
        OSIE_BOJOWE.map(os => [NAZWY_OSI[os], liczba(w.sila[os])]),
      );

      rysujRadar(w.sila);
    } catch (e) {
      $('blad').hidden = false;
      $('blad').textContent = e.message;
    }
  }

  document.addEventListener('input', przelicz);

  $('szablon-wczytaj').addEventListener('click', function () {
    try {
      const dane = JSON.parse($('szablon-pole').value);
      for (const b of BUDYNKI) {
        if (dane.poziomy?.[b] != null) $('poziom-' + b).value = dane.poziomy[b];
        if (dane.bonusRekrutacji?.[b] != null) $('bonus-' + b).value = dane.bonusRekrutacji[b];
      }
      for (const kod of Object.keys(NAZWY_JEDNOSTEK)) {
        $('sklad-' + kod).value = dane.sklad?.[kod] ?? 0;
      }
      przelicz();
    } catch (e) {
      $('blad').hidden = false;
      $('blad').textContent = 'Nie udało się wczytać szablonu: ' + e.message;
    }
  });

  $('szablon-kopiuj').addEventListener('click', function () {
    $('szablon-pole').value = JSON.stringify(zbierzSzablon(), null, 2);
  });

  przelicz();
}
```

- [ ] **Step 2: Rebuild and verify the page contains the UI**

Run: `node build.js && node -e "const h=require('fs').readFileSync('dist/jednostki/index.html','utf8');for(const s of ['function przelicz','function rysujRadar','Wąskie gardło']){if(!h.includes(s))throw new Error('brak: '+s)}console.log('UI obecne, rozmiar',h.length,'B')"`
Expected: `UI obecne, rozmiar <N> B`

- [ ] **Step 3: Run the full suite**

Run: `node --test`
Expected: wszystkie testy PASS, 0 fail

- [ ] **Step 4: Commit**

```bash
git add src/jednostki/strona.js
git commit -m "feat: UI symulatora rekrutacji"
```

---

### Task 11: Szablon przykładowy i weryfikacja końcowa

**Files:**
- Create: `szablony/wojsko-def-pik-luk.json`

**Interfaces:**
- Consumes: format z Task 6
- Produces: gotowy szablon do wklejenia

- [ ] **Step 1: Create the template**

```json
{
  "swiat": "pl231",
  "nazwa": "Def: pikinier + łucznik",
  "poziomy": {
    "koszary": 25,
    "stajnia": 20,
    "warsztat": 15
  },
  "bonusRekrutacji": {
    "koszary": 0,
    "stajnia": 0,
    "warsztat": 0
  },
  "sklad": {
    "pikinier": 7000,
    "lucznik": 7000
  }
}
```

- [ ] **Step 2: Verify the template loads through the model**

Run:
```bash
node -e "
import('./src/jednostki/podsumowanie.js').then(async m => {
  const s = JSON.parse(require('fs').readFileSync('szablony/wojsko-def-pik-luk.json','utf8'));
  const w = m.podsumowanie(s);
  console.log('populacja', w.koszt.populacja);
  console.log('koszt', w.koszt.drewno, w.koszt.glina, w.koszt.zelazo);
  console.log('czas dni', (w.czas.calosc/86400).toFixed(1), 'waskie gardlo', w.czas.waskieGardlo);
  console.log('obrona', w.sila.obrona);
});
"
```
Expected: `populacja 14000`, czas ok. 101 dni, wąskie gardło `koszary`, obrona > 0

- [ ] **Step 3: Run the full suite and build**

Run: `node --test && node build.js`
Expected: wszystkie testy PASS, build kończy się bez błędu

- [ ] **Step 4: Commit**

```bash
git add szablony/wojsko-def-pik-luk.json
git commit -m "feat: przykladowy szablon wojska def pik+luk"
```

---

## Uwagi dla wykonawcy

**Najczęstsza pomyłka w tym planie:** czas całości to `Math.max` z budynków, nie suma. Test „czas calosci to MAKSIMUM z budynkow, nie suma" w Task 4 pilnuje właśnie tego. Jeśli go zmieniasz — zatrzymaj się i zapytaj.

**Staty bojowe** wpisuj wyłącznie z `_share/jednostki.json`. Podgląd jednostki w grze pokazuje wartości z bonusami wioski (pikinier 15,6 zamiast 15) — te liczby nie mogą trafić do `staty-dane.js`.

**Kolejność w `JEDNOSTKI_LOGIC` ma znaczenie.** Build skleja pliki w jeden blok i usuwa importy, więc moduł musi wystąpić po tych, z których korzysta. `strona.js` zawsze ostatni.

**Nie dodawaj** prędkości, ładowności, limitu zagrody ani mechaniki bitwy — to świadomie poza zakresem (patrz spec).
