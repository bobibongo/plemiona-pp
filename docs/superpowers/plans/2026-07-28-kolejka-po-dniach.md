# Kolejka podzielona na dni — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wstawić separator dnia między krokami kolejki, gdy przechodzą na kolejny dzień osi bez przestojów, z treścią wziętą z `zapotrzebowanieDzienne(plan)`.

**Architecture:** Cała logika składania listy kolejki (kroki, wtrącenia, separatory dni) przenosi się z nietestowanego `kolejkaHTML` w `strona.js` do nowej, czystej, eksportowanej funkcji `kolejkaHTML(plan, wynik, zaznaczony)` w `widok-kolejka.js` — obok istniejących `krokHTML` i `wtracenieHTML`, testowalna bez DOM tak jak reszta modułów `widok-*.js`. `strona.js` zostaje cienkim wywołującym.

**Tech Stack:** Node.js ≥ 20 (wbudowany `node:test`), czysty ESM, zero zależności runtime, zero zależności deweloperskich.

**Spec:** `docs/superpowers/specs/2026-07-28-kolejka-po-dniach-design.md`

## Global Constraints

- **Zero zależności.** Nie wolno dodać niczego do `package.json` poza skryptami.
- **Strona samowystarczalna.** Żadnego `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `<script src>`, `<link rel=stylesheet>` ani adresów `http`/`https` poza `www.w3.org` w kodzie sklejanym do strony.
- **Testy** przez `node --test`, pliki `test/*.test.js`, `import { test } from 'node:test'` i `import assert from 'node:assert/strict'`.
- **Język.** Nazwy i komentarze po polsku, **bez polskich znaków w identyfikatorach**. Komentarze wyjaśniają *dlaczego*, nie *co*.
- **Każdy plik w `src/` zaczyna się komentarzem ze swoją ścieżką.**
- **Nazwy najwyższego poziomu unikalne w całym repozytorium** — `build.js` skleja moduły `src/wioska/*.js` w jeden wspólny zakres. Kolizja to błąd składni w przeglądarce, którego testy Node nie wyłapią.
- **Każdy `import` w jednej linii.**
- **Czas w sekundach.**

**Stan wyjściowy:** gałąź `symulator-wioski`, 291 testów przechodzi, `node build.js` generuje `dist/wioska/index.html` wśród pięciu stron.

---

### Task 1: `naglowekDniaHTML` w `widok-kolejka.js`

**Files:**
- Modify: `src/wioska/widok-kolejka.js`
- Test: `test/wioska-widoki.test.js`

**Interfaces:**
- Consumes: element z `zapotrzebowanieDzienne(plan)` — `{ dzien, drewno, glina, zelazo, liczbaKrokow }` (patrz `src/wioska/zapotrzebowanie.js`, funkcja już istnieje z poprzedniej rundy).
- Produces: `naglowekDniaHTML(wiersz)` → string `<li>` z klasą `naglowek-dnia`.

**Kontekst.** Numer dnia wyświetlany graczowi to `wiersz.dzien + 1` (dni liczone od 1, jak kroki w `krokHTML`). Zaokrąglanie surowców przez `Math.round` — plan może mieć ułamkowe sumy dobowe podzielone przez trzy (patrz `widok-bilans.js`, ten sam wzorzec).

- [ ] **Step 1: Write the failing test**

Dopisz do `test/wioska-widoki.test.js`, po istniejących testach `wtracenieHTML`. Najpierw rozszerz import na górze pliku:

```js
import { krokHTML, wtracenieHTML, naglowekDniaHTML, kolejkaHTML } from '../src/wioska/widok-kolejka.js';
```

(Import `kolejkaHTML` jest tu, bo Task 2 tego samego pliku dopisze dla niej testy w tym samym bloku importu — patrz Task 2.)

```js
test('naglowek dnia pokazuje numer od jednego, sume surowcow i liczbe krokow', () => {
  const html = naglowekDniaHTML({ dzien: 2, drewno: 12000, glina: 8000, zelazo: 5000, liczbaKrokow: 4 });
  assert.match(html, /Dzień 3/);
  assert.match(html, /12\s?000/);
  assert.match(html, /8\s?000/);
  assert.match(html, /5\s?000/);
  assert.match(html, /4/);
});

test('naglowek pustego dnia pokazuje zera i nie wyglada jak krok', () => {
  const html = naglowekDniaHTML({ dzien: 3, drewno: 0, glina: 0, zelazo: 0, liczbaKrokow: 0 });
  assert.match(html, /Dzień 4/);
  assert.match(html, /class="naglowek-dnia"/);
  assert.doesNotMatch(html, /data-krok=/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-widoki.test.js`
Expected: FAIL — `naglowekDniaHTML is not a function` (i `kolejkaHTML is not a function`, bo oba importy jeszcze nie istnieją; to oczekiwane, Task 2 dopiero doda drugą funkcję).

- [ ] **Step 3: Implement `naglowekDniaHTML`**

W `src/wioska/widok-kolejka.js` dodaj na końcu pliku:

```js
export function naglowekDniaHTML(wiersz) {
  return `<li class="naglowek-dnia">Dzień ${wiersz.dzien + 1} · `
    + `${Math.round(wiersz.drewno)} / ${Math.round(wiersz.glina)} / ${Math.round(wiersz.zelazo)} · `
    + `${wiersz.liczbaKrokow} ${wiersz.liczbaKrokow === 1 ? 'krok' : 'kroki'}</li>`;
}
```

- [ ] **Step 4: Run test to verify `naglowekDniaHTML` tests pass**

Run: `node --test test/wioska-widoki.test.js`
Expected: testy `naglowek dnia...` PASS. Testy odwołujące się do `kolejkaHTML` nadal FAIL (Task 2) — to oczekiwane na tym etapie, nie cofaj się.

- [ ] **Step 5: Commit**

```bash
git add src/wioska/widok-kolejka.js test/wioska-widoki.test.js
git commit -m "feat: naglowek dnia dla kolejki budowy"
```

---

### Task 2: Przeniesienie `kolejkaHTML` do `widok-kolejka.js` z separatorami dni

**Files:**
- Modify: `src/wioska/widok-kolejka.js`
- Modify: `src/wioska/strona.js`
- Test: `test/wioska-widoki.test.js`

**Interfaces:**
- Consumes: `krokHTML(krok, indeks, zaznaczony)`, `wtracenieHTML(rodzaj, wpis, przedKrokiem, indeksWTablicy)`, `naglowekDniaHTML(wiersz)` — wszystkie już w tym pliku po Task 1; `osBezPrzestojow(plan)` i `zapotrzebowanieDzienne(plan)` z `./zapotrzebowanie.js`.
- Produces: `kolejkaHTML(plan, wynik, zaznaczony)` → string całej listy `<li>` (separatory dni + wtrącenia + kroki), eksportowana z `widok-kolejka.js`. Zastępuje nieeksportowaną funkcję o tej samej nazwie dotąd żyjącą w `strona.js`.

**Kontekst — dlaczego przenosimy, nie tylko rozszerzamy w miejscu.** Dzisiejsza `kolejkaHTML` w `strona.js` nie jest eksportowana i nie ma testów — `strona.js` w ogóle nie jest testowane poza sprawdzeniem, że `uruchom()` nie wybucha bez DOM (`test/wioska-strona.test.js`). Cała reszta warstwy widoku (`widok-budynki.js`, `widok-kolejka.js`, `widok-status.js`, `widok-bilans.js`) jest testowana bezpośrednio, bez przeglądarki. Dodanie separatorów dni to wystarczająco dużo nowej logiki (mapowanie kroku na dzień, wstawianie brakujących dni pustych), żeby zasługiwała na te same testy — zostawienie jej w `strona.js` uczyniłoby ją praktycznie nietestowaną.

**Algorytm.** Dla każdego kroku `i` w `wynik.kroki`:
1. Policz `os = osBezPrzestojow(plan)` i `dni = zapotrzebowanieDzienne(plan)` raz, na początku funkcji.
2. `dzienKroku(i) = Math.floor(os[i].startS / DOBA_S)` — ale `DOBA_S` nie jest eksportowane z `zapotrzebowanie.js`, więc licz to porównawczo: śledź `ostatniDzien` (dzień poprzedniego kroku, startuje na `-1`) i dla każdego kroku wylicz jego dzień przez podział `os[i].startS` przez `86400` (stała lokalna w `widok-kolejka.js`, bo to prosta, samo-opisująca się liczba sekund w dobie — nie wymaga importu z modułu, który jej nie eksportuje).
3. Gdy `dzienKroku(i) > ostatniDzien`: dla każdego brakującego dnia od `ostatniDzien + 1` do `dzienKroku(i)` włącznie wstaw `naglowekDniaHTML(dni[ten dzien])`, potem zaktualizuj `ostatniDzien = dzienKroku(i)`. To pokrywa zarówno zwykłe przejście o jeden dzień, jak i dni puste (przeskok o więcej niż jeden).
4. Wtrącenia wplatają się dokładnie tak jak dziś: przed krokiem `i`, jeśli ich `indeksKotwicyStrony <= i - 1`, __zanim__ wstawiany jest ewentualny separator dnia dla kroku `i` (żeby wtrącenie kończące dzień N zostało przed nagłówkiem dnia N+1, zgodnie ze spec).
5. Po pętli, wtrącenia przypięte na koniec planu (indeks `-1` względem `length`, czyli te które zostały w `w < wtracenia.length` po pętli) idą na sam koniec, tak jak dziś — bez żadnego separatora po nich.

Krok 4 wymaga zmiany kolejności w pętli względem dzisiejszego kodu: dziś wtrącenia są wypisywane, *potem* krok. Nowa kolejność dla kroku `i`: **wtrącenia przed `i`, potem separator(y) dnia jeśli dzień się zmienił, potem krok `i`.**

- [ ] **Step 1: Write the failing tests**

Dopisz do `test/wioska-widoki.test.js` (import `kolejkaHTML` już dodany w Task 1 Step 1):

```js
test('kolejka bez wielu dni ma jeden naglowek dnia na starcie', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }] });
  const w = symuluj(p);
  const html = kolejkaHTML(p, w, null);
  const dopasowania = html.match(/naglowek-dnia/g) ?? [];
  assert.equal(dopasowania.length, 1);
  assert.match(html, /Dzień 1/);
});

test('kolejka wstawia naglowek przy kazdej zmianie dnia', () => {
  const kroki = [];
  for (let i = 1; i <= 20; i++) kroki.push({ budynek: 'ratusz', doPoziomu: i });
  const p = normalizujPlan({ swiat: 'pl231', kroki });
  const w = symuluj(p);
  const dni = zapotrzebowanieDzienne(p);
  const html = kolejkaHTML(p, w, null);
  const dopasowania = html.match(/naglowek-dnia/g) ?? [];
  assert.equal(dopasowania.length, dni.length);
  for (let d = 0; d < dni.length; d++) assert.match(html, new RegExp(`Dzień ${d + 1}\\b`));
});

test('kolejka pokazuje naglowek dla dnia bez zadnego startujacego kroku', () => {
  // Ratusz do poziomu 30 trwa ok. 55h (ponad dwie doby) — dzien 1 nie ma
  // zadnego startu, ale ma sie pojawic jego naglowek z zerami.
  const p = normalizujPlan({ swiat: 'pl231', start: { poziomy: { ratusz: 1 } }, kroki: [{ budynek: 'ratusz', doPoziomu: 30 }, { budynek: 'tartak', doPoziomu: 1 }] });
  const os = osBezPrzestojow(p);
  assert.ok(os[0].trwanieS > 86400, 'test zaklada krok dluzszy niz doba — dostosuj plan, jesli tabele swiata sie zmienily');
  const w = symuluj(p);
  const html = kolejkaHTML(p, w, null);
  assert.match(html, /Dzień 2 · 0 \/ 0 \/ 0 · 0 kroki/);
});

test('kolejka zachowuje kolejnosc: wtracenie na koncu dnia przed naglowkiem kolejnego', () => {
  const kroki = [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }];
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki,
    zastrzyki: [{ kotwica: { budynek: 'tartak', doPoziomu: 1 }, drewno: 100, glina: 0, zelazo: 0 }],
  });
  const os = osBezPrzestojow(p);
  const w = symuluj(p);
  const html = kolejkaHTML(p, w, null);
  const pozycjaWtracenia = html.indexOf('wtracenie');
  const pozycjaDrugiegoNaglowka = html.indexOf('naglowek-dnia', html.indexOf('naglowek-dnia') + 1);
  if (os[1].startS - os[0].startS >= 0 && Math.floor(os[1].startS / 86400) > Math.floor(os[0].startS / 86400)) {
    assert.ok(pozycjaWtracenia !== -1 && pozycjaDrugiegoNaglowka !== -1 && pozycjaWtracenia < pozycjaDrugiegoNaglowka,
      'wtracenie konczace dzien ma stac przed naglowkiem kolejnego dnia');
  } else {
    assert.equal(pozycjaDrugiegoNaglowka, -1, 'test zaklada dwa dni — dostosuj plan, jesli tabele swiata sie zmienily');
  }
});

test('kolejka pustego planu nie ma zadnego naglowka dnia', () => {
  const p = normalizujPlan({ swiat: 'pl231' });
  const w = symuluj(p);
  assert.equal(kolejkaHTML(p, w, null), '');
});
```

Zaktualizuj import na górze `test/wioska-widoki.test.js`, dodając brakujące zależności:

```js
import { normalizujPlan } from '../src/wioska/plan.js';
import { osBezPrzestojow, zapotrzebowanieDzienne } from '../src/wioska/zapotrzebowanie.js';
```

(`normalizujPlan` i `symuluj` mogą już być zaimportowane w pliku — sprawdź istniejące importy przed dopisaniem, żeby nie zdublować.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/wioska-widoki.test.js`
Expected: FAIL — `kolejkaHTML is not a function`.

- [ ] **Step 3: Implement `kolejkaHTML` in `widok-kolejka.js`**

Rozszerz import na górze `src/wioska/widok-kolejka.js`:

```js
import { NAZWY, NAZWY_SUROWCOW } from './nazwy.js';
import { esc, ikonaHTML } from './widok-budynki.js';
import { osBezPrzestojow, zapotrzebowanieDzienne } from './zapotrzebowanie.js';
```

Dodaj na końcu pliku (po `naglowekDniaHTML` z Task 1):

```js
// Nazwa DOBA_S jest juz zajeta w zapotrzebowanie.js — build.js skleja oba
// pliki w jeden wspolny zakres (patrz LOGIC w build.js), wiec druga stala
// o tej samej nazwie bylaby bledem skladni w przegladarce.
const DOBA_KOLEJKI_S = 86400;

function indeksKotwicyKolejki(kotwica, kroki) {
  if (kotwica === null) return -1;
  return kroki.findIndex(k => k.budynek === kotwica.budynek && k.doPoziomu === kotwica.doPoziomu);
}

// Kroki, wtracenia gracza i naglowki dni w jednej liscie. Wtracenie stoi
// zaraz po kroku, do ktorego kotwiczy — nawet gdy ten krok konczy dzien,
// wiec wtracenie ma wyladowac PRZED naglowkiem kolejnego dnia, nie po nim.
export function kolejkaHTML(plan, wynik, zaznaczony) {
  const os = osBezPrzestojow(plan);
  const dni = zapotrzebowanieDzienne(plan);
  const wtracenia = [
    ...plan.dochody.map((d, idx) => ({ i: indeksKotwicyKolejki(d.kotwica, plan.kroki), rodzaj: 'dochod', wpis: d, idx })),
    ...plan.zastrzyki.map((z, idx) => ({ i: indeksKotwicyKolejki(z.kotwica, plan.kroki), rodzaj: 'dosylka', wpis: z, idx })),
  ].sort((a, b) => a.i - b.i);

  let w = 0;
  let ostatniDzien = -1;
  const out = [];
  wynik.kroki.forEach((k, i) => {
    while (w < wtracenia.length && wtracenia[w].i <= i - 1) {
      const wpis = wtracenia[w];
      out.push(wtracenieHTML(wpis.rodzaj, wpis.wpis, i, wpis.idx));
      w += 1;
    }
    const dzienKroku = Math.floor(os[i].startS / DOBA_KOLEJKI_S);
    for (let d = ostatniDzien + 1; d <= dzienKroku; d++) out.push(naglowekDniaHTML(dni[d]));
    ostatniDzien = dzienKroku;
    out.push(krokHTML(k, i, i === zaznaczony));
  });
  while (w < wtracenia.length) {
    const wpis = wtracenia[w];
    out.push(wtracenieHTML(wpis.rodzaj, wpis.wpis, null, wpis.idx));
    w += 1;
  }
  return out.join('');
}
```

- [ ] **Step 4: Remove the old `kolejkaHTML` from `strona.js` and call the imported one**

W `src/wioska/strona.js` zmień import (linia z `krokHTML, wtracenieHTML`):

```js
import { kolejkaHTML } from './widok-kolejka.js';
```

Usuń całą starą definicję funkcji `kolejkaHTML` (dotychczasowa funkcja lokalna w `strona.js`, między `indeksKotwicyStrony` a `zaopatrzenieHTML`) — łącznie z pomocniczą `indeksKotwicyStrony`, która była używana wyłącznie przez nią (sprawdź przed usunięciem, że nic innego w pliku jej nie wywołuje — dziś jest wołana tylko wewnątrz starej `kolejkaHTML`).

W funkcji `rysuj()` zmień wywołanie:

```js
$('lista-krokow').innerHTML = kolejkaHTML(plan, wynik, zaznaczony);
```

(dotąd było `kolejkaHTML(wynik)` bez `plan` — nowa sygnatura przyjmuje `plan` jako pierwszy argument, bo funkcja licha `osBezPrzestojow`/`zapotrzebowanieDzienne` potrzebuje pełnego planu, nie tylko wyniku symulacji).

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/wioska-widoki.test.js`
Expected: PASS w komplecie.

- [ ] **Step 6: Run the full suite**

Run: `node --test`
Expected: PASS w komplecie (296 testów: 291 dotychczasowych + 2 z Task 1 + 5 z Task 2 — zwróć uwagę, że jeśli w Task 1 Step 2 `kolejkaHTML`-owe testy chwilowo failowały, teraz muszą przejść razem z resztą).

- [ ] **Step 7: Build and sanity-check the page**

Run: `node build.js`
Expected: kończy się bez błędów, wypisuje listę zbudowanych stron włącznie z `wioska/index.html`. To pilnuje, że sklejanie modułów (`src/wioska/*.js` w jeden zakres) nie ma kolizji nazw po przeniesieniu `kolejkaHTML` i dodaniu `DOBA_KOLEJKI_S`, `indeksKotwicyKolejki` do `widok-kolejka.js`.

- [ ] **Step 8: Commit**

```bash
git add src/wioska/widok-kolejka.js src/wioska/strona.js test/wioska-widoki.test.js
git commit -m "feat: podzial kolejki budowy na dni"
```

---

## Self-Review

**Pokrycie specyfikacji:**

| Wymaganie ze specyfikacji | Task |
|---|---|
| Separator dnia między krokami różnych dni | 2 |
| Treść separatora z `zapotrzebowanieDzienne` (numer, surowce, liczba kroków) | 1 |
| Numeracja dni od 1 | 1 |
| Dzień pusty pokazany, nie pomijany | 2 |
| Oś bez przestojów jako podstawa (nie realna z symulacji) | 2 (`osBezPrzestojow` do mapowania dzień↔krok) |
| Wtrącenie na granicy dni przed nagłówkiem następnego dnia | 2 |
| Testy: jeden dzień, wiele dni, dzień pusty, wtrącenie na granicy, plan pusty | 1, 2 |

**Świadomie poza planem:** realny bilans dzienny z dochodem/dosyłkami/magazynem, zwijanie/rozwijanie dni, nawigacja — zgodnie ze spec, kolejne rundy.

**Uwaga o kolejności zadań:** Task 1 musi iść przed Task 2, bo `kolejkaHTML` w Task 2 wywołuje `naglowekDniaHTML`. Import `kolejkaHTML` w teście jest dodany już w Task 1 Step 1 (dla jednego bloku importu), co celowo zostawia część testów czerwoną między Task 1 a Task 2 — to zaznaczone wprost w Step 4 Task 1, żeby wykonawca się nie zatrzymał, myśląc że coś poszło źle.
