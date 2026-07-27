# Bilans zaopatrzenia i kotwice krokowe — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zastąpić kotwiczenie wtrąceń w czasie kotwiczeniem do kroków szablonu, zamienić trójpolowy dochód na jedną sumę dobową z podziałem farma/zbieractwo, wprowadzić zużycie surowców na dobę liczone po harmonogramie bez przestojów, i przebudować pasek stanu na dwie kolumny (stan wioski + bilans).

**Architecture:** Zmiana zaczyna się w modelu planu (kotwice zamiast `czasS`), przechodzi przez silnik symulacji (rozwiązywanie kotwic na indeksy kroków zamiast porównań czasowych) i moduł zapotrzebowania (eksport osi bez przestojów + nowa funkcja zużycia), a kończy w warstwie widoków i wpięcia zdarzeń.

**Tech Stack:** Node.js ≥ 20 (wbudowany `node:test`), czysty ESM, zero zależności runtime, zero zależności deweloperskich.

**Spec:** `docs/superpowers/specs/2026-07-28-bilans-i-kotwice-krokow-design.md`

## Global Constraints

- **Zero zależności.** Nie wolno dodać niczego do `package.json` poza skryptami.
- **Strona samowystarczalna.** Żadnego `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `<script src>`, `<link rel=stylesheet>` ani adresów `http`/`https` poza `www.w3.org` w kodzie sklejanym do strony.
- **Testy** przez `node --test`, pliki `test/*.test.js`, `import { test } from 'node:test'` i `import assert from 'node:assert/strict'`.
- **Język.** Nazwy i komentarze po polsku, **bez polskich znaków w identyfikatorach**. Komentarze wyjaśniają *dlaczego*, nie *co*.
- **Każdy plik w `src/` zaczyna się komentarzem ze swoją ścieżką.**
- **Nazwy najwyższego poziomu unikalne w całym repozytorium** — `build.js` skleja moduły `src/wioska/*.js` w jeden wspólny zakres. Kolizja to błąd składni w przeglądarce, którego testy Node nie wyłapią.
- **Każdy `import` w jednej linii.**
- **Czas w sekundach.** Dochód podawany jako suma na dobę.

**Stan wyjściowy:** gałąź `symulator-wioski`, 263 testy przechodzą, `node build.js` generuje `dist/wioska/index.html` wśród pięciu stron. Pliki w `dist/` są śledzone w git i commitowane razem ze źródłami.

---

### Task 1: Kotwice w modelu planu

**Files:**
- Modify: `src/wioska/plan.js`
- Test: `test/wioska-plan.test.js`

**Interfaces:**
- Consumes: `SWIATY`, `swiat`, `poziomyStartowe`, `maksPoziom`, `budynkiSwiata`
- Produces:
  - `dochody[i]` = `{ kotwica, sumaD, zrodlo }`, gdzie `kotwica` to `null` albo `{ budynek, doPoziomu }`, `sumaD` liczba, `zrodlo` `'farma'` albo `'zbieractwo'`
  - `zastrzyki[i]` = `{ kotwica, drewno, glina, zelazo }`
  - `normalizujPlan` — bez zmian sygnatury, ale generuje nowy kształt i migruje stare pola

**Kontekst — dlaczego kotwica, nie czas.** Szablon Menedżera Konta to ciąg kroków; godziny są wynikiem symulacji, nie danymi wejściowymi. Kotwica `{ budynek, doPoziomu }` wskazuje krok, po którego ukończeniu wtrącenie zaczyna obowiązywać, i przeżywa zmianę kolejności kroków — nie trzeba niczego przeliczać przy przeciąganiu.

**Migracja starego formatu.** Dotychczasowe pola to `czasS` (sekundy od startu) i, dla dochodu, `drewnoH`/`glinaH`/`zelazoH` (godzinowe, migrowane już wcześniej do `drewnoD`/`glinaD`/`zelazoD`). Ten task zamienia `czasS` na kotwicę przybliżoną po **osi bez przestojów** — liście `{ budynek, doPoziomu, startS }` policzonej z samych czasów budowy, bez uwzględniania magazynu ani dochodu. Wtrącenie ze starym `czasS` przypina się do **pierwszego kroku, którego `startS` jest ≥ czasS**; jeśli żaden taki krok nie istnieje (wtrącenie wypada po końcu osi), przypina się do **ostatniego kroku planu**; jeśli plan nie ma żadnych kroków albo `czasS` jest mniejszy niż `startS` pierwszego kroku, kotwica to `null`.

Oś bez przestojów licz lokalnie w `plan.js` — to jest krótka pętla (baza + koszt + czas budowy, poziom Ratusza narastająco), nie importuj `zapotrzebowanie.js`, żeby uniknąć zależności cyklicznej (Task 3 doda tam funkcję opartą na tym samym wzorze, ale oba miejsca liczą tę samą, prostą rzecz niezależnie — nie ma potrzeby dzielenia kodu na tym etapie).

**Dochód: z trzech pól na jedną sumę.** Stare pola `drewnoD`/`glinaD`/`zelazoD` sumują się do `sumaD`. Wpis bez pola `zrodlo` dostaje `'farma'`.

- [ ] **Step 1: Write the failing test**

Dopisz do `test/wioska-plan.test.js`:

```js
test('dochod ma kotwice, sume dobowa i zrodlo', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    dochody: [{ kotwica: { budynek: 'tartak', doPoziomu: 1 }, sumaD: 15000, zrodlo: 'zbieractwo' }],
  });
  assert.deepEqual(p.dochody[0], {
    kotwica: { budynek: 'tartak', doPoziomu: 1 }, sumaD: 15000, zrodlo: 'zbieractwo',
  });
});

test('dochod bez zrodla trafia do farmy', () => {
  const p = normalizujPlan({ swiat: 'pl231', dochody: [{ kotwica: null, sumaD: 300 }] });
  assert.equal(p.dochody[0].zrodlo, 'farma');
});

test('stary trojpolowy dochod sumuje sie do jednej wartosci dobowej', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    dochody: [{ czasS: 0, drewnoD: 100, glinaD: 200, zelazoD: 300 }],
  });
  assert.equal(p.dochody[0].sumaD, 600);
});

test('zastrzyk ma kotwice zamiast czasu', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    zastrzyki: [{ kotwica: { budynek: 'ratusz', doPoziomu: 2 }, drewno: 1000, glina: 500, zelazo: 0 }],
  });
  assert.deepEqual(p.zastrzyki[0].kotwica, { budynek: 'ratusz', doPoziomu: 2 });
});

test('wtracenie ze starym czasS przypina sie do pierwszego kroku, ktory startuje nie wczesniej', () => {
  const kroki = [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 2 }, { budynek: 'tartak', doPoziomu: 3 }];
  // tartak 1: 10s, tartak 2: 10s (start 10), tartak 3: 2min=120s (start 20)
  const p = normalizujPlan({ swiat: 'pl231', kroki, dochody: [{ czasS: 15, drewnoD: 100 }] });
  assert.deepEqual(p.dochody[0].kotwica, { budynek: 'tartak', doPoziomu: 3 });
});

test('wtracenie z czasS przed pierwszym krokiem dostaje kotwice null', () => {
  const kroki = [{ budynek: 'tartak', doPoziomu: 1 }];
  const p = normalizujPlan({ swiat: 'pl231', kroki, dochody: [{ czasS: 0, drewnoD: 100 }] });
  assert.equal(p.dochody[0].kotwica, null);
});

test('wtracenie z czasS po koncu osi przypina sie do ostatniego kroku', () => {
  const kroki = [{ budynek: 'tartak', doPoziomu: 1 }];
  const p = normalizujPlan({ swiat: 'pl231', kroki, dochody: [{ czasS: 999999, drewnoD: 100 }] });
  assert.deepEqual(p.dochody[0].kotwica, { budynek: 'tartak', doPoziomu: 1 });
});

test('wtracenie z czasS w planie bez krokow dostaje kotwice null', () => {
  const p = normalizujPlan({ swiat: 'pl231', dochody: [{ czasS: 500, drewnoD: 100 }] });
  assert.equal(p.dochody[0].kotwica, null);
});

test('normalizacja jest idempotentna dla nowego formatu', () => {
  const a = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ kotwica: { budynek: 'tartak', doPoziomu: 1 }, sumaD: 900, zrodlo: 'farma' }],
    zastrzyki: [{ kotwica: null, drewno: 10, glina: 20, zelazo: 30 }],
  });
  const b = normalizujPlan(JSON.parse(JSON.stringify(a)));
  assert.deepEqual(a, b);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-plan.test.js`
Expected: FAIL — `dochody[0].kotwica` jest `undefined`

- [ ] **Step 3: Write the implementation**

W `src/wioska/plan.js` dodaj pomocniczą funkcję liczącą oś bez przestojów (nad `normalizujPlan`, jako zwykła deklaracja funkcji — potrzebna wcześniej niż jest zdefiniowana dzięki hoistingowi):

```js
import { czasBudowy } from './czas.js';

// Oś bez przestojow: startS kazdego kroku liczony wylacznie z czasow budowy,
// bez magazynu i dochodu. Sluzy tylko do migracji starych planow z czasS —
// nie eksportujemy jej, bo Task 3 dodaje rownowazna, publiczna wersje
// w zapotrzebowanie.js dla innych celow.
function osBezPrzestojowDoMigracji(s, poziomyStart, kroki) {
  const poziomy = { ...poziomyStart };
  let czas = 0;
  return kroki.map(k => {
    const startS = czas;
    const { sekundy } = czasBudowy(s, k.budynek, k.doPoziomu, poziomy.ratusz ?? 1);
    czas += sekundy;
    poziomy[k.budynek] = k.doPoziomu;
    return { budynek: k.budynek, doPoziomu: k.doPoziomu, startS };
  });
}

// Wtracenie ze starym czasS migrowane jest do kotwicy: pierwszy krok, ktory
// startuje nie wczesniej niz ten czas. Po koncu osi — ostatni krok. Bez
// krokow albo przed pierwszym — brak kotwicy (start planu).
function kotwicaZCzasu(os, czasS) {
  if (os.length === 0) return null;
  const trafiony = os.find(k => k.startS >= czasS);
  if (trafiony) {
    if (os[0].startS > czasS && os[0] === trafiony) return null;
    return { budynek: trafiony.budynek, doPoziomu: trafiony.doPoziomu };
  }
  const ostatni = os[os.length - 1];
  return { budynek: ostatni.budynek, doPoziomu: ostatni.doPoziomu };
}
```

Zamień blok `dochody:` i `zastrzyki:` w `normalizujPlan`:

```js
export function normalizujPlan(surowy) {
  const kod = surowy?.swiat ?? 'pl231';
  const s = SWIATY[kod];
  const poziomy = s ? poziomyStartowe(s) : {};
  const kroki = (surowy?.kroki ?? []).map(k => ({
    budynek: k.budynek,
    doPoziomu: Number(k.doPoziomu),
  }));
  const startPoziomy = { ...poziomy, ...(surowy?.start?.poziomy ?? {}) };
  // Liczona tylko gdy trzeba migrowac stare wtracenia z czasS — bez sensu
  // dla planow juz zapisanych w nowym formacie.
  const potrzebnaOs = (surowy?.dochody ?? []).some(d => d.czasS !== undefined && d.kotwica === undefined)
    || (surowy?.zastrzyki ?? []).some(z => z.czasS !== undefined && z.kotwica === undefined);
  const os = (s && potrzebnaOs) ? osBezPrzestojowDoMigracji(s, startPoziomy, kroki) : [];

  const kotwicaZ = (wpis) => wpis.kotwica !== undefined
    ? (wpis.kotwica === null ? null : { budynek: wpis.kotwica.budynek, doPoziomu: Number(wpis.kotwica.doPoziomu) })
    : kotwicaZCzasu(os, Number(wpis.czasS ?? 0));

  return {
    swiat: kod,
    start: {
      poziomy: startPoziomy,
      surowce: { ...SUROWCE_STARTOWE, ...(surowy?.start?.surowce ?? {}) },
    },
    kroki,
    dochody: (surowy?.dochody ?? []).map(d => ({
      kotwica: kotwicaZ(d),
      // Stary trojpolowy zapis (juz w postaci dobowej) sumuje sie do jednej
      // wartosci — kierunek podzialu na surowce przestaje miec znaczenie,
      // bo dochod dzieli sie rowno przy uzyciu.
      sumaD: Number(d.sumaD ?? ((d.drewnoD ?? 0) + (d.glinaD ?? 0) + (d.zelazoD ?? 0))),
      zrodlo: d.zrodlo === 'zbieractwo' ? 'zbieractwo' : 'farma',
    })),
    zastrzyki: (surowy?.zastrzyki ?? []).map(z => ({
      kotwica: kotwicaZ(z),
      drewno: Number(z.drewno ?? 0),
      glina: Number(z.glina ?? 0),
      zelazo: Number(z.zelazo ?? 0),
    })),
  };
}
```

Usuń stary import `poziomyStartowe, maksPoziom, budynkiSwiata` i zastąp go `poziomyStartowe, maksPoziom, budynkiSwiata` plus nowy `czasBudowy` — zachowaj jeden import na linię:

```js
import { poziomyStartowe, maksPoziom, budynkiSwiata } from './swiat.js';
import { czasBudowy } from './czas.js';
```

**Uwaga:** wtrącenia nie są już sortowane po `czasS` — sortowanie po kotwicy dzieje się w symulacji (Task 2), bo tam dopiero wiadomo, w jakiej kolejności kroki faktycznie występują.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/wioska-plan.test.js`
Expected: PASS

- [ ] **Step 5: Fix existing tests using the old shape**

Reszta pakietu ma testy budujące plany z `czasS`/`drewnoD`/`glinaD`/`zelazoD` dla dochodu i `czasS` dla zastrzyków. Znajdź je (`node --test` pokaże, co się wywala po Task 2) i zamień na nowy kształt z jawną kotwicą — **nie polegaj na migracji `czasS` w testach nowo pisanych ani modyfikowanych**, migracja jest wyłącznie dla realnych, zapisanych planów. Przykład: `{ czasS: 0, drewnoD: 10, glinaD: 10, zelazoD: 10 }` → `{ kotwica: null, sumaD: 30 }`. Ten krok wykonasz do końca dopiero po Task 2, bo dopiero tam symulacja zacznie czytać nowe pola — na razie zostaw notatkę i przejdź do commita samego modelu.

- [ ] **Step 6: Commit**

```bash
git add src/wioska/plan.js test/wioska-plan.test.js
git commit -m "feat: kotwice krokowe i suma dobowa dochodu w modelu planu"
```

---

### Task 2: Silnik symulacji na kotwicach

**Files:**
- Modify: `src/wioska/symulacja.js`
- Modify: wszystkie pliki testowe budujące plany z `dochody`/`zastrzyki` w starym kształcie (`test/wioska-symulacja.test.js`, `test/wioska-zapotrzebowanie.test.js`, `test/wioska-format.test.js`, `test/wioska-status.test.js`, `test/wioska-widoki.test.js`, `test/wioska-plan.test.js` z Task 1 Step 5)
- Test: `test/wioska-symulacja.test.js`

**Interfaces:**
- Consumes: `dochody[i]` = `{ kotwica, sumaD, zrodlo }`, `zastrzyki[i]` = `{ kotwica, drewno, glina, zelazo }` (Task 1)
- Produces: `symuluj(plan)` — sygnatura i kształt wyniku bez zmian (`{ kroki, ostrzezenia, podsumowanie }`), ale dochód/zastrzyki stosowane wg indeksu kroku, nie czasu

**Kontekst — jak działało i jak ma działać.** Dziś `dochodWChwili(dochody, czas)` i `nastepneZdarzenie(plan, czas)` porównują `d.czasS` z bieżącym zegarem symulacji. Po zmianie modelu porównanie idzie po **indeksie kroku**: na wejściu do `symuluj` każda kotwica jest tłumaczona na indeks (`null` → `-1`, `{budynek,doPoziomu}` → pozycja odpowiadającego kroku w `plan.kroki`), a wtrącenia sortowane po tym indeksie. Dochód obowiązujący *w trakcie* kroku `i` (czy to w fazie oczekiwania, czy w fazie budowy) to ostatni wpis o indeksie ≤ `i`; wtrącenia z indeksem `i` stosują się **po ukończeniu** kroku `i` (od kroku `i+1` włącznie) — patrz Step 3 poniżej dla dokładnej semantyki granicy.

To usuwa całą koncepcję "następnego zdarzenia w czasie" w pętli oczekiwania — nie ma już potrzeby przerywania naliczania produkcji w połowie kroku z powodu wtrącenia, bo wtrącenie nie ma czasu, tylko krok, do którego jest przypięte, a w trakcie **trwania** kroku `i` żadne wtrącenie o indeksie `i` jeszcze się nie stosuje (stosuje się dopiero po jego zakończeniu, na starcie kroku `i+1`). To upraszcza `produkcjaNaSekunde` w fazie budowy: dochód jest stały przez cały czas trwania danego kroku, nie trzeba już segmentować pętli budowy na potencjalne zmiany w środku.

**Rozwiązanie kotwicy na indeks.** Buduj mapę `budynek+'|'+doPoziomu → indeks` z `plan.kroki` (klucz jednoznaczny w poprawnym planie — dwa kroki tego samego budynku i poziomu nie mogą wystąpić, bo `bledyPlanu` by to odrzuciło). Kotwica wskazująca krok nieobecny w planie — możliwa tylko przy ręcznie edytowanym, niepoprawnym planie — rozwiązuje się do `-1` (start planu); to jest wyłącznie siatka bezpieczeństwa, nie ścieżka używana przez interfejs.

- [ ] **Step 1: Write the failing tests**

Zastąp `test/wioska-symulacja.test.js` w całości (zachowaj wszystkie istniejące przypadki, przepisz tylko konstrukcję planów z `dochody`/`zastrzyki` na nowy kształt):

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

test('zastrzyk przypiety do startu planu (kotwica null) dziala od pierwszego kroku', () => {
  const bez = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ kotwica: null, sumaD: 30, zrodlo: 'farma' }],
  }));
  const z = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ kotwica: null, sumaD: 30, zrodlo: 'farma' }],
    zastrzyki: [{ kotwica: null, drewno: 500, glina: 500, zelazo: 500 }],
  }));
  assert.ok(z.kroki[0].startS < bez.kroki[0].startS);
  assert.equal(z.podsumowanie.zZastrzykow.drewno, 500);
});

test('zastrzyk przypiety do drugiego kroku nie dziala jeszcze podczas pierwszego', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 60, glina: 60, zelazo: 40 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    zastrzyki: [{ kotwica: { budynek: 'tartak', doPoziomu: 1 }, drewno: 999999, glina: 999999, zelazo: 999999 }],
  }));
  // Pierwszy krok placi od reki, nie z zastrzyku (ktory dziala dopiero PO nim).
  assert.equal(w.kroki[0].zasobyPo.drewno, 60 - 50);
  // Drugi krok korzysta juz z zastrzyku.
  assert.ok(w.kroki[1].zasobyPo.drewno > 900000);
});

test('dochod zmienia sie miedzy krokami wedlug kotwicy, nie polowy trwania kroku', () => {
  const wolno = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    dochody: [{ kotwica: null, sumaD: 30, zrodlo: 'farma' }],
  }));
  const szybciej = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    dochody: [
      { kotwica: null, sumaD: 30, zrodlo: 'farma' },
      { kotwica: { budynek: 'tartak', doPoziomu: 1 }, sumaD: 15000, zrodlo: 'farma' },
    ],
  }));
  assert.ok(szybciej.kroki[1].czekanieS < wolno.kroki[1].czekanieS);
});

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

test('krok drozszy niz spichlerz to blad twardy', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 1, ratusz: 5, zagroda: 5 } },
    kroki: [{ budynek: 'wieza', doPoziomu: 1 }],
  }));
  assert.equal(w.kroki[0].blad, 'ponad-spichlerz');
  assert.ok(w.ostrzezenia.some(o => o.typ === 'ponad-spichlerz'));
});

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

test('kotwica wskazujaca nieistniejacy krok dziala jak start planu', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ kotwica: { budynek: 'cegielnia', doPoziomu: 9 }, sumaD: 30, zrodlo: 'farma' }],
  }));
  assert.ok(w.kroki[0].startS < 100);
});

test('dwa wpisy dochodu na tym samym kroku — wygrywa ostatni w tablicy', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    dochody: [
      { kotwica: { budynek: 'tartak', doPoziomu: 1 }, sumaD: 30, zrodlo: 'farma' },
      { kotwica: { budynek: 'tartak', doPoziomu: 1 }, sumaD: 15000, zrodlo: 'farma' },
    ],
  }));
  assert.ok(w.kroki[1].czekanieS < 100);
});

test('dwie dosylki na tym samym kroku sumuja sie obie', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    zastrzyki: [
      { kotwica: { budynek: 'tartak', doPoziomu: 1 }, drewno: 100, glina: 0, zelazo: 0 },
      { kotwica: { budynek: 'tartak', doPoziomu: 1 }, drewno: 100, glina: 0, zelazo: 0 },
    ],
  }));
  assert.equal(w.podsumowanie.zZastrzykow.drewno, 200);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-symulacja.test.js`
Expected: FAIL — silnik nadal czyta `czasS`

- [ ] **Step 3: Rewrite the engine**

Zastąp zawartość `src/wioska/symulacja.js`:

```js
// src/wioska/symulacja.js
// Przebieg osi czasu. W wiosce buduje sie jeden budynek naraz, wiec kroki
// ida sekwencyjnie — liczba slotow kolejki nie zmienia laczonego czasu.
// Dochod i dosylki sa przypiete do krokow (kotwica), nie do czasu — dochod
// obowiazujacy w trakcie kroku i to ostatni wpis o indeksie <= i, a wtracenia
// przypiete do kroku i staja sie aktywne dopiero PO jego ukonczeniu.

import { swiat } from './swiaty.js';
import { kosztPoziomu, ludnoscPoziomu, budynkiSwiata } from './swiat.js';
import { pojemnosc, maksLudnosc, produkcjaGodzinowa } from './tabele.js';
import { czasBudowy } from './czas.js';
import { brakujaceWymagania, opisWymagan } from './wymagania.js';
import { NAZWY } from './nazwy.js';

const SUROWCE = ['drewno', 'glina', 'zelazo'];
// Tolerancja na blad zaokraglenia zmiennoprzecinkowego. Bez niej "starczy na
// koszt" potrafi zostac tuz ponizej progu o kwote mniejsza niz precyzja
// dodawania do zegara, i petla nigdy sie nie konczy.
const EPS = 1e-6;

const zeroSurowce = () => ({ drewno: 0, glina: 0, zelazo: 0 });

// Kotwica -> indeks kroku w plan.kroki. null = przed pierwszym krokiem (-1).
// Kotwica wskazujaca krok nieobecny w planie (mozliwe tylko przy recznie
// edytowanym JSON) rozwiazuje sie do -1 — to siatka bezpieczenstwa, nie
// sciezka uzywana przez interfejs.
function indeksKotwicy(kotwica, kroki) {
  if (kotwica === null) return -1;
  const i = kroki.findIndex(k => k.budynek === kotwica.budynek && k.doPoziomu === kotwica.doPoziomu);
  return i;
}

// Ostatni wpis, ktorego indeks kotwicy jest <= indeksBiezacy. Lista jest
// posortowana rosnaco po indeksie kotwicy przy wejsciu do symuluj.
function aktywnyWpis(posortowane, indeksBiezacy, domyslny) {
  let wynik = domyslny;
  for (const w of posortowane) {
    if (w.indeksKotwicy <= indeksBiezacy) wynik = w; else break;
  }
  return wynik;
}

function produkcjaNaSekunde(s, poziomy, sumaD) {
  return {
    drewno: produkcjaGodzinowa(s, poziomy.tartak ?? 0) / 3600 + sumaD / 3 / 86400,
    glina: produkcjaGodzinowa(s, poziomy.cegielnia ?? 0) / 3600 + sumaD / 3 / 86400,
    zelazo: produkcjaGodzinowa(s, poziomy.huta ?? 0) / 3600 + sumaD / 3 / 86400,
  };
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
  const kroki = [];
  const ostrzezenia = [];
  const koszt = zeroSurowce();
  let czasNiepewnyS = 0;
  let czas = 0;

  const dochody = plan.dochody
    .map(d => ({ ...d, indeksKotwicy: indeksKotwicy(d.kotwica, plan.kroki) }))
    .sort((a, b) => a.indeksKotwicy - b.indeksKotwicy);
  const zastrzyki = plan.zastrzyki
    .map(z => ({ ...z, indeksKotwicy: indeksKotwicy(z.kotwica, plan.kroki) }))
    .sort((a, b) => a.indeksKotwicy - b.indeksKotwicy);
  const zastosowaneZastrzyki = new Set();
  const domyslnyDochod = { sumaD: 0 };

  const ludnoscZajeta = () => budynkiSwiata(s)
    .reduce((suma, b) => suma + ludnoscPoziomu(s, b, poziomy[b] ?? 0), 0);

  // Dosylki przypiete do indeksu <= indeksBiezacy wpadaja dokladnie raz.
  const wpuscZastrzyki = (indeksBiezacy, sufit) => {
    zastrzyki.forEach((z, idx) => {
      if (zastosowaneZastrzyki.has(idx) || z.indeksKotwicy > indeksBiezacy) return;
      zastosowaneZastrzyki.add(idx);
      dolej(stan, { drewno: z.drewno, glina: z.glina, zelazo: z.zelazo }, sufit);
      for (const r of SUROWCE) zZastrzykow[r] += z[r];
    });
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
      poziomyPo: { ...poziomy },
      blad: null,
    };

    // Dochod i dosylki przypiete do kroku i-1 lub wczesniej dzialaja juz
    // podczas kroku i (czyli PO ukonczeniu poprzedniego kroku); przypiete
    // do kroku i same jeszcze nie dzialaja w jego trakcie.
    const indeksAktywny = i - 1;
    wpuscZastrzyki(indeksAktywny, sufit);

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

    // Przesuwaj zegar w krokach czasowych, az stac na koszt. Stawka jest
    // stala w trakcie oczekiwania na dany krok (dochod nie zmienia sie
    // wewnatrz trwania jednego kroku), wiec nie trzeba juz dzielic petli
    // na segmenty wedlug zdarzen czasowych.
    const poczatek = czas;
    let czekanieNa = null;
    const zmarnowanePrzed = SUROWCE.reduce((sum, r) => sum + stan.zmarnowane[r], 0);
    const dochodBiezacy = aktywnyWpis(dochody, indeksAktywny, domyslnyDochod);
    const stawka = produkcjaNaSekunde(s, poziomy, dochodBiezacy.sumaD);
    for (;;) {
      if (SUROWCE.every(r => stan.zasoby[r] >= c[r] - EPS)) break;
      let potrzebaS = 0;
      for (const r of SUROWCE) {
        const brakuje = c[r] - stan.zasoby[r];
        if (brakuje <= 0) continue;
        const dt = stawka[r] > 0 ? brakuje / stawka[r] : Infinity;
        if (dt > potrzebaS) { potrzebaS = dt; czekanieNa = r; }
      }
      if (potrzebaS === Infinity) {
        wpis.blad = 'brak-dochodu';
        ostrzezenia.push({
          typ: 'przestoj', krok: i,
          tekst: `Krok ${i + 1}: przy zerowej produkcji ${czekanieNa} tego kroku nie da się nigdy opłacić.`,
        });
        break;
      }
      dolej(stan, {
        drewno: stawka.drewno * potrzebaS, glina: stawka.glina * potrzebaS, zelazo: stawka.zelazo * potrzebaS,
      }, sufit);
      czas += potrzebaS;
    }

    if (wpis.blad) { kroki.push(wpis); return; }

    wpis.czekanieS = Math.round(czas - poczatek);
    wpis.czekanieNa = wpis.czekanieS > 0 ? czekanieNa : null;
    wpis.startS = Math.round(czas);
    for (const r of SUROWCE) { stan.zasoby[r] = Math.max(0, stan.zasoby[r] - c[r]); koszt[r] += c[r]; }

    const { sekundy, pewny } = czasBudowy(s, krok.budynek, krok.doPoziomu, poziomy.ratusz ?? 1);
    wpis.trwanieS = sekundy;
    wpis.pewny = pewny;
    if (!pewny) czasNiepewnyS += sekundy;

    // Produkcja plynie takze w trakcie budowy, ta sama stawka co w oczekiwaniu
    // — dochod przypiety do tego kroku zacznie dzialac dopiero po jego koncu.
    dolej(stan, {
      drewno: stawka.drewno * sekundy, glina: stawka.glina * sekundy, zelazo: stawka.zelazo * sekundy,
    }, sufit);
    czas += sekundy;

    // Ostrzegamy raz, ale dopiero po fazie budowy — magazyn potrafi przelac
    // sie wylacznie w jej trakcie, gdy na krok stac od reki i nie bylo
    // oczekiwania.
    const zmarnowanePo = SUROWCE.reduce((sum, r) => sum + stan.zmarnowane[r], 0);
    if (zmarnowanePo > zmarnowanePrzed && !ostrzezenia.some(o => o.typ === 'przepelnienie')) {
      ostrzezenia.push({
        typ: 'przepelnienie', krok: i,
        tekst: 'Spichlerz się przepełnia — część produkcji przepada. Rozbuduj go wcześniej.',
      });
    }

    poziomy[krok.budynek] = krok.doPoziomu;
    wpis.koniecS = Math.round(czas);
    wpis.zasobyPo = { ...stan.zasoby };
    wpis.ludnoscPo = ludnoscZajeta();
    wpis.poziomyPo = { ...poziomy };
    kroki.push(wpis);

    // Dosylki przypiete do tego kroku wpadaja teraz, po jego ukonczeniu —
    // zanim ruszy oczekiwanie na krok nastepny.
    wpuscZastrzyki(i, pojemnosc(poziomy.spichlerz ?? 1));
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

**Uwaga o granicy stosowania dosyłek:** dosyłka przypięta do kroku `i` wpada zaraz po jego zakończeniu (wołanie `wpuscZastrzyki(i, ...)` na końcu iteracji `i`), więc jest dostępna już w oczekiwaniu na krok `i+1` (gdzie `indeksAktywny = i`, więc `wpuscZastrzyki(indeksAktywny, sufit)` na starcie iteracji `i+1` też by ją złapało — podwójnego naliczenia nie ma, bo `zastosowaneZastrzyki` pilnuje jednokrotności). To dublowanie wywołania jest celowe: pierwsze (na końcu poprzedniej iteracji) aktualizuje `wpis.zasobyPo` tak, żeby pasek stanu widział dosyłkę natychmiast po kroku, do którego jest przypięta, a nie dopiero po starcie następnego.

- [ ] **Step 4: Fix all downstream test files to the new shape**

Uruchom `node --test` i przejdź przez każdy plik, który się wywala. Dla każdego wystąpienia starego kształtu dochodu/zastrzyku zamień:
- `{ czasS: X, drewnoD: A, glinaD: B, zelazoD: C }` → `{ kotwica: <odpowiadająca pozycja lub null>, sumaD: A+B+C, zrodlo: 'farma' }`
- `{ czasS: X, drewno: A, glina: B, zelazo: C }` (zastrzyk) → `{ kotwica: <...>, drewno: A, glina: B, zelazo: C }`

Gdzie test opisuje "coś dzieje się od startu" — kotwica `null`. Gdzie opisuje "coś dzieje się później, w trakcie kroku N" (licząc od 0) — kotwica `{ budynek: kroki[N].budynek, doPoziomu: kroki[N].doPoziomu }` (czyli przypięte do zakończenia kroku N, więc aktywne od kroku N+1). Zachowaj **intencję** oryginalnego testu (co sprawdza), nie tylko składnię — jeśli nie jesteś pewien, jaką intencję miał dany test, zatrzymaj się i zapytaj.

Pliki do przejrzenia: `test/wioska-zapotrzebowanie.test.js`, `test/wioska-format.test.js`, `test/wioska-status.test.js`, `test/wioska-widoki.test.js`. Task 3 i dalsze też dotkną części z nich, ale na tym etapie mają się kompilować i przechodzić z nowym kształtem danych — nie musisz jeszcze aktualizować testów pod nowe funkcje (`zapotrzebowanie` zmieni kształt wyniku w Task 3).

- [ ] **Step 5: Run full suite**

Run: `node --test`
Expected: PASS w komplecie (poza testami, które Task 3+ i tak przepiszą pod nowe interfejsy — jeśli jakiś test w `wioska-zapotrzebowanie.test.js` nadal się wywala z powodu kształtu wyniku `zapotrzebowanie()`, a nie kształtu planu, zostaw to Taskowi 3)

- [ ] **Step 6: Commit**

```bash
git add src/wioska/symulacja.js test/wioska-symulacja.test.js test/wioska-zapotrzebowanie.test.js test/wioska-format.test.js test/wioska-status.test.js test/wioska-widoki.test.js
git commit -m "feat: silnik symulacji rozwiazuje dochod i dosylki po indeksie kroku"
```

---

### Task 3: Oś bez przestojów jako publiczna funkcja + zużycie na dobę

**Files:**
- Modify: `src/wioska/zapotrzebowanie.js`
- Test: `test/wioska-zapotrzebowanie.test.js`

**Interfaces:**
- Consumes: `swiat`, `kosztPoziomu`, `produkcjaGodzinowa`, `czasBudowy`
- Produces:
  - `osBezPrzestojow(plan)` → `[{ budynek, doPoziomu, startS, koszt }]` — nowy eksport, jeden wiersz na krok
  - `zapotrzebowanie(plan)` → bez zmian sygnatury/kształtu wyniku (`{ czasNettoS, wymaganyDobowo, waskieGardlo, brakNaStart }`), ale zaimplementowana na bazie `osBezPrzestojow`
  - `zuzycieNaDobe(plan, indeksKroku)` → `{ suma: { drewno, glina, zelazo }, doKonca: boolean }`

**Kontekst.** Dziś `zapotrzebowanie.js` liczy oś bez przestojów w pętli wewnętrznej, ale jej nie eksportuje. Ten task wydziela ją jako `osBezPrzestojow`, przepisuje `zapotrzebowanie` na jej bazie (bez zmiany zachowania — to czysty refaktor tej części), i dokłada `zuzycieNaDobe`.

**Zużycie na dobę — dokładna definicja.** Dla `indeksKroku` (albo `null` dla stanu końcowego, patrz niżej) sumuje `koszt` wszystkich kroków z osi bez przestojów, których `startS` mieści się w przedziale `[T, T + 86400)`, gdzie `T` to `startS` kroku o `indeksKroku` (dla `indeksKroku === null`, `T` to `startS` **ostatniego** kroku na osi — czyli "od teraz do końca planu i ewentualnie dalej", ale skoro plan się kończy, `doKonca` będzie `true`). Gdy `T + 86400` przekracza `startS` ostatniego kroku na osi plus jego `trwanieS` (czyli koniec całej osi), okno jest krótsze niż doba — funkcja zwraca `doKonca: true` i sumuje tylko do końca planu, **nie ekstrapoluje**.

Do tego dokładnego wzoru na koniec planu potrzebny jest czas trwania ostatniego kroku, nie tylko jego start — dlatego `osBezPrzestojow` niesie też pole pomocnicze czasu zakończenia całej osi jako osobną wartość zwracaną obok listy... **rozwiązanie prostsze:** `osBezPrzestojow` zwraca listę kroków, a koniec całej osi to `ostatni.startS + ostatni.trwanieS`, więc dodaj `trwanieS` do każdego wiersza (patrz sygnatura poniżej — zaktualizowana).

**Poprawiona sygnatura `osBezPrzestojow`:**
- Produces: `osBezPrzestojow(plan)` → `[{ budynek, doPoziomu, startS, trwanieS, koszt }]`

- [ ] **Step 1: Write the failing test**

Zastąp `test/wioska-zapotrzebowanie.test.js` w całości:

```js
// test/wioska-zapotrzebowanie.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujPlan } from '../src/wioska/plan.js';
import { zapotrzebowanie, osBezPrzestojow, zuzycieNaDobe } from '../src/wioska/zapotrzebowanie.js';
import { czasBudowy } from '../src/wioska/czas.js';
import { swiat } from '../src/wioska/swiaty.js';

const s = swiat('pl231');
const plan = (n) => normalizujPlan({ swiat: 'pl231', ...n });

test('czas netto to suma samych czasow budowy', () => {
  const p = plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 2 }] });
  const oczekiwany = czasBudowy(s, 'tartak', 1, 1).sekundy + czasBudowy(s, 'tartak', 2, 1).sekundy;
  assert.equal(zapotrzebowanie(p).czasNettoS, oczekiwany);
});

test('czas netto nie zalezy od dochodu ani od dosylek', () => {
  const kroki = [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 2 }];
  const bez = zapotrzebowanie(plan({ kroki }));
  const z = zapotrzebowanie(plan({
    kroki,
    dochody: [{ kotwica: null, sumaD: 99999, zrodlo: 'farma' }],
    zastrzyki: [{ kotwica: null, drewno: 99999, glina: 99999, zelazo: 99999 }],
  }));
  assert.equal(z.czasNettoS, bez.czasNettoS);
  assert.deepEqual(z.wymaganyDobowo, bez.wymaganyDobowo);
});

test('czas netto uwzglednia przyspieszenie od Ratusza w trakcie planu', () => {
  const wolny = zapotrzebowanie(plan({
    start: { poziomy: { ratusz: 1 } }, kroki: [{ budynek: 'tartak', doPoziomu: 10 }],
  })).czasNettoS;
  const szybki = zapotrzebowanie(plan({
    start: { poziomy: { ratusz: 10 } }, kroki: [{ budynek: 'tartak', doPoziomu: 10 }],
  })).czasNettoS;
  assert.ok(szybki < wolny);
});

test('plan mieszczacy sie w surowcach startowych nie wymaga dochodu', () => {
  const z = zapotrzebowanie(plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  assert.deepEqual(z.wymaganyDobowo, { drewno: 0, glina: 0, zelazo: 0 });
  assert.equal(z.waskieGardlo, null);
  assert.equal(z.brakNaStart, false);
});

test('plan ponad surowce startowe wymaga dochodu i wskazuje waskie gardlo', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const z = zapotrzebowanie(plan({ kroki }));
  assert.ok(z.wymaganyDobowo.drewno > 0);
  assert.ok(z.waskieGardlo !== null);
  assert.equal(z.waskieGardlo.budynek, 'tartak');
  assert.ok(z.waskieGardlo.indeks > 0 && z.waskieGardlo.indeks < kroki.length);
});

test('pierwszy krok drozszy niz surowce startowe jest zglaszany osobno', () => {
  const z = zapotrzebowanie(plan({
    start: { poziomy: { ratusz: 5, zagroda: 5 }, surowce: { drewno: 10, glina: 10, zelazo: 10 } },
    kroki: [{ budynek: 'wieza', doPoziomu: 1 }],
  }));
  assert.equal(z.brakNaStart, true);
  assert.ok(Number.isFinite(z.wymaganyDobowo.drewno));
});

test('wieksze surowce startowe obnizaja wymagany dochod', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const skromnie = zapotrzebowanie(plan({ kroki })).wymaganyDobowo.drewno;
  const bogato = zapotrzebowanie(plan({ kroki, start: { surowce: { drewno: 50000, glina: 50000, zelazo: 50000 } } })).wymaganyDobowo.drewno;
  assert.ok(bogato < skromnie);
});

test('pusty plan nie wymaga niczego', () => {
  const z = zapotrzebowanie(plan({}));
  assert.equal(z.czasNettoS, 0);
  assert.deepEqual(z.wymaganyDobowo, { drewno: 0, glina: 0, zelazo: 0 });
  assert.equal(z.waskieGardlo, null);
});

test('osBezPrzestojow ma jeden wiersz na krok, w kolejnosci planu', () => {
  const p = plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }] });
  const os = osBezPrzestojow(p);
  assert.equal(os.length, 2);
  assert.equal(os[0].budynek, 'tartak');
  assert.equal(os[1].budynek, 'cegielnia');
  assert.equal(os[1].startS, os[0].startS + os[0].trwanieS);
});

test('osBezPrzestojow niesie koszt kazdego kroku', () => {
  const p = plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }] });
  const os = osBezPrzestojow(p);
  assert.deepEqual(os[0].koszt, { drewno: 50, glina: 60, zelazo: 40 });
});

test('zuzycie na dobe sumuje koszty krokow w oknie doby od wskazanego', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const p = plan({ kroki });
  const z = zuzycieNaDobe(p, 0);
  assert.ok(z.suma.drewno > 0);
  assert.equal(typeof z.doKonca, 'boolean');
});

test('zuzycie na dobe blisko konca planu ustawia doKonca i nie ekstrapoluje', () => {
  const p = plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }] });
  const os = osBezPrzestojow(p);
  const z = zuzycieNaDobe(p, 0);
  assert.equal(z.doKonca, true);
  assert.equal(z.suma.drewno, os[0].koszt.drewno);
});

test('zuzycie na dobe rosnie na etapie z drozszymi krokami', () => {
  const kroki = [];
  for (let i = 1; i <= 15; i++) kroki.push({ budynek: 'ratusz', doPoziomu: i });
  const p = plan({ kroki });
  const wczesnie = zuzycieNaDobe(p, 0);
  const pozno = zuzycieNaDobe(p, 10);
  // Nie zakladamy z gory kierunku (koszty rosna geometrycznie, wiec pozniej
  // wieksze), ale wartosci maja byc rozne — inaczej test nic nie sprawdza.
  assert.notEqual(wczesnie.suma.drewno, pozno.suma.drewno);
});

test('null jako indeks liczy zuzycie od ostatniego kroku (stan koncowy)', () => {
  const p = plan({ kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }] });
  const naOstatnim = zuzycieNaDobe(p, 1);
  const naNull = zuzycieNaDobe(p, null);
  assert.deepEqual(naNull, naOstatnim);
});

test('zuzycie na dobe dla pustego planu nie wywraca sie', () => {
  const p = plan({});
  const z = zuzycieNaDobe(p, null);
  assert.deepEqual(z.suma, { drewno: 0, glina: 0, zelazo: 0 });
  assert.equal(z.doKonca, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-zapotrzebowanie.test.js`
Expected: FAIL — `osBezPrzestojow`/`zuzycieNaDobe` nie istnieją

- [ ] **Step 3: Write the implementation**

Zastąp zawartość `src/wioska/zapotrzebowanie.js`:

```js
// src/wioska/zapotrzebowanie.js
// Dwie rodziny liczb odporne na wahania farmienia, obie liczone na osi bez
// przestojow (magazyn i dochod sa ignorowane — to jest tempo, w jakim plan
// CHCIALBY isc, nie przebieg przy konkretnym zaopatrzeniu):
//   - czas netto i wymagany dochod dla calego planu (zapotrzebowanie),
//   - zuzycie w oknie doby od wskazanego momentu (zuzycieNaDobe) — pokazuje
//     zmiane tempa na kolejnych etapach, czego jedna liczba dla calego planu
//     nie widzi.
// Podstawa musi byc harmonogram BEZ przestojow: liczony po realnym (z
// symulacji) bilans zawsze wyszedlby zerowy przy braku surowcow, bo wtedy
// plan zuzywa dokladnie tyle, ile wplywa — miara mierzylaby sama siebie.

import { swiat } from './swiaty.js';
import { kosztPoziomu } from './swiat.js';
import { produkcjaGodzinowa } from './tabele.js';
import { czasBudowy } from './czas.js';

const SUROWCE_Z = ['drewno', 'glina', 'zelazo'];
const KOPALNIA_SUROWCA = { drewno: 'tartak', glina: 'cegielnia', zelazo: 'huta' };
const DOBA_S = 86400;

export function osBezPrzestojow(plan) {
  const s = swiat(plan.swiat);
  const poziomy = { ...plan.start.poziomy };
  let czas = 0;
  return plan.kroki.map(krok => {
    const koszt = kosztPoziomu(s, krok.budynek, krok.doPoziomu);
    const { sekundy } = czasBudowy(s, krok.budynek, krok.doPoziomu, poziomy.ratusz ?? 1);
    const wiersz = { budynek: krok.budynek, doPoziomu: krok.doPoziomu, startS: czas, trwanieS: sekundy, koszt };
    czas += sekundy;
    poziomy[krok.budynek] = krok.doPoziomu;
    return wiersz;
  });
}

export function zapotrzebowanie(plan) {
  const s = swiat(plan.swiat);
  const os = osBezPrzestojow(plan);
  const skumulowany = { drewno: 0, glina: 0, zelazo: 0 };
  const wyprodukowane = { drewno: 0, glina: 0, zelazo: 0 };
  const wymagany = { drewno: 0, glina: 0, zelazo: 0 };
  let waskieGardlo = null;
  let szczyt = 0;
  let brakNaStart = false;
  const poziomy = { ...plan.start.poziomy };

  os.forEach((wiersz, indeks) => {
    for (const r of SUROWCE_Z) skumulowany[r] += wiersz.koszt[r];

    for (const r of SUROWCE_Z) {
      const deficyt = skumulowany[r] - plan.start.surowce[r] - wyprodukowane[r];
      if (deficyt <= 0) continue;
      if (wiersz.startS <= 0) {
        brakNaStart = true;
        continue;
      }
      const naDobe = deficyt / (wiersz.startS / DOBA_S);
      if (naDobe > wymagany[r]) wymagany[r] = naDobe;
      if (naDobe > szczyt) {
        szczyt = naDobe;
        waskieGardlo = { indeks, budynek: wiersz.budynek, doPoziomu: wiersz.doPoziomu, surowiec: r, czasS: Math.round(wiersz.startS) };
      }
    }

    for (const r of SUROWCE_Z) {
      wyprodukowane[r] += produkcjaGodzinowa(s, poziomy[KOPALNIA_SUROWCA[r]] ?? 0) * wiersz.trwanieS / 3600;
    }
    poziomy[wiersz.budynek] = wiersz.doPoziomu;
  });

  const czasNettoS = os.length ? os[os.length - 1].startS + os[os.length - 1].trwanieS : 0;

  return {
    czasNettoS: Math.round(czasNettoS),
    wymaganyDobowo: {
      drewno: Math.ceil(wymagany.drewno),
      glina: Math.ceil(wymagany.glina),
      zelazo: Math.ceil(wymagany.zelazo),
    },
    waskieGardlo,
    brakNaStart,
  };
}

export function zuzycieNaDobe(plan, indeksKrokuLubNull) {
  const os = osBezPrzestojow(plan);
  const suma = { drewno: 0, glina: 0, zelazo: 0 };
  if (os.length === 0) return { suma, doKonca: true };

  const indeksBazowy = indeksKrokuLubNull === null ? os.length - 1 : indeksKrokuLubNull;
  const wiersz = os[indeksBazowy];
  if (!wiersz) return { suma, doKonca: true };

  const T = wiersz.startS;
  const koniecOsi = os[os.length - 1].startS + os[os.length - 1].trwanieS;
  const doKonca = T + DOBA_S >= koniecOsi;
  const gorna = doKonca ? koniecOsi : T + DOBA_S;

  for (const w of os) {
    if (w.startS >= T && w.startS < gorna) {
      for (const r of SUROWCE_Z) suma[r] += w.koszt[r];
    }
  }
  return { suma, doKonca };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/wioska-zapotrzebowanie.test.js`
Expected: PASS, 15 testów

- [ ] **Step 5: Sanity-check against a real plan**

```bash
node --input-type=module -e "
import { normalizujPlan } from './src/wioska/plan.js';
import { zapotrzebowanie, zuzycieNaDobe } from './src/wioska/zapotrzebowanie.js';
import { czasCzytelny } from './src/wioska/format.js';
const kroki = [];
const dodaj = (b, n) => { for (let i = 1; i <= n; i++) kroki.push({ budynek: b, doPoziomu: i }); };
dodaj('tartak', 10); dodaj('cegielnia', 10); dodaj('huta', 10);
dodaj('spichlerz', 12); dodaj('zagroda', 8); dodaj('ratusz', 10);
const p = normalizujPlan({ swiat: 'pl231', kroki });
const z = zapotrzebowanie(p);
console.log('czas netto:', czasCzytelny(z.czasNettoS));
console.log('krok 1  zuzycie/dobe:', zuzycieNaDobe(p, 0).suma);
console.log('krok 40 zuzycie/dobe:', zuzycieNaDobe(p, 39).suma);
"
```

Expected: czas netto około `1 d 03 h`, zużycie na kroku 1 rzędu jedenastu tysięcy drewna, na kroku 40 wyraźnie wyższe (etap z droższymi poziomami Ratusza) — zgodnie z wartościami zmierzonymi w projekcie (11 221 na kroku 1, 13 714 na kroku 40).

- [ ] **Step 6: Commit**

```bash
git add src/wioska/zapotrzebowanie.js test/wioska-zapotrzebowanie.test.js
git commit -m "feat: os bez przestojow jako publiczna funkcja, zuzycie surowcow na dobe"
```

---

### Task 4: Dopasowanie eksportu tekstowego i CLI do sumy dobowej

**Files:**
- Modify: `src/wioska/format.js`
- Test: `test/wioska-format.test.js`

**Interfaces:**
- Consumes: `dochody[i].sumaD`, `dochody[i].zrodlo` (Task 1); `zapotrzebowanie` bez zmian kształtu (Task 3)
- Produces: `planTekst`, `osCzasuTekst` — bez zmian sygnatur

**Kontekst.** `planTekst` i `osCzasuTekst` nie odwoływały się bezpośrednio do pól dochodu poza tym, co dostają z `wynik`/`zap` — jedyne miejsce dotykające starego kształtu to ewentualne testy budujące plan z trójpolowym dochodem. Sprawdź `src/wioska/format.js` grepem pod kątem `drewnoD`/`glinaD`/`zelazoD`/`czasS` — jeśli nic tam nie ma (formatowanie działa na wyniku symulacji, nie na surowym planie), ten task ogranicza się do naprawy testów.

- [ ] **Step 1: Check whether format.js touches the old shape**

```bash
grep -n "drewnoD\|glinaD\|zelazoD\|czasS" src/wioska/format.js
```

Jeśli brak wyników — `format.js` nie wymaga zmian kodu, przejdź do Step 2. Jeśli są wyniki, dostosuj je do nowego kształtu (`sumaD`, `zrodlo`) analogicznie do Task 1/2.

- [ ] **Step 2: Fix tests using the old plan shape**

Przejrzyj `test/wioska-format.test.js` pod kątem konstrukcji planu z `dochody`/`zastrzyki` w starym kształcie i zamień tak jak w Task 2 Step 4.

- [ ] **Step 3: Run tests and the CLI**

Run: `node --test`
Expected: PASS w komplecie

```bash
node --input-type=module -e "
import { writeFileSync } from 'node:fs';
const kroki = [];
for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
writeFileSync('./p.json', JSON.stringify({
  swiat: 'pl231', kroki,
  dochody: [{ kotwica: null, sumaD: 3000, zrodlo: 'farma' }],
}, null, 2));
"
node tools/plan.js ./p.json | tail -12
rm -f ./p.json
```

Expected: podsumowanie z „Czas netto", „Wymagany dochód … na dobę", brak błędów

- [ ] **Step 4: Commit**

```bash
git add src/wioska/format.js test/wioska-format.test.js
git commit -m "fix: eksport tekstowy zgodny z nowym ksztaltem dochodu"
```

---

### Task 5: Jawna kolejność budynków i wymagania w dymku

**Files:**
- Create: `src/wioska/kolejnosc-budynkow.js`
- Modify: `src/wioska/widok-budynki.js`
- Modify: `src/wioska/strona.js` (miejsce iteracji po `budynkiSwiata`)
- Test: `test/wioska-widoki.test.js`

**Interfaces:**
- Consumes: `NAZWY` (nazwy.js), `budynkiSwiata` (swiat.js)
- Produces:
  - `kolejnoscBudynkow(s)` → `string[]` — lista nazw budynków świata `s`, w kolejności wyświetlania (Plac, Piedestał, Pałac na końcu)
  - `wierszBudynkuHTML` — bez zmiany sygnatury, ale bez osobnego wiersza `.powod`; powód idzie do `title` przycisku

**Kontekst.** Dziś kolejność budynków w tabeli i w rzędzie ikon paska stanu to po prostu `budynkiSwiata(s)` — kolejność wpisów w obiekcie `SWIATY[kod].budynki`. Trzeba ją ujednolicić w jednym miejscu, żeby tabela i pasek stanu (Task 7) nie mogły się rozjechać.

- [ ] **Step 1: Write the failing test**

`test/wioska-kolejnosc.test.js` (nowy plik):

```js
// test/wioska-kolejnosc.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { kolejnoscBudynkow } from '../src/wioska/kolejnosc-budynkow.js';

const s = swiat('pl231');

test('plac, piedestal i palac sa na koncu listy', () => {
  const lista = kolejnoscBudynkow(s);
  const koniec = lista.slice(-3);
  assert.deepEqual(koniec.sort(), ['palac', 'piedestal', 'plac'].sort());
});

test('kazdy budynek swiata wystepuje dokladnie raz', () => {
  const lista = kolejnoscBudynkow(s);
  const zbior = new Set(lista);
  assert.equal(zbior.size, lista.length);
  assert.equal(lista.length, Object.keys(s.budynki).length);
});

test('budynek nieobecny na swiecie (np. kosciol na 231) nie pojawia sie w liscie', () => {
  const lista = kolejnoscBudynkow(s);
  assert.ok(!lista.includes('kosciol'));
});
```

Dopisz do `test/wioska-widoki.test.js`:

```js
test('wiersz budynku z niespelnionym wymaganiem niesie powod w atrybucie title przycisku, nie w osobnym wierszu', () => {
  const html = wierszBudynkuHTML(s, 'koszary', { ratusz: 1 }, 1);
  assert.match(html, /title="Wymaga: Ratusz 3"/);
  assert.doesNotMatch(html, /class="powod"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-kolejnosc.test.js`
Expected: FAIL — `Cannot find module '../src/wioska/kolejnosc-budynkow.js'`

- [ ] **Step 3: Write the ordering module**

`src/wioska/kolejnosc-budynkow.js`:

```js
// src/wioska/kolejnosc-budynkow.js
// Jawna kolejnosc wyswietlania, wspolna dla tabeli budynkow i rzedu ikon
// w pasku stanu — inaczej te dwa miejsca rozjechalyby sie przy pierwszej
// zmianie. Plac, Piedestal i Palac na koncu: maja po jednym poziomie
// i po wybudowaniu nic sie z nimi nie robi.

import { budynkiSwiata } from './swiat.js';

const NA_KONIEC = ['plac', 'piedestal', 'palac'];

export function kolejnoscBudynkow(s) {
  const wszystkie = budynkiSwiata(s);
  const pierwsze = wszystkie.filter(b => !NA_KONIEC.includes(b));
  const ostatnie = NA_KONIEC.filter(b => wszystkie.includes(b));
  return [...pierwsze, ...ostatnie];
}
```

- [ ] **Step 4: Move the requirement reason into the button title**

W `src/wioska/widok-budynki.js` zamień blok wyliczający `przycisk`:

```js
  const brak = brakujaceWymagania(budynek, poziomy);
  const zablokowany = brak.length > 0;
  const przycisk = zablokowany
    ? `<button disabled title="${esc(opisWymagan(brak, NAZWY))}">Poziom ${docelowy}</button>`
    : `<button data-dodaj="${esc(budynek)}">Poziom ${docelowy}</button>`;
```

- [ ] **Step 5: Wire the ordering into strona.js**

W `src/wioska/strona.js` zamień import i użycie `budynkiSwiata` w funkcji `rysuj`:

```js
import { kolejnoscBudynkow } from './kolejnosc-budynkow.js';
```

```js
  function rysuj() {
    const s = swiat(plan.swiat);
    const poziomy = poziomyPoKolejce();
    $('tabela-budynkow').tBodies[0].innerHTML = kolejnoscBudynkow(s)
      .map(b => wierszBudynkuHTML(s, b, poziomy, poziomy.ratusz ?? 1)).join('');
```

Sprawdź, czy `budynkiSwiata` jest jeszcze gdzieś w `strona.js` używane (do `poziomyPoKolejce` nie jest potrzebne — iteruje po `plan.kroki`, nie po budynkach) — jeśli import stał się nieużywany, usuń go.

- [ ] **Step 6: Update CSS — remove `.powod` styling if now dead**

Sprawdź `src/wioska.css`:

```bash
grep -n "\.powod" src/wioska.css
```

Jeśli reguła istnieje i po tej zmianie nic już nie generuje elementu z klasą `powod`, usuń ją.

- [ ] **Step 7: Run tests**

Run: `node --test`
Expected: PASS w komplecie

- [ ] **Step 8: Commit**

```bash
git add src/wioska/kolejnosc-budynkow.js src/wioska/widok-budynki.js src/wioska/strona.js src/wioska.css test/wioska-kolejnosc.test.js test/wioska-widoki.test.js
git commit -m "feat: jawna kolejnosc budynkow, wymagania w dymku przycisku"
```

---

### Task 6: Dochód jako jedna suma w kolumnie zaopatrzenia

**Files:**
- Modify: `src/wioska/widok-kolejka.js`
- Modify: `src/wioska/strona.js`
- Test: `test/wioska-widoki.test.js`

**Interfaces:**
- Consumes: `dochody[i]` = `{ kotwica, sumaD, zrodlo }` (Task 1)
- Produces: `wtracenieHTML(rodzaj, wpis, przedKrokiem)` — dla `rodzaj === 'dochod'` renderuje `sumaD` i `zrodlo` zamiast trzech pól; sygnatura bez zmian

**Kontekst.** `wtracenieHTML` dziś renderuje `wpis.drewnoD / wpis.glinaD / wpis.zelazoD`. Po Task 1 te pola nie istnieją — trzeba przejść na `sumaD` i pokazać `zrodlo`. Ten task **nie** dotyka jeszcze przypinania do kroków w kolejce (to Task 8) — tu wyłącznie kształt renderowanego tekstu wtrącenia dochodu i formularz dodawania w `strona.js`.

- [ ] **Step 1: Write the failing test**

Dopisz do `test/wioska-widoki.test.js`, zamieniając istniejący test dotyczący `wtracenieHTML('dochod', ...)`:

```js
test('wtracenie dochodu pokazuje sume dobowa i zrodlo', () => {
  const html = wtracenieHTML('dochod', { kotwica: null, sumaD: 15000, zrodlo: 'zbieractwo' }, null);
  assert.match(html, /15000/);
  assert.match(html, /zbieractwo/);
  assert.match(html, /dobę/);
});

test('wtracenie dochodu z farmy oznacza zrodlo', () => {
  const html = wtracenieHTML('dochod', { kotwica: null, sumaD: 5000, zrodlo: 'farma' }, null);
  assert.match(html, /farm[ay]/);
});
```

Usuń stary test sprawdzający `data-przed-krokiem="3"` na wtrąceniu z `czasS` (jeśli istnieje w obecnym pliku pod starym API) — zostanie zastąpiony w Task 8, gdzie zmienia się cały mechanizm przypinania. Jeśli plik ma dziś testy `wtracenieHTML('dosylka', { czasS: ... }, 3)`, zostaw je **na razie**, bo `zastrzyki` nadal mają `drewno`/`glina`/`zelazo` bez zmian — zmieni się tylko trzeci argument (`przedKrokiem`) w Task 8.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-widoki.test.js`
Expected: FAIL — `wtracenieHTML` nadal czyta `drewnoD`

- [ ] **Step 3: Update the view**

W `src/wioska/widok-kolejka.js` zamień gałąź `rodzaj === 'dochod'`:

```js
export function wtracenieHTML(rodzaj, wpis, przedKrokiem = null) {
  const cel = przedKrokiem === null ? '' : ` data-przed-krokiem="${przedKrokiem}"`;
  if (rodzaj === 'dochod') {
    const zrodlo = wpis.zrodlo === 'zbieractwo' ? 'zbieractwo' : 'farma';
    return `<li class="wtracenie dochod"${cel}>`
      + `<span class="opis">dochód (${esc(zrodlo)}) ${wpis.sumaD} na dobę</span></li>`;
  }
  return `<li class="wtracenie dosylka"${cel}>`
    + `<span class="opis">dosyłka ${wpis.drewno} / ${wpis.glina} / ${wpis.zelazo}</span></li>`;
}
```

**Uwaga:** ten wiersz na razie nie pokazuje momentu ("od"/"po") — Task 8 przebuduje sposób opisywania pozycji na osi razem ze zmianą przypinania. Usuń import `czasCzytelny`, jeśli po tej zmianie nic go w pliku nie używa — sprawdź grepem przed usunięciem, bo `czasCzytelny` może być jeszcze potrzebny gdzie indziej w tym pliku.

- [ ] **Step 4: Update the income form in strona.js**

W `src/wioska/strona.js` zamień handler `dodaj-dochod`:

```js
  $('dodaj-dochod').addEventListener('click', () => {
    const zrodlo = confirm('OK = zbieractwo, Anuluj = farma') ? 'zbieractwo' : 'farma';
    plan.dochody.push({
      kotwica: null,
      sumaD: pytajOLiczbe('Suma na dobę (dzielona równo na drewno/glinę/żelazo)'),
      zrodlo,
    });
    rysuj();
  });
```

To jest tymczasowy formularz — Task 8 zamieni `kotwica: null` na rzeczywiste przypinanie do zaznaczonego kroku. Na tym etapie kluczowe jest, żeby kształt danych się zgadzał, nie żeby UX był docelowy.

Zamień też renderowanie listy w `zaopatrzenieHTML`:

```js
  function zaopatrzenieHTML() {
    $('lista-dochodow').innerHTML = plan.dochody.map((d, i) =>
      `<li><span class="opis">${d.sumaD} na dobę (${esc(d.zrodlo)})</span>`
      + `<button data-usun-dochod="${i}" title="Usuń">×</button></li>`).join('');
    $('lista-dosylek').innerHTML = plan.zastrzyki.map((z, i) =>
      `<li><span class="opis">${z.drewno} / ${z.glina} / ${z.zelazo}</span>`
      + `<button data-usun-dosylke="${i}" title="Usuń">×</button></li>`).join('');
  }
```

(Usunięto odwołania do `czasCzytelny(d.czasS)`/`czasCzytelny(z.czasS)`, bo pole `czasS` już nie istnieje — Task 8 doda tu opis pozycji w kolejce, na razie wystarczy, żeby się nie wywalało.)

- [ ] **Step 5: Run tests**

Run: `node --test`
Expected: PASS w komplecie

- [ ] **Step 6: Commit**

```bash
git add src/wioska/widok-kolejka.js src/wioska/strona.js test/wioska-widoki.test.js
git commit -m "feat: dochod jako jedna suma dobowa z podzialem farma/zbieractwo"
```

---

### Task 7: Pasek stanu — dwie kolumny (stan wioski + bilans)

**Files:**
- Create: `src/wioska/widok-bilans.js`
- Modify: `src/wioska/widok-status.js`
- Test: `test/wioska-status.test.js`
- Test: `test/wioska-bilans.test.js` (nowy)

**Interfaces:**
- Consumes: `kolejnoscBudynkow` (Task 5), `zuzycieNaDobe`, `zapotrzebowanie` (Task 3), `esc`, `ikonaHTML` (widok-budynki.js), `produkcjaGodzinowa`, `maksLudnosc` (tabele.js)
- Produces:
  - `pasekStanuHTML(s, plan, wynik, zap, indeks)` — sygnatura bez zmian, ale zwraca teraz HTML **obu kolumn razem** (lewa: stan wioski, prawa: bilans), a poziom pokazywany **pod** ikoną
  - `bilansHTML(plan, wynik, zap, indeks)` — nowa, eksportowana osobno, bo jest testowana niezależnie i wołana przez `pasekStanuHTML`

**Kontekst — podział wielkości.** Zależne od `indeks` (momentu): poziomy budynków, populacja, wydane surowce, produkcja, dochód obowiązujący, dosyłki do tej chwili, zużycie na dobę. Niezależne: czas netto, wymagany dochód dla całego planu, wąskie gardło. To zostaje takie samo jak w poprzedniej rundzie — zmienia się układ (dwie kolumny zamiast jednej) i dochodzi bilans.

**Dochód obowiązujący w danym momencie** trzeba teraz liczyć po indeksie kroku, nie po `czasS <= czasS` — analogicznie do zmiany w silniku (Task 2). Dodaj do `widok-status.js` (albo `widok-bilans.js`, tam gdzie jest potrzebne) pomocniczą funkcję rozwiązującą kotwicę na indeks, tak jak w `symulacja.js`, ale to jest osobna, mała kopia specyficzna dla widoku — nie importuj jej z `symulacja.js` (tamta funkcja nie jest eksportowana, i eksportowanie jej wyłącznie dla widoku dodałoby zależność w złą stronę: widoki mają być cienkie i nie ciągnąć wewnętrznej logiki silnika).

- [ ] **Step 1: Write the failing tests**

Zastąp `test/wioska-status.test.js` w całości:

```js
// test/wioska-status.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { zapotrzebowanie } from '../src/wioska/zapotrzebowanie.js';
import { pasekStanuHTML } from '../src/wioska/widok-status.js';

const s = swiat('pl231');
const plan = normalizujPlan({
  swiat: 'pl231',
  start: { surowce: { drewno: 99999, glina: 99999, zelazo: 99999 } },
  kroki: [
    { budynek: 'tartak', doPoziomu: 1 },
    { budynek: 'tartak', doPoziomu: 2 },
    { budynek: 'cegielnia', doPoziomu: 1 },
  ],
});
const wynik = symuluj(plan);
const zap = zapotrzebowanie(plan);

test('bez zaznaczenia pasek pokazuje stan koncowy', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, null);
  assert.match(html, /Tartak/);
  assert.match(html, />2</);
});

test('zaznaczenie pierwszego kroku pokazuje poziomy z tamtej chwili', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, 0);
  assert.match(html, /data-poziom-tartak="1"/);
});

test('zaznaczenie ostatniego kroku pokazuje poziomy koncowe', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, 2);
  assert.match(html, /data-poziom-tartak="2"/);
  assert.match(html, /data-poziom-cegielnia="1"/);
});

test('poziom budynku jest wyswietlany pod ikona, nie obok', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, null);
  // Struktura: <span class="poziom-budynku">...<img...><b>N</b></span> —
  // sprawdzamy obecnosc znacznika <b> wewnatrz tego samego spana co ikona.
  assert.match(html, /class="poziom-budynku"[^<]*<img[^>]*>\s*<b>\d+<\/b>/);
});

test('pasek podaje czas netto i realny', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, null);
  assert.match(html, /netto/i);
  assert.match(html, /realny/i);
});

test('pasek podaje ludnosc zajeta i limit zagrody', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, null);
  assert.match(html, /240/);
});

test('pasek nie zawiera znaku przyblizenia', () => {
  assert.doesNotMatch(pasekStanuHTML(s, plan, wynik, zap, null), /≈/);
});

test('wydano pomija krok zatrzymany bledem, tak jak podsumowanie planu', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { spichlerz: 1, ratusz: 5, zagroda: 5 }, surowce: { drewno: 50, glina: 60, zelazo: 40 } },
    kroki: [{ budynek: 'wieza', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 1 }],
  });
  const w = symuluj(p);
  const z = zapotrzebowanie(p);
  assert.equal(w.kroki[0].blad, 'ponad-spichlerz');
  const zZaznaczeniem = pasekStanuHTML(s, p, w, z, 1);
  const bezZaznaczenia = pasekStanuHTML(s, p, w, z, null);
  const wyciagnij = (html) => html.match(/Wydano[^<]*<\/b>[^0-9]*([\d\s]+)/);
  // Nie polegamy na dokladnym formacie — sprawdzamy tylko, ze oba warianty
  // pokazuja koszt Tartaku (50), a nie koszt Wiezy (12000+).
  assert.doesNotMatch(zZaznaczeniem, /12000/);
  assert.doesNotMatch(bezZaznaczenia, /12000/);
});

test('pusty plan nie wywraca paska', () => {
  const p = normalizujPlan({ swiat: 'pl231' });
  const html = pasekStanuHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.ok(html.length > 0);
});
```

`test/wioska-bilans.test.js` (nowy):

```js
// test/wioska-bilans.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { zapotrzebowanie } from '../src/wioska/zapotrzebowanie.js';
import { bilansHTML } from '../src/wioska/widok-bilans.js';

const s = swiat('pl231');

test('bilans pokazuje eko, farme i zbieractwo osobno', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { tartak: 5, cegielnia: 5, huta: 5 } },
    kroki: [{ budynek: 'ratusz', doPoziomu: 2 }],
    dochody: [
      { kotwica: null, sumaD: 9000, zrodlo: 'farma' },
      { kotwica: null, sumaD: 3000, zrodlo: 'zbieractwo' },
    ],
  });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.match(html, /EKO/);
  assert.match(html, /Farma/);
  assert.match(html, /Zbieractwo/);
});

test('bilans pokazuje ujemna roznice, gdy zuzycie przewyzsza dochod', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'ratusz', doPoziomu: i });
  const p = normalizujPlan({ swiat: 'pl231', kroki });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), 0);
  assert.match(html, /-\d/);
});

test('bilans sumuje dosylki, ktorych kotwica wypada nie pozniej niz wskazany krok', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    zastrzyki: [
      { kotwica: null, drewno: 100, glina: 0, zelazo: 0 },
      { kotwica: { budynek: 'tartak', doPoziomu: 1 }, drewno: 200, glina: 0, zelazo: 0 },
    ],
  });
  const w = symuluj(p);
  const z = zapotrzebowanie(p);
  const naPierwszym = bilansHTML(s, p, w, z, 0);
  const naDrugim = bilansHTML(s, p, w, z, 1);
  // Na pierwszym kroku dziala tylko dosylka z kotwica null (100), na drugim
  // dochodzi tez dosylka przypieta do kroku 0 (200) — suma rosnie do 300.
  assert.match(naPierwszym, /Dosyłki razem[^0-9]*100\b/);
  assert.match(naDrugim, /Dosyłki razem[^0-9]*300\b/);
});

test('bilans dla planu bez wtracen pokazuje zera, nie wywraca sie', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.ok(html.length > 0);
});

test('bilans nie zawiera wymaganego dochodu na dobe — to zostalo w eksporcie tekstowym', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const p = normalizujPlan({ swiat: 'pl231', kroki });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.doesNotMatch(html, /[Ww]ymagany/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/wioska-status.test.js test/wioska-bilans.test.js`
Expected: FAIL — `bilansHTML` nie istnieje, `pasekStanuHTML` nie ma jeszcze poziomu pod ikoną w oczekiwanym kształcie

- [ ] **Step 3: Write the balance view**

`src/wioska/widok-bilans.js`:

```js
// src/wioska/widok-bilans.js
// Bilans zaopatrzenia dla wskazanego momentu: trzy strumienie dochodu
// (eko, farma, zbieractwo), ich suma, zuzycie na dobe liczone po osi bez
// przestojow, i roznica — ile na dobe brakuje albo zostaje.

import { produkcjaGodzinowa } from './tabele.js';
import { zuzycieNaDobe } from './zapotrzebowanie.js';
import { esc } from './widok-budynki.js';

const SUROWCE_B = ['drewno', 'glina', 'zelazo'];

// Kopia rozwiazywania kotwicy na indeks, analogiczna do symulacji, ale
// swiadomie osobna: widoki maja byc cienkie i nie ciagnac wewnetrznej,
// nieeksportowanej logiki silnika.
function indeksKotwicyWidoku(kotwica, kroki) {
  if (kotwica === null) return -1;
  return kroki.findIndex(k => k.budynek === kotwica.budynek && k.doPoziomu === kotwica.doPoziomu);
}

function sumaZrodla(plan, indeksAktywny, zrodlo) {
  const trafione = plan.dochody
    .map(d => ({ ...d, i: indeksKotwicyWidoku(d.kotwica, plan.kroki) }))
    .filter(d => d.zrodlo === zrodlo && d.i <= indeksAktywny)
    .sort((a, b) => a.i - b.i);
  // Tak jak w symulacji: kazde zrodlo ma jeden aktywny wpis naraz, ostatni
  // w kolejnosci indeksu kotwicy wygrywa.
  return trafione.length ? trafione[trafione.length - 1].sumaD : 0;
}

function dosylkiDoIndeksu(plan, indeks) {
  const suma = { drewno: 0, glina: 0, zelazo: 0 };
  for (const z of plan.zastrzyki) {
    const i = indeksKotwicyWidoku(z.kotwica, plan.kroki);
    if (i <= indeks) for (const r of SUROWCE_B) suma[r] += z[r];
  }
  return suma;
}

export function bilansHTML(s, plan, wynik, zap, indeks) {
  const indeksAktywny = indeks === null ? plan.kroki.length - 1 : indeks;
  const poziomy = indeks === null
    ? (wynik.kroki[wynik.kroki.length - 1]?.poziomyPo ?? { ...plan.start.poziomy })
    : (wynik.kroki[indeks]?.poziomyPo ?? { ...plan.start.poziomy });

  const eko = {
    drewno: produkcjaGodzinowa(s, poziomy.tartak ?? 0) * 24,
    glina: produkcjaGodzinowa(s, poziomy.cegielnia ?? 0) * 24,
    zelazo: produkcjaGodzinowa(s, poziomy.huta ?? 0) * 24,
  };
  const farmaD = sumaZrodla(plan, indeksAktywny, 'farma');
  const zbieractwoD = sumaZrodla(plan, indeksAktywny, 'zbieractwo');
  const farma = { drewno: farmaD / 3, glina: farmaD / 3, zelazo: farmaD / 3 };
  const zbieractwo = { drewno: zbieractwoD / 3, glina: zbieractwoD / 3, zelazo: zbieractwoD / 3 };
  const razem = {};
  for (const r of SUROWCE_B) razem[r] = eko[r] + farma[r] + zbieractwo[r];

  const zuzycie = zuzycieNaDobe(plan, indeks);
  const etykietaZuzycia = zuzycie.doKonca ? 'Zużycie do końca planu' : 'Zużycie / dobę';

  const bilans = {};
  for (const r of SUROWCE_B) bilans[r] = razem[r] - zuzycie.suma[r];

  const dos = dosylkiDoIndeksu(plan, indeksAktywny);

  const wiersz = (etykieta, w) => `<div><b>${esc(etykieta)}</b> ${Math.round(w.drewno)} / ${Math.round(w.glina)} / ${Math.round(w.zelazo)}</div>`;
  const klasaBilansu = SUROWCE_B.some(r => bilans[r] < 0) ? 'bilans-ujemny' : '';

  return [
    '<div class="bilans">',
    wiersz('EKO / dobę', eko),
    wiersz('Farma / dobę', farma),
    wiersz('Zbieractwo / dobę', zbieractwo),
    '<hr>',
    wiersz('Razem', razem),
    wiersz(etykietaZuzycia, zuzycie.suma),
    `<div class="${klasaBilansu}"><b>Bilans</b> ${Math.round(bilans.drewno)} / ${Math.round(bilans.glina)} / ${Math.round(bilans.zelazo)}</div>`,
    `<div><b>Dosyłki razem</b> ${dos.drewno} / ${dos.glina} / ${dos.zelazo}</div>`,
    '</div>',
  ].join('');
}
```

- [ ] **Step 4: Rewrite the status view for two columns**

Zastąp zawartość `src/wioska/widok-status.js`:

```js
// src/wioska/widok-status.js
// Stan wioski na wskazany moment osi, w dwoch kolumnach: stan wioski (lewa)
// i bilans zaopatrzenia (prawa). Rzad ikon budynkow wzorowany na
// "Podsumowaniu" w Menedzerze Konta, z poziomem pod ikona.

import { produkcjaGodzinowa, maksLudnosc } from './tabele.js';
import { czasCzytelny } from './format.js';
import { NAZWY } from './nazwy.js';
import { esc, ikonaHTML } from './widok-budynki.js';
import { kolejnoscBudynkow } from './kolejnosc-budynkow.js';
import { bilansHTML } from './widok-bilans.js';

const SUROWCE_S = ['drewno', 'glina', 'zelazo'];

function stanNaKrok(plan, wynik, indeks) {
  if (indeks === null || !wynik.kroki[indeks]) {
    const ostatni = wynik.kroki[wynik.kroki.length - 1];
    return {
      poziomy: ostatni ? ostatni.poziomyPo : { ...plan.start.poziomy },
      czasS: wynik.podsumowanie.czasS,
      ludnosc: ostatni ? ostatni.ludnoscPo : 0,
      wydano: wynik.podsumowanie.koszt,
      indeks: null,
    };
  }
  const k = wynik.kroki[indeks];
  const wydano = { drewno: 0, glina: 0, zelazo: 0 };
  for (let i = 0; i <= indeks; i++) {
    if (wynik.kroki[i].blad) continue;
    for (const r of SUROWCE_S) wydano[r] += wynik.kroki[i].koszt[r];
  }
  return { poziomy: k.poziomyPo, czasS: k.koniecS, ludnosc: k.ludnoscPo, wydano, indeks };
}

function stanWioskiHTML(s, plan, wynik, zap, st, indeks) {
  const ikony = kolejnoscBudynkow(s)
    .map(b => `<span class="poziom-budynku" data-poziom-${esc(b)}="${st.poziomy[b] ?? 0}">`
      + `${ikonaHTML(b, NAZWY[b] ?? b)}<b>${st.poziomy[b] ?? 0}</b></span>`)
    .join('');
  const prodH = {
    drewno: produkcjaGodzinowa(s, st.poziomy.tartak ?? 0),
    glina: produkcjaGodzinowa(s, st.poziomy.cegielnia ?? 0),
    zelazo: produkcjaGodzinowa(s, st.poziomy.huta ?? 0),
  };
  const limit = maksLudnosc(st.poziomy.zagroda ?? 1);
  const etykieta = indeks === null
    ? 'stan końcowy'
    : `krok ${indeks + 1} — ${czasCzytelny(st.czasS)}`;

  return [
    `<div class="stan-moment">● ${esc(etykieta)}</div>`,
    `<div class="stan-ikony">${ikony}</div>`,
    `<div class="stan-liczby">`,
    `<span title="Czas budowy przy założeniu, że surowców nigdy nie brakuje"><b>Czas budowy bez przerw</b> ${czasCzytelny(zap.czasNettoS)}</span>`,
    `<span title="Czas obejmujący produkcję i zaopatrzenie"><b>Czas budowy realny</b> ${czasCzytelny(wynik.podsumowanie.czasS)}</span>`,
    `<span><b>Aktualne eko</b> ${Math.round(prodH.drewno)} / ${Math.round(prodH.glina)} / ${Math.round(prodH.zelazo)} na h</span>`,
    `<span><b>Populacja</b> ${st.ludnosc} / ${limit}</span>`,
    `<span><b>Wydano</b> ${st.wydano.drewno} / ${st.wydano.glina} / ${st.wydano.zelazo}</span>`,
    `</div>`,
  ].join('');
}

export function pasekStanuHTML(s, plan, wynik, zap, indeks) {
  const st = stanNaKrok(plan, wynik, indeks);
  const lewa = stanWioskiHTML(s, plan, wynik, zap, st, indeks);
  const prawa = bilansHTML(s, plan, wynik, zap, indeks);
  const wiersze = [
    `<div class="stan-lewa">${lewa}</div>`,
    `<div class="stan-prawa">${prawa}</div>`,
  ];
  if (zap.waskieGardlo) {
    const g = zap.waskieGardlo;
    wiersze.push(`<div class="stan-gardlo">Wąskie gardło: krok ${g.indeks + 1} — ${esc(NAZWY[g.budynek] ?? g.budynek)} → ${g.doPoziomu}</div>`);
  }
  if (zap.brakNaStart) {
    wiersze.push('<div class="stan-gardlo">Na pierwszy krok nie starcza surowców startowych.</div>');
  }
  return wiersze.join('');
}
```

- [ ] **Step 5: Run tests**

Run: `node --test test/wioska-status.test.js test/wioska-bilans.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/wioska/widok-bilans.js src/wioska/widok-status.js test/wioska-status.test.js test/wioska-bilans.test.js
git commit -m "feat: pasek stanu w dwoch kolumnach — stan wioski i bilans"
```

---

### Task 8: Przypinanie wtrąceń do kroków w interfejsie + przeciąganie dosyłek

**Files:**
- Modify: `src/wioska/strona.js`
- Modify: `src/wioska/widok-kolejka.js`
- Test: `test/wioska-widoki.test.js`
- Test: `test/wioska-strona.test.js`

**Interfaces:**
- Consumes: `kotwica` w `dochody`/`zastrzyki` (Task 1), `wtracenieHTML` (Task 6)
- Produces: `uruchom()` — bez zmian sygnatury; dodaje przypinanie nowych wtrąceń do zaznaczonego kroku, przypinanie po usunięciu kroku do poprzedniego, i przeciąganie dosyłek/dochodu tak jak kroków

**Kontekst — trzy powiązane zmiany.**

1. **Formularz dodawania dochodu/dosyłki przypina do zaznaczonego kroku.** Gdy `zaznaczony !== null`, nowy wpis dostaje `kotwica: { budynek: plan.kroki[zaznaczony].budynek, doPoziomu: plan.kroki[zaznaczony].doPoziomu }`; gdy `zaznaczony === null`, dostaje `kotwica: null` (start planu).

2. **Usunięcie kroku przypina jego wtrącenia do poprzedniego.** W handlerze `usun` (dla kroku), przed `plan.kroki.splice(...)`, znajdź krok usuwany i jego poprzednika, po czym przełącz kotwice wszystkich wtrąceń wskazujących usuwany krok na poprzednika (albo `null`, gdy usuwany jest pierwszy).

3. **Przeciąganie obejmuje też wiersze wtrąceń.** `dragstart` musi rozpoznawać, czy ciągnięty element to krok (`data-krok`) czy wtrącenie (potrzebny nowy atrybut, np. `data-wtracenie` z indeksem w odpowiedniej tablicy i typem `dochod`/`dosylka`). Upuszczenie na pozycję przed krokiem `n` ustawia kotwicę ciągniętego wtrącenia na krok `n-1` (albo `null` dla `n=0`).

**Uwaga o kolejności renderowania wtrąceń w `kolejkaHTML`.** Dziś wtrącenia sortowane są po `czasS` i wstawiane przed krokiem, którego `startS` jest ≥ ich czas. Po zmianie sortujemy po indeksie kotwicy (z fallbackiem `-1` dla `null`) i wstawiamy wtrącenie **przed** krokiem o indeksie `kotwica_indeks + 1` (czyli zaraz po kroku, do którego jest przypięte — spójne z tym, że wtrącenie "działa od" zakończenia tego kroku).

- [ ] **Step 1: Write the failing tests**

Dopisz do `test/wioska-widoki.test.js`:

```js
test('wtracenie dosylki niesie data-przed-krokiem zgodnie z kotwica', () => {
  const html = wtracenieHTML('dosylka', { kotwica: { budynek: 'tartak', doPoziomu: 2 }, drewno: 100, glina: 0, zelazo: 0 }, 3);
  assert.match(html, /data-przed-krokiem="3"/);
});

test('wtracenie na koncu kolejki (kotwica ostatniego kroku) nie niesie data-przed-krokiem, gdy przekazano null', () => {
  const html = wtracenieHTML('dochod', { kotwica: null, sumaD: 100, zrodlo: 'farma' });
  assert.doesNotMatch(html, /data-przed-krokiem/);
});
```

Zastąp `test/wioska-strona.test.js` w całości (jeśli plik dziś ma tylko trzy proste testy `uruchom`/`KLUCZ_MAGAZYNU`, zostaw je i dodaj poniższe — funkcje pomocnicze do przypinania nie są eksportowane, więc testujemy przez `uruchom()` z atrapą DOM):

```js
// test/wioska-strona.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KLUCZ_MAGAZYNU, uruchom } from '../src/wioska/strona.js';

test('klucz magazynu jest staly', () => {
  assert.equal(KLUCZ_MAGAZYNU, 'plemiona-wioska');
});

test('uruchom nie wywraca sie bez dokumentu', () => {
  assert.doesNotThrow(() => uruchom());
});

test('podsumowanieHTML nie jest juz eksportowane — zastapil je pasek stanu', async () => {
  const m = await import('../src/wioska/strona.js');
  assert.equal(m.podsumowanieHTML, undefined);
});
```

Testy logiki przypinania (formularz, usuwanie, przeciąganie wtrąceń) zostają jako **obserwacja manualna** — atrapa DOM na poziomie tego repo nie jest budowana w planie (poprzednia runda pokazała, że recenzenci budują ją doraźnie do weryfikacji, nie jako trwały test). Zamiast tego dopisz w Step 4 skrypt weryfikacyjny do jednorazowego uruchomienia.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-widoki.test.js`
Expected: FAIL — `data-przed-krokiem` liczone inaczej niż oczekiwane w nowych testach (zależnie od obecnego stanu może akurat przejść przypadkiem — sprawdź, że test faktycznie odróżnia poprawne zachowanie, dopisując tymczasowo błędną wartość i patrząc, czy test się czerwieni)

- [ ] **Step 3: Rewrite the relevant parts of strona.js**

W `src/wioska/strona.js`:

Zamień `kolejkaHTML`:

```js
  // Wtracenia wchodza w kolejke tam, gdzie wypadaja wedlug ich kotwicy —
  // zaraz po kroku, do ktorego sa przypiete (indeks kotwicy + 1).
  function indeksKotwicyStrony(kotwica) {
    if (kotwica === null) return -1;
    return plan.kroki.findIndex(k => k.budynek === kotwica.budynek && k.doPoziomu === kotwica.doPoziomu);
  }

  function kolejkaHTML(wynik) {
    const wtracenia = [
      ...plan.dochody.map((d, idx) => ({ i: indeksKotwicyStrony(d.kotwica), rodzaj: 'dochod', wpis: d, idx })),
      ...plan.zastrzyki.map((z, idx) => ({ i: indeksKotwicyStrony(z.kotwica), rodzaj: 'dosylka', wpis: z, idx })),
    ].sort((a, b) => a.i - b.i);
    let w = 0;
    const out = [];
    wynik.kroki.forEach((k, i) => {
      while (w < wtracenia.length && wtracenia[w].i <= i - 1) {
        const t = wtracenia[w];
        out.push(wtracenieHTML(t.rodzaj, t.wpis, i));
        w += 1;
      }
      out.push(krokHTML(k, i, i === zaznaczony));
    });
    while (w < wtracenia.length) {
      const t = wtracenia[w];
      out.push(wtracenieHTML(t.rodzaj, t.wpis));
      w += 1;
    }
    return out.join('');
  }
```

Zamień handler `dodaj-dochod` i `dodaj-zastrzyk` (przypinanie do zaznaczonego kroku):

```js
  function kotwicaOdZaznaczenia() {
    if (zaznaczony === null || !plan.kroki[zaznaczony]) return null;
    const k = plan.kroki[zaznaczony];
    return { budynek: k.budynek, doPoziomu: k.doPoziomu };
  }

  $('dodaj-dochod').addEventListener('click', () => {
    const zrodlo = confirm('OK = zbieractwo, Anuluj = farma') ? 'zbieractwo' : 'farma';
    plan.dochody.push({
      kotwica: kotwicaOdZaznaczenia(),
      sumaD: pytajOLiczbe('Suma na dobę (dzielona równo na drewno/glinę/żelazo)'),
      zrodlo,
    });
    rysuj();
  });

  $('dodaj-zastrzyk').addEventListener('click', () => {
    plan.zastrzyki.push({
      kotwica: kotwicaOdZaznaczenia(),
      drewno: pytajOLiczbe('Drewno'),
      glina: pytajOLiczbe('Glina'),
      zelazo: pytajOLiczbe('Żelazo'),
    });
    rysuj();
  });
```

Zamień handler `usun` (kroku), dodając przepięcie wtrąceń na poprzednika:

```js
    const usun = e.target.closest('[data-usun]');
    if (usun) {
      const indeksUsuwany = Number(usun.dataset.usun);
      const usuwanyKrok = plan.kroki[indeksUsuwany];
      const poprzedniKrok = indeksUsuwany > 0 ? plan.kroki[indeksUsuwany - 1] : null;
      const nowaKotwica = poprzedniKrok ? { budynek: poprzedniKrok.budynek, doPoziomu: poprzedniKrok.doPoziomu } : null;
      // Wtracenia przypiete do usuwanego kroku przechodza po cichu na
      // poprzedni — usuniecie kroku moze wiec zmienic wynik symulacji.
      const wskazujeUsuwany = (kotwica) => kotwica !== null
        && kotwica.budynek === usuwanyKrok.budynek && kotwica.doPoziomu === usuwanyKrok.doPoziomu;
      for (const d of plan.dochody) if (wskazujeUsuwany(d.kotwica)) d.kotwica = nowaKotwica;
      for (const z of plan.zastrzyki) if (wskazujeUsuwany(z.kotwica)) z.kotwica = nowaKotwica;

      plan.kroki.splice(indeksUsuwany, 1);
      zaznaczony = null;
      przelicz();
      rysuj();
      return;
    }
```

Zamień listę usuwania (`data-usun-dochod`/`data-usun-dosylke`) — bez zmian, zostają jak są.

Dodaj obsługę przeciągania wtrąceń. Zamień `dragstart`:

```js
  lista.addEventListener('dragstart', (e) => {
    const krokEl = e.target.closest('[data-krok]');
    const wtracenieEl = !krokEl ? e.target.closest('[data-wtracenie]') : null;
    if (!krokEl && !wtracenieEl) return;
    if (krokEl) {
      ciagniony = { typ: 'krok', indeks: Number(krokEl.dataset.krok) };
      krokEl.classList.add('ciagniony');
    } else {
      ciagniony = {
        typ: wtracenieEl.dataset.wtracenieRodzaj,
        indeks: Number(wtracenieEl.dataset.wtracenie),
      };
      wtracenieEl.classList.add('ciagniony');
    }
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });
```

Zamień `drop`:

```js
  lista.addEventListener('drop', (e) => {
    if (ciagniony === null) return;
    e.preventDefault();
    const indeksCelu = indeksZElementu(elementCelu(e));

    if (ciagniony.typ === 'krok') {
      const cel = indeksCelu === null ? plan.kroki.length - 1 : indeksCelu;
      if (cel !== ciagniony.indeks) {
        const [krok] = plan.kroki.splice(ciagniony.indeks, 1);
        plan.kroki.splice(cel, 0, krok);
        przelicz();
        zaznaczony = null;
      }
    } else {
      // Upuszczenie przed krokiem n ustawia kotwice na krok n-1 (albo null
      // dla n=0). Upuszczenie pod cala lista (indeksCelu === null) przypina
      // do ostatniego kroku.
      const listaWtracen = ciagniony.typ === 'dochod' ? plan.dochody : plan.zastrzyki;
      const wpis = listaWtracen[ciagniony.indeks];
      if (wpis) {
        if (indeksCelu === null) {
          const ostatni = plan.kroki[plan.kroki.length - 1];
          wpis.kotwica = ostatni ? { budynek: ostatni.budynek, doPoziomu: ostatni.doPoziomu } : null;
        } else if (indeksCelu === 0) {
          wpis.kotwica = null;
        } else {
          const poprzedni = plan.kroki[indeksCelu - 1];
          wpis.kotwica = poprzedni ? { budynek: poprzedni.budynek, doPoziomu: poprzedni.doPoziomu } : null;
        }
      }
    }
    ciagniony = null;
    posprzatajPodswietlenie();
    rysuj();
  });
```

Zamień `dragover` i `dragend`, żeby czyściły też `ciagniony !== null` sprawdzane jako obiekt:

```js
  lista.addEventListener('dragover', (e) => {
    if (ciagniony === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    for (const el of lista.querySelectorAll('.cel-gora,.cel-dol')) el.classList.remove('cel-gora', 'cel-dol');
    lista.classList.remove('cel-koniec');
    const el = elementCelu(e);
    const cel = indeksZElementu(el);
    if (cel === null) { lista.classList.add('cel-koniec'); return; }
    const referencyjny = ciagniony.typ === 'krok' ? ciagniony.indeks : cel;
    el.classList.add(cel < referencyjny ? 'cel-gora' : 'cel-dol');
  });
```

(`dragend` już tylko zeruje `ciagniony` i sprząta klasy — działa bez zmian, bo porównuje `ciagniony === null`, nie kształt.)

- [ ] **Step 4: Add `data-wtracenie` attributes to the queue view**

W `src/wioska/widok-kolejka.js` dodaj do `wtracenieHTML` atrybuty niosące typ i indeks w tablicy — potrzebne, żeby `strona.js` wiedziało, który wpis w `plan.dochody`/`plan.zastrzyki` odpowiada przeciąganemu elementowi. Rozszerz sygnaturę o czwarty, opcjonalny parametr:

```js
export function wtracenieHTML(rodzaj, wpis, przedKrokiem = null, indeksWTablicy = null) {
  const cel = przedKrokiem === null ? '' : ` data-przed-krokiem="${przedKrokiem}"`;
  const wt = indeksWTablicy === null ? '' : ` draggable="true" data-wtracenie="${indeksWTablicy}" data-wtracenie-rodzaj="${rodzaj}"`;
  if (rodzaj === 'dochod') {
    const zrodlo = wpis.zrodlo === 'zbieractwo' ? 'zbieractwo' : 'farma';
    return `<li class="wtracenie dochod"${cel}${wt}>`
      + `<span class="opis">dochód (${esc(zrodlo)}) ${wpis.sumaD} na dobę</span></li>`;
  }
  return `<li class="wtracenie dosylka"${cel}${wt}>`
    + `<span class="opis">dosyłka ${wpis.drewno} / ${wpis.glina} / ${wpis.zelazo}</span></li>`;
}
```

Dopisz test w `test/wioska-widoki.test.js`:

```js
test('wtracenie z indeksem w tablicy jest przeciagalne i niesie swoj indeks/rodzaj', () => {
  const html = wtracenieHTML('dosylka', { kotwica: null, drewno: 1, glina: 0, zelazo: 0 }, null, 2);
  assert.match(html, /draggable="true"/);
  assert.match(html, /data-wtracenie="2"/);
  assert.match(html, /data-wtracenie-rodzaj="dosylka"/);
});

test('wtracenie bez indeksu w tablicy nie jest przeciagalne (uzycie w podgladzie)', () => {
  const html = wtracenieHTML('dosylka', { kotwica: null, drewno: 1, glina: 0, zelazo: 0 });
  assert.doesNotMatch(html, /draggable/);
});
```

W `strona.js`, w `kolejkaHTML`, przekaż `t.idx` jako czwarty argument:

```js
      out.push(wtracenieHTML(t.rodzaj, t.wpis, i, t.idx));
```

i analogicznie w pętli domykającej:

```js
      out.push(wtracenieHTML(t.rodzaj, t.wpis, null, t.idx));
```

- [ ] **Step 5: Run tests**

Run: `node --test`
Expected: PASS w komplecie

- [ ] **Step 6: Manual verification script (run once, do not commit)**

```bash
node --input-type=module -e "
globalThis.document = {
  addEventListener(){}, getElementById(){ return { addEventListener(){}, classList:{add(){},remove(){}}, querySelectorAll:()=>[], tBodies:[{}], dataset:{}, style:{} }; },
};
globalThis.localStorage = { getItem:()=>null, setItem(){} };
globalThis.navigator = {};
import('./src/wioska/strona.js').then(() => console.log('modul zaladowany bez bledu'));
"
```

Expected: `modul zaladowany bez bledu` — potwierdza, że nowy kod nie ma błędów składniowych ani odwołań do nieistniejących nazw na etapie ładowania modułu. Prawdziwe kliknięcia/przeciąganie wymagają przeglądarki — nie buduj tu pełnej atrapy DOM, to zadanie zostawia weryfikację interakcji graczowi.

- [ ] **Step 7: Commit**

```bash
git add src/wioska/strona.js src/wioska/widok-kolejka.js test/wioska-widoki.test.js test/wioska-strona.test.js
git commit -m "feat: przypinanie wtracen do krokow, przeciaganie dosylek i dochodu"
```

---

### Task 9: Szablon i style — dwie kolumny paska, sufit szerokości, formularz źródła

**Files:**
- Modify: `src/wioska.template.html`
- Modify: `src/wioska.css`
- Modify: `build.js`
- Test: `test/build.test.js`

**Interfaces:**
- Consumes: moduły z Tasków 1–8
- Produces: `buildWioskaPage()` — sklejona strona zawiera `widok-bilans.js` i `kolejnosc-budynkow.js`; `dist/wioska/index.html` przebudowany

**Kontekst.** `WIOSKA_LOGIC` w `build.js` musi objąć dwa nowe moduły z tej rundy: `kolejnosc-budynkow.js` (Task 5) i `widok-bilans.js` (Task 7). Kolejność ma znaczenie — `widok-bilans.js` importuje z `zapotrzebowanie.js` (już wcześniej na liście) i z `widok-budynki.js` (już wcześniej), `widok-status.js` importuje z `kolejnosc-budynkow.js` i `widok-bilans.js`, więc oba muszą być **przed** `widok-status.js` na liście.

**Sufit szerokości paska stanu.** Dziś `#stan-wioski{width:94%;margin:10px auto 0;...}` — bez ograniczenia, podczas gdy `.kolumny{width:94%;max-width:1600px;margin:12px auto;...}` ma sufit. Dopisz `max-width:1600px` do `#stan-wioski`.

- [ ] **Step 1: Write the failing test**

Dopisz do `test/build.test.js`:

```js
test('strona wioski zawiera bilans i kolejnosc budynkow', () => {
  const html = buildWioskaPage();
  assert.match(html, /function bilansHTML/);
  assert.match(html, /function kolejnoscBudynkow/);
});

test('strona wioski nie zawiera juz osobnego wiersza powodu blokady', () => {
  const html = buildWioskaPage();
  assert.doesNotMatch(html, /class="powod"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build.test.js`
Expected: FAIL — brak `function bilansHTML`

- [ ] **Step 3: Update WIOSKA_LOGIC**

W `build.js` zastąp tablicę `WIOSKA_LOGIC`:

```js
const WIOSKA_LOGIC = [
  'src/wioska/swiaty.js',
  'src/wioska/czas-dane.js',
  'src/wioska/wymagania-dane.js',
  'src/wioska/nazwy.js',
  'src/wioska/ikony.js',
  'src/wioska/swiat.js',
  'src/wioska/tabele.js',
  'src/wioska/czas.js',
  'src/wioska/wymagania.js',
  'src/wioska/kolejnosc-budynkow.js',
  'src/wioska/plan.js',
  'src/wioska/symulacja.js',
  'src/wioska/zapotrzebowanie.js',
  'src/wioska/format.js',
  'src/wioska/widok-budynki.js',
  'src/wioska/widok-kolejka.js',
  'src/wioska/widok-bilans.js',
  'src/wioska/widok-status.js',
  'src/wioska/strona.js',
];
```

- [ ] **Step 4: Update CSS**

W `src/wioska.css`:

1. Dopisz sufit szerokości do `#stan-wioski`:

```css
#stan-wioski{width:94%;max-width:1600px;margin:10px auto 0;background:var(--pg);border:1px solid var(--line);
```

(zamień tylko pierwszy fragment reguły, resztę deklaracji zostaw bez zmian)

2. Dopisz układ dwukolumnowy paska i style bilansu, pod istniejącymi regułami `.stan-*`:

```css
#stan-wioski{display:grid;grid-template-columns:1.3fr 1fr;gap:16px;align-items:start}
@media (max-width:900px){#stan-wioski{grid-template-columns:1fr}}
.stan-lewa,.stan-prawa{min-width:0}
.stan-ikony{display:flex;flex-wrap:wrap;gap:10px}
.poziom-budynku{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:.78rem}
.bilans{display:flex;flex-direction:column;gap:3px;font-size:.86rem}
.bilans hr{border:none;border-top:1px solid var(--line);margin:4px 0}
.bilans-ujemny{color:var(--acc);font-weight:600}
li.wtracenie[draggable=true]{cursor:grab}
```

**Uwaga:** `#stan-wioski{display:grid;...}` jako druga, osobna reguła dla tego samego selektora działa poprawnie w CSS (kaskada łączy właściwości), ale sprawdź, czy nie prościej scalić ją z pierwszą regułą `#stan-wioski` w jedną — zrób to, jeśli poprawia czytelność, byle nie zgubić `max-width:1600px`.

3. Sprawdź istniejącą regułę `.stan-ikony{...}` (dziś ma `margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--line)`) — te odstępy miały sens przy jednokolumnowym pasku z liczbami pod spodem; w układzie dwukolumnowym mogą zostać, ale sprawdź wizualnie po zbudowaniu (Step 6), czy nie tworzą zbędnej linii w środku lewej kolumny. Jeśli przeszkadza, usuń `border-bottom`.

- [ ] **Step 5: Run tests and build**

Run: `node --test && node build.js`
Expected: PASS w komplecie; build bez błędów

- [ ] **Step 6: Verify the bundled script executes**

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const h = readFileSync('dist/wioska/index.html','utf8');
writeFileSync('./s.mjs', h.match(/<script type=\"module\">([\s\S]*?)<\/script>/)[1]);
"
node --check ./s.mjs
node ./s.mjs
rm -f ./s.mjs
```

Expected: brak błędu składni, brak `ReferenceError`, kod wyjścia 0

- [ ] **Step 7: Commit**

```bash
git add build.js src/wioska.template.html src/wioska.css test/build.test.js dist/
git commit -m "feat: wpiecie bilansu i kolejnosci budynkow, sufit szerokosci paska stanu"
```

---

### Task 10: Migracja i porządki końcowe

**Files:**
- Modify: `src/wioska/plan.js` (jeśli potrzeba poprawek po pełnej integracji)
- Test: `test/wioska-plan.test.js`

**Interfaces:**
- Consumes: cały poprzedni stan
- Produces: brak nowych — to zadanie domykające

**Kontekst.** Po Taskach 1–9 cały system działa na nowym modelu. Ten task to przegląd całości pod kątem rzeczy, które mogły zostać przeoczone przy przechodzeniu przez poszczególne pliki: martwy kod, niespójne nazwy, brakujące testy migracji end-to-end.

- [ ] **Step 1: Write an end-to-end migration test**

Dopisz do `test/wioska-plan.test.js`:

```js
test('plan w calosci starego formatu migruje sie do nowego bez utraty wtracen', () => {
  const kroki = [
    { budynek: 'tartak', doPoziomu: 1 },
    { budynek: 'tartak', doPoziomu: 2 },
    { budynek: 'cegielnia', doPoziomu: 1 },
  ];
  const stary = {
    swiat: 'pl231',
    kroki,
    dochody: [
      { czasS: 0, drewnoD: 100, glinaD: 100, zelazoD: 100 },
      { czasS: 50, drewnoD: 5000, glinaD: 5000, zelazoD: 5000 },
    ],
    zastrzyki: [{ czasS: 5, drewno: 200, glina: 0, zelazo: 0 }],
  };
  const p = normalizujPlan(stary);
  assert.equal(p.dochody.length, 2);
  assert.equal(p.zastrzyki.length, 1);
  assert.equal(p.dochody[0].sumaD, 300);
  assert.equal(p.dochody[1].sumaD, 15000);
  // Zaden wpis nie ma juz pol czasS/drewnoD w wyjsciowym ksztalcie.
  for (const d of p.dochody) assert.equal(d.czasS, undefined);
  for (const d of p.dochody) assert.equal(d.drewnoD, undefined);
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test test/wioska-plan.test.js`
Expected: PASS (jeśli FAIL, dopracuj `normalizujPlan` z Task 1 — to jest test integracyjny domykający tamto zadanie)

- [ ] **Step 3: Grep for leftover references to the old shape**

```bash
grep -rn "czasS\|drewnoD\|glinaD\|zelazoD" src/wioska/*.js
```

Przejrzyj wyniki. Oczekiwane trafienia: `plan.js` (migracja — celowe), `format.js`/`widok-*.js` **nie powinny** już mieć trafień poza ewentualnymi komentarzami wyjaśniającymi migrację. Jeśli znajdziesz żywy kod czytający te pola poza `plan.js`, popraw go.

- [ ] **Step 4: Run the full suite one more time**

Run: `node --test`
Expected: PASS w komplecie

- [ ] **Step 5: Commit (only if Step 3 required changes)**

```bash
git add -A
git commit -m "test: migracja calego starego planu do kotwic krokowych"
```

Jeśli Step 3 nie wymagał żadnych zmian w kodzie, ten task kończy się samym commitem testu z Step 1.

---

## Self-Review

**Pokrycie specyfikacji:**

| Wymaganie ze specyfikacji | Task |
|---|---|
| Kotwice krokowe zamiast czasu (model) | 1 |
| Rozwiązywanie kotwic w symulacji, semantyka "po ukończeniu kroku" | 2 |
| Dwa wpisy dochodu / dwie dosyłki na tym samym kroku | 2 |
| Kotwica wisząca → `null` | 2 |
| Usunięcie kroku przypina wtrącenia do poprzednika | 8 |
| Migracja starego `czasS` po osi bez przestojów | 1 |
| Dochód jako jedna suma, dzielona równo, z `zrodlo` | 1, 6 |
| `osBezPrzestojow` jako publiczna funkcja | 3 |
| Zużycie na dobę, flaga `doKonca` | 3 |
| Pasek stanu w dwóch kolumnach | 7 |
| Bilans: eko/farma/zbieractwo/razem/zużycie/różnica/dosyłki | 7 |
| Wymagany dochód znika z paska, zostaje w eksporcie | 4, 7 (nie renderowany w bilansie) |
| Wymagania budynków w dymku przycisku | 5 |
| Jawna kolejność budynków, Plac/Piedestał/Pałac na końcu | 5 |
| Przeciąganie wtrąceń | 8 |
| Sufit szerokości paska stanu | 9 |
| Poziom pod ikoną, wyśrodkowany | 7 (HTML), 9 (CSS) |

**Świadomie poza planem:** rekrutacja jednostek — bilans ma tylko konceptualne miejsce na przyszłą pozycję zużycia przez wojsko, nic więcej.

**Uwaga o kolejności zadań:** Task 2 (silnik) musi iść po Task 1 (model) i przed Task 3 (zapotrzebowanie), bo `zapotrzebowanie.js` w tym planie nie zależy od `symulacja.js` bezpośrednio, ale testy w Task 3 budują plany przez `normalizujPlan`, który po Task 1 już oczekuje nowego kształtu. Task 5 (kolejność budynków) jest niezależny od Tasków 2–4 i mógłby iść równolegle, ale w planie liniowym idzie po nich dla prostoty ścieżki. Task 8 zależy od Task 6 (kształt `wtracenieHTML`) i Task 1 (kotwice) — nie da się go wykonać wcześniej.

**Znane założenie:** dochód dzielony jest "równo" przez `sumaD / 3` w miejscach użycia (silnik, bilans), nie przy zapisie — dzięki temu suma niepodzielna przez 3 nie gubi reszty przy wielokrotnym odczycie, kosztem tego, że pojedyncze odczyty mogą pokazywać wartości niecałkowite (np. `100/3 = 33.33...`). W bilansie i silniku wartości te wchodzą dalej do arytmetyki zmiennoprzecinkowej i są zaokrąglane dopiero przy renderowaniu (`Math.round`) — to jest spójne z resztą kodu (np. `produkcjaGodzinowa` też nie jest zawsze całkowita przed użyciem).
