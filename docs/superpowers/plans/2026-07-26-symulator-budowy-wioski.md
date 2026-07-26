# Symulator budowy wioski — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Statyczna strona symulująca budowę wioski Plemion od zera na osi czasu — z produkcją, magazynem, oczekiwaniem na surowce i ręcznymi dosyłkami — plus silnik uruchamialny z CLI.

**Architecture:** Czyste moduły ESM w `src/wioska/` bez DOM-u i bez `window`, importowane zarówno przez `build.js` (który skleja je w jedną stronę) jak i przez narzędzia w `tools/`. Dane świata i tabele pomiarowe są **modułami JS z nazwanymi eksportami**, nie plikami JSON — `build.js` skleja moduły przez usuwanie linii `import`/`export`, więc `import` JSON-a by nie przetrwał tego procesu.

**Tech Stack:** Node.js ≥ 20 (wbudowany `node:test`), czysty ESM, zero zależności runtime, zero zależności deweloperskich.

**Spec:** `docs/superpowers/specs/2026-07-26-symulator-budowy-wioski-design.md`

## Global Constraints

- **Zero zależności.** Nie wolno dodać niczego do `package.json` poza skryptami. Brak `dependencies` i `devDependencies`.
- **Zero sieci w kodzie produkcyjnym.** Moduły w `src/` nie mogą zawierać `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` ani `<script src>`. Sieci wolno używać wyłącznie w `tools/fetch-swiat.js`.
- **Testy uruchamiane przez `node --test`**, pliki `test/*.test.js`, `import { test } from 'node:test'` i `import assert from 'node:assert/strict'`.
- **Język.** Nazwy funkcji, zmiennych, komentarze i nazwy testów po polsku, bez polskich znaków w identyfikatorach (`ludnosc`, nie `ludność`). Komentarze wyjaśniają *dlaczego*, nie *co* — tak jak w `src/rates-store.js`.
- **Każdy plik w `src/` zaczyna się komentarzem ze swoją ścieżką**, np. `// src/wioska/czas.js`.
- **Nazwy eksportów muszą być unikalne w obrębie całego repozytorium**, bo `build.js` skleja moduły w jeden zakres.
- **Czas liczony w sekundach**, dochody podawane na godzinę i dzielone przez 3600 przy użyciu.
- **Zaokrąglanie w górę od połówki** (`Math.floor(x + 0.5)`), nie `Math.round` — dla wartości ujemnych dają różne wyniki, a `Math.round(-0.5)` to `-0`.

---

### Task 1: Dane świata i derywacja kosztów

**Files:**
- Create: `src/wioska/swiaty.js`
- Create: `src/wioska/swiat.js`
- Create: `tools/fetch-swiat.js`
- Test: `test/wioska-swiat.test.js`

**Interfaces:**
- Consumes: nic
- Produces:
  - `SWIATY` — obiekt `{ [kod]: DaneSwiata }`
  - `swiat(kod)` → `DaneSwiata`, rzuca `Error` dla nieznanego kodu
  - `DaneSwiata` = `{ kod, nazwa, predkosc, predkoscJednostek, produkcjaBazowa, wzorCzasu, budynki }`
  - `budynki[nazwa]` = `{ kod, maks, min, drewno, glina, zelazo, pop, fDrewno, fGlina, fZelazo, fPop, czas }`
  - `zaokr(x)` → `number` — zaokrąglenie w górę od połówki
  - `kosztPoziomu(s, budynek, poziom)` → `{ drewno, glina, zelazo }`
  - `ludnoscPoziomu(s, budynek, poziom)` → `number` (skumulowana dla tego budynku, 0 dla poziomu 0)
  - `maksPoziom(s, budynek)` → `number`
  - `budynkiSwiata(s)` → `string[]` (klucze obecne w configu świata)
  - `poziomyStartowe(s)` → `{ [budynek]: number }`

- [ ] **Step 1: Write the failing test**

`test/wioska-swiat.test.js`:

```js
// test/wioska-swiat.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat, SWIATY } from '../src/wioska/swiaty.js';
import {
  zaokr, kosztPoziomu, ludnoscPoziomu, maksPoziom, budynkiSwiata, poziomyStartowe,
} from '../src/wioska/swiat.js';

const s = swiat('pl231');

test('zaokr zaokragla polowke w gore, takze dla wartosci ujemnych', () => {
  assert.equal(zaokr(62.5), 63);
  assert.equal(zaokr(62.4), 62);
  assert.equal(zaokr(1229.5), 1230);
});

test('swiat rzuca dla nieznanego kodu zamiast zwracac undefined', () => {
  assert.throws(() => swiat('pl999'), /pl999/);
});

// Wartosci z ekranu Ratusza wioski A004 (swiat 231) — koszty widziane w grze.
test('koszt Ratusza na poziom 15 zgadza sie z gra', () => {
  assert.deepEqual(kosztPoziomu(s, 'ratusz', 15), { drewno: 2288, glina: 2400, zelazo: 1779 });
});

test('koszt Koszar na poziom 9 zgadza sie z gra', () => {
  assert.deepEqual(kosztPoziomu(s, 'koszary', 9), { drewno: 1271, glina: 1225, zelazo: 572 });
});

test('koszt Rynku na poziom 4 zgadza sie z gra', () => {
  assert.deepEqual(kosztPoziomu(s, 'rynek', 4), { drewno: 200, glina: 207, zelazo: 200 });
});

test('koszt Muru na poziom 1 to wartosc bazowa', () => {
  assert.deepEqual(kosztPoziomu(s, 'mur', 1), { drewno: 50, glina: 100, zelazo: 20 });
});

test('koszt Spichlerza na poziom 21 zgadza sie z gra', () => {
  assert.deepEqual(kosztPoziomu(s, 'spichlerz', 21), { drewno: 6606, glina: 5957, zelazo: 3202 });
});

test('ludnosc jest skumulowana, nie przyrostowa', () => {
  assert.equal(ludnoscPoziomu(s, 'ratusz', 1), 5);
  assert.equal(ludnoscPoziomu(s, 'ratusz', 6), 11);
});

test('poziom 0 nie zajmuje ludnosci', () => {
  assert.equal(ludnoscPoziomu(s, 'koszary', 0), 0);
});

test('Zagroda i Spichlerz nie zajmuja ludnosci na zadnym poziomie', () => {
  assert.equal(ludnoscPoziomu(s, 'zagroda', 20), 0);
  assert.equal(ludnoscPoziomu(s, 'spichlerz', 20), 0);
});

test('maksymalne poziomy zgadzaja sie z configem swiata', () => {
  assert.equal(maksPoziom(s, 'ratusz'), 30);
  assert.equal(maksPoziom(s, 'warsztat'), 15);
  assert.equal(maksPoziom(s, 'palac'), 1);
});

test('Kosciol nie istnieje na swiecie 231', () => {
  assert.ok(!budynkiSwiata(s).includes('kosciol'));
});

test('poziomy startowe biora sie z min_level configu', () => {
  const p = poziomyStartowe(s);
  assert.equal(p.ratusz, 1);
  assert.equal(p.zagroda, 1);
  assert.equal(p.spichlerz, 1);
  assert.equal(p.koszary, 0);
});

test('kazdy budynek swiata ma komplet pol', () => {
  for (const b of budynkiSwiata(s)) {
    const d = SWIATY.pl231.budynki[b];
    for (const pole of ['kod', 'maks', 'min', 'drewno', 'glina', 'zelazo', 'pop',
                        'fDrewno', 'fGlina', 'fZelazo', 'fPop', 'czas']) {
      assert.ok(typeof d[pole] === 'number' || typeof d[pole] === 'string', `${b}.${pole}`);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-swiat.test.js`
Expected: FAIL — `Cannot find module '../src/wioska/swiaty.js'`

- [ ] **Step 3: Create the world data module**

`src/wioska/swiaty.js` — wartości pobrane z `https://pl231.plemiona.pl/interface.php?func=get_building_info` i `func=get_config`:

```js
// src/wioska/swiaty.js
// Dane swiatow generowane przez tools/fetch-swiat.js z publicznych endpointow
// interface.php. Nie edytowac recznie — zmiany nadpisze kolejne uruchomienie.
// Tabele kosztow nie sa tu zapisywane: licza sie ze wzoru baza x mnoznik^(poziom-1).

export const SWIATY = {
  pl231: {
    kod: 'pl231',
    nazwa: 'Świat 231',
    predkosc: 1,
    predkoscJednostek: 1,
    produkcjaBazowa: 30,
    wzorCzasu: 2,
    budynki: {
      ratusz:    { kod: 'main',       maks: 30, min: 1, drewno: 90,    glina: 80,    zelazo: 70,    pop: 5,   fDrewno: 1.26,  fGlina: 1.275, fZelazo: 1.26,  fPop: 1.17,  czas: 900 },
      koszary:   { kod: 'barracks',   maks: 25, min: 0, drewno: 200,   glina: 170,   zelazo: 90,    pop: 7,   fDrewno: 1.26,  fGlina: 1.28,  fZelazo: 1.26,  fPop: 1.17,  czas: 1800 },
      stajnia:   { kod: 'stable',     maks: 20, min: 0, drewno: 270,   glina: 240,   zelazo: 260,   pop: 8,   fDrewno: 1.26,  fGlina: 1.28,  fZelazo: 1.26,  fPop: 1.17,  czas: 6000 },
      warsztat:  { kod: 'garage',     maks: 15, min: 0, drewno: 300,   glina: 240,   zelazo: 260,   pop: 8,   fDrewno: 1.26,  fGlina: 1.28,  fZelazo: 1.26,  fPop: 1.17,  czas: 6000 },
      kuznia:    { kod: 'smith',      maks: 20, min: 0, drewno: 220,   glina: 180,   zelazo: 240,   pop: 20,  fDrewno: 1.26,  fGlina: 1.275, fZelazo: 1.26,  fPop: 1.17,  czas: 6000 },
      palac:     { kod: 'snob',       maks: 1,  min: 0, drewno: 15000, glina: 25000, zelazo: 10000, pop: 80,  fDrewno: 2,     fGlina: 2,     fZelazo: 2,     fPop: 1.17,  czas: 586800 },
      plac:      { kod: 'place',      maks: 1,  min: 0, drewno: 10,    glina: 40,    zelazo: 30,    pop: 0,   fDrewno: 1.26,  fGlina: 1.275, fZelazo: 1.26,  fPop: 1.17,  czas: 10860 },
      piedestal: { kod: 'statue',     maks: 1,  min: 0, drewno: 220,   glina: 220,   zelazo: 220,   pop: 10,  fDrewno: 1.26,  fGlina: 1.275, fZelazo: 1.26,  fPop: 1.17,  czas: 1500 },
      rynek:     { kod: 'market',     maks: 25, min: 0, drewno: 100,   glina: 100,   zelazo: 100,   pop: 20,  fDrewno: 1.26,  fGlina: 1.275, fZelazo: 1.26,  fPop: 1.17,  czas: 2700 },
      tartak:    { kod: 'wood',       maks: 30, min: 0, drewno: 50,    glina: 60,    zelazo: 40,    pop: 5,   fDrewno: 1.25,  fGlina: 1.275, fZelazo: 1.245, fPop: 1.155, czas: 900 },
      cegielnia: { kod: 'stone',      maks: 30, min: 0, drewno: 65,    glina: 50,    zelazo: 40,    pop: 10,  fDrewno: 1.27,  fGlina: 1.265, fZelazo: 1.24,  fPop: 1.14,  czas: 900 },
      huta:      { kod: 'iron',       maks: 30, min: 0, drewno: 75,    glina: 65,    zelazo: 70,    pop: 10,  fDrewno: 1.252, fGlina: 1.275, fZelazo: 1.24,  fPop: 1.17,  czas: 1080 },
      zagroda:   { kod: 'farm',       maks: 30, min: 1, drewno: 45,    glina: 40,    zelazo: 30,    pop: 0,   fDrewno: 1.3,   fGlina: 1.32,  fZelazo: 1.29,  fPop: 1,     czas: 1200 },
      spichlerz: { kod: 'storage',    maks: 30, min: 1, drewno: 60,    glina: 50,    zelazo: 40,    pop: 0,   fDrewno: 1.265, fGlina: 1.27,  fZelazo: 1.245, fPop: 1.15,  czas: 1020 },
      schowek:   { kod: 'hide',       maks: 10, min: 0, drewno: 50,    glina: 60,    zelazo: 50,    pop: 2,   fDrewno: 1.25,  fGlina: 1.25,  fZelazo: 1.25,  fPop: 1.17,  czas: 1800 },
      mur:       { kod: 'wall',       maks: 20, min: 0, drewno: 50,    glina: 100,   zelazo: 20,    pop: 5,   fDrewno: 1.26,  fGlina: 1.275, fZelazo: 1.26,  fPop: 1.17,  czas: 3600 },
      wieza:     { kod: 'watchtower', maks: 20, min: 0, drewno: 12000, glina: 14000, zelazo: 10000, pop: 500, fDrewno: 1.17,  fGlina: 1.17,  fZelazo: 1.18,  fPop: 1.18,  czas: 13200 },
    },
  },
};

export function swiat(kod) {
  const s = SWIATY[kod];
  if (!s) throw new Error(`Nieznany świat: ${kod}. Dostępne: ${Object.keys(SWIATY).join(', ')}`);
  return s;
}
```

- [ ] **Step 4: Write the derivation module**

`src/wioska/swiat.js`:

```js
// src/wioska/swiat.js
// Wyprowadzenie kosztow i ludnosci z danych swiata. Gra liczy je ze wzoru,
// wiec my tez — dzieki temu dowolny swiat dziala bez wklejania tabel.

// Math.round(-0.5) daje -0, a gra zaokragla polowke zawsze w gore.
export function zaokr(x) {
  return Math.floor(x + 0.5);
}

function danegoBudynku(s, budynek) {
  const d = s.budynki[budynek];
  if (!d) throw new Error(`Budynek ${budynek} nie istnieje na świecie ${s.kod}`);
  return d;
}

export function kosztPoziomu(s, budynek, poziom) {
  const d = danegoBudynku(s, budynek);
  return {
    drewno: zaokr(d.drewno * d.fDrewno ** (poziom - 1)),
    glina: zaokr(d.glina * d.fGlina ** (poziom - 1)),
    zelazo: zaokr(d.zelazo * d.fZelazo ** (poziom - 1)),
  };
}

// Wartosc w tabeli gry jest skumulowana: to laczna ludnosc budynku na tym
// poziomie, a nie przyrost wzgledem poprzedniego.
export function ludnoscPoziomu(s, budynek, poziom) {
  const d = danegoBudynku(s, budynek);
  if (poziom <= 0 || d.pop === 0) return 0;
  return zaokr(d.pop * d.fPop ** (poziom - 1));
}

export function maksPoziom(s, budynek) {
  return danegoBudynku(s, budynek).maks;
}

// Budynek nieobecny w configu swiata jest na nim wylaczony (np. Kosciol na 231).
export function budynkiSwiata(s) {
  return Object.keys(s.budynki);
}

export function poziomyStartowe(s) {
  const p = {};
  for (const b of budynkiSwiata(s)) p[b] = s.budynki[b].min;
  return p;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/wioska-swiat.test.js`
