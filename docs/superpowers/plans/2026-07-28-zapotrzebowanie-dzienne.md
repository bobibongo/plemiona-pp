# Zapotrzebowanie dzienne — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać `zapotrzebowanieDzienne(plan)` w `src/wioska/zapotrzebowanie.js`, rozkładającą koszt budowy na kolejne dni osi bez przestojów — surowy rozkład zapotrzebowania w czasie, bez dochodu, dosyłek, magazynu ani realnego czasu z symulacji.

**Architecture:** Jedna czysta funkcja obok istniejących `osBezPrzestojow` i `zuzycieNaDobe` w tym samym module. Dzieli oś bez przestojów na okna 24-godzinne liczone od startu planu (nie od dowolnego punktu jak `zuzycieNaDobe`), przypisuje każdy krok w całości do dnia jego startu i sumuje koszty w oknie.

**Tech Stack:** Node.js ≥ 20 (wbudowany `node:test`), czysty ESM, zero zależności runtime, zero zależności deweloperskich.

**Spec:** `docs/superpowers/specs/2026-07-28-zapotrzebowanie-dzienne-design.md`

## Global Constraints

- **Zero zależności.** Nie wolno dodać niczego do `package.json` poza skryptami.
- **Strona samowystarczalna.** Żadnego `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `<script src>`, `<link rel=stylesheet>` ani adresów `http`/`https` poza `www.w3.org` w kodzie sklejanym do strony.
- **Testy** przez `node --test`, pliki `test/*.test.js`, `import { test } from 'node:test'` i `import assert from 'node:assert/strict'`.
- **Język.** Nazwy i komentarze po polsku, **bez polskich znaków w identyfikatorach**. Komentarze wyjaśniają *dlaczego*, nie *co*.
- **Każdy plik w `src/` zaczyna się komentarzem ze swoją ścieżką.**
- **Nazwy najwyższego poziomu unikalne w całym repozytorium** — `build.js` skleja moduły `src/wioska/*.js` w jeden wspólny zakres. Kolizja to błąd składni w przeglądarce, którego testy Node nie wyłapią.
- **Każdy `import` w jednej linii.**
- **Czas w sekundach.** `DOBA_S = 86400` jest już zdefiniowane w `zapotrzebowanie.js` — użyj go, nie duplikuj.

**Stan wyjściowy:** gałąź `symulator-wioski`, 286 testów przechodzi, `node build.js` generuje `dist/wioska/index.html` wśród pięciu stron.

---

### Task 1: `zapotrzebowanieDzienne` w module zapotrzebowania

**Files:**
- Modify: `src/wioska/zapotrzebowanie.js`
- Test: `test/wioska-zapotrzebowanie.test.js`

**Interfaces:**
- Consumes: `osBezPrzestojow(plan)` — już istnieje w tym samym pliku, zwraca `[{ budynek, doPoziomu, startS, trwanieS, koszt: { drewno, glina, zelazo } }, ...]`; stała `DOBA_S = 86400`.
- Produces: `zapotrzebowanieDzienne(plan)` → `[{ dzien, drewno, glina, zelazo, liczbaKrokow }, ...]`, gdzie `dzien` to indeks liczony od zera, długość tablicy to `Math.ceil(czasNettoS / DOBA_S)` (0 dla planu bez kroków).

**Kontekst.** Krok trafia w całości do dnia `Math.floor(startS / DOBA_S)` — tak jak `zuzycieNaDobe` liczy cały koszt kroku w oknie, w którym ten krok startuje, niezależnie ile trwa. Dzień bez startującego kroku (bo poprzedni krok jest bardzo długi) dostaje wiersz zerowy — tablica ma tyle elementów, ile dni obejmuje `czasNettoS`, bez dziur w numeracji.

`czasNettoS` dla pustej osi to 0, więc `Math.ceil(0 / DOBA_S) === 0` — pusty plan daje pustą tablicę, żadnego wiersza „dzień 0".

- [ ] **Step 1: Write the failing tests**

Dopisz na końcu `test/wioska-zapotrzebowanie.test.js`:

```js
test('zapotrzebowanie dzienne dla planu w jednym dniu daje jeden wiersz z pelna suma', () => {
  const p = plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }] });
  const dni = zapotrzebowanieDzienne(p);
  const os = osBezPrzestojow(p);
  assert.equal(dni.length, 1);
  assert.equal(dni[0].dzien, 0);
  assert.equal(dni[0].liczbaKrokow, 2);
  assert.equal(dni[0].drewno, os[0].koszt.drewno + os[1].koszt.drewno);
  assert.equal(dni[0].glina, os[0].koszt.glina + os[1].koszt.glina);
  assert.equal(dni[0].zelazo, os[0].koszt.zelazo + os[1].koszt.zelazo);
});

test('zapotrzebowanie dzienne rozklada kroki na wlasciwe dni po starcie', () => {
  const kroki = [];
  for (let i = 1; i <= 20; i++) kroki.push({ budynek: 'ratusz', doPoziomu: i });
  const p = plan({ kroki });
  const os = osBezPrzestojow(p);
  const dni = zapotrzebowanieDzienne(p);
  const oczekiwaneDni = Math.ceil((os[os.length - 1].startS + os[os.length - 1].trwanieS) / 86400);
  assert.equal(dni.length, oczekiwaneDni);
  for (const wiersz of dni) assert.ok(wiersz.dzien >= 0 && wiersz.dzien < dni.length);
});

test('zapotrzebowanie dzienne: suma po wszystkich dniach rowna sumie kosztow wszystkich krokow', () => {
  const kroki = [];
  for (let i = 1; i <= 15; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const p = plan({ kroki });
  const os = osBezPrzestojow(p);
  const dni = zapotrzebowanieDzienne(p);
  const oczekiwany = { drewno: 0, glina: 0, zelazo: 0 };
  for (const w of os) { oczekiwany.drewno += w.koszt.drewno; oczekiwany.glina += w.koszt.glina; oczekiwany.zelazo += w.koszt.zelazo; }
  const suma = { drewno: 0, glina: 0, zelazo: 0 };
  for (const w of dni) { suma.drewno += w.drewno; suma.glina += w.glina; suma.zelazo += w.zelazo; }
  assert.deepEqual(suma, oczekiwany);
});

test('zapotrzebowanie dzienne: dzien bez startujacego kroku ma wiersz zerowy, nie jest pominiety', () => {
  // Ratusz do poziomu 30 od poziomu 1 trwa ok. 55h (ponad dwie doby) — dzien 1
  // nie ma zadnego startu, ale musi byc obecny w tablicy jako wiersz zerowy.
  const p = plan({ start: { poziomy: { ratusz: 1 } }, kroki: [{ budynek: 'ratusz', doPoziomu: 30 }, { budynek: 'tartak', doPoziomu: 1 }] });
  const os = osBezPrzestojow(p);
  assert.ok(os[0].trwanieS > 86400, 'test zaklada krok dluzszy niz doba — dostosuj plan, jesli tabele swiata sie zmienily');
  const dni = zapotrzebowanieDzienne(p);
  assert.equal(dni[0].liczbaKrokow, 1);
  assert.equal(dni[1].liczbaKrokow, 0);
  assert.deepEqual({ drewno: dni[1].drewno, glina: dni[1].glina, zelazo: dni[1].zelazo }, { drewno: 0, glina: 0, zelazo: 0 });
});

test('zapotrzebowanie dzienne dla pustego planu jest pusta tablica', () => {
  const p = plan({});
  assert.deepEqual(zapotrzebowanieDzienne(p), []);
});
```

Zaktualizuj import na górze pliku, dodając nową funkcję do listy importowanej z `../src/wioska/zapotrzebowanie.js`:

```js
import { zapotrzebowanie, osBezPrzestojow, zuzycieNaDobe, zapotrzebowanieDzienne } from '../src/wioska/zapotrzebowanie.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/wioska-zapotrzebowanie.test.js`
Expected: FAIL — `zapotrzebowanieDzienne is not a function` (albo błąd importu, bo eksport jeszcze nie istnieje).

- [ ] **Step 3: Implement `zapotrzebowanieDzienne`**

W `src/wioska/zapotrzebowanie.js` dodaj funkcję po `zuzycieNaDobe` (na końcu pliku):

```js
export function zapotrzebowanieDzienne(plan) {
  const os = osBezPrzestojow(plan);
  if (os.length === 0) return [];

  const ostatni = os[os.length - 1];
  const czasNettoS = ostatni.startS + ostatni.trwanieS;
  const liczbaDni = Math.ceil(czasNettoS / DOBA_S);

  const dni = [];
  for (let i = 0; i < liczbaDni; i++) {
    dni.push({ dzien: i, drewno: 0, glina: 0, zelazo: 0, liczbaKrokow: 0 });
  }

  for (const wiersz of os) {
    const indeksDnia = Math.floor(wiersz.startS / DOBA_S);
    const cel = dni[indeksDnia];
    cel.liczbaKrokow += 1;
    for (const r of SUROWCE_Z) cel[r] += wiersz.koszt[r];
  }

  return dni;
}
```

To korzysta z już zdefiniowanej w pliku stałej `SUROWCE_Z = ['drewno', 'glina', 'zelazo']` i `DOBA_S = 86400` — nie duplikuj tych stałych.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/wioska-zapotrzebowanie.test.js`
Expected: PASS w komplecie.

- [ ] **Step 5: Run the full suite**

Run: `node --test`
Expected: PASS w komplecie (291 testów: 286 dotychczasowych + 5 nowych).

- [ ] **Step 6: Commit**

```bash
git add src/wioska/zapotrzebowanie.js test/wioska-zapotrzebowanie.test.js
git commit -m "feat: rozklad zapotrzebowania na dni osi bez przestojow"
```

---

## Self-Review

**Pokrycie specyfikacji:**

| Wymaganie ze specyfikacji | Task |
|---|---|
| Nowa funkcja `zapotrzebowanieDzienne(plan)` | 1 |
| Rozkład na okna 24h liczone od startu planu (dzień 0, 1, 2, ...) | 1 |
| Krok w całości do dnia startu | 1 |
| Pełna liczba dni, dzień bez startu = wiersz zerowy, nie pominięty | 1 |
| Ostatni dzień może być niepełny, ale obecny | 1 |
| Plan bez kroków → pusta tablica | 1 |
| Bez dochodu, dosyłek, magazynu, realnego czasu | 1 (funkcja czyta wyłącznie `osBezPrzestojow`) |
| Testy: jeden dzień, wiele dni, krok dłuższy niż doba, suma zgodna z osią, plan pusty | 1 |

**Świadomie poza planem:** podpięcie pod kolejkę i pasek stanu, uwzględnienie dochodu/dosyłek/magazynu, poprawa `waskieGardlo` — kolejne rundy zgodnie ze spec.