Expected: PASS, 13 testów

- [ ] **Step 6: Write the world fetcher**

`tools/fetch-swiat.js`:

```js
// tools/fetch-swiat.js
// Generuje wpis w src/wioska/swiaty.js dla wskazanego swiata.
// Uzycie: node tools/fetch-swiat.js pl231
// Endpointy interface.php sa publiczne — nie wymagaja logowania.

const MAPA = {
  main: 'ratusz', barracks: 'koszary', stable: 'stajnia', garage: 'warsztat',
  smith: 'kuznia', snob: 'palac', place: 'plac', statue: 'piedestal',
  market: 'rynek', wood: 'tartak', stone: 'cegielnia', iron: 'huta',
  farm: 'zagroda', storage: 'spichlerz', hide: 'schowek', wall: 'mur',
  watchtower: 'wieza', church: 'kosciol', church_f: 'pierwszy_kosciol',
};

// Prosty odczyt XML — endpointy zwracaja plaskie drzewo dwoch poziomow,
// wiec nie ma po co ciagnac parsera.
function pole(xml, nazwa) {
  const m = xml.match(new RegExp(`<${nazwa}>([^<]*)</${nazwa}>`));
  return m ? m[1] : null;
}

function sekcje(xml) {
  const out = {};
  for (const m of xml.matchAll(/<(\w+)>\s*(<(?:max_level|min_level)[\s\S]*?)<\/\1>/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

async function pobierz(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.text();
}

const kod = process.argv[2];
if (!kod) {
  console.error('Użycie: node tools/fetch-swiat.js pl231');
  process.exit(1);
}

const baza = `https://${kod}.plemiona.pl/interface.php`;
const config = await pobierz(`${baza}?func=get_config`);
const budynkiXml = await pobierz(`${baza}?func=get_building_info`);

const budynki = {};
for (const [kodEn, xml] of Object.entries(sekcje(budynkiXml))) {
  const nazwa = MAPA[kodEn];
  if (!nazwa) { console.error(`Pomijam nieznany budynek: ${kodEn}`); continue; }
  budynki[nazwa] = {
    kod: kodEn,
    maks: Number(pole(xml, 'max_level')),
    min: Number(pole(xml, 'min_level')),
    drewno: Number(pole(xml, 'wood')),
    glina: Number(pole(xml, 'stone')),
    zelazo: Number(pole(xml, 'iron')),
    pop: Number(pole(xml, 'pop')),
    fDrewno: Number(pole(xml, 'wood_factor')),
    fGlina: Number(pole(xml, 'stone_factor')),
    fZelazo: Number(pole(xml, 'iron_factor')),
    fPop: Number(pole(xml, 'pop_factor')),
    czas: Number(pole(xml, 'build_time')),
  };
}

const wpis = {
  kod,
  nazwa: `Świat ${kod.replace(/\D/g, '')}`,
  predkosc: Number(pole(config, 'speed')),
  predkoscJednostek: Number(pole(config, 'unit_speed')),
  produkcjaBazowa: Number(pole(config, 'base_production')),
  wzorCzasu: Number(pole(config, 'buildtime_formula')),
  budynki,
};

console.log(`  ${kod}: ${JSON.stringify(wpis, null, 2).replace(/\n/g, '\n  ')},`);
console.error(`\nWklej powyższy blok do SWIATY w src/wioska/swiaty.js (${Object.keys(budynki).length} budynków).`);
```

- [ ] **Step 7: Commit**

```bash
git add src/wioska/swiaty.js src/wioska/swiat.js tools/fetch-swiat.js test/wioska-swiat.test.js
git commit -m "feat: dane swiata i derywacja kosztow budynkow"
```

---

### Task 2: Tabele uniwersalne

**Files:**
- Create: `src/wioska/tabele.js`
- Test: `test/wioska-tabele.test.js`

**Interfaces:**
- Consumes: `DaneSwiata` z Taska 1 (pole `produkcjaBazowa`)
- Produces:
  - `pojemnosc(poziom)` → `number` (poziom 1–30)
  - `maksLudnosc(poziom)` → `number` (poziom 1–30)
  - `produkcjaGodzinowa(s, poziom)` → `number` (poziom 0 → 0)
  - `schowane(poziom)` → `number`
  - `kupcy(poziom)` → `number`

**Kontekst:** te wielkości są identyczne na wszystkich światach — sprawdzone
względem `_share/budynki.xlsx`. Produkcja skaluje się liniowo z
`produkcjaBazowa` świata (kolumna x2 w arkuszu to dokładnie dwukrotność
kolumny x1). Trzymamy je jako tabele, a nie wzory, bo dopasowane wzory mylą
się o jednostkę na kilkunastu poziomach.

- [ ] **Step 1: Write the failing test**

`test/wioska-tabele.test.js`:

```js
// test/wioska-tabele.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { pojemnosc, maksLudnosc, produkcjaGodzinowa, schowane, kupcy } from '../src/wioska/tabele.js';

const s = swiat('pl231');

test('pojemnosc spichlerza na skrajach', () => {
  assert.equal(pojemnosc(1), 1000);
  assert.equal(pojemnosc(20), 50675);
  assert.equal(pojemnosc(30), 400000);
});

test('maksymalna ludnosc zagrody na skrajach', () => {
  assert.equal(maksLudnosc(1), 240);
  assert.equal(maksLudnosc(30), 24000);
});

test('produkcja na swiecie o predkosci 1 zaczyna sie od produkcjaBazowa', () => {
  assert.equal(produkcjaGodzinowa(s, 1), 30);
  assert.equal(produkcjaGodzinowa(s, 30), 2400);
});

test('poziom 0 kopalni nie produkuje nic', () => {
  assert.equal(produkcjaGodzinowa(s, 0), 0);
});

test('produkcja skaluje sie z produkcjaBazowa swiata', () => {
  const szybki = { ...s, produkcjaBazowa: 60 };
  assert.equal(produkcjaGodzinowa(szybki, 1), 60);
  assert.equal(produkcjaGodzinowa(szybki, 30), 4800);
});

test('schowek i kupcy', () => {
  assert.equal(schowane(1), 150);
  assert.equal(schowane(10), 2000);
  assert.equal(kupcy(1), 1);
  assert.equal(kupcy(25), 235);
});

test('poziom spoza zakresu rzuca zamiast zwracac undefined', () => {
  assert.throws(() => pojemnosc(31), /poziom/i);
  assert.throws(() => maksLudnosc(0), /poziom/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-tabele.test.js`
Expected: FAIL — `Cannot find module '../src/wioska/tabele.js'`

- [ ] **Step 3: Write the implementation**

`src/wioska/tabele.js`:

```js
// src/wioska/tabele.js
// Tabele niezalezne od swiata, przepisane z _share/budynki.xlsx i zweryfikowane
// wzgledem gry. Trzymamy tabele zamiast wzorow, bo najlepsze dopasowane wzory
// myla sie o jednostke na kilkunastu poziomach.

export const POJEMNOSC_SPICHLERZA = [
  1000, 1229, 1512, 1859, 2285, 2810, 3454, 4247, 5222, 6420,
  7893, 9705, 11932, 14670, 18037, 22177, 27266, 33523, 41217, 50675,
  62305, 76604, 94184, 115798, 142373, 175047, 215219, 264611, 325337, 400000,
];

export const MAKS_LUDNOSC_ZAGRODY = [
  240, 281, 329, 386, 452, 530, 622, 729, 854, 1002,
  1174, 1376, 1613, 1891, 2216, 2598, 3045, 3569, 4183, 4904,
  5748, 6737, 7896, 9255, 10848, 12715, 14904, 17469, 20476, 24000,
];

// Wartosci dla swiata o produkcjaBazowa = 30. Inne swiaty skaluja sie liniowo.
export const PRODUKCJA_H_BAZA30 = [
  30, 35, 41, 47, 55, 64, 74, 86, 100, 117,
  136, 158, 184, 214, 249, 289, 337, 391, 455, 530,
  616, 717, 833, 969, 1127, 1311, 1525, 1774, 2063, 2400,
];

export const SCHOWANE_SUROWCE = [150, 200, 267, 356, 474, 632, 843, 1125, 1500, 2000];

// Jedyna tabela bez wzoru: do 11 rosnie o jeden, potem skacze.
export const KUPCY = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 14, 19, 26, 35, 46, 59, 74, 91, 110,
  131, 154, 179, 206, 235,
];

function zTabeli(tabela, poziom, nazwa) {
  const v = tabela[poziom - 1];
  if (v === undefined) throw new Error(`${nazwa}: poziom ${poziom} poza zakresem 1–${tabela.length}`);
  return v;
}

export function pojemnosc(poziom) {
  return zTabeli(POJEMNOSC_SPICHLERZA, poziom, 'Spichlerz');
}

export function maksLudnosc(poziom) {
  return zTabeli(MAKS_LUDNOSC_ZAGRODY, poziom, 'Zagroda');
}

export function schowane(poziom) {
  return zTabeli(SCHOWANE_SUROWCE, poziom, 'Schowek');
}

export function kupcy(poziom) {
  return zTabeli(KUPCY, poziom, 'Rynek');
}

// Kopalnia na poziomie 0 nie produkuje nic. Zalozenie: nie udalo sie tego
// potwierdzic obserwacyjnie, ale bledna wartosc rzedu kilku jednostek na
// godzine zmienia wynik kilkudniowego planu o promile.
export function produkcjaGodzinowa(s, poziom) {
  if (poziom <= 0) return 0;
  return Math.floor(zTabeli(PRODUKCJA_H_BAZA30, poziom, 'Kopalnia') * s.produkcjaBazowa / 30 + 0.5);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/wioska-tabele.test.js`
Expected: PASS, 7 testów

- [ ] **Step 5: Commit**

```bash
git add src/wioska/tabele.js test/wioska-tabele.test.js
git commit -m "feat: tabele uniwersalne — produkcja, spichlerz, zagroda, schowek, kupcy"
```

---

### Task 3: Czas budowy

**Files:**
- Create: `src/wioska/czas-dane.js`
- Create: `src/wioska/czas.js`
- Test: `test/wioska-czas.test.js`

**Interfaces:**
- Consumes: `DaneSwiata` (pola `budynki[b].czas`, `predkosc`)
- Produces:
  - `TABELA_G` — `{ [poziom]: { g: number, zmierzony: boolean } }` dla poziomów 1–30
  - `MINIMALNY_CZAS_S = 10`, `MUR_STALY_CZAS_S = 240`
  - `czasBudowy(s, budynek, poziom, poziomRatusza)` → `{ sekundy: number, pewny: boolean }`

**Kontekst — skąd się wziął wzór:**

```
czas = maks(10 s, build_time_budynku × G(poziom) × 1,05^(−poziom_ratusza) ÷ prędkość_świata)
```

`G` nie zależy od budynku: na poziomie 4 dziewięć różnych budynków z dwóch
wiosek zgadza się w 0,11%. Człon Ratusza potwierdzony dwoma niezależnymi
drogami — tabelą z gry i porównaniem wiosek o Ratuszu 3 i 14 (zgodność 0,03%).
`pewny: false` oznacza poziom, którego nikt nie zmierzył i którego `G` pochodzi
z interpolacji.

Mur na poziomach 1 i 2 jest jedynym znanym wyjątkiem: pokazuje równe `4:00`
w obu wioskach, mimo różnych poziomów Ratusza — czyli nie skaluje się wcale.

- [ ] **Step 1: Write the failing test**

`test/wioska-czas.test.js`:

```js
// test/wioska-czas.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { czasBudowy } from '../src/wioska/czas.js';
import { TABELA_G } from '../src/wioska/czas-dane.js';

const s = swiat('pl231');
// Gra pokazuje czasy w pelnych sekundach, wiec porownujemy z tolerancja 1 s.
const blisko = (a, b, opis) => assert.ok(Math.abs(a - b) <= 1, `${opis}: ${a} vs ${b}`);

test('tabela G pokrywa poziomy 1-30 i rosnie', () => {
  for (let l = 1; l <= 30; l++) assert.ok(TABELA_G[l], `brak poziomu ${l}`);
  for (let l = 2; l <= 30; l++) {
    assert.ok(TABELA_G[l].g >= TABELA_G[l - 1].g, `G maleje na poziomie ${l}`);
  }
});

// Wioska A004, Ratusz 14. Spichlerz mial poziom 20 w kolejce, wiec ekran
// pokazywal poziom 21 — to jest juz uwzglednione w oczekiwanych wartosciach.
test('czasy z ekranu Ratusza wioski A004 (Ratusz 14)', () => {
  blisko(czasBudowy(s, 'ratusz', 15, 14).sekundy, 6404, 'Ratusz 15');
  blisko(czasBudowy(s, 'koszary', 9, 14).sekundy, 3479, 'Koszary 9');
  blisko(czasBudowy(s, 'kuznia', 7, 14).sekundy, 6542, 'Kuźnia 7');
  blisko(czasBudowy(s, 'tartak', 12, 14).sekundy, 3482, 'Tartak 12');
  blisko(czasBudowy(s, 'cegielnia', 10, 14).sekundy, 2224, 'Cegielnia 10');
  blisko(czasBudowy(s, 'huta', 11, 14).sekundy, 3359, 'Huta 11');
  blisko(czasBudowy(s, 'zagroda', 14, 14).sekundy, 7010, 'Zagroda 14');
  blisko(czasBudowy(s, 'spichlerz', 21, 14).sekundy, 22183, 'Spichlerz 21');
  blisko(czasBudowy(s, 'stajnia', 3, 14).sekundy, 489, 'Stajnia 3');
  blisko(czasBudowy(s, 'rynek', 4, 14).sekundy, 682, 'Rynek 4');
  blisko(czasBudowy(s, 'schowek', 4, 14).sekundy, 455, 'Schowek 4');
  blisko(czasBudowy(s, 'wieza', 1, 14).sekundy, 50, 'Wieża 1');
});

// Zagroda 11, 12 i 13 stala w kolejce budowy — to sa czasy pelnych rozbudow.
test('czasy z kolejki budowy wioski A004', () => {
  blisko(czasBudowy(s, 'zagroda', 11, 14).sekundy, 3732, 'Zagroda 11');
  blisko(czasBudowy(s, 'zagroda', 12, 14).sekundy, 4642, 'Zagroda 12');
  blisko(czasBudowy(s, 'zagroda', 13, 14).sekundy, 5724, 'Zagroda 13');
});

// Druga wioska, Ratusz 3 — pilnuje, zeby czlon Ratusza nie wsiakl w tabele G.
test('czasy z ekranu Ratusza wioski yozeek (Ratusz 3)', () => {
  blisko(czasBudowy(s, 'ratusz', 4, 3).sekundy, 389, 'Ratusz 4');
  blisko(czasBudowy(s, 'koszary', 4, 3).sekundy, 778, 'Koszary 4');
  blisko(czasBudowy(s, 'rynek', 3, 3).sekundy, 377, 'Rynek 3');
  blisko(czasBudowy(s, 'tartak', 4, 3).sekundy, 389, 'Tartak 4');
  blisko(czasBudowy(s, 'cegielnia', 4, 3).sekundy, 389, 'Cegielnia 4');
  blisko(czasBudowy(s, 'huta', 4, 3).sekundy, 467, 'Huta 4');
  blisko(czasBudowy(s, 'zagroda', 4, 3).sekundy, 519, 'Zagroda 4');
  blisko(czasBudowy(s, 'spichlerz', 4, 3).sekundy, 441, 'Spichlerz 4');
  blisko(czasBudowy(s, 'schowek', 3, 3).sekundy, 251, 'Schowek 3');
  blisko(czasBudowy(s, 'mur', 3, 3).sekundy, 502, 'Mur 3');
});

test('minimum dziesieciu sekund obowiazuje na najnizszych poziomach', () => {
  assert.equal(czasBudowy(s, 'tartak', 1, 1).sekundy, 10);
  assert.equal(czasBudowy(s, 'ratusz', 2, 1).sekundy, 10);
  assert.equal(czasBudowy(s, 'zagroda', 2, 1).sekundy, 10);
});

test('budynki powyzej minimum pokazuja wartosc dokladna, nie dziesiec', () => {
  blisko(czasBudowy(s, 'schowek', 2, 1).sekundy, 13, 'Schowek 2');
  blisko(czasBudowy(s, 'piedestal', 1, 1).sekundy, 11, 'Piedestał 1');
});

test('Mur na poziomach 1 i 2 trwa rowne cztery minuty niezaleznie od Ratusza', () => {
  assert.equal(czasBudowy(s, 'mur', 1, 14).sekundy, 240);
  assert.equal(czasBudowy(s, 'mur', 2, 3).sekundy, 240);
  assert.equal(czasBudowy(s, 'mur', 1, 1).sekundy, 240);
});

test('poziomy bez pomiaru sa oznaczone jako niepewne', () => {
  assert.equal(czasBudowy(s, 'tartak', 10, 14).pewny, true);
  assert.equal(czasBudowy(s, 'tartak', 5, 14).pewny, false);
  assert.equal(czasBudowy(s, 'tartak', 18, 14).pewny, false);
});

test('predkosc swiata skraca czas budowy', () => {
  const szybki = { ...s, predkosc: 2 };
  const wolny = czasBudowy(s, 'ratusz', 15, 14).sekundy;
  blisko(czasBudowy(szybki, 'ratusz', 15, 14).sekundy, wolny / 2, 'świat x2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-czas.test.js`
Expected: FAIL — `Cannot find module '../src/wioska/czas-dane.js'`

- [ ] **Step 3: Write the measurement table**

`src/wioska/czas-dane.js`:

```js
// src/wioska/czas-dane.js
// Tabela G — czysta funkcja poziomu, wspolna dla wszystkich budynkow.
// Generowana przez tools/kalibracja.js z zapisanych stron Ratusza.
//
// zmierzony: true  — wartosc odczytana z gry
// zmierzony: false — interpolacja miedzy pomiarami (poziomy 5, 6, 8, 16-20)
//                    albo ekstrapolacja wspolczynnikiem 1,20467 (poziomy 22-30)

export const TABELA_G = {
  1: { g: 0.00772, zmierzony: true },
  // Poziomy 1 i 2 sa nierozroznialne: gra pokazuje czasy w pelnych sekundach,
  // a jedyna obserwacja poziomu 2 (Schowek 13 s przy Ratuszu 1) daje przedzial
  // 0,00729-0,00788, w ktorym miesci sie G(1). Bierzemy wartosc rowna G(1),
  // bo czas budowy nie moze malec z poziomem, a 0,00772 nadal odtwarza te 13 s.
  2: { g: 0.00772, zmierzony: true },
  3: { g: 0.16146, zmierzony: true },
  4: { g: 0.50042, zmierzony: true },
  5: { g: 1.05552, zmierzony: false },
  6: { g: 1.61879, zmierzony: false },
  7: { g: 2.15879, zmierzony: true },
  8: { g: 2.88378, zmierzony: false },
  9: { g: 3.82677, zmierzony: true },
  10: { g: 4.89263, zmierzony: true },
  11: { g: 6.15777, zmierzony: true },
  12: { g: 7.65959, zmierzony: true },
  13: { g: 9.44427, zmierzony: true },
  14: { g: 11.5661, zmierzony: true },
  15: { g: 14.08831, zmierzony: true },
  16: { g: 17.08524, zmierzony: false },
  17: { g: 20.64453, zmierzony: false },
  18: { g: 24.87289, zmierzony: false },
  19: { g: 29.90201, zmierzony: false },
  20: { g: 35.89576, zmierzony: false },
  21: { g: 43.05963, zmierzony: true },
  22: { g: 51.8727, zmierzony: false },
  23: { g: 62.48955, zmierzony: false },
  24: { g: 75.27937, zmierzony: false },
  25: { g: 90.6869, zmierzony: false },
  26: { g: 109.24791, zmierzony: false },
  27: { g: 131.60782, zmierzony: false },
  28: { g: 158.54416, zmierzony: false },
  29: { g: 190.9936, zmierzony: false },
  30: { g: 230.08451, zmierzony: false },
};

export const MINIMALNY_CZAS_S = 10;

// Mur na poziomach 1 i 2 pokazuje rowne 4:00 w wioskach o Ratuszu 3 i 14,
// czyli nie skaluje sie wcale. Mechanika nieznana — wartosc obserwowana.
export const MUR_STALY_CZAS_S = 240;
export const MUR_STALY_DO_POZIOMU = 2;
```

- [ ] **Step 4: Write the time module**

`src/wioska/czas.js`:

```js
// src/wioska/czas.js
// czas = maks(10 s, build_time x G(poziom) x 1,05^(-ratusz) / predkosc swiata)

import { TABELA_G, MINIMALNY_CZAS_S, MUR_STALY_CZAS_S, MUR_STALY_DO_POZIOMU } from './czas-dane.js';

export function wspolczynnikG(poziom) {
  const w = TABELA_G[poziom];
  if (!w) throw new Error(`Brak współczynnika czasu dla poziomu ${poziom}`);
  return w;
}

export function czasBudowy(s, budynek, poziom, poziomRatusza) {
  if (budynek === 'mur' && poziom <= MUR_STALY_DO_POZIOMU) {
    return { sekundy: MUR_STALY_CZAS_S, pewny: true };
  }
  const d = s.budynki[budynek];
  if (!d) throw new Error(`Budynek ${budynek} nie istnieje na świecie ${s.kod}`);
  const { g, zmierzony } = wspolczynnikG(poziom);
  const surowy = d.czas * g * 1.05 ** -poziomRatusza / s.predkosc;
  return { sekundy: Math.max(MINIMALNY_CZAS_S, Math.round(surowy)), pewny: zmierzony };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/wioska-czas.test.js`
Expected: PASS, 9 testów. Jeśli któryś z czasów z gry nie mieści się w tolerancji jednej sekundy, **nie luzuj tolerancji** — to znaczy, że wzór albo tabela są złe.

- [ ] **Step 6: Commit**

```bash
git add src/wioska/czas-dane.js src/wioska/czas.js test/wioska-czas.test.js
git commit -m "feat: czas budowy odtworzony z dwoch wiosek, tabela G z oznaczeniem pewnosci"
```

---

### Task 4: Narzędzie kalibracji

**Files:**
- Create: `tools/kalibracja.js`
- Create: `src/wioska/odczyt-ratusza.js`
- Test: `test/wioska-odczyt-ratusza.test.js`

**Interfaces:**
- Consumes: `swiat(kod)`, `wspolczynnikG(poziom)`
- Produces:
  - `poziomRatuszaZeStrony(html)` → `number`
  - `kolejkaZeStrony(html)` → `[{ budynek, poziom }]`
  - `pomiaryZeStrony(html)` → `[{ budynek, poziom, sekundy, poziomRatusza }]`

**Kontekst — dlaczego to nietrywialne:** ekran Ratusza pokazuje koszt i czas
dla poziomu **po** kolejce budowy. W wiosce A004 Spichlerz stał w kolejce na
poziom 20, więc jego wiersz dotyczył poziomu 21, a Zagroda kolejkowana na
11, 12 i 13 pokazywała poziom 14. Bez tej poprawki pomiary wyglądają na
wewnętrznie sprzeczne i wzoru nie da się odtworzyć.

- [ ] **Step 1: Write the failing test**

`test/wioska-odczyt-ratusza.test.js`:

```js
// test/wioska-odczyt-ratusza.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { poziomRatuszaZeStrony, kolejkaZeStrony, pomiaryZeStrony } from '../src/wioska/odczyt-ratusza.js';

// Wycinki prawdziwych ekranow Ratusza — tylko naglowek, kolejka budowy
// i tabela budynkow. Reszta strony nie ma tu znaczenia.
const wczytaj = (nazwa) => readFileSync(new URL(`./fixtures/${nazwa}.html`, import.meta.url), 'utf8');

const a004 = wczytaj('ratusz-a004');
const yozeek = wczytaj('ratusz-yozeek');

test('odczytuje poziom Ratusza z naglowka strony', () => {
  assert.equal(poziomRatuszaZeStrony(a004), 14);
  assert.equal(poziomRatuszaZeStrony(yozeek), 3);
});

test('odczytuje kolejke budowy', () => {
  assert.deepEqual(kolejkaZeStrony(a004), [
    { budynek: 'spichlerz', poziom: 20 },
    { budynek: 'zagroda', poziom: 11 },
    { budynek: 'zagroda', poziom: 12 },
    { budynek: 'zagroda', poziom: 13 },
  ]);
});

test('pusta kolejka daje pusta liste, nie wyjatek', () => {
  assert.deepEqual(kolejkaZeStrony(yozeek), []);
});

// To jest sedno narzedzia: Spichlerz stoi na 19 i ma 20 w kolejce,
// wiec wiersz w tabeli dotyczy poziomu 21, a nie 20.
test('poziom docelowy uwzglednia kolejke budowy', () => {
  const p = pomiaryZeStrony(a004);
  const spichlerz = p.find(x => x.budynek === 'spichlerz');
  assert.equal(spichlerz.poziom, 21);
  assert.equal(spichlerz.sekundy, 22183);
  const zagroda = p.find(x => x.budynek === 'zagroda');
  assert.equal(zagroda.poziom, 14);
});

test('budynek bez kolejki ma poziom o jeden wyzszy od obecnego', () => {
  const p = pomiaryZeStrony(a004);
  assert.equal(p.find(x => x.budynek === 'ratusz').poziom, 15);
  assert.equal(p.find(x => x.budynek === 'ratusz').sekundy, 6404);
});

test('budynek nieistniejacy startuje z poziomu 1', () => {
  const p = pomiaryZeStrony(a004);
  assert.equal(p.find(x => x.budynek === 'mur').poziom, 1);
});

test('kazdy pomiar niesie poziom Ratusza swojej wioski', () => {
  assert.ok(pomiaryZeStrony(a004).every(x => x.poziomRatusza === 14));
  assert.ok(pomiaryZeStrony(yozeek).every(x => x.poziomRatusza === 3));
});

test('budynki calkowicie rozbudowane nie daja pomiaru', () => {
  const p = pomiaryZeStrony(a004);
  assert.ok(!p.some(x => x.budynek === 'plac'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-odczyt-ratusza.test.js`
Expected: FAIL — `Cannot find module '../src/wioska/odczyt-ratusza.js'`

- [ ] **Step 3: Write the reader**

`src/wioska/odczyt-ratusza.js`:

```js
// src/wioska/odczyt-ratusza.js
// Odczyt zapisanej strony Ratusza. Sluzy wylacznie kalibracji tabeli G
// i testom — strona symulatora go nie uzywa.

const KODY = {
  main: 'ratusz', barracks: 'koszary', stable: 'stajnia', garage: 'warsztat',
  smith: 'kuznia', snob: 'palac', place: 'plac', statue: 'piedestal',
  market: 'rynek', wood: 'tartak', stone: 'cegielnia', iron: 'huta',
  farm: 'zagroda', storage: 'spichlerz', hide: 'schowek', wall: 'mur',
  watchtower: 'wieza',
};

function sekundy(tekst) {
  const cz = tekst.split(':').map(Number);
  return cz[0] * 3600 + cz[1] * 60 + cz[2];
}

export function poziomRatuszaZeStrony(html) {
  const m = html.match(/Ratusz \(Poziom (\d+)\)/);
  if (!m) throw new Error('Nie znaleziono poziomu Ratusza — czy to na pewno ekran Ratusza?');
  return Number(m[1]);
}

export function kolejkaZeStrony(html) {
  const tabela = html.match(/<table id="build_queue"[\s\S]*?<\/table>/);
  if (!tabela) return [];
  const out = [];
  for (const m of tabela[0].matchAll(/<tr class="[^"]*buildorder_(\w+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const budynek = KODY[m[1]];
    const poziom = m[2].match(/Poziom (\d+)/);
    if (budynek && poziom) out.push({ budynek, poziom: Number(poziom[1]) });
  }
  return out;
}

export function pomiaryZeStrony(html) {
  const poziomRatusza = poziomRatuszaZeStrony(html);
  // Kolejka podnosi poziom docelowy: budynek z dwoma wpisami w kolejce
  // pokazuje w tabeli koszt i czas o dwa poziomy wyzej niz stan obecny.
  const wKolejce = {};
  for (const { budynek } of kolejkaZeStrony(html)) {
    wKolejce[budynek] = (wKolejce[budynek] ?? 0) + 1;
  }
  const tabela = html.match(/<table[^>]*id="buildings"[^>]*>([\s\S]*?)<\/table>/);
  if (!tabela) throw new Error('Nie znaleziono tabeli budynków');
  const out = [];
  for (const m of tabela[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const wiersz = m[1];
    const kod = wiersz.match(/data-building="(\w+)"/);
    const czas = wiersz.match(/icon header time"><\/span>([\d:]+)/);
    if (!kod || !czas) continue;              // naglowek albo budynek w pelni rozbudowany
    const budynek = KODY[kod[1]];
    if (!budynek) continue;
    const obecny = wiersz.match(/Poziom (\d+)/);
    const poziomObecny = obecny ? Number(obecny[1]) : 0;
    out.push({
      budynek,
      poziom: poziomObecny + (wKolejce[budynek] ?? 0) + 1,
      sekundy: sekundy(czas[1]),
      poziomRatusza,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/wioska-odczyt-ratusza.test.js`
Expected: PASS, 8 testów

- [ ] **Step 5: Write the calibration tool**

`tools/kalibracja.js`:

```js
// tools/kalibracja.js
// Wyliczenie tabeli G z zapisanych stron Ratusza.
// Uzycie: node tools/kalibracja.js "_share/A004*.html" "_share/Wioska yozeek*.html"
//
// G(poziom) = czas / (build_time budynku x 1,05^(-poziom ratusza))
// Wartosc nie zalezy od budynku, wiec rozrzut w kolumnie "rozrzut" jest
// miara zaufania: powyzej 1% cos jest nie tak z odczytem.

import { readFileSync } from 'node:fs';
import { swiat } from '../src/wioska/swiaty.js';
import { pomiaryZeStrony } from '../src/wioska/odczyt-ratusza.js';
import { MUR_STALY_DO_POZIOMU } from '../src/wioska/czas-dane.js';

const pliki = process.argv.slice(2);
if (!pliki.length) {
  console.error('Użycie: node tools/kalibracja.js <plik.html> [plik2.html ...]');
  process.exit(1);
}

const s = swiat('pl231');
const wg = new Map();

for (const plik of pliki) {
  for (const p of pomiaryZeStrony(readFileSync(plik, 'utf8'))) {
    // Mur na najnizszych poziomach ma staly czas — zepsulby srednia.
    if (p.budynek === 'mur' && p.poziom <= MUR_STALY_DO_POZIOMU) continue;
    const baza = s.budynki[p.budynek]?.czas;
    if (!baza) continue;
    const g = p.sekundy / (baza * 1.05 ** -p.poziomRatusza);
    if (!wg.has(p.poziom)) wg.set(p.poziom, []);
    wg.get(p.poziom).push({ g, budynek: p.budynek, ratusz: p.poziomRatusza });
  }
}

console.log('poziom |         G | n | rozrzut | budynki');
for (const poziom of [...wg.keys()].sort((a, b) => a - b)) {
  const w = wg.get(poziom);
  const gs = w.map(x => x.g);
  const sr = gs.reduce((a, b) => a + b, 0) / gs.length;
  const rozrzut = gs.length > 1 ? (Math.max(...gs) - Math.min(...gs)) / sr * 100 : 0;
  const zrodla = w.map(x => `${x.budynek}/R${x.ratusz}`).join(' ');
  console.log(`${String(poziom).padStart(6)} | ${sr.toFixed(5).padStart(9)} | ${String(gs.length).padStart(1)} | ${rozrzut.toFixed(2).padStart(6)}% | ${zrodla}`);
}
console.log('\nWartości z n≥2 i rozrzutem poniżej 1% wpisz do TABELA_G jako zmierzony: true.');
```

- [ ] **Step 6: Run the tool and confirm it reproduces the table**

Run: `node tools/kalibracja.js test/fixtures/ratusz-a004.html test/fixtures/ratusz-yozeek.html`
Expected: poziom 4 z `n = 9` i rozrzutem poniżej `0,20%`, wartość `0,500` — zgodna z `TABELA_G[4].g`.

- [ ] **Step 7: Commit**

```bash
git add src/wioska/odczyt-ratusza.js tools/kalibracja.js test/wioska-odczyt-ratusza.test.js
git commit -m "feat: kalibracja tabeli G z zapisanych stron Ratusza"
```

---

### Task 5: Wymagania między budynkami

**Files:**
- Create: `src/wioska/wymagania-dane.js`
- Create: `src/wioska/wymagania.js`
- Test: `test/wioska-wymagania.test.js`

**Interfaces:**
- Consumes: nic
- Produces:
  - `WYMAGANIA` — `{ [budynek]: { [wymagany]: poziom } }`
  - `brakujaceWymagania(budynek, poziomy)` → `[{ budynek, poziom }]` (pusta lista = można budować)
  - `opisWymagan(brakujace, nazwy)` → `string` — do wyświetlenia w interfejsie

- [ ] **Step 1: Write the failing test**

`test/wioska-wymagania.test.js`:

```js
// test/wioska-wymagania.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brakujaceWymagania, opisWymagan } from '../src/wioska/wymagania.js';
import { WYMAGANIA } from '../src/wioska/wymagania-dane.js';

test('budynek bez wymagan mozna budowac od zera', () => {
  assert.deepEqual(brakujaceWymagania('tartak', {}), []);
  assert.deepEqual(brakujaceWymagania('spichlerz', {}), []);
});

test('Koszary wymagaja Ratusza na 3', () => {
  assert.deepEqual(brakujaceWymagania('koszary', { ratusz: 2 }), [{ budynek: 'ratusz', poziom: 3 }]);
  assert.deepEqual(brakujaceWymagania('koszary', { ratusz: 3 }), []);
});

test('Stajnia wymaga trzech budynkow naraz', () => {
  const brak = brakujaceWymagania('stajnia', { ratusz: 10, koszary: 5, kuznia: 1 });
  assert.deepEqual(brak, [{ budynek: 'kuznia', poziom: 5 }]);
});

test('brak wpisu o budynku znaczy poziom zero', () => {
  const brak = brakujaceWymagania('rynek', { ratusz: 3 });
  assert.deepEqual(brak, [{ budynek: 'spichlerz', poziom: 2 }]);
});

test('Wieza straznicza wymaga Ratusza i Zagrody na 5', () => {
  assert.deepEqual(brakujaceWymagania('wieza', { ratusz: 5, zagroda: 5 }), []);
  assert.equal(brakujaceWymagania('wieza', { ratusz: 5, zagroda: 4 }).length, 1);
});

test('Palac wymaga Ratusza 20, Kuzni 20 i Rynku 10', () => {
  assert.deepEqual(WYMAGANIA.palac, { ratusz: 20, kuznia: 20, rynek: 10 });
});

test('opisWymagan sklada czytelny komunikat', () => {
  const nazwy = { ratusz: 'Ratusz', kuznia: 'Kuźnia' };
  assert.equal(
    opisWymagan([{ budynek: 'ratusz', poziom: 10 }, { budynek: 'kuznia', poziom: 5 }], nazwy),
    'Wymaga: Ratusz 10, Kuźnia 5',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-wymagania.test.js`
Expected: FAIL — `Cannot find module '../src/wioska/wymagania.js'`

- [ ] **Step 3: Write the data and logic**

`src/wioska/wymagania-dane.js`:

```js
// src/wioska/wymagania-dane.js
// Wymagania sa wspolne dla swiatow — nie ma ich w zadnym endpoincie
// interface.php, wiec pochodza z ekranu Ratusza i wiki.
// Budynki niewymienione nie maja zadnych wymagan.

export const WYMAGANIA = {
  koszary: { ratusz: 3 },
  mur: { koszary: 1 },
  kuznia: { ratusz: 5, koszary: 1 },
  rynek: { ratusz: 3, spichlerz: 2 },
  stajnia: { ratusz: 10, koszary: 5, kuznia: 5 },
  warsztat: { ratusz: 10, kuznia: 10 },
  palac: { ratusz: 20, kuznia: 20, rynek: 10 },
  kosciol: { ratusz: 5, zagroda: 5 },
  wieza: { ratusz: 5, zagroda: 5 },
};
```

`src/wioska/wymagania.js`:

```js
// src/wioska/wymagania.js

import { WYMAGANIA } from './wymagania-dane.js';

// Pusta lista znaczy „mozna budowac". Kolejnosc wynikow idzie za kolejnoscia
// wpisow w WYMAGANIA, zeby komunikat byl zawsze taki sam.
export function brakujaceWymagania(budynek, poziomy) {
  const wym = WYMAGANIA[budynek];
  if (!wym) return [];
  const brak = [];
  for (const [wymagany, poziom] of Object.entries(wym)) {
    if ((poziomy[wymagany] ?? 0) < poziom) brak.push({ budynek: wymagany, poziom });
  }
  return brak;
}

export function opisWymagan(brakujace, nazwy) {
  if (!brakujace.length) return '';
  const czesci = brakujace.map(b => `${nazwy[b.budynek] ?? b.budynek} ${b.poziom}`);
  return `Wymaga: ${czesci.join(', ')}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/wioska-wymagania.test.js`
Expected: PASS, 7 testów

- [ ] **Step 5: Commit**

```bash
git add src/wioska/wymagania-dane.js src/wioska/wymagania.js test/wioska-wymagania.test.js
git commit -m "feat: wymagania miedzy budynkami"
```

---

### Task 6: Model planu

**Files:**
- Create: `src/wioska/plan.js`
- Test: `test/wioska-plan.test.js`

**Interfaces:**
- Consumes: `swiat(kod)`, `poziomyStartowe(s)`, `maksPoziom(s, b)`
- Produces:
  - `PLAN_PUSTY` — stała: plan bez kroków dla `pl231`
  - `normalizujPlan(surowy)` → `Plan` — uzupełnia braki wartościami domyślnymi, sortuje `dochody` i `zastrzyki` po czasie
  - `bledyPlanu(plan)` → `string[]` — pusta lista znaczy plan poprawny
  - `Plan` = `{ swiat, start: { poziomy, surowce }, kroki, dochody, zastrzyki }`
  - `kroki[i]` = `{ budynek, doPoziomu }`
  - `dochody[i]` = `{ czasS, drewnoH, glinaH, zelazoH }`
  - `zastrzyki[i]` = `{ czasS, drewno, glina, zelazo }`

**Uwaga o nazwach pól:** w JSON-ie wymienianym z użytkownikiem pola nazywają się
tak samo jak w kodzie (`doPoziomu`, `czasS`, `drewnoH`). Nie ma dwóch
konwencji — plan zapisany przez stronę wczytuje się do CLI bez tłumaczenia.

- [ ] **Step 1: Write the failing test**

`test/wioska-plan.test.js`:

```js
// test/wioska-plan.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujPlan, bledyPlanu, PLAN_PUSTY } from '../src/wioska/plan.js';

test('pusty plan jest poprawny', () => {
  assert.deepEqual(bledyPlanu(PLAN_PUSTY), []);
});

test('normalizacja uzupelnia poziomy startowe z configu swiata', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [] });
  assert.equal(p.start.poziomy.ratusz, 1);
  assert.equal(p.start.poziomy.koszary, 0);
});

test('normalizacja ustawia surowce startowe na 1000 kazdego', () => {
  const p = normalizujPlan({ swiat: 'pl231' });
  assert.deepEqual(p.start.surowce, { drewno: 1000, glina: 1000, zelazo: 1000 });
});

test('podane surowce startowe wygrywaja z domyslnymi', () => {
  const p = normalizujPlan({ swiat: 'pl231', start: { surowce: { drewno: 5000 } } });
  assert.equal(p.start.surowce.drewno, 5000);
  assert.equal(p.start.surowce.glina, 1000);
});

test('normalizacja sortuje dochody i zastrzyki po czasie', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    dochody: [{ czasS: 7200, drewnoH: 5000 }, { czasS: 0, drewnoH: 0 }],
    zastrzyki: [{ czasS: 500, drewno: 10 }, { czasS: 100, drewno: 20 }],
  });
  assert.deepEqual(p.dochody.map(d => d.czasS), [0, 7200]);
  assert.deepEqual(p.zastrzyki.map(z => z.czasS), [100, 500]);
});

test('normalizacja domyka niepodane skladowe dochodu zerem', () => {
  const p = normalizujPlan({ swiat: 'pl231', dochody: [{ czasS: 0, drewnoH: 2000 }] });
  assert.deepEqual(p.dochody[0], { czasS: 0, drewnoH: 2000, glinaH: 0, zelazoH: 0 });
});

test('nieznany swiat to blad planu', () => {
  assert.match(bledyPlanu({ swiat: 'pl999', kroki: [] })[0], /pl999/);
});

test('nieznany budynek to blad planu', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'wiatrak', doPoziomu: 1 }] });
  assert.match(bledyPlanu(p)[0], /wiatrak/);
});

test('poziom ponad maksimum swiata to blad planu', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'warsztat', doPoziomu: 16 }] });
  assert.match(bledyPlanu(p)[0], /Warsztat|warsztat/);
});

test('kroki musza isc po jednym poziomie w gore', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 3 }],
  });
  assert.equal(bledyPlanu(p).length, 1);
  assert.match(bledyPlanu(p)[0], /2/);
});

test('poprawna sciezka rozbudowy nie zglasza bledow', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [
      { budynek: 'tartak', doPoziomu: 1 },
      { budynek: 'cegielnia', doPoziomu: 1 },
      { budynek: 'tartak', doPoziomu: 2 },
    ],
  });
  assert.deepEqual(bledyPlanu(p), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-plan.test.js`
Expected: FAIL — `Cannot find module '../src/wioska/plan.js'`

- [ ] **Step 3: Write the implementation**

`src/wioska/plan.js`:

```js
// src/wioska/plan.js
// Plan to czysty obiekt bez stanu interfejsu — ten sam ksztalt jedzie
// do CLI, do schowka i do localStorage.

import { SWIATY, swiat } from './swiaty.js';
import { poziomyStartowe, maksPoziom, budynkiSwiata } from './swiat.js';

export const SUROWCE_STARTOWE = { drewno: 1000, glina: 1000, zelazo: 1000 };

export const PLAN_PUSTY = normalizujPlan({ swiat: 'pl231' });

export function normalizujPlan(surowy) {
  const kod = surowy?.swiat ?? 'pl231';
  const s = SWIATY[kod];
  const poziomy = s ? poziomyStartowe(s) : {};
  return {
    swiat: kod,
    start: {
      poziomy: { ...poziomy, ...(surowy?.start?.poziomy ?? {}) },
      surowce: { ...SUROWCE_STARTOWE, ...(surowy?.start?.surowce ?? {}) },
    },
    kroki: (surowy?.kroki ?? []).map(k => ({
      budynek: k.budynek,
      doPoziomu: Number(k.doPoziomu),
    })),
    dochody: [...(surowy?.dochody ?? [])]
      .map(d => ({
        czasS: Number(d.czasS ?? 0),
        drewnoH: Number(d.drewnoH ?? 0),
        glinaH: Number(d.glinaH ?? 0),
        zelazoH: Number(d.zelazoH ?? 0),
      }))
      .sort((a, b) => a.czasS - b.czasS),
    zastrzyki: [...(surowy?.zastrzyki ?? [])]
      .map(z => ({
        czasS: Number(z.czasS ?? 0),
        drewno: Number(z.drewno ?? 0),
        glina: Number(z.glina ?? 0),
        zelazo: Number(z.zelazo ?? 0),
      }))
      .sort((a, b) => a.czasS - b.czasS),
  };
}

export function bledyPlanu(plan) {
  const bledy = [];
  let s;
  try {
    s = swiat(plan.swiat);
  } catch (e) {
    return [e.message];
  }
  const dostepne = new Set(budynkiSwiata(s));
  // Kopia poziomow startowych — sprawdzamy, czy kroki tworza ciagla sciezke.
  const poziomy = { ...plan.start.poziomy };
  plan.kroki.forEach((krok, i) => {
    if (!dostepne.has(krok.budynek)) {
      bledy.push(`Krok ${i + 1}: budynek ${krok.budynek} nie istnieje na świecie ${plan.swiat}`);
      return;
    }
    const maks = maksPoziom(s, krok.budynek);
    if (krok.doPoziomu > maks) {
      bledy.push(`Krok ${i + 1}: ${krok.budynek} ma maksymalnie ${maks} poziomów, nie ${krok.doPoziomu}`);
      return;
    }
    const oczekiwany = (poziomy[krok.budynek] ?? 0) + 1;
    if (krok.doPoziomu !== oczekiwany) {
      bledy.push(`Krok ${i + 1}: ${krok.budynek} powinien iść na poziom ${oczekiwany}, nie ${krok.doPoziomu}`);
      return;
    }
    poziomy[krok.budynek] = krok.doPoziomu;
  });
  return bledy;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/wioska-plan.test.js`
Expected: PASS, 11 testów

- [ ] **Step 5: Commit**

```bash
git add src/wioska/plan.js test/wioska-plan.test.js
git commit -m "feat: model planu z normalizacja i walidacja"
```

---

### Task 7: Symulacja osi czasu

**Files:**
- Create: `src/wioska/symulacja.js`
- Test: `test/wioska-symulacja.test.js`

**Interfaces:**
- Consumes: wszystko z Tasków 1–6
- Produces:
  - `symuluj(plan)` → `Wynik`
  - `Wynik` = `{ kroki, ostrzezenia, podsumowanie }`
  - `kroki[i]` = `{ budynek, doPoziomu, startS, czekanieS, czekanieNa, trwanieS, koniecS, koszt, pewny, zasobyPo, ludnoscPo, blad }`
  - `ostrzezenia[i]` = `{ typ, krok, tekst }`, gdzie `typ` ∈ `'przestoj' | 'przepelnienie' | 'ponad-spichlerz' | 'ponad-zagrode' | 'wymagania'`
  - `podsumowanie` = `{ czasS, koszt, zZastrzykow, zmarnowane, czasNiepewnyS }`

**Kontekst — jak działa zegar:**

W wiosce buduje się jeden budynek naraz, więc kroki idą sekwencyjnie. Dla
każdego kroku zegar przesuwa się do momentu, w którym magazyn pokrywa koszt,
a potem o czas budowy.

Dopływ surowców składa się z produkcji kopalń (rośnie w miarę rozbudowy) i
z dochodu wpisanego przez gracza (przedziały: wpis obowiązuje do następnego).
Do tego dochodzą zastrzyki jednorazowe. Magazyn ma sufit z poziomu Spichlerza
— nadwyżka przepada i jest liczona jako strata, bo to jest sygnał „zbuduj
spichlerz wcześniej".

Szukanie momentu, w którym stać, idzie skokami między zdarzeniami. Między
dwoma zdarzeniami stawka dopływu jest stała, więc czas do uzbierania liczy
się wprost, bez pętli po sekundach.

- [ ] **Step 1: Write the failing test**

`test/wioska-symulacja.test.js`:

```js
// test/wioska-symulacja.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';

const plan = (nadpisz) => normalizujPlan({ swiat: 'pl231', ...nadpisz });

test('pusty plan konczy sie natychmiast', () => {
  const w = symuluj(plan({}));
  assert.equal(w.kroki.length, 0);
  assert.equal(w.podsumowanie.czasS, 0);
});

test('krok oplacalny od reki nie czeka', () => {
  const w = symuluj(plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  assert.equal(w.kroki[0].czekanieS, 0);
  assert.equal(w.kroki[0].startS, 0);
  assert.equal(w.kroki[0].trwanieS, 10);
  assert.equal(w.podsumowanie.czasS, 10);
});

test('koszt schodzi z magazynu', () => {
  const w = symuluj(plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  assert.equal(w.kroki[0].zasobyPo.drewno, 1000 - 50);
  assert.equal(w.kroki[0].zasobyPo.glina, 1000 - 60);
});

test('krok ponad stan magazynu czeka na produkcje i mowi na co czekal', () => {
  const w = symuluj(plan({
    start: { poziomy: { tartak: 5, cegielnia: 5, huta: 5, spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 6 }],
  }));
  assert.ok(w.kroki[0].czekanieS > 0);
  assert.ok(['drewno', 'glina', 'zelazo'].includes(w.kroki[0].czekanieNa));
});

test('rozbudowa Ratusza skraca kolejne budowy', () => {
  const bez = symuluj(plan({
    start: { poziomy: { ratusz: 5 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 10 }],
  }));
  const po = symuluj(plan({
    start: { poziomy: { ratusz: 10 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 10 }],
  }));
  assert.ok(po.kroki[0].trwanieS < bez.kroki[0].trwanieS);
});

test('zastrzyk skraca oczekiwanie', () => {
  const bez = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoH: 10, glinaH: 10, zelazoH: 10 }],
  }));
  const z = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoH: 10, glinaH: 10, zelazoH: 10 }],
    zastrzyki: [{ czasS: 60, drewno: 500, glina: 500, zelazo: 500 }],
  }));
  assert.ok(z.kroki[0].startS < bez.kroki[0].startS);
  assert.equal(z.podsumowanie.zZastrzykow.drewno, 500);
});

test('zmiana dochodu w trakcie oczekiwania przyspiesza zbieranie', () => {
  const wolno = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoH: 10, glinaH: 10, zelazoH: 10 }],
  }));
  const szybciej = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [
      { czasS: 0, drewnoH: 10, glinaH: 10, zelazoH: 10 },
      { czasS: 600, drewnoH: 5000, glinaH: 5000, zelazoH: 5000 },
    ],
  }));
  assert.ok(szybciej.kroki[0].startS < wolno.kroki[0].startS);
});

// Magazyn stoi pod sufitem (Spichlerz 1 = 1000), kopalnie sypia po 530/h,
// a krok czeka na zelazo — wiec drewno i glina przelewaja sie przez ten czas.
test('nadwyzka ponad pojemnosc spichlerza przepada i jest raportowana', () => {
  const w = symuluj(plan({
    start: {
      poziomy: { spichlerz: 1, tartak: 20, cegielnia: 20, huta: 20, ratusz: 5, koszary: 1, zagroda: 20 },
      surowce: { drewno: 1000, glina: 1000, zelazo: 0 },
    },
    kroki: [{ budynek: 'kuznia', doPoziomu: 1 }],
  }));
  assert.ok(w.podsumowanie.zmarnowane.drewno > 0);
  assert.ok(w.ostrzezenia.some(o => o.typ === 'przepelnienie'));
});

// Wymagania Wiezy sa spelnione, wiec zatrzymac ja moze dopiero pojemnosc.
test('krok drozszy niz spichlerz to blad twardy', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 1, ratusz: 5, zagroda: 5 } },
    kroki: [{ budynek: 'wieza', doPoziomu: 1 }],
  }));
  assert.equal(w.kroki[0].blad, 'ponad-spichlerz');
  assert.ok(w.ostrzezenia.some(o => o.typ === 'ponad-spichlerz'));
});

// Spichlerz 25 miesci koszt Wiezy, wiec zostaje sama Zagroda: 500 ludnosci
// przy limicie 452 z poziomu 5.
test('przekroczenie zagrody zatrzymuje krok', () => {
  const w = symuluj(plan({
    start: { poziomy: { zagroda: 5, ratusz: 5, spichlerz: 25 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'wieza', doPoziomu: 1 }],
  }));
  assert.equal(w.kroki[0].blad, 'ponad-zagrode');
});

test('niespelnione wymaganie zatrzymuje krok', () => {
  const w = symuluj(plan({ kroki: [{ budynek: 'koszary', doPoziomu: 1 }] }));
  assert.equal(w.kroki[0].blad, 'wymagania');
  assert.ok(w.ostrzezenia.some(o => o.typ === 'wymagania' && /Ratusz|ratusz/.test(o.tekst)));
});

test('podsumowanie sumuje koszt wszystkich krokow', () => {
  const w = symuluj(plan({
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
  }));
  assert.equal(w.podsumowanie.koszt.drewno, 50 + 65);
  assert.equal(w.podsumowanie.koszt.zelazo, 40 + 40);
});

test('podsumowanie liczy czas pochodzacy z poziomow bez pomiaru', () => {
  const w = symuluj(plan({
    start: { poziomy: { tartak: 4 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 5 }],
  }));
  assert.equal(w.kroki[0].pewny, false);
  assert.equal(w.podsumowanie.czasNiepewnyS, w.kroki[0].trwanieS);
});

test('dlugi przestoj daje ostrzezenie', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoH: 1, glinaH: 1, zelazoH: 1 }],
  }));
  assert.ok(w.ostrzezenia.some(o => o.typ === 'przestoj'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-symulacja.test.js`
Expected: FAIL — `Cannot find module '../src/wioska/symulacja.js'`

- [ ] **Step 3: Write the implementation**

`src/wioska/symulacja.js`:

```js
// src/wioska/symulacja.js
// Przebieg osi czasu. W wiosce buduje sie jeden budynek naraz, wiec kroki
// ida sekwencyjnie — liczba slotow kolejki nie zmienia laczonego czasu.

import { swiat } from './swiaty.js';
import { kosztPoziomu, ludnoscPoziomu, budynkiSwiata } from './swiat.js';
import { pojemnosc, maksLudnosc, produkcjaGodzinowa } from './tabele.js';
import { czasBudowy } from './czas.js';
import { brakujaceWymagania, opisWymagan } from './wymagania.js';
import { NAZWY } from './nazwy.js';

const SUROWCE = ['drewno', 'glina', 'zelazo'];
// Prog, powyzej ktorego przestoj przestaje byc szumem i warto o nim powiedziec.
const PROG_PRZESTOJU_S = 3600;

const zeroSurowce = () => ({ drewno: 0, glina: 0, zelazo: 0 });

function produkcjaNaSekunde(s, poziomy, dochod) {
  return {
    drewno: (produkcjaGodzinowa(s, poziomy.tartak ?? 0) + dochod.drewnoH) / 3600,
    glina: (produkcjaGodzinowa(s, poziomy.cegielnia ?? 0) + dochod.glinaH) / 3600,
    zelazo: (produkcjaGodzinowa(s, poziomy.huta ?? 0) + dochod.zelazoH) / 3600,
  };
}

// Dochod obowiazuje od swojego czasu do nastepnego wpisu. Przed pierwszym
// wpisem gracz nie ma zadnego dodatkowego zrodla.
function dochodWChwili(dochody, czas) {
  let biezacy = { czasS: 0, drewnoH: 0, glinaH: 0, zelazoH: 0 };
  for (const d of dochody) {
    if (d.czasS <= czas) biezacy = d; else break;
  }
  return biezacy;
}

function nastepneZdarzenie(plan, czas) {
  let naj = Infinity;
  for (const d of plan.dochody) if (d.czasS > czas && d.czasS < naj) naj = d.czasS;
  for (const z of plan.zastrzyki) if (z.czasS > czas && z.czasS < naj) naj = z.czasS;
  return naj;
}

function dolej(stan, ile, sufit) {
  for (const r of SUROWCE) {
    const suma = stan.zasoby[r] + ile[r];
    if (suma > sufit) {
      stan.zmarnowane[r] += suma - sufit;
      stan.zasoby[r] = sufit;
    } else {
      stan.zasoby[r] = suma;
    }
  }
}

export function symuluj(plan) {
  const s = swiat(plan.swiat);
  const poziomy = { ...plan.start.poziomy };
  const stan = {
    zasoby: { ...plan.start.surowce },
    zmarnowane: zeroSurowce(),
  };
  const zZastrzykow = zeroSurowce();
  const zastosowaneZastrzyki = new Set();
  let czas = 0;
  const kroki = [];
  const ostrzezenia = [];
  const koszt = zeroSurowce();
  let czasNiepewnyS = 0;

  const ludnoscZajeta = () => budynkiSwiata(s)
    .reduce((suma, b) => suma + ludnoscPoziomu(s, b, poziomy[b] ?? 0), 0);

  // Zastrzyki wpadaja dokladnie w swoim czasie; kazdy tylko raz.
  const wpuscZastrzyki = (doCzasu, sufit) => {
    for (let i = 0; i < plan.zastrzyki.length; i++) {
      const z = plan.zastrzyki[i];
      if (zastosowaneZastrzyki.has(i) || z.czasS > doCzasu) continue;
      zastosowaneZastrzyki.add(i);
      dolej(stan, { drewno: z.drewno, glina: z.glina, zelazo: z.zelazo }, sufit);
      for (const r of SUROWCE) zZastrzykow[r] += z[r];
    }
  };

  plan.kroki.forEach((krok, i) => {
    const sufit = pojemnosc(poziomy.spichlerz ?? 1);
    const wpis = {
      budynek: krok.budynek,
      doPoziomu: krok.doPoziomu,
      startS: czas,
      czekanieS: 0,
      czekanieNa: null,
      trwanieS: 0,
      koniecS: czas,
      koszt: zeroSurowce(),
      pewny: true,
      zasobyPo: { ...stan.zasoby },
      ludnoscPo: ludnoscZajeta(),
      blad: null,
    };

    const brak = brakujaceWymagania(krok.budynek, poziomy);
    if (brak.length) {
      wpis.blad = 'wymagania';
      ostrzezenia.push({ typ: 'wymagania', krok: i, tekst: `Krok ${i + 1}: ${opisWymagan(brak, NAZWY)}` });
      kroki.push(wpis);
      return;
    }

    const c = kosztPoziomu(s, krok.budynek, krok.doPoziomu);
    wpis.koszt = c;

    if (SUROWCE.some(r => c[r] > sufit)) {
      wpis.blad = 'ponad-spichlerz';
      ostrzezenia.push({
        typ: 'ponad-spichlerz', krok: i,
        tekst: `Krok ${i + 1}: ${NAZWY[krok.budynek]} ${krok.doPoziomu} kosztuje więcej, niż mieści Spichlerz ${poziomy.spichlerz} (${sufit}). Rozbuduj Spichlerz wcześniej.`,
      });
      kroki.push(wpis);
      return;
    }

    const ludnoscPo = ludnoscZajeta()
      - ludnoscPoziomu(s, krok.budynek, poziomy[krok.budynek] ?? 0)
      + ludnoscPoziomu(s, krok.budynek, krok.doPoziomu);
    const limit = maksLudnosc(poziomy.zagroda ?? 1);
    if (ludnoscPo > limit) {
      wpis.blad = 'ponad-zagrode';
      ostrzezenia.push({
        typ: 'ponad-zagrode', krok: i,
        tekst: `Krok ${i + 1}: ${NAZWY[krok.budynek]} ${krok.doPoziomu} wymaga ${ludnoscPo} ludności, a Zagroda ${poziomy.zagroda} daje ${limit}.`,
      });
      kroki.push(wpis);
      return;
    }

    // Przesuwaj zegar skokami miedzy zdarzeniami, az stac na krok.
    const poczatek = czas;
    let czekanieNa = null;
    wpuscZastrzyki(czas, sufit);
    for (;;) {
      if (SUROWCE.every(r => stan.zasoby[r] >= c[r])) break;
      const stawka = produkcjaNaSekunde(s, poziomy, dochodWChwili(plan.dochody, czas));
      let potrzebaS = 0;
      for (const r of SUROWCE) {
        const brakuje = c[r] - stan.zasoby[r];
        if (brakuje <= 0) continue;
        const dt = stawka[r] > 0 ? brakuje / stawka[r] : Infinity;
        if (dt > potrzebaS) { potrzebaS = dt; czekanieNa = r; }
      }
      const zdarzenie = nastepneZdarzenie(plan, czas);
      if (potrzebaS === Infinity && zdarzenie === Infinity) {
        wpis.blad = 'brak-dochodu';
        ostrzezenia.push({
          typ: 'przestoj', krok: i,
          tekst: `Krok ${i + 1}: przy zerowej produkcji ${czekanieNa} tego kroku nie da się nigdy opłacić.`,
        });
        break;
      }
      const doCzasu = Math.min(czas + potrzebaS, zdarzenie);
      const dt = doCzasu - czas;
      dolej(stan, {
        drewno: stawka.drewno * dt, glina: stawka.glina * dt, zelazo: stawka.zelazo * dt,
      }, sufit);
      czas = doCzasu;
      wpuscZastrzyki(czas, sufit);
    }

    if (wpis.blad) { kroki.push(wpis); return; }

    wpis.czekanieS = Math.round(czas - poczatek);
    wpis.czekanieNa = wpis.czekanieS > 0 ? czekanieNa : null;
    wpis.startS = Math.round(czas);
    if (wpis.czekanieS >= PROG_PRZESTOJU_S) {
      ostrzezenia.push({
        typ: 'przestoj', krok: i,
        tekst: `Krok ${i + 1}: ${Math.round(wpis.czekanieS / 3600)} h przestoju w oczekiwaniu na ${czekanieNa}.`,
      });
    }
    if (SUROWCE.some(r => stan.zmarnowane[r] > 0) && !ostrzezenia.some(o => o.typ === 'przepelnienie')) {
      ostrzezenia.push({
        typ: 'przepelnienie', krok: i,
        tekst: 'Spichlerz się przepełnia — część produkcji przepada. Rozbuduj go wcześniej.',
      });
    }

    for (const r of SUROWCE) { stan.zasoby[r] -= c[r]; koszt[r] += c[r]; }

    const { sekundy, pewny } = czasBudowy(s, krok.budynek, krok.doPoziomu, poziomy.ratusz ?? 1);
    wpis.trwanieS = sekundy;
    wpis.pewny = pewny;
    if (!pewny) czasNiepewnyS += sekundy;

    // Produkcja plynie takze w trakcie budowy.
    const stawka = produkcjaNaSekunde(s, poziomy, dochodWChwili(plan.dochody, czas));
    const koniec = czas + sekundy;
    let biezacy = czas;
    for (;;) {
      const zdarzenie = Math.min(nastepneZdarzenie(plan, biezacy), koniec);
      const dt = zdarzenie - biezacy;
      dolej(stan, {
        drewno: stawka.drewno * dt, glina: stawka.glina * dt, zelazo: stawka.zelazo * dt,
      }, sufit);
      biezacy = zdarzenie;
      wpuscZastrzyki(biezacy, sufit);
      if (biezacy >= koniec) break;
    }
    czas = koniec;

    poziomy[krok.budynek] = krok.doPoziomu;
    wpis.koniecS = Math.round(czas);
    wpis.zasobyPo = { ...stan.zasoby };
    wpis.ludnoscPo = ludnoscZajeta();
    kroki.push(wpis);
  });

  return {
    kroki,
    ostrzezenia,
    podsumowanie: {
      czasS: Math.round(czas),
      koszt,
      zZastrzykow,
      zmarnowane: {
        drewno: Math.round(stan.zmarnowane.drewno),
        glina: Math.round(stan.zmarnowane.glina),
        zelazo: Math.round(stan.zmarnowane.zelazo),
      },
      czasNiepewnyS,
    },
  };
}
```

- [ ] **Step 4: Create the shared name map**

`src/wioska/nazwy.js`:

```js
// src/wioska/nazwy.js
// Nazwy widoczne dla gracza — wspolne dla komunikatow silnika i interfejsu,
// zeby nie rozjechaly sie miedzy jednym a drugim.

export const NAZWY = {
  ratusz: 'Ratusz', koszary: 'Koszary', stajnia: 'Stajnia', warsztat: 'Warsztat',
  kuznia: 'Kuźnia', palac: 'Pałac', plac: 'Plac', piedestal: 'Piedestał',
  rynek: 'Rynek', tartak: 'Tartak', cegielnia: 'Cegielnia', huta: 'Huta żelaza',
  zagroda: 'Zagroda', spichlerz: 'Spichlerz', schowek: 'Schowek', mur: 'Mur obronny',
  wieza: 'Wieża strażnicza', kosciol: 'Kościół',
};

export const NAZWY_SUROWCOW = { drewno: 'drewno', glina: 'glina', zelazo: 'żelazo' };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/wioska-symulacja.test.js`
Expected: PASS, 14 testów

- [ ] **Step 6: Commit**

```bash
git add src/wioska/symulacja.js src/wioska/nazwy.js test/wioska-symulacja.test.js
git commit -m "feat: symulacja osi czasu z produkcja, magazynem i wtraceniami gracza"
```

---

### Task 8: Eksport i CLI

**Files:**
- Create: `src/wioska/format.js`
- Create: `tools/plan.js`
- Test: `test/wioska-format.test.js`

**Interfaces:**
- Consumes: `Plan`, `Wynik`
- Produces:
  - `czasCzytelny(sekundy)` → `string` (np. `6 d 14 h 03 min`)
  - `planJSON(plan)` → `string`
  - `planTekst(plan, wynik)` → `string`
  - `osCzasuTekst(wynik)` → `string` — rozpiska krok po kroku, do konsoli

- [ ] **Step 1: Write the failing test**

`test/wioska-format.test.js`:

```js
// test/wioska-format.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { czasCzytelny, planJSON, planTekst, osCzasuTekst } from '../src/wioska/format.js';

const p = normalizujPlan({
  swiat: 'pl231',
  kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
});
const w = symuluj(p);

test('czasCzytelny rozbija sekundy na dni, godziny i minuty', () => {
  assert.equal(czasCzytelny(0), '0 min');
  assert.equal(czasCzytelny(90), '1 min');
  assert.equal(czasCzytelny(3600), '1 h 00 min');
  assert.equal(czasCzytelny(90000), '1 d 01 h 00 min');
});

test('planJSON daje sie wczytac z powrotem bez straty', () => {
  const znowu = normalizujPlan(JSON.parse(planJSON(p)));
  assert.deepEqual(znowu, p);
});

test('planTekst wymienia kroki po nazwach widocznych dla gracza', () => {
  const t = planTekst(p, w);
  assert.match(t, /Tartak → 1/);
  assert.match(t, /Cegielnia → 1/);
});

test('planTekst podaje sumy surowcow i laczny czas', () => {
  const t = planTekst(p, w);
  assert.match(t, /115/);              // 50 drewna + 65 drewna
  assert.match(t, /Łączny czas/);
});

test('osCzasuTekst pokazuje przestoj i surowiec, na ktory czekano', () => {
  const wolny = symuluj(normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoH: 60, glinaH: 60, zelazoH: 60 }],
  }));
  assert.match(osCzasuTekst(wolny), /czeka/);
});

test('osCzasuTekst oznacza kroki z poziomow bez pomiaru', () => {
  const niepewny = symuluj(normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { tartak: 4 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 5 }],
  }));
  assert.match(osCzasuTekst(niepewny), /≈/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-format.test.js`
Expected: FAIL — `Cannot find module '../src/wioska/format.js'`

- [ ] **Step 3: Write the implementation**

`src/wioska/format.js`:

```js
// src/wioska/format.js
// Dwie postacie eksportu: tekst do przepisania do Menedzera Konta
// i JSON, ktory jest kanalem wymiany planu z Claude.

import { NAZWY, NAZWY_SUROWCOW } from './nazwy.js';

export function czasCzytelny(sekundy) {
  const s = Math.max(0, Math.round(sekundy));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d} d ${String(h).padStart(2, '0')} h ${String(m).padStart(2, '0')} min`;
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min`;
}

export function planJSON(plan) {
  return JSON.stringify(plan, null, 2);
}

function liczba(n) {
  return Math.round(n).toLocaleString('pl-PL');
}

export function planTekst(plan, wynik) {
  const linie = [`Plan budowy — ${plan.swiat}`, ''];
  plan.kroki.forEach((k, i) => {
    linie.push(`${String(i + 1).padStart(3)}. ${NAZWY[k.budynek] ?? k.budynek} → ${k.doPoziomu}`);
  });
  const { koszt, czasS, zmarnowane, zZastrzykow } = wynik.podsumowanie;
  linie.push('', 'Podsumowanie');
  linie.push(`  Łączny czas: ${czasCzytelny(czasS)}`);
  linie.push(`  Surowce: ${liczba(koszt.drewno)} drewna, ${liczba(koszt.glina)} gliny, ${liczba(koszt.zelazo)} żelaza`);
  if (zZastrzykow.drewno || zZastrzykow.glina || zZastrzykow.zelazo) {
    linie.push(`  Z dosyłek: ${liczba(zZastrzykow.drewno)} / ${liczba(zZastrzykow.glina)} / ${liczba(zZastrzykow.zelazo)}`);
  }
  if (zmarnowane.drewno || zmarnowane.glina || zmarnowane.zelazo) {
    linie.push(`  Zmarnowane przez pełny spichlerz: ${liczba(zmarnowane.drewno)} / ${liczba(zmarnowane.glina)} / ${liczba(zmarnowane.zelazo)}`);
  }
  return linie.join('\n');
}

export function osCzasuTekst(wynik) {
  const linie = ['  # | start        | krok                      | trwanie      | uwagi'];
  wynik.kroki.forEach((k, i) => {
    const nazwa = `${NAZWY[k.budynek] ?? k.budynek} → ${k.doPoziomu}`;
    const uwagi = [];
    if (k.blad) uwagi.push(`BŁĄD: ${k.blad}`);
    if (k.czekanieS > 0) uwagi.push(`czeka ${czasCzytelny(k.czekanieS)} na ${NAZWY_SUROWCOW[k.czekanieNa] ?? k.czekanieNa}`);
    if (!k.pewny) uwagi.push('≈ czas z poziomu bez pomiaru');
    linie.push(
      `${String(i + 1).padStart(3)} | ${czasCzytelny(k.startS).padEnd(12)} | ${nazwa.padEnd(25)} | ${czasCzytelny(k.trwanieS).padEnd(12)} | ${uwagi.join('; ')}`,
    );
  });
  if (wynik.ostrzezenia.length) {
    linie.push('', 'Ostrzeżenia:');
    for (const o of wynik.ostrzezenia) linie.push(`  • ${o.tekst}`);
  }
  return linie.join('\n');
}
```

`tools/plan.js`:

```js
// tools/plan.js
// Uruchomienie symulacji poza przegladarka — ten sam silnik, co na stronie.
// Uzycie:
//   node tools/plan.js plan.json
//   cat plan.json | node tools/plan.js

import { readFileSync } from 'node:fs';
import { normalizujPlan, bledyPlanu } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { osCzasuTekst, planTekst } from '../src/wioska/format.js';

const zrodlo = process.argv[2]
  ? readFileSync(process.argv[2], 'utf8')
  : readFileSync(0, 'utf8');

const plan = normalizujPlan(JSON.parse(zrodlo));
const bledy = bledyPlanu(plan);
if (bledy.length) {
  console.error('Plan jest niepoprawny:');
  for (const b of bledy) console.error(`  • ${b}`);
  process.exit(1);
}

const wynik = symuluj(plan);
console.log(osCzasuTekst(wynik));
console.log('');
console.log(planTekst(plan, wynik));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/wioska-format.test.js`
Expected: PASS, 6 testów

- [ ] **Step 5: Verify the CLI end to end**

```bash
cat > /tmp/plan-probny.json <<'EOF'
{
  "swiat": "pl231",
  "kroki": [
    { "budynek": "tartak", "doPoziomu": 1 },
    { "budynek": "cegielnia", "doPoziomu": 1 },
    { "budynek": "huta", "doPoziomu": 1 },
    { "budynek": "tartak", "doPoziomu": 2 }
  ],
  "dochody": [{ "czasS": 0, "drewnoH": 500, "glinaH": 500, "zelazoH": 500 }]
}
EOF
node tools/plan.js /tmp/plan-probny.json
```

Expected: tabela czterech kroków z narastającymi czasami startu i podsumowanie z łącznym czasem.

- [ ] **Step 6: Commit**

```bash
git add src/wioska/format.js tools/plan.js test/wioska-format.test.js
git commit -m "feat: eksport planu i CLI do uruchamiania symulacji"
```

---

### Task 9: Szablon strony i wpięcie w build

**Files:**
- Create: `src/wioska.template.html`
- Create: `src/wioska.css`
- Modify: `build.js`
- Modify: `test/build.test.js`

**Interfaces:**
- Consumes: moduły `src/wioska/*.js`
- Produces: `buildWioskaPage()` → `string` (kompletny HTML), zapisywany do `dist/wioska/index.html`

**Kontekst:** `build.js` skleja moduły funkcją `stripModule`, która usuwa linie
`import` i słowo `export`. Wszystkie moduły lądują w jednym zakresie, więc
kolejność w tablicy `WIOSKA_LOGIC` musi iść od danych do kodu, który z nich
korzysta. Nazwy najwyższego poziomu nie mogą się powtarzać.

- [ ] **Step 1: Write the failing test**

Dopisz na końcu `test/build.test.js`:

```js
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
```

Zmień pierwszą linię importu w `test/build.test.js` na:

```js
import { buildDashboard, buildBookmarklet, buildUserscript, buildRatesPage, buildWioskaPage } from '../build.js';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build.test.js`
Expected: FAIL — `buildWioskaPage is not a function`

- [ ] **Step 3: Write the template**

`src/wioska.template.html`:

```html
<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Symulator budowy wioski — Plemiona</title>
<style>/*INJECT:css*/</style>
</head>
<body>
<header><div class="wrap">
  <div class="brand">
    <div class="eyebrow">Plemiona · symulator</div>
    <h1>Budowa wioski</h1>
  </div>
  <div class="start">
    <label>Świat <select id="swiat"></select></label>
    <label>Drewno <input id="start-drewno" type="number" min="0" value="1000"></label>
    <label>Glina <input id="start-glina" type="number" min="0" value="1000"></label>
    <label>Żelazo <input id="start-zelazo" type="number" min="0" value="1000"></label>
  </div>
</div></header>

<main class="wrap">
<div class="kolumny">

  <section id="budynki">
    <h2>Budynki</h2>
    <table id="tabela-budynkow">
      <thead><tr>
        <th>Budynek</th><th>Drewno</th><th>Glina</th><th>Żelazo</th>
        <th>Czas</th><th>Ludność</th><th></th>
      </tr></thead>
      <tbody></tbody>
    </table>
  </section>

  <section id="kolejka">
    <div class="kolejka-gora">
      <h2>Kolejka</h2>
      <div class="akcje">
        <button id="dodaj-dochod">+ dochód</button>
        <button id="dodaj-zastrzyk">+ dosyłka</button>
        <button id="kopiuj-tekst">Kopiuj tekst</button>
        <button id="kopiuj-json" class="primary">Kopiuj JSON</button>
        <button id="wklej-json">Wklej JSON</button>
        <button id="wyczysc">Wyczyść</button>
      </div>
    </div>
    <ol id="lista-krokow"></ol>
    <div id="podsumowanie"></div>
    <ul id="ostrzezenia"></ul>
  </section>

</div>
</main>

<div id="modal" class="modal" hidden>
  <div class="modal-box">
    <h3 id="modal-tytul">Wklej plan</h3>
    <textarea id="modal-pole" spellcheck="false"></textarea>
    <div class="modal-foot">
      <span id="modal-info"></span>
      <span class="spacer"></span>
      <button id="modal-anuluj">Anuluj</button>
      <button id="modal-ok" class="primary">Zatwierdź</button>
    </div>
  </div>
</div>

<script type="module">/*INJECT:js*/</script>
</body>
</html>
```

- [ ] **Step 4: Write the stylesheet**

`src/wioska.css` — trzymaj paletę zgodną z `src/rates.css` (ta sama gra, ten sam zestaw narzędzi):

```css
:root{--w:#2c2015;--w2:#170f08;--pg:#f4ead2;--ink:#38291a;--ink2:#6b543a;
  --acc:#7c2b2b;--gold:#a8842c;--line:#c4ac7c;--ok:#2f6b34;--zle:#8c2f2f}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);
  background:radial-gradient(ellipse at 50% -10%,#3a2c1c,var(--w) 45%,var(--w2)) fixed;min-height:100vh}
.wrap{width:94%;max-width:1400px;margin:0 auto}
header{color:#f6ecd4;padding:20px 0}
header .wrap{display:flex;align-items:center;gap:24px;flex-wrap:wrap}
.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.72rem;color:var(--gold)}
h1{margin:.1em 0 0;font-size:1.6rem}
.start{display:flex;gap:12px;flex-wrap:wrap;margin-left:auto}
.start label{display:flex;flex-direction:column;font-size:.72rem;color:var(--line)}
.start input,.start select{width:110px;padding:4px 6px;border:1px solid var(--line);border-radius:3px}
.kolumny{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:18px;padding-bottom:60px}
@media (max-width:1000px){.kolumny{grid-template-columns:1fr}}
section{background:var(--pg);border:1px solid var(--line);border-radius:4px;padding:14px}
h2{margin:0 0 10px;font-size:1.05rem}
table{width:100%;border-collapse:collapse;font-size:.86rem}
th{text-align:left;background:#e3d4b0;padding:6px;border-bottom:1px solid var(--line)}
td{padding:5px 6px;border-bottom:1px solid #e0d2b4}
tr.zablokowany td{color:var(--ink2);background:#efe4c8}
tr.zablokowany .powod{font-size:.76rem;color:var(--acc)}
button{font:inherit;padding:4px 10px;border:1px solid var(--line);border-radius:3px;
  background:#e3d4b0;cursor:pointer}
button:hover{background:#eddfbe}
button.primary{background:var(--acc);color:#f6ecd4;border-color:#5d2020}
button:disabled{opacity:.45;cursor:not-allowed}
.kolejka-gora{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.akcje{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
#lista-krokow{list-style:none;margin:0;padding:0;max-height:60vh;overflow:auto}
#lista-krokow li{display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;align-items:center;
  padding:6px;border-bottom:1px solid #e0d2b4;font-size:.86rem}
#lista-krokow li.wtracenie{background:#e8f0e2}
#lista-krokow li.blad{background:#f3dede}
#lista-krokow li[draggable=true]{cursor:grab}
.czekanie{font-size:.76rem;color:var(--acc)}
.niepewny{color:var(--ink2)}
#podsumowanie{margin-top:10px;padding-top:10px;border-top:2px solid var(--line);font-size:.9rem}
#ostrzezenia{margin:8px 0 0;padding-left:18px;font-size:.82rem;color:var(--acc)}
.modal{position:fixed;inset:0;background:rgba(20,12,6,.72);display:flex;align-items:center;justify-content:center}
.modal[hidden]{display:none}
.modal-box{background:var(--pg);border:1px solid var(--line);border-radius:4px;padding:16px;width:min(680px,92vw)}
.modal-box textarea{width:100%;height:280px;font-family:ui-monospace,monospace;font-size:.8rem}
.modal-foot{display:flex;gap:8px;align-items:center;margin-top:10px}
.spacer{flex:1}
```

- [ ] **Step 5: Wire it into build.js**

W `build.js`, poniżej `buildRatesPage`, dopisz:

```js
// Kolejnosc ma znaczenie: stripModule usuwa importy, wiec dane musza byc
// zdefiniowane przed kodem, ktory z nich korzysta.
const WIOSKA_LOGIC = [
  'src/wioska/swiaty.js',
  'src/wioska/czas-dane.js',
  'src/wioska/wymagania-dane.js',
  'src/wioska/nazwy.js',
  'src/wioska/swiat.js',
  'src/wioska/tabele.js',
  'src/wioska/czas.js',
  'src/wioska/wymagania.js',
  'src/wioska/plan.js',
  'src/wioska/symulacja.js',
  'src/wioska/format.js',
  'src/wioska/strona.js',
];

// Symulator budowy wioski (dist/wioska/index.html) — samowystarczalny plik.
export function buildWioskaPage() {
  const css = read('./src/wioska.css');
  const js = WIOSKA_LOGIC.map(p => stripModule(read('./' + p))).join('\n');
  return read('./src/wioska.template.html')
    .replace('/*INJECT:css*/', () => css)
    .replace('/*INJECT:js*/', () => js);
}
```

W bloku zapisu na końcu pliku dopisz przed `console.log`:

```js
  mkdirSync(new URL('./dist/wioska/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./dist/wioska/index.html', import.meta.url), buildWioskaPage());
```

i rozszerz komunikat o `wioska/index.html (symulator budowy)`.

- [ ] **Step 6: Create a placeholder page module so the build runs**

`src/wioska/strona.js` — na razie tylko szkielet, wypełni go Task 10:

```js
// src/wioska/strona.js
// Warstwa DOM. Cala arytmetyka siedzi w pozostalych modulach — tutaj tylko
// przepisywanie stanu na ekran i z powrotem.

export function uruchom() {
  if (typeof document === 'undefined') return;
}

uruchom();
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test test/build.test.js && node build.js`
Expected: PASS wszystkich testów builda; `node build.js` wypisuje komunikat z `wioska/index.html`

- [ ] **Step 8: Commit**

```bash
git add src/wioska.template.html src/wioska.css src/wioska/strona.js build.js test/build.test.js
git commit -m "feat: szablon strony symulatora i wpiecie w build"
```

---

### Task 10: Interfejs strony

**Files:**
- Modify: `src/wioska/strona.js`
- Test: `test/wioska-strona.test.js`

**Interfaces:**
- Consumes: wszystko z Tasków 1–8
- Produces:
  - `wierszBudynkuHTML(s, budynek, poziomy, poziomRatusza)` → `string`
  - `krokHTML(krok, indeks)` → `string`
  - `podsumowanieHTML(wynik)` → `string`
  - `KLUCZ_MAGAZYNU = 'plemiona-wioska'`
  - `uruchom()` — wpina zdarzenia, nic nie zwraca; sama się wywołuje tylko gdy istnieje `document`

**Kontekst:** funkcje budujące HTML są czyste i testowalne bez przeglądarki —
to one niosą logikę prezentacji. `uruchom()` zostaje cienką warstwą wpinania
zdarzeń, której testy nie dotykają.

- [ ] **Step 1: Write the failing test**

`test/wioska-strona.test.js`:

```js
// test/wioska-strona.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { wierszBudynkuHTML, krokHTML, podsumowanieHTML } from '../src/wioska/strona.js';

const s = swiat('pl231');

test('wiersz budynku pokazuje koszt nastepnego poziomu', () => {
  const html = wierszBudynkuHTML(s, 'tartak', { ratusz: 1, tartak: 0 }, 1);
  assert.match(html, /Tartak/);
  assert.match(html, /50/);
  assert.match(html, />60</);
});

test('wiersz budynku z niespelnionym wymaganiem jest zablokowany z podanym powodem', () => {
  const html = wierszBudynkuHTML(s, 'koszary', { ratusz: 1 }, 1);
  assert.match(html, /zablokowany/);
  assert.match(html, /Ratusz 3/);
  assert.match(html, /disabled/);
});

test('budynek na maksymalnym poziomie nie ma przycisku rozbudowy', () => {
  const html = wierszBudynkuHTML(s, 'plac', { plac: 1, ratusz: 1 }, 1);
  assert.match(html, /rozbudowany/);
  assert.doesNotMatch(html, /data-dodaj/);
});

test('wiersz budynku niesie identyfikator do wpiecia zdarzenia', () => {
  const html = wierszBudynkuHTML(s, 'tartak', { ratusz: 1, tartak: 0 }, 1);
  assert.match(html, /data-dodaj="tartak"/);
});

test('krok z przestojem pokazuje, na co czekal', () => {
  const w = symuluj(normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoH: 60, glinaH: 60, zelazoH: 60 }],
  }));
  assert.match(krokHTML(w.kroki[0], 0), /czeka/);
});

test('krok z bledem dostaje klase blad', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'koszary', doPoziomu: 1 }] }));
  assert.match(krokHTML(w.kroki[0], 0), /class="[^"]*blad/);
});

test('krok z poziomu bez pomiaru jest oznaczony', () => {
  const w = symuluj(normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { tartak: 4 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 5 }],
  }));
  assert.match(krokHTML(w.kroki[0], 0), /niepewny/);
});

test('podsumowanie podaje laczny czas i sumy surowcow', () => {
  const w = symuluj(normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
  }));
  const html = podsumowanieHTML(w);
  assert.match(html, /Łączny czas/);
  assert.match(html, /115/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-strona.test.js`
Expected: FAIL — `wierszBudynkuHTML is not a function`

- [ ] **Step 3: Write the implementation**

`src/wioska/strona.js`:

```js
// src/wioska/strona.js
// Warstwa DOM. Funkcje budujace HTML sa czyste — logika prezentacji siedzi
// w nich i daje sie testowac bez przegladarki. uruchom() to tylko wpiecie zdarzen.

import { SWIATY, swiat } from './swiaty.js';
import { kosztPoziomu, ludnoscPoziomu, maksPoziom, budynkiSwiata, poziomyStartowe } from './swiat.js';
import { czasBudowy } from './czas.js';
import { brakujaceWymagania, opisWymagan } from './wymagania.js';
import { normalizujPlan, bledyPlanu } from './plan.js';
import { symuluj } from './symulacja.js';
import { czasCzytelny, planJSON, planTekst } from './format.js';
import { NAZWY, NAZWY_SUROWCOW } from './nazwy.js';

export const KLUCZ_MAGAZYNU = 'plemiona-wioska';

const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function wierszBudynkuHTML(s, budynek, poziomy, poziomRatusza) {
  const obecny = poziomy[budynek] ?? 0;
  const nazwa = NAZWY[budynek] ?? budynek;
  const maks = maksPoziom(s, budynek);
  if (obecny >= maks) {
    return `<tr><td>${esc(nazwa)}<br><small>Poziom ${obecny}</small></td>`
      + `<td colspan="6"><em>Budynek całkowicie rozbudowany</em></td></tr>`;
  }
  const docelowy = obecny + 1;
  const k = kosztPoziomu(s, budynek, docelowy);
  const { sekundy, pewny } = czasBudowy(s, budynek, docelowy, poziomRatusza);
  const ludnosc = ludnoscPoziomu(s, budynek, docelowy) - ludnoscPoziomu(s, budynek, obecny);
  const brak = brakujaceWymagania(budynek, poziomy);
  const zablokowany = brak.length > 0;
  const przycisk = zablokowany
    ? `<button disabled>Poziom ${docelowy}</button><div class="powod">${esc(opisWymagan(brak, NAZWY))}</div>`
    : `<button data-dodaj="${esc(budynek)}">Poziom ${docelowy}</button>`;
  return `<tr class="${zablokowany ? 'zablokowany' : ''}">`
    + `<td>${esc(nazwa)}<br><small>${obecny === 0 ? 'nie istnieje' : `Poziom ${obecny}`}</small></td>`
    + `<td>${k.drewno}</td><td>${k.glina}</td><td>${k.zelazo}</td>`
    + `<td class="${pewny ? '' : 'niepewny'}">${pewny ? '' : '≈ '}${czasCzytelny(sekundy)}</td>`
    + `<td>${ludnosc}</td><td>${przycisk}</td></tr>`;
}

export function krokHTML(krok, indeks) {
  const nazwa = `${NAZWY[krok.budynek] ?? krok.budynek} → ${krok.doPoziomu}`;
  const klasy = ['krok'];
  if (krok.blad) klasy.push('blad');
  if (!krok.pewny) klasy.push('niepewny');
  const czekanie = krok.czekanieS > 0
    ? `<div class="czekanie">czeka ${czasCzytelny(krok.czekanieS)} na ${NAZWY_SUROWCOW[krok.czekanieNa] ?? krok.czekanieNa}</div>`
    : '';
  return `<li class="${klasy.join(' ')}" draggable="true" data-krok="${indeks}">`
    + `<span class="nr">${indeks + 1}</span>`
    + `<span class="opis">${esc(nazwa)}${czekanie}</span>`
    + `<span class="czas">${czasCzytelny(krok.startS)} · ${krok.pewny ? '' : '≈ '}${czasCzytelny(krok.trwanieS)}</span>`
    + `<button data-usun="${indeks}" title="Usuń">×</button></li>`;
}

export function podsumowanieHTML(wynik) {
  const { czasS, koszt, zmarnowane, zZastrzykow, czasNiepewnyS } = wynik.podsumowanie;
  const linie = [
    `<div><b>Łączny czas:</b> ${czasCzytelny(czasS)}</div>`,
    `<div><b>Surowce:</b> ${koszt.drewno} drewna · ${koszt.glina} gliny · ${koszt.zelazo} żelaza</div>`,
  ];
  if (zZastrzykow.drewno || zZastrzykow.glina || zZastrzykow.zelazo) {
    linie.push(`<div><b>Z dosyłek:</b> ${zZastrzykow.drewno} · ${zZastrzykow.glina} · ${zZastrzykow.zelazo}</div>`);
  }
  if (zmarnowane.drewno || zmarnowane.glina || zmarnowane.zelazo) {
    linie.push(`<div><b>Zmarnowane przez pełny spichlerz:</b> ${zmarnowane.drewno} · ${zmarnowane.glina} · ${zmarnowane.zelazo}</div>`);
  }
  if (czasNiepewnyS > 0) {
    const proc = Math.round(czasNiepewnyS / Math.max(1, czasS) * 100);
    linie.push(`<div class="niepewny">${proc}% czasu pochodzi z poziomów bez pomiaru (oznaczone ≈)</div>`);
  }
  return linie.join('');
}

export function uruchom() {
  if (typeof document === 'undefined') return;

  const $ = (id) => document.getElementById(id);
  let plan = wczytajPlan();

  function wczytajPlan() {
    try {
      const zapis = localStorage.getItem(KLUCZ_MAGAZYNU);
      if (zapis) return normalizujPlan(JSON.parse(zapis));
    } catch { /* uszkodzony zapis nie moze blokowac strony */ }
    return normalizujPlan({ swiat: 'pl231' });
  }

  function zapisz() {
    try { localStorage.setItem(KLUCZ_MAGAZYNU, planJSON(plan)); } catch { /* tryb prywatny */ }
  }

  // Poziomy w danym momencie kolejki — tabela budynkow pokazuje stan po
  // wszystkich krokach, zeby kolejne kilkniecie dokladalo nastepny poziom.
  function poziomyPoKolejce() {
    const p = { ...plan.start.poziomy };
    for (const k of plan.kroki) p[k.budynek] = k.doPoziomu;
    return p;
  }

  function rysuj() {
    const s = swiat(plan.swiat);
    const poziomy = poziomyPoKolejce();
    $('tabela-budynkow').tBodies[0].innerHTML = budynkiSwiata(s)
      .map(b => wierszBudynkuHTML(s, b, poziomy, poziomy.ratusz ?? 1)).join('');

    const bledy = bledyPlanu(plan);
    const wynik = bledy.length ? { kroki: [], ostrzezenia: [], podsumowanie: { czasS: 0, koszt: { drewno: 0, glina: 0, zelazo: 0 }, zZastrzykow: { drewno: 0, glina: 0, zelazo: 0 }, zmarnowane: { drewno: 0, glina: 0, zelazo: 0 }, czasNiepewnyS: 0 } } : symuluj(plan);
    $('lista-krokow').innerHTML = wynik.kroki.map(krokHTML).join('');
    $('podsumowanie').innerHTML = podsumowanieHTML(wynik);
    $('ostrzezenia').innerHTML = [...bledy.map(b => `<li>${esc(b)}</li>`),
      ...wynik.ostrzezenia.map(o => `<li>${esc(o.tekst)}</li>`)].join('');
    zapisz();
  }

  function pytajOLiczbe(etykieta) {
    const v = prompt(etykieta, '0');
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  document.addEventListener('click', (e) => {
    const dodaj = e.target.closest('[data-dodaj]');
    if (dodaj) {
      const budynek = dodaj.dataset.dodaj;
      const poziomy = poziomyPoKolejce();
      plan.kroki.push({ budynek, doPoziomu: (poziomy[budynek] ?? 0) + 1 });
      rysuj();
      return;
    }
    const usun = e.target.closest('[data-usun]');
    if (usun) {
      plan.kroki.splice(Number(usun.dataset.usun), 1);
      // Po usunieciu srodkowego kroku poziomy docelowe przestaja byc ciagle.
      przelicz();
      rysuj();
    }
  });

  // Kroki trzymaja poziom docelowy, wiec po zmianie kolejnosci trzeba je
  // ponumerowac od nowa — inaczej plan przestaje byc poprawny.
  function przelicz() {
    const poziomy = { ...plan.start.poziomy };
    for (const k of plan.kroki) {
      k.doPoziomu = (poziomy[k.budynek] ?? 0) + 1;
      poziomy[k.budynek] = k.doPoziomu;
    }
  }

  $('dodaj-dochod').addEventListener('click', () => {
    const czasS = pytajOLiczbe('Od której godziny obowiązuje (w godzinach od startu)?') * 3600;
    plan.dochody.push({
      czasS,
      drewnoH: pytajOLiczbe('Drewno na godzinę'),
      glinaH: pytajOLiczbe('Glina na godzinę'),
      zelazoH: pytajOLiczbe('Żelazo na godzinę'),
    });
    plan.dochody.sort((a, b) => a.czasS - b.czasS);
    rysuj();
  });

  $('dodaj-zastrzyk').addEventListener('click', () => {
    const czasS = pytajOLiczbe('W której godzinie od startu przychodzi dosyłka?') * 3600;
    plan.zastrzyki.push({
      czasS,
      drewno: pytajOLiczbe('Drewno'),
      glina: pytajOLiczbe('Glina'),
      zelazo: pytajOLiczbe('Żelazo'),
    });
    plan.zastrzyki.sort((a, b) => a.czasS - b.czasS);
    rysuj();
  });

  $('kopiuj-json').addEventListener('click', () => navigator.clipboard.writeText(planJSON(plan)));
  $('kopiuj-tekst').addEventListener('click', () => navigator.clipboard.writeText(planTekst(plan, symuluj(plan))));

  $('wklej-json').addEventListener('click', () => {
    $('modal').hidden = false;
    $('modal-pole').value = '';
    $('modal-pole').focus();
  });
  $('modal-anuluj').addEventListener('click', () => { $('modal').hidden = true; });
  $('modal-ok').addEventListener('click', () => {
    try {
      plan = normalizujPlan(JSON.parse($('modal-pole').value));
      $('modal').hidden = true;
      rysuj();
    } catch (err) {
      $('modal-info').textContent = `Nie udało się wczytać: ${err.message}`;
    }
  });

  $('wyczysc').addEventListener('click', () => {
    plan = normalizujPlan({ swiat: plan.swiat, start: plan.start });
    rysuj();
  });

  for (const pole of ['drewno', 'glina', 'zelazo']) {
    $(`start-${pole}`).addEventListener('change', (e) => {
      plan.start.surowce[pole] = Number(e.target.value) || 0;
      rysuj();
    });
  }

  $('swiat').innerHTML = Object.values(SWIATY)
    .map(s => `<option value="${s.kod}">${esc(s.nazwa)}</option>`).join('');
  $('swiat').value = plan.swiat;
  $('swiat').addEventListener('change', (e) => {
    plan = normalizujPlan({ swiat: e.target.value });
    plan.start.poziomy = poziomyStartowe(swiat(e.target.value));
    rysuj();
  });

  for (const pole of ['drewno', 'glina', 'zelazo']) $(`start-${pole}`).value = plan.start.surowce[pole];
  rysuj();
}

uruchom();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/wioska-strona.test.js`
Expected: PASS, 8 testów

- [ ] **Step 5: Verify the page in a browser**

```bash
node build.js
```

Otwórz `dist/wioska/index.html` z dysku. Sprawdź kolejno:
1. Tabela budynków pokazuje Ratusz na poziomie 1, Koszary wyszarzone z „Wymaga: Ratusz 3".
2. Kliknięcie „Poziom 2" przy Tartaku dokłada krok do kolejki, a wiersz Tartaku przeskakuje na poziom 2.
3. Podsumowanie pokazuje niezerowy łączny czas.
4. „Kopiuj JSON" wkleja się z powrotem przez „Wklej JSON" i odtwarza tę samą kolejkę.
5. Odświeżenie strony zachowuje kolejkę.

- [ ] **Step 6: Commit**

```bash
git add src/wioska/strona.js test/wioska-strona.test.js
git commit -m "feat: interfejs symulatora — tabela budynkow i kolejka jako os czasu"
```

---

### Task 11: Narzędziownik — rozdzielnik, README, nazwa pakietu

**Files:**
- Create: `src/rozdzielnik.template.html`
- Modify: `build.js`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `test/build.test.js`

**Interfaces:**
- Consumes: nic
- Produces: `buildRozdzielnik()` → `string`, zapisywany do `dist/index.html`

**Kontekst:** dziś `dist/index.html` to dashboard PP. Po tej zmianie strona
główna jest rozdzielnikiem, a dashboard przenosi się pod `dist/pp/`. Trzeba
zmienić także link powrotny w `buildLanding` (`href="../"` → `href="../pp/"`).

- [ ] **Step 1: Write the failing test**

Dopisz do `test/build.test.js`:

```js
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
```

i dopisz `buildRozdzielnik, buildLanding` do importu z `../build.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build.test.js`
Expected: FAIL — `buildRozdzielnik is not a function`

- [ ] **Step 3: Write the router page**

`src/rozdzielnik.template.html`:

```html
<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Narzędziownik — Plemiona</title>
<style>
  :root{--w:#2c2015;--w2:#170f08;--pg:#f4ead2;--ink:#38291a;--ink2:#6b543a;--acc:#7c2b2b;--gold:#a8842c;--line:#c4ac7c}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);
    background:radial-gradient(ellipse at 50% -10%,#3a2c1c,var(--w) 45%,var(--w2)) fixed;min-height:100vh}
  .wrap{width:90%;max-width:860px;margin:0 auto;padding:44px 0 60px}
  header{text-align:center;color:#f6ecd4;margin-bottom:30px}
  .eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:.74rem;color:var(--gold)}
  h1{margin:.15em 0 .2em;font-size:2rem}
  header p{color:var(--line);margin:0}
  .karty{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
  a.karta{display:block;background:var(--pg);border:1px solid var(--line);border-radius:5px;
    padding:18px;text-decoration:none;color:var(--ink)}
  a.karta:hover{border-color:var(--acc)}
  a.karta h2{margin:0 0 6px;font-size:1.1rem;color:var(--acc)}
  a.karta p{margin:0;font-size:.88rem;color:var(--ink2)}
  footer{margin-top:34px;text-align:center;color:var(--line);font-size:.8rem}
</style>
</head>
<body>
<div class="wrap">
<header>
  <div class="eyebrow">Plemiona</div>
  <h1>Narzędziownik</h1>
  <p>Wszystko liczy się lokalnie w Twojej przeglądarce. Żadne dane nie wychodzą na zewnątrz.</p>
</header>

<div class="karty">
  <a class="karta" href="./wioska/">
    <h2>Symulator budowy wioski</h2>
    <p>Ułóż kolejność rozbudowy i zobacz, ile potrwa, ile pochłonie surowców i gdzie będziesz stał bezczynnie.</p>
  </a>
  <a class="karta" href="./kursy/">
    <h2>Kursy giełdy</h2>
    <p>Historia kursów per kontynent, progi i sygnały okazji.</p>
  </a>
  <a class="karta" href="./pp/">
    <h2>Analiza punktów premium</h2>
    <p>Bilans PP, arbitraż giełdowy i wydatki z logu premium.</p>
  </a>
  <a class="karta" href="./kolektor/">
    <h2>Kolektory</h2>
    <p>Bookmarklet do logu PP i userscript do kursów giełdy.</p>
  </a>
</div>

<footer>Prywatność: cała analiza dzieje się w Twojej przeglądarce (localStorage).</footer>
</div>
</body>
</html>
```

- [ ] **Step 4: Update build.js**

Dodaj funkcję:

```js
// Strona glowna narzedziownika — rozdzielnik do poszczegolnych narzedzi.
export function buildRozdzielnik() {
  return read('./src/rozdzielnik.template.html');
}
```

W `buildLanding` zamień `href="../"` na `href="../pp/"`.

W bloku zapisu zamień wiersz zapisujący dashboard i dopisz rozdzielnik:

```js
  mkdirSync(new URL('./dist/pp/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./dist/index.html', import.meta.url), buildRozdzielnik());
  writeFileSync(new URL('./dist/pp/index.html', import.meta.url), buildDashboard());
```

- [ ] **Step 5: Update package.json and README**

`package.json` — zmień pole `name`:

```json
  "name": "plemiona-narzedziownik",
```

`README.md` — zamień pierwsze dwa akapity na:

```markdown
# Narzędziownik — Plemiona

Prywatny zestaw narzędzi do gry Plemiona.pl. Wszystko liczy się **lokalnie
w Twojej przeglądarce** — żadne dane nie trafiają na serwer.

- **Symulator budowy wioski** (`/wioska/`) — układasz kolejność rozbudowy,
  narzędzie symuluje oś czasu z produkcją surowców, pojemnością spichlerza
  i Twoimi dosyłkami, i mówi, gdzie kolejka stoi bezczynnie.
- **Kursy giełdy** (`/kursy/`) — historia kursów per kontynent i sygnały okazji.
- **Analiza punktów premium** (`/pp/`) — bilans PP, arbitraż i wydatki z logu.
- **Kolektory** (`/kolektor/`) — bookmarklet do logu PP i userscript do kursów.
```

W sekcji „Budowanie" dopisz pod blokiem z komendami:

```markdown
Symulator ma też tryb bez przeglądarki — ten sam silnik, ta sama arytmetyka:

```bash
node tools/plan.js plan.json          # symulacja planu z pliku
node tools/kalibracja.js strona.html  # tabela G z zapisanego ekranu Ratusza
node tools/fetch-swiat.js pl231       # dane nowego świata
```
```

- [ ] **Step 6: Run the full test suite and build**

Run: `node --test && node build.js`
Expected: wszystkie testy PASS; `dist/` zawiera `index.html`, `pp/index.html`, `kursy/index.html`, `wioska/index.html`, `kolektor/index.html`, `kursy.user.js`

- [ ] **Step 7: Verify the deploy workflow still publishes the right root**

Run: `cat .github/workflows/deploy.yml`
Sprawdź, że workflow publikuje katalog `dist/` jako całość. Jeśli wskazuje na konkretny plik zamiast katalogu, popraw na `dist/`.

- [ ] **Step 8: Commit**

```bash
git add src/rozdzielnik.template.html build.js package.json README.md test/build.test.js
git commit -m "feat: strona glowna jako rozdzielnik narzedziownika"
```

---

## Self-Review

**Pokrycie specyfikacji:**

| Wymaganie ze specyfikacji | Task |
|---|---|
| Dane świata z `interface.php`, koszty ze wzoru | 1 |
| Tabele uniwersalne (produkcja, spichlerz, zagroda, schowek, kupcy) | 2 |
| Czas budowy, tabela `G`, minimum 10 s, wyjątek Muru | 3 |
| `tools/kalibracja.js` z poprawką na kolejkę budowy | 4 |
| Wymagania między budynkami | 5 |
| Model planu jako czysty JSON | 6 |
| Symulacja osi czasu, magazyn z sufitem, wtrącenia gracza | 7 |
| Diagnostyka: przestój, przepełnienie, ponad spichlerz, ponad zagroda, wymagania | 7 |
| Eksport tekst + JSON, CLI | 8 |
| Strona wzorowana na ekranie Ratusza, wpięcie w build | 9, 10 |
| Oznaczenie poziomów bez pomiaru | 3, 7, 10 |
| Rozdzielnik, README, nazwa pakietu | 11 |

**Świadomie poza planem:** rekrutacja jednostek, natywny format szablonu
Menedżera Konta, automatyczny optymalizator kolejności, wiele wiosek naraz,
burzenie budynków. Wszystkie są w specyfikacji wymienione jako poza zakresem v1.

**Znane założenia do potwierdzenia w trakcie:** produkcja kopalni na poziomie 0
przyjęta jako zero (`src/wioska/tabele.js`), dzielenie czasu budowy przez
prędkość świata niepotwierdzone obserwacyjnie (świat 231 ma prędkość 1).
