# Przebudowa interfejsu symulatora — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zastąpić rozpisywanie przestojów dwiema odpornymi liczbami — czasem netto planu i wymaganym dochodem na dobę — oraz przebudować ekran na górny pasek narzędzi, pasek stanu wioski i trzy kolumny.

**Architecture:** Nowa arytmetyka trafia do osobnego modułu `zapotrzebowanie.js`, niezależnego od symulacji. Rozrośnięty `strona.js` dzieli się na trzy czyste moduły widoków i cienką warstwę wpinania zdarzeń. Silnik zmienia się minimalnie: dochód liczony na dobę i poziomy budynków po każdym kroku.

**Tech Stack:** Node.js ≥ 20 (wbudowany `node:test`), czysty ESM, zero zależności runtime, zero zależności deweloperskich.

**Spec:** `docs/superpowers/specs/2026-07-27-przebudowa-interfejsu-symulatora-design.md`

## Global Constraints

- **Zero zależności.** Nie wolno dodać niczego do `package.json`. Brak `dependencies` i `devDependencies`.
- **Strona samowystarczalna.** Żadnego `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `<script src>`, `<link rel=stylesheet>` ani adresów `http`/`https` poza `www.w3.org`. Wyjątek: `tools/fetch-swiat.js`.
- **Testy** przez `node --test`, pliki `test/*.test.js`, `import { test } from 'node:test'` i `import assert from 'node:assert/strict'`.
- **Język.** Nazwy i komentarze po polsku, **bez polskich znaków w identyfikatorach** (`ludnosc`, nie `ludność`). Komentarze wyjaśniają *dlaczego*, nie *co*.
- **Każdy plik w `src/` zaczyna się komentarzem ze swoją ścieżką**, np. `// src/wioska/zapotrzebowanie.js`.
- **Nazwy najwyższego poziomu unikalne w całym repozytorium** — `build.js` skleja moduły `src/wioska/*.js` w jeden wspólny zakres, usuwając linie `import` i słowo `export`. Kolizja to błąd składni w przeglądarce, którego testy Node nie wyłapią.
- **Każdy `import` w jednej linii** — `build.js` usuwa je regexem jednoliniowym.
- **Czas w sekundach.** Dochód i dosyłki podawane na dobę, dzielone przez 86400 przy użyciu.
- **Znak `≈` nie może pojawić się w żadnym widoku ani w eksporcie tekstowym.**

**Stan wyjściowy:** gałąź `symulator-wioski`, 222 testy przechodzą, `node build.js` generuje pięć stron w `dist/`. Pliki w `dist/` są śledzone w git i commitowane razem ze źródłami.

---

### Task 1: Dochód na dobę ze zgodnością wsteczną

**Files:**
- Modify: `src/wioska/plan.js`
- Test: `test/wioska-plan.test.js`

**Interfaces:**
- Consumes: `SWIATY`, `swiat`, `poziomyStartowe`, `maksPoziom`, `budynkiSwiata`
- Produces: `dochody[i]` = `{ czasS, drewnoD, glinaD, zelazoD }` — wartości **na dobę**. `normalizujPlan` przyjmuje też stary zapis `drewnoH`/`glinaH`/`zelazoH` i mnoży go przez 24.

**Kontekst:** gracz ma w przeglądarce zapisany plan w starym formacie. Bez tolerancji dla starych pól jego kolejka przepadnie przy pierwszym wczytaniu.

- [ ] **Step 1: Write the failing test**

Dopisz do `test/wioska-plan.test.js`:

```js
test('dochod jest normalizowany do wartosci na dobe', () => {
  const p = normalizujPlan({ swiat: 'pl231', dochody: [{ czasS: 0, drewnoD: 5000 }] });
  assert.deepEqual(p.dochody[0], { czasS: 0, drewnoD: 5000, glinaD: 0, zelazoD: 0 });
});

// Plan zapisany w przegladarce przed ta zmiana ma pola godzinowe.
test('stary zapis godzinowy przelicza sie na dobowy', () => {
  const p = normalizujPlan({ swiat: 'pl231', dochody: [{ czasS: 0, drewnoH: 100, glinaH: 50 }] });
  assert.equal(p.dochody[0].drewnoD, 2400);
  assert.equal(p.dochody[0].glinaD, 1200);
  assert.equal(p.dochody[0].zelazoD, 0);
});

test('zapis dobowy wygrywa, gdy w planie sa oba', () => {
  const p = normalizujPlan({ swiat: 'pl231', dochody: [{ czasS: 0, drewnoH: 100, drewnoD: 7 }] });
  assert.equal(p.dochody[0].drewnoD, 7);
});

test('zero na dobe zostaje zerem, nie jest brane za brak wartosci', () => {
  const p = normalizujPlan({ swiat: 'pl231', dochody: [{ czasS: 0, drewnoH: 100, drewnoD: 0 }] });
  assert.equal(p.dochody[0].drewnoD, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-plan.test.js`
Expected: FAIL — `drewnoD` jest `undefined`

- [ ] **Step 3: Write the implementation**

W `src/wioska/plan.js` zastąp blok `dochody:` w `normalizujPlan`:

```js
    dochody: [...(surowy?.dochody ?? [])]
      .map(d => ({
        czasS: Number(d.czasS ?? 0),
        // Plany zapisane przed przejsciem na dobe maja pola godzinowe.
        // Operator ?? zostawia jawne zero, wiec 0 na dobe nie wraca do wersji godzinowej.
        drewnoD: Number(d.drewnoD ?? (d.drewnoH ?? 0) * 24),
        glinaD: Number(d.glinaD ?? (d.glinaH ?? 0) * 24),
        zelazoD: Number(d.zelazoD ?? (d.zelazoH ?? 0) * 24),
      }))
      .sort((a, b) => a.czasS - b.czasS),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/wioska-plan.test.js`
Expected: PASS

- [ ] **Step 5: Switch the simulation to daily units**

Zmiana jednostki jest niepodzielna: `normalizujPlan` produkuje już pola dobowe,
więc `symulacja.js` musi je czytać w tym samym commicie, inaczej dochód
przestaje działać. W `src/wioska/symulacja.js` zamień dwie funkcje:

```js
function produkcjaNaSekunde(s, poziomy, dochod) {
  return {
    drewno: produkcjaGodzinowa(s, poziomy.tartak ?? 0) / 3600 + dochod.drewnoD / 86400,
    glina: produkcjaGodzinowa(s, poziomy.cegielnia ?? 0) / 3600 + dochod.glinaD / 86400,
    zelazo: produkcjaGodzinowa(s, poziomy.huta ?? 0) / 3600 + dochod.zelazoD / 86400,
  };
}

// Dochod obowiazuje od swojego czasu do nastepnego wpisu. Przed pierwszym
// wpisem gracz nie ma zadnego dodatkowego zrodla.
function dochodWChwili(dochody, czas) {
  let biezacy = { czasS: 0, drewnoD: 0, glinaD: 0, zelazoD: 0 };
  for (const d of dochody) {
    if (d.czasS <= czas) biezacy = d; else break;
  }
  return biezacy;
}
```

- [ ] **Step 6: Fix the existing tests that still use hourly fields**

Reszta pakietu ma testy budujące plany z `drewnoH`. Uruchom `node --test` i popraw **wyłącznie nazwy pól** w plikach testowych na dobowe, przeliczając wartości przez 24, żeby zachować sens przypadku. Przykład: `{ czasS: 0, drewnoH: 10, glinaH: 10, zelazoH: 10 }` staje się `{ czasS: 0, drewnoD: 240, glinaD: 240, zelazoD: 240 }`.

- [ ] **Step 7: Run the full suite**

Run: `node --test`
Expected: PASS w komplecie. Zadanie kończy się zielonym pakietem — jednostka
dochodu zmienia się w jednym commicie po obu stronach.

- [ ] **Step 8: Commit**

```bash
git add src/wioska/plan.js src/wioska/symulacja.js test/
git commit -m "feat: dochod planu liczony na dobe, ze zgodnoscia wsteczna"
```

---

### Task 2: Poziomy po kroku i koniec ostrzeżeń o przestoju

**Files:**
- Modify: `src/wioska/symulacja.js`
- Test: `test/wioska-symulacja.test.js`

**Interfaces:**
- Consumes: `dochody[i]` z polami `drewnoD`, `glinaD`, `zelazoD` — symulacja czyta je już od Taska 1
- Produces: `kroki[i].poziomyPo` — `{ [budynek]: poziom }`, stan poziomów **po** tym kroku. Krok zakończony błędem niesie poziomy niezmienione.

**Kontekst:** pasek stanu ma pokazywać wioskę na wskazany moment, więc wynik musi nieść poziomy. Ostrzeżenie o przestoju przy każdym kroku znika — przy trzydziestu krokach dawało kilkanaście niemal identycznych wierszy. Pozostałe ostrzeżenia zostają: żadnego z nich nie da się nadrobić dowozem surowców.

- [ ] **Step 1: Write the failing test**

Dopisz do `test/wioska-symulacja.test.js`:

```js
test('krok niesie poziomy budynkow po swoim zakonczeniu', () => {
  const w = symuluj(plan({
    start: { surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 2 }],
  }));
  assert.equal(w.kroki[0].poziomyPo.tartak, 1);
  assert.equal(w.kroki[1].poziomyPo.tartak, 2);
  assert.equal(w.kroki[0].poziomyPo.ratusz, 1);
});

test('krok zatrzymany bledem nie podnosi poziomu', () => {
  const w = symuluj(plan({ kroki: [{ budynek: 'koszary', doPoziomu: 1 }] }));
  assert.equal(w.kroki[0].blad, 'wymagania');
  assert.equal(w.kroki[0].poziomyPo.koszary, 0);
});

// Rozpisywanie przestoju przy kazdym kroku dawalo kilkanascie identycznych
// wierszy; zapotrzebowanie raportuje osobny modul.
test('dlugi przestoj nie tworzy juz ostrzezenia przy kroku', () => {
  const w = symuluj(plan({
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoD: 24, glinaD: 24, zelazoD: 24 }],
  }));
  assert.ok(w.kroki[0].czekanieS > 0, 'przestoj nadal jest liczony');
  assert.equal(w.ostrzezenia.length, 0);
});

test('plan niewykonalny przy zerowej produkcji nadal daje ostrzezenie', () => {
  const w = symuluj(plan({
    start: { surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
  }));
  assert.equal(w.kroki[0].blad, 'brak-dochodu');
  assert.ok(w.ostrzezenia.some(o => o.typ === 'przestoj'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-symulacja.test.js`
Expected: FAIL — `poziomyPo` jest `undefined`

- [ ] **Step 3: Add levels to the step record**

W `src/wioska/symulacja.js`, w literale `const wpis = { … }`, dopisz pole tuż po `ludnoscPo`:

```js
      poziomyPo: { ...poziomy },
```

Następnie w każdym miejscu, w którym krok kończy się błędem i wykonuje `kroki.push(wpis); return;`, poziomy są już poprawne (niezmienione), więc nic więcej nie trzeba. Na końcu udanego kroku, **po** wierszu `poziomy[krok.budynek] = krok.doPoziomu;`, dopisz:

```js
    wpis.poziomyPo = { ...poziomy };
```

- [ ] **Step 4: Remove the per-step idle warning**

Usuń stałą `PROG_PRZESTOJU_S` oraz cały blok, który na jej podstawie dokłada ostrzeżenie:

```js
    if (wpis.czekanieS >= PROG_PRZESTOJU_S) {
      ostrzezenia.push({ … typ: 'przestoj' … });
    }
```

Pole `czekanieS` i `czekanieNa` **zostają** — nadal opisują krok, tylko nie generują wpisu na liście ostrzeżeń. Ostrzeżenie o typie `przestoj` przy błędzie `brak-dochodu` zostaje bez zmian.

- [ ] **Step 5: Run tests**

Run: `node --test`
Expected: PASS w komplecie. Jeśli któryś istniejący test oczekiwał ostrzeżenia o przestoju przy kroku, dostosuj go do nowego zachowania — ale **nie** rozluźniaj testów sprawdzających przepełnienie, pojemność spichlerza, zagrodę ani wymagania.

- [ ] **Step 6: Commit**

```bash
git add src/wioska/symulacja.js test/wioska-symulacja.test.js
git commit -m "feat: poziomy budynkow po kroku, koniec rozpisywania przestojow"
```

---

### Task 3: Moduł zapotrzebowania

**Files:**
- Create: `src/wioska/zapotrzebowanie.js`
- Test: `test/wioska-zapotrzebowanie.test.js`

**Interfaces:**
- Consumes: `swiat`, `kosztPoziomu`, `produkcjaGodzinowa`, `czasBudowy`
- Produces: `zapotrzebowanie(plan)` → `{ czasNettoS, wymaganyDobowo, waskieGardlo, brakNaStart }`
  - `czasNettoS` — liczba sekund, suma samych czasów budowy
  - `wymaganyDobowo` — `{ drewno, glina, zelazo }`, dochód zewnętrzny **na dobę**, zaokrąglony w górę do jedności
  - `waskieGardlo` — `{ indeks, budynek, doPoziomu, surowiec, czasS }` albo `null`
  - `brakNaStart` — `true`, gdy pierwszy krok kosztuje więcej niż surowce startowe

**Kontekst — skąd ta arytmetyka.** Przebieg pomocniczy ignoruje magazyn i przesuwa zegar wyłącznie o czasy budowy, licząc po drodze produkcję kopalń. Dla kroku zaczynającego się w chwili `T`:

```
deficyt  = koszt_skumulowany − surowce_startowe − produkcja_wlasna(T)
wymagany = deficyt / T          gdy T > 0 i deficyt > 0
```

Maksimum po wszystkich krokach to wymagany dochód, a krok, na którym wypada, to wąskie gardło. Miara sprawdzona na planie 28 kroków: czas netto 4 h 48 min, wymagany dochód 22 456 drewna na dobę, wąskie gardło w kroku 23. Profil narasta gładko i opada, gdy kopalnie nadganiają.

- [ ] **Step 1: Write the failing test**

`test/wioska-zapotrzebowanie.test.js`:

```js
// test/wioska-zapotrzebowanie.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujPlan } from '../src/wioska/plan.js';
import { zapotrzebowanie } from '../src/wioska/zapotrzebowanie.js';
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
  const bez = zapotrzebowanie(plan({ kroki })).czasNettoS;
  const z = zapotrzebowanie(plan({
    kroki,
    dochody: [{ czasS: 0, drewnoD: 99999 }],
    zastrzyki: [{ czasS: 10, drewno: 99999 }],
  })).czasNettoS;
  assert.equal(z, bez);
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

// Pierwszy krok zaczyna sie w chwili zero, wiec iloraz nie istnieje —
// taki przypadek ma byc zglaszany osobno, nie jako nieskonczony dochod.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-zapotrzebowanie.test.js`
Expected: FAIL — `Cannot find module '../src/wioska/zapotrzebowanie.js'`

- [ ] **Step 3: Write the implementation**

`src/wioska/zapotrzebowanie.js`:

```js
// src/wioska/zapotrzebowanie.js
// Dwie liczby odporne na wahania farmienia: ile plan trwa, gdy nic go nie
// zatrzymuje, i ile surowcow trzeba dowozic, zeby tej granicy dotrzymac.
// Przebieg pomocniczy ignoruje magazyn — interesuje nas dolna granica, a nie
// przebieg przy konkretnym dochodzie, ktory liczy symulacja.

import { swiat } from './swiaty.js';
import { kosztPoziomu } from './swiat.js';
import { produkcjaGodzinowa } from './tabele.js';
import { czasBudowy } from './czas.js';

const SUROWCE_Z = ['drewno', 'glina', 'zelazo'];
const KOPALNIA_SUROWCA = { drewno: 'tartak', glina: 'cegielnia', zelazo: 'huta' };
const DOBA_S = 86400;

export function zapotrzebowanie(plan) {
  const s = swiat(plan.swiat);
  const poziomy = { ...plan.start.poziomy };
  const skumulowany = { drewno: 0, glina: 0, zelazo: 0 };
  const wyprodukowane = { drewno: 0, glina: 0, zelazo: 0 };
  const wymagany = { drewno: 0, glina: 0, zelazo: 0 };
  let czas = 0;
  let waskieGardlo = null;
  let szczyt = 0;
  let brakNaStart = false;

  plan.kroki.forEach((krok, indeks) => {
    const koszt = kosztPoziomu(s, krok.budynek, krok.doPoziomu);
    for (const r of SUROWCE_Z) skumulowany[r] += koszt[r];

    for (const r of SUROWCE_Z) {
      const deficyt = skumulowany[r] - plan.start.surowce[r] - wyprodukowane[r];
      if (deficyt <= 0) continue;
      if (czas <= 0) {
        // Krok o zerowym czasie startu nie ma jak "zdazyc" — dzielenie
        // dalo by nieskonczonosc i zepsulo cala liczbe.
        brakNaStart = true;
        continue;
      }
      const naDobe = deficyt / (czas / DOBA_S);
      if (naDobe > wymagany[r]) wymagany[r] = naDobe;
      if (naDobe > szczyt) {
        szczyt = naDobe;
        waskieGardlo = { indeks, budynek: krok.budynek, doPoziomu: krok.doPoziomu, surowiec: r, czasS: Math.round(czas) };
      }
    }

    const { sekundy } = czasBudowy(s, krok.budynek, krok.doPoziomu, poziomy.ratusz ?? 1);
    for (const r of SUROWCE_Z) {
      wyprodukowane[r] += produkcjaGodzinowa(s, poziomy[KOPALNIA_SUROWCA[r]] ?? 0) * sekundy / 3600;
    }
    czas += sekundy;
    poziomy[krok.budynek] = krok.doPoziomu;
  });

  return {
    czasNettoS: Math.round(czas),
    wymaganyDobowo: {
      drewno: Math.ceil(wymagany.drewno),
      glina: Math.ceil(wymagany.glina),
      zelazo: Math.ceil(wymagany.zelazo),
    },
    waskieGardlo,
    brakNaStart,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `node --test test/wioska-zapotrzebowanie.test.js`
Expected: PASS, 8 testów

- [ ] **Step 5: Sanity-check against a real plan**

```bash
node --input-type=module -e "
import { normalizujPlan } from './src/wioska/plan.js';
import { zapotrzebowanie } from './src/wioska/zapotrzebowanie.js';
import { czasCzytelny } from './src/wioska/format.js';
const kroki = [];
const dodaj = (b, n) => { for (let i = 1; i <= n; i++) kroki.push({ budynek: b, doPoziomu: i }); };
dodaj('tartak', 5); dodaj('cegielnia', 5); dodaj('huta', 5);
kroki.push({ budynek: 'spichlerz', doPoziomu: 2 }, { budynek: 'spichlerz', doPoziomu: 3 });
kroki.push({ budynek: 'zagroda', doPoziomu: 2 }, { budynek: 'zagroda', doPoziomu: 3 });
for (let i = 2; i <= 5; i++) kroki.push({ budynek: 'ratusz', doPoziomu: i });
for (let i = 6; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
const z = zapotrzebowanie(normalizujPlan({ swiat: 'pl231', kroki }));
console.log('czas netto:', czasCzytelny(z.czasNettoS));
console.log('wymagany /dobe:', z.wymaganyDobowo);
console.log('waskie gardlo:', z.waskieGardlo);
"
```

Expected: czas netto około `4 h 48 min`, wymagany dochód rzędu 22 000 drewna na dobę, wąskie gardło na kroku o indeksie 22 (Ratusz na poziom 5). Odchylenia o kilka procent są w porządku; rząd wielkości musi się zgadzać.

- [ ] **Step 6: Commit**

```bash
git add src/wioska/zapotrzebowanie.js test/wioska-zapotrzebowanie.test.js
git commit -m "feat: czas netto planu i wymagany dochod zewnetrzny"
```

---

### Task 4: Eksport tekstowy bez oznaczeń niepewności

**Files:**
- Modify: `src/wioska/format.js`
- Test: `test/wioska-format.test.js`

**Interfaces:**
- Consumes: `zapotrzebowanie(plan)` (Task 3)
- Produces: `planTekst(plan, wynik, zap)` — trzeci argument to wynik `zapotrzebowanie`, opcjonalny; `osCzasuTekst(wynik)` bez znaku `≈` i bez kolumny uwag o poziomach bez pomiaru

- [ ] **Step 1: Write the failing test**

Dopisz do `test/wioska-format.test.js`:

```js
test('os czasu nie zawiera juz znaku przyblizenia', () => {
  const w = symuluj(normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { tartak: 4 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 5 }],
  }));
  assert.doesNotMatch(osCzasuTekst(w), /≈/);
});

test('podsumowanie tekstowe nie zawiera znaku przyblizenia', () => {
  assert.doesNotMatch(planTekst(p, w), /≈/);
});

test('podsumowanie podaje czas netto i wymagany dochod, gdy je przekazano', () => {
  const zap = zapotrzebowanie(p);
  const t = planTekst(p, w, zap);
  assert.match(t, /Czas netto/);
  assert.match(t, /na dobę/);
});

test('podsumowanie bez zapotrzebowania nadal dziala', () => {
  assert.match(planTekst(p, w), /Łączny czas/);
});
```

Dopisz też import na górze pliku:

```js
import { zapotrzebowanie } from '../src/wioska/zapotrzebowanie.js';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-format.test.js`
Expected: FAIL — `osCzasuTekst` nadal zawiera `≈`

- [ ] **Step 3: Write the implementation**

W `src/wioska/format.js` w `osCzasuTekst` usuń z kolumny uwag pozycję o poziomie bez pomiaru oraz przedrostek `≈` przy czasach:

```js
export function osCzasuTekst(wynik) {
  const linie = ['  # | start        | krok                      | trwanie      | uwagi'];
  wynik.kroki.forEach((k, i) => {
    const nazwa = `${NAZWY[k.budynek] ?? k.budynek} → ${k.doPoziomu}`;
    const uwagi = [];
    if (k.blad) uwagi.push(`BŁĄD: ${k.blad}`);
    if (k.czekanieS > 0) uwagi.push(`czeka ${czasCzytelny(k.czekanieS)} na ${NAZWY_SUROWCOW[k.czekanieNa] ?? k.czekanieNa}`);
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

W `planTekst` dodaj trzeci argument i nowe wiersze podsumowania:

```js
export function planTekst(plan, wynik, zap = null) {
  const linie = [`Plan budowy — ${plan.swiat}`, ''];
  plan.kroki.forEach((k, i) => {
    linie.push(`${String(i + 1).padStart(3)}. ${NAZWY[k.budynek] ?? k.budynek} → ${k.doPoziomu}`);
  });
  const { koszt, czasS, zmarnowane, zZastrzykow } = wynik.podsumowanie;
  linie.push('', 'Podsumowanie');
  if (zap) {
    linie.push(`  Czas netto (bez przestojów): ${czasCzytelny(zap.czasNettoS)}`);
  }
  linie.push(`  Łączny czas: ${czasCzytelny(czasS)}`);
  linie.push(`  Surowce: ${liczba(koszt.drewno)} drewna, ${liczba(koszt.glina)} gliny, ${liczba(koszt.zelazo)} żelaza`);
  if (zap) {
    const w = zap.wymaganyDobowo;
    linie.push(`  Wymagany dochód: ${liczba(w.drewno)} / ${liczba(w.glina)} / ${liczba(w.zelazo)} na dobę`);
    if (zap.waskieGardlo) {
      const g = zap.waskieGardlo;
      linie.push(`  Wąskie gardło: krok ${g.indeks + 1} — ${NAZWY[g.budynek] ?? g.budynek} → ${g.doPoziomu}`);
    }
    if (zap.brakNaStart) {
      linie.push('  Uwaga: na pierwszy krok nie starcza surowców startowych.');
    }
  }
  if (zZastrzykow.drewno || zZastrzykow.glina || zZastrzykow.zelazo) {
    linie.push(`  Z dosyłek: ${liczba(zZastrzykow.drewno)} / ${liczba(zZastrzykow.glina)} / ${liczba(zZastrzykow.zelazo)}`);
  }
  if (zmarnowane.drewno || zmarnowane.glina || zmarnowane.zelazo) {
    linie.push(`  Zmarnowane przez pełny spichlerz: ${liczba(zmarnowane.drewno)} / ${liczba(zmarnowane.glina)} / ${liczba(zmarnowane.zelazo)}`);
  }
  return linie.join('\n');
}
```

- [ ] **Step 4: Wire the CLI to pass the new argument**

W `tools/plan.js` dopisz import i przekaż zapotrzebowanie:

```js
import { zapotrzebowanie } from '../src/wioska/zapotrzebowanie.js';
```

oraz zamień wywołanie na:

```js
console.log(planTekst(plan, wynik, zapotrzebowanie(plan)));
```

- [ ] **Step 5: Run tests and the CLI**

Run: `node --test`
Expected: PASS w komplecie

Zbuduj plan próbny i przeczytaj wyjście:

```bash
node --input-type=module -e "
import { writeFileSync } from 'node:fs';
const kroki = [];
for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
writeFileSync('./plan-probny.json', JSON.stringify({ swiat: 'pl231', kroki }, null, 2));
" && node tools/plan.js ./plan-probny.json && rm -f ./plan-probny.json
```

Expected: w podsumowaniu widać „Czas netto", „Wymagany dochód … na dobę" i „Wąskie gardło"; nigdzie nie ma znaku `≈`.

- [ ] **Step 6: Commit**

```bash
git add src/wioska/format.js tools/plan.js test/wioska-format.test.js
git commit -m "feat: eksport tekstowy z czasem netto i wymaganym dochodem"
```

---

### Task 5: Widoki tabeli budynków i kolejki

**Files:**
- Create: `src/wioska/widok-budynki.js`
- Create: `src/wioska/widok-kolejka.js`
- Modify: `src/wioska/strona.js`
- Modify: `test/wioska-strona.test.js`
- Test: `test/wioska-widoki.test.js`

**Interfaces:**
- Consumes: `kosztPoziomu`, `ludnoscPoziomu`, `maksPoziom`, `czasBudowy`, `brakujaceWymagania`, `opisWymagan`, `czasCzytelny`, `NAZWY`, `NAZWY_SUROWCOW`, `IKONY_BUDYNKOW`
- Produces:
  - `esc(tekst)` → `string` — wspólna ucieczka znaków, przeniesiona z `strona.js` do `widok-budynki.js`
  - `wierszBudynkuHTML(s, budynek, poziomy, poziomRatusza)` → `string` — bez znaku `≈`
  - `krokHTML(krok, indeks, zaznaczony)` → `string` — bez kolumny czasu, z klasą `zaznaczony`
  - `wtracenieHTML(rodzaj, wpis)` → `string`, gdzie `rodzaj` to `'dochod'` albo `'dosylka'`

**Kontekst:** `strona.js` urósł do 278 linii i miesza budowanie HTML z wpinaniem zdarzeń. Wydzielamy czyste funkcje widoków; `strona.js` zostaje warstwą wpinania.

- [ ] **Step 1: Write the failing test**

`test/wioska-widoki.test.js`:

```js
// test/wioska-widoki.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { esc, wierszBudynkuHTML } from '../src/wioska/widok-budynki.js';
import { krokHTML, wtracenieHTML } from '../src/wioska/widok-kolejka.js';

const s = swiat('pl231');

test('esc ucieka znaki, ktore zepsulyby HTML', () => {
  assert.equal(esc('<b>&"'), '&lt;b&gt;&amp;&quot;');
});

test('wiersz budynku pokazuje ikone, nazwe i koszt nastepnego poziomu', () => {
  const html = wierszBudynkuHTML(s, 'tartak', { ratusz: 1, tartak: 0 }, 1);
  assert.match(html, /Tartak/);
  assert.match(html, /wood\.webp|data:image/);
  assert.match(html, /50/);
  assert.match(html, />60</);
});

test('wiersz budynku nigdy nie zawiera znaku przyblizenia', () => {
  const html = wierszBudynkuHTML(s, 'tartak', { ratusz: 1, tartak: 4 }, 1);
  assert.doesNotMatch(html, /≈/);
});

test('wiersz budynku z niespelnionym wymaganiem jest zablokowany z powodem', () => {
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

test('kafelek kroku nie pokazuje juz czasu', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  const html = krokHTML(w.kroki[0], 0, false);
  assert.match(html, /Tartak/);
  assert.doesNotMatch(html, /\d+\s*(s|min|h)\b/);
});

test('kafelek kroku niesie indeks, na ktorym opiera sie przeciaganie', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  assert.match(krokHTML(w.kroki[0], 0, false), /data-krok="0"/);
});

test('zaznaczony kafelek dostaje wlasna klase', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  assert.doesNotMatch(krokHTML(w.kroki[0], 0, false), /zaznaczony/);
  assert.match(krokHTML(w.kroki[0], 0, true), /zaznaczony/);
});

test('kafelek z bledem dostaje klase blad', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'koszary', doPoziomu: 1 }] }));
  assert.match(krokHTML(w.kroki[0], 0, false), /class="[^"]*blad/);
});

test('wtracenie dochodu podaje moment i wartosci na dobe', () => {
  const html = wtracenieHTML('dochod', { czasS: 172800, drewnoD: 2000, glinaD: 1000, zelazoD: 0 });
  assert.match(html, /2 d/);
  assert.match(html, /2000/);
  assert.match(html, /dobę/);
});

test('wtracenie dosylki podaje moment i ilosci', () => {
  const html = wtracenieHTML('dosylka', { czasS: 86400, drewno: 5000, glina: 5000, zelazo: 5000 });
  assert.match(html, /1 d/);
  assert.match(html, /5000/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-widoki.test.js`
Expected: FAIL — `Cannot find module '../src/wioska/widok-budynki.js'`

- [ ] **Step 3: Write the buildings view**

`src/wioska/widok-budynki.js`:

```js
// src/wioska/widok-budynki.js
// Tabela budynkow, wzorowana na ekranie Ratusza w grze.

import { kosztPoziomu, ludnoscPoziomu, maksPoziom } from './swiat.js';
import { czasBudowy } from './czas.js';
import { brakujaceWymagania, opisWymagan } from './wymagania.js';
import { czasCzytelny } from './format.js';
import { NAZWY } from './nazwy.js';
import { IKONY_BUDYNKOW } from './ikony.js';

export const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function ikonaHTML(budynek, nazwa) {
  const src = IKONY_BUDYNKOW[budynek];
  return src ? `<img class="ikona" src="${esc(src)}" alt="" title="${esc(nazwa)}">` : '';
}

export function wierszBudynkuHTML(s, budynek, poziomy, poziomRatusza) {
  const obecny = poziomy[budynek] ?? 0;
  const nazwa = NAZWY[budynek] ?? budynek;
  const maks = maksPoziom(s, budynek);
  if (obecny >= maks) {
    return `<tr><td>${ikonaHTML(budynek, nazwa)}${esc(nazwa)}<br><small>Poziom ${obecny}</small></td>`
      + '<td colspan="6"><em>Budynek całkowicie rozbudowany</em></td></tr>';
  }
  const docelowy = obecny + 1;
  const k = kosztPoziomu(s, budynek, docelowy);
  const { sekundy } = czasBudowy(s, budynek, docelowy, poziomRatusza);
  const ludnosc = ludnoscPoziomu(s, budynek, docelowy) - ludnoscPoziomu(s, budynek, obecny);
  const brak = brakujaceWymagania(budynek, poziomy);
  const zablokowany = brak.length > 0;
  const przycisk = zablokowany
    ? `<button disabled>Poziom ${docelowy}</button><div class="powod">${esc(opisWymagan(brak, NAZWY))}</div>`
    : `<button data-dodaj="${esc(budynek)}">Poziom ${docelowy}</button>`;
  return `<tr class="${zablokowany ? 'zablokowany' : ''}">`
    + `<td>${ikonaHTML(budynek, nazwa)}${esc(nazwa)}<br><small>${obecny === 0 ? 'nie istnieje' : `Poziom ${obecny}`}</small></td>`
    + `<td>${k.drewno}</td><td>${k.glina}</td><td>${k.zelazo}</td>`
    + `<td>${czasCzytelny(sekundy)}</td>`
    + `<td>${ludnosc}</td><td>${przycisk}</td></tr>`;
}
```

- [ ] **Step 4: Write the queue view**

`src/wioska/widok-kolejka.js`:

```js
// src/wioska/widok-kolejka.js
// Kolejka jako os czasu. Czas kroku nie jest tu pokazywany — pasek stanu
// podaje go dla zaznaczonego momentu, a tu zabieralby miejsce w kazdym wierszu.

import { czasCzytelny } from './format.js';
import { NAZWY, NAZWY_SUROWCOW } from './nazwy.js';
import { esc, ikonaHTML } from './widok-budynki.js';

export function krokHTML(krok, indeks, zaznaczony) {
  const nazwa = `${NAZWY[krok.budynek] ?? krok.budynek} → ${krok.doPoziomu}`;
  const klasy = ['krok'];
  if (krok.blad) klasy.push('blad');
  if (zaznaczony) klasy.push('zaznaczony');
  const czekanie = krok.czekanieS > 0
    ? `<span class="czekanie" title="czeka na ${esc(NAZWY_SUROWCOW[krok.czekanieNa] ?? krok.czekanieNa)}">⏳</span>`
    : '';
  return `<li class="${klasy.join(' ')}" draggable="true" data-krok="${indeks}">`
    + `<span class="nr">${indeks + 1}</span>`
    + `<span class="opis">${ikonaHTML(krok.budynek, nazwa)}${esc(nazwa)}</span>`
    + `${czekanie}`
    + `<button data-usun="${indeks}" title="Usuń">×</button></li>`;
}

// Wtracenia gracza pokazujemy w miejscu, w ktorym wypadaja na osi — edytuje
// sie je w kolumnie zaopatrzenia, ale dzialaja tutaj.
export function wtracenieHTML(rodzaj, wpis) {
  const kiedy = czasCzytelny(wpis.czasS);
  if (rodzaj === 'dochod') {
    return `<li class="wtracenie dochod">`
      + `<span class="kiedy">od ${esc(kiedy)}</span>`
      + `<span class="opis">dochód ${wpis.drewnoD} / ${wpis.glinaD} / ${wpis.zelazoD} na dobę</span></li>`;
  }
  return `<li class="wtracenie dosylka">`
    + `<span class="kiedy">po ${esc(kiedy)}</span>`
    + `<span class="opis">dosyłka ${wpis.drewno} / ${wpis.glina} / ${wpis.zelazo}</span></li>`;
}
```

- [ ] **Step 5: Remove the moved functions from strona.js**

Z `src/wioska/strona.js` usuń `esc`, `komorkaBudynku`, `wierszBudynkuHTML` i `krokHTML` wraz z ich eksportami, a w ich miejsce dopisz import (w jednej linii każdy):

```js
import { esc, wierszBudynkuHTML } from './widok-budynki.js';
import { krokHTML, wtracenieHTML } from './widok-kolejka.js';
```

Usuń też importy, które stały się w `strona.js` nieużywane (`kosztPoziomu`, `ludnoscPoziomu`, `maksPoziom`, `czasBudowy`, `brakujaceWymagania`, `opisWymagan`, `NAZWY_SUROWCOW`) — sprawdź każdy grepem, zanim usuniesz.

- [ ] **Step 6: Point the old test file at the new modules**

W `test/wioska-strona.test.js` przenieś testy dotyczące `wierszBudynkuHTML` i `krokHTML` do nowego pliku (są już w nim napisane w Step 1) i usuń je stąd. Zostaw w `test/wioska-strona.test.js` wyłącznie testy `podsumowanieHTML`, poprawiając import na:

```js
import { podsumowanieHTML } from '../src/wioska/strona.js';
```

- [ ] **Step 7: Run tests**

Run: `node --test`
Expected: PASS w komplecie

- [ ] **Step 8: Commit**

```bash
git add src/wioska/widok-budynki.js src/wioska/widok-kolejka.js src/wioska/strona.js test/
git commit -m "refactor: wydzielenie widokow budynkow i kolejki"
```

---

### Task 6: Pasek stanu wioski

**Files:**
- Create: `src/wioska/widok-status.js`
- Modify: `src/wioska/strona.js`
- Modify: `test/wioska-strona.test.js`
- Test: `test/wioska-status.test.js`

**Interfaces:**
- Consumes: `esc`, `ikonaHTML` (Task 5), `czasCzytelny`, `NAZWY`, `produkcjaGodzinowa`, `maksLudnosc`, `zapotrzebowanie`
- Produces: `pasekStanuHTML(s, plan, wynik, zap, indeks)` → `string`, gdzie `indeks` to numer zaznaczonego kroku albo `null` dla stanu końcowego

**Kontekst:** pasek pokazuje wioskę **na wskazany moment** — poziomy budynków, ludność, wydane surowce, produkcję, dochód i dosyłki do tej chwili — plus dwie liczby planu, które od momentu nie zależą: czas netto i wymagany dochód. Zastępuje `podsumowanieHTML`, które znika w Task 8.

- [ ] **Step 1: Write the failing test**

`test/wioska-status.test.js`:

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

test('pasek podaje czas netto i laczny', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, null);
  assert.match(html, /netto/i);
});

test('pasek podaje wymagany dochod na dobe', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const p = normalizujPlan({ swiat: 'pl231', kroki });
  const html = pasekStanuHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.match(html, /dobę/);
});

test('pasek podaje ludnosc zajeta i limit zagrody', () => {
  const html = pasekStanuHTML(s, plan, wynik, zap, null);
  assert.match(html, /240/);
});

test('pasek nie zawiera znaku przyblizenia', () => {
  assert.doesNotMatch(pasekStanuHTML(s, plan, wynik, zap, null), /≈/);
});

test('pusty plan nie wywraca paska', () => {
  const p = normalizujPlan({ swiat: 'pl231' });
  const html = pasekStanuHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.ok(html.length > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-status.test.js`
Expected: FAIL — `Cannot find module '../src/wioska/widok-status.js'`

- [ ] **Step 3: Write the implementation**

`src/wioska/widok-status.js`:

```js
// src/wioska/widok-status.js
// Stan wioski na wskazany moment osi. Gorna czesc to rzad ikon z poziomami,
// wzorowany na "Podsumowaniu" w Menedzerze Konta — z ta roznica, ze pokazuje
// wioske w wybranej chwili, a nie stan koncowy.

import { budynkiSwiata } from './swiat.js';
import { produkcjaGodzinowa, maksLudnosc } from './tabele.js';
import { czasCzytelny } from './format.js';
import { NAZWY } from './nazwy.js';
import { esc, ikonaHTML } from './widok-budynki.js';

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
    for (const r of SUROWCE_S) wydano[r] += wynik.kroki[i].koszt[r];
  }
  return { poziomy: k.poziomyPo, czasS: k.koniecS, ludnosc: k.ludnoscPo, wydano, indeks };
}

function dosylkiDo(plan, czasS) {
  const suma = { drewno: 0, glina: 0, zelazo: 0 };
  for (const z of plan.zastrzyki) {
    if (z.czasS <= czasS) for (const r of SUROWCE_S) suma[r] += z[r];
  }
  return suma;
}

function dochodWChwiliS(plan, czasS) {
  let biezacy = { drewnoD: 0, glinaD: 0, zelazoD: 0 };
  for (const d of plan.dochody) { if (d.czasS <= czasS) biezacy = d; else break; }
  return biezacy;
}

export function pasekStanuHTML(s, plan, wynik, zap, indeks) {
  const st = stanNaKrok(plan, wynik, indeks);
  const ikony = budynkiSwiata(s)
    .map(b => `<span class="poziom-budynku" data-poziom-${esc(b)}="${st.poziomy[b] ?? 0}">`
      + `${ikonaHTML(b, NAZWY[b] ?? b)}<b>${st.poziomy[b] ?? 0}</b></span>`)
    .join('');

  const prodH = {
    drewno: produkcjaGodzinowa(s, st.poziomy.tartak ?? 0),
    glina: produkcjaGodzinowa(s, st.poziomy.cegielnia ?? 0),
    zelazo: produkcjaGodzinowa(s, st.poziomy.huta ?? 0),
  };
  const limit = maksLudnosc(st.poziomy.zagroda ?? 1);
  const dos = dosylkiDo(plan, st.czasS);
  const doch = dochodWChwiliS(plan, st.czasS);
  const w = zap.wymaganyDobowo;
  const etykieta = indeks === null
    ? 'stan końcowy'
    : `krok ${indeks + 1} — ${czasCzytelny(st.czasS)}`;

  const wiersze = [
    `<div class="stan-moment">● ${esc(etykieta)}</div>`,
    `<div class="stan-ikony">${ikony}</div>`,
    `<div class="stan-liczby">`,
    `<span><b>Czas netto</b> ${czasCzytelny(zap.czasNettoS)} · <b>realny</b> ${czasCzytelny(wynik.podsumowanie.czasS)}</span>`,
    `<span><b>Populacja</b> ${st.ludnosc} / ${limit}</span>`,
    `<span><b>Wydano</b> ${st.wydano.drewno} / ${st.wydano.glina} / ${st.wydano.zelazo}</span>`,
    `<span><b>Produkcja</b> ${prodH.drewno} / ${prodH.glina} / ${prodH.zelazo} na h · ${prodH.drewno * 24} / ${prodH.glina * 24} / ${prodH.zelazo * 24} na dobę</span>`,
    `<span><b>Dochód</b> ${doch.drewnoD} / ${doch.glinaD} / ${doch.zelazoD} na dobę · <b>wymagany</b> ${w.drewno} / ${w.glina} / ${w.zelazo} na dobę</span>`,
    `<span><b>Dosłano</b> ${dos.drewno} / ${dos.glina} / ${dos.zelazo}</span>`,
    `</div>`,
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

- [ ] **Step 4: Run tests**

Run: `node --test test/wioska-status.test.js`
Expected: PASS, 8 testów

- [ ] **Step 5: Commit**

```bash
git add src/wioska/widok-status.js test/wioska-status.test.js
git commit -m "feat: pasek stanu wioski dla wskazanego momentu osi"
```

---

### Task 7: Szablon, style i sklejanie

**Files:**
- Modify: `src/wioska.template.html`
- Modify: `src/wioska.css`
- Modify: `build.js`
- Modify: `test/build.test.js`

**Interfaces:**
- Consumes: moduły z Tasków 3, 5 i 6
- Produces: szablon z identyfikatorami `pasek-narzedzi`, `stan-wioski`, `tabela-budynkow`, `lista-krokow`, `lista-dochodow`, `lista-dosylek`, `swiat`, `zapisz`, `wczytaj`, `kopiuj-tekst`, `kopiuj-json`, `wklej-json`, `wyczysc`, `dodaj-dochod`, `dodaj-zastrzyk`, `modal`, `modal-tytul`, `modal-pole`, `modal-info`, `modal-anuluj`, `modal-ok`

- [ ] **Step 1: Write the failing test**

Dopisz do `test/build.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build.test.js`
Expected: FAIL — brak `id="pasek-narzedzi"`

- [ ] **Step 3: Rewrite the template**

Zastąp zawartość `src/wioska.template.html`:

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

<header id="pasek-narzedzi">
  <div class="marka">Plemiona · symulator</div>
  <label>Świat <select id="swiat"></select></label>
  <span class="rozpychacz"></span>
  <button id="zapisz">Zapisz</button>
  <button id="wczytaj">Wczytaj</button>
  <button id="kopiuj-tekst">Tekst</button>
  <button id="kopiuj-json" class="primary">JSON</button>
  <button id="wklej-json">Wklej</button>
  <button id="wyczysc">Wyczyść</button>
</header>

<section id="stan-wioski"></section>

<main class="kolumny">
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
    <h2>Kolejka</h2>
    <ol id="lista-krokow"></ol>
    <ul id="ostrzezenia"></ul>
  </section>

  <section id="zaopatrzenie">
    <h2>Zaopatrzenie</h2>
    <h3>Dochód stały <button id="dodaj-dochod">+</button></h3>
    <ul id="lista-dochodow"></ul>
    <h3>Dosyłki <button id="dodaj-zastrzyk">+</button></h3>
    <ul id="lista-dosylek"></ul>
  </section>
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

- [ ] **Step 4: Extend the stylesheet**

Dopisz na końcu `src/wioska.css`:

```css
#pasek-narzedzi{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:8px 3%;background:#241a10;color:#f6ecd4;border-bottom:2px solid var(--gold)}
#pasek-narzedzi .marka{font-weight:600;letter-spacing:.04em}
#pasek-narzedzi label{font-size:.8rem;color:var(--line)}
.rozpychacz{flex:1}
#stan-wioski{width:94%;margin:10px auto 0;background:var(--pg);border:1px solid var(--line);
  border-radius:4px;padding:10px 12px;font-size:.84rem}
.stan-moment{font-weight:600;color:var(--acc);margin-bottom:6px}
.stan-ikony{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;
  padding-bottom:8px;border-bottom:1px solid var(--line)}
.poziom-budynku{display:flex;align-items:center;gap:3px}
.poziom-budynku img.ikona{width:20px;height:20px}
.poziom-budynku b{min-width:1.2em;text-align:right}
.stan-liczby{display:flex;flex-wrap:wrap;gap:6px 22px}
.stan-gardlo{margin-top:6px;color:var(--acc);font-weight:600}
.kolumny{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr) minmax(0,.75fr);
  gap:14px;width:94%;max-width:1600px;margin:12px auto;padding-bottom:60px}
@media (max-width:1200px){.kolumny{grid-template-columns:1fr}}
img.ikona{width:22px;height:22px;vertical-align:middle;margin-right:5px}
#zaopatrzenie h3{margin:12px 0 4px;font-size:.9rem}
#lista-dochodow,#lista-dosylek{list-style:none;margin:0;padding:0;font-size:.82rem}
#lista-dochodow li,#lista-dosylek li{display:flex;gap:6px;align-items:center;
  padding:4px 0;border-bottom:1px solid #e0d2b4}
li.wtracenie{background:#e8f0e2;font-size:.8rem;font-style:italic}
li.wtracenie .kiedy{font-weight:600;font-style:normal}
li.krok.zaznaczony{outline:2px solid var(--acc);outline-offset:-2px;background:#f0e4c6}
li.krok.ciagniony{opacity:.4}
li.krok.cel-gora{box-shadow:inset 0 3px 0 var(--acc)}
li.krok.cel-dol{box-shadow:inset 0 -3px 0 var(--acc)}
#lista-krokow.cel-koniec{box-shadow:inset 0 -4px 0 var(--acc)}
```

- [ ] **Step 5: Extend the module list in build.js**

W `build.js` zastąp tablicę `WIOSKA_LOGIC`:

```js
// Kolejnosc ma znaczenie: stripModule usuwa importy, wiec dane musza byc
// zdefiniowane przed kodem, ktory z nich korzysta.
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
  'src/wioska/plan.js',
  'src/wioska/symulacja.js',
  'src/wioska/zapotrzebowanie.js',
  'src/wioska/format.js',
  'src/wioska/widok-budynki.js',
  'src/wioska/widok-kolejka.js',
  'src/wioska/widok-status.js',
  'src/wioska/strona.js',
];
```

- [ ] **Step 6: Run tests and build**

Run: `node --test && node build.js`
Expected: testy budowania przechodzą; `dist/wioska/index.html` powstaje

Sprawdź, że sklejony skrypt się wykonuje:

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const h = readFileSync('dist/wioska/index.html','utf8');
writeFileSync('./sklejone-tmp.mjs', h.match(/<script type=\"module\">([\s\S]*?)<\/script>/)[1]);
" && node --check ./sklejone-tmp.mjs && node ./sklejone-tmp.mjs && rm -f ./sklejone-tmp.mjs && echo "sklejona strona OK"
```

Expected: brak błędu składni i brak `ReferenceError`

- [ ] **Step 7: Commit**

```bash
git add src/wioska.template.html src/wioska.css build.js test/build.test.js dist/
git commit -m "feat: pasek narzedzi, pasek stanu i trzy kolumny w szablonie"
```

---

### Task 8: Wpięcie interfejsu

**Files:**
- Modify: `src/wioska/strona.js`
- Modify: `test/wioska-strona.test.js`

**Interfaces:**
- Consumes: wszystko z Tasków 1–7
- Produces: `KLUCZ_MAGAZYNU = 'plemiona-wioska'`, `uruchom()`. Funkcja `podsumowanieHTML` **znika** — zastępuje ją `pasekStanuHTML`.

**Kontekst:** to jest jedyne zadanie, które dotyka DOM-u. Funkcje budujące HTML są już czyste i przetestowane, więc tutaj zostaje wyłącznie stan interfejsu i wpinanie zdarzeń.

- [ ] **Step 1: Write the failing test**

Zastąp zawartość `test/wioska-strona.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wioska-strona.test.js`
Expected: FAIL — `podsumowanieHTML` nadal istnieje

- [ ] **Step 3: Rewrite the page module**

Zastąp zawartość `src/wioska/strona.js`:

```js
// src/wioska/strona.js
// Warstwa DOM: stan interfejsu i wpinanie zdarzen. Cale budowanie HTML
// siedzi w modulach widok-*.js i jest testowane bez przegladarki.

import { SWIATY, swiat } from './swiaty.js';
import { budynkiSwiata } from './swiat.js';
import { normalizujPlan, bledyPlanu } from './plan.js';
import { symuluj } from './symulacja.js';
import { zapotrzebowanie } from './zapotrzebowanie.js';
import { planJSON, planTekst, czasCzytelny } from './format.js';
import { esc, wierszBudynkuHTML } from './widok-budynki.js';
import { krokHTML, wtracenieHTML } from './widok-kolejka.js';
import { pasekStanuHTML } from './widok-status.js';

export const KLUCZ_MAGAZYNU = 'plemiona-wioska';

export function uruchom() {
  if (typeof document === 'undefined') return;

  const $ = (id) => document.getElementById(id);
  let plan = wczytajPlan();
  let zaznaczony = null;
  let trybModalu = 'wklej';
  let ciagniony = null;

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

  // Tabela budynkow pokazuje stan po wszystkich krokach, zeby kolejne
  // klikniecie dokladalo nastepny poziom.
  function poziomyPoKolejce() {
    const p = { ...plan.start.poziomy };
    for (const k of plan.kroki) p[k.budynek] = k.doPoziomu;
    return p;
  }

  // Kroki niosa poziom docelowy, wiec po kazdej zmianie kolejnosci trzeba je
  // ponumerowac od nowa — inaczej plan przestaje byc ciagly.
  function przelicz() {
    const poziomy = { ...plan.start.poziomy };
    for (const k of plan.kroki) {
      k.doPoziomu = (poziomy[k.budynek] ?? 0) + 1;
      poziomy[k.budynek] = k.doPoziomu;
    }
  }

  // Wtracenia wchodza w kolejke tam, gdzie wypadaja na osi.
  function kolejkaHTML(wynik) {
    const wtracenia = [
      ...plan.dochody.map(d => ({ czasS: d.czasS, rodzaj: 'dochod', wpis: d })),
      ...plan.zastrzyki.map(z => ({ czasS: z.czasS, rodzaj: 'dosylka', wpis: z })),
    ].sort((a, b) => a.czasS - b.czasS);
    let w = 0;
    const out = [];
    wynik.kroki.forEach((k, i) => {
      while (w < wtracenia.length && wtracenia[w].czasS <= k.startS) {
        out.push(wtracenieHTML(wtracenia[w].rodzaj, wtracenia[w].wpis));
        w += 1;
      }
      out.push(krokHTML(k, i, i === zaznaczony));
    });
    while (w < wtracenia.length) {
      out.push(wtracenieHTML(wtracenia[w].rodzaj, wtracenia[w].wpis));
      w += 1;
    }
    return out.join('');
  }

  function zaopatrzenieHTML() {
    $('lista-dochodow').innerHTML = plan.dochody.map((d, i) =>
      `<li><span class="kiedy">od ${esc(czasCzytelny(d.czasS))}</span>`
      + `<span class="opis">${d.drewnoD} / ${d.glinaD} / ${d.zelazoD} na dobę</span>`
      + `<button data-usun-dochod="${i}" title="Usuń">×</button></li>`).join('');
    $('lista-dosylek').innerHTML = plan.zastrzyki.map((z, i) =>
      `<li><span class="kiedy">po ${esc(czasCzytelny(z.czasS))}</span>`
      + `<span class="opis">${z.drewno} / ${z.glina} / ${z.zelazo}</span>`
      + `<button data-usun-dosylke="${i}" title="Usuń">×</button></li>`).join('');
  }

  function rysuj() {
    const s = swiat(plan.swiat);
    const poziomy = poziomyPoKolejce();
    $('tabela-budynkow').tBodies[0].innerHTML = budynkiSwiata(s)
      .map(b => wierszBudynkuHTML(s, b, poziomy, poziomy.ratusz ?? 1)).join('');

    const bledy = bledyPlanu(plan);
    if (bledy.length) {
      $('lista-krokow').innerHTML = '';
      $('stan-wioski').innerHTML = '';
      $('ostrzezenia').innerHTML = bledy.map(b => `<li>${esc(b)}</li>`).join('');
      zaopatrzenieHTML();
      zapisz();
      return;
    }
    const wynik = symuluj(plan);
    const zap = zapotrzebowanie(plan);
    if (zaznaczony !== null && !wynik.kroki[zaznaczony]) zaznaczony = null;
    $('lista-krokow').innerHTML = kolejkaHTML(wynik);
    $('stan-wioski').innerHTML = pasekStanuHTML(s, plan, wynik, zap, zaznaczony);
    $('ostrzezenia').innerHTML = wynik.ostrzezenia.map(o => `<li>${esc(o.tekst)}</li>`).join('');
    zaopatrzenieHTML();
    zapisz();
  }

  function pytajOLiczbe(etykieta) {
    const v = prompt(etykieta, '0');
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function otworzModal(tryb, tytul, tresc) {
    trybModalu = tryb;
    $('modal-tytul').textContent = tytul;
    $('modal-pole').value = tresc;
    $('modal-info').textContent = '';
    $('modal').hidden = false;
    $('modal-pole').focus();
    if (tryb === 'kopiuj') $('modal-pole').select();
  }

  async function doSchowka(tekst, opis) {
    try {
      await navigator.clipboard.writeText(tekst);
    } catch {
      otworzModal('kopiuj', `${opis} — skopiuj ręcznie`, tekst);
    }
  }

  document.addEventListener('click', (e) => {
    const dodaj = e.target.closest('[data-dodaj]');
    if (dodaj) {
      const budynek = dodaj.dataset.dodaj;
      plan.kroki.push({ budynek, doPoziomu: (poziomyPoKolejce()[budynek] ?? 0) + 1 });
      rysuj();
      return;
    }
    const usun = e.target.closest('[data-usun]');
    if (usun) {
      plan.kroki.splice(Number(usun.dataset.usun), 1);
      zaznaczony = null;
      przelicz();
      rysuj();
      return;
    }
    const usunD = e.target.closest('[data-usun-dochod]');
    if (usunD) { plan.dochody.splice(Number(usunD.dataset.usunDochod), 1); rysuj(); return; }
    const usunZ = e.target.closest('[data-usun-dosylke]');
    if (usunZ) { plan.zastrzyki.splice(Number(usunZ.dataset.usunDosylke), 1); rysuj(); return; }
    const krok = e.target.closest('[data-krok]');
    if (krok) {
      const i = Number(krok.dataset.krok);
      zaznaczony = zaznaczony === i ? null : i;
      rysuj();
    }
  });

  const lista = $('lista-krokow');

  lista.addEventListener('dragstart', (e) => {
    const li = e.target.closest('[data-krok]');
    if (!li) return;
    ciagniony = Number(li.dataset.krok);
    li.classList.add('ciagniony');
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });

  // Bez podswietlenia celu nie widac, gdzie krok wyladuje.
  lista.addEventListener('dragover', (e) => {
    if (ciagniony === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    for (const el of lista.querySelectorAll('.cel-gora,.cel-dol')) el.classList.remove('cel-gora', 'cel-dol');
    lista.classList.remove('cel-koniec');
    const li = e.target.closest('[data-krok]');
    if (!li) { lista.classList.add('cel-koniec'); return; }
    const cel = Number(li.dataset.krok);
    li.classList.add(cel < ciagniony ? 'cel-gora' : 'cel-dol');
  });

  function posprzatajPodswietlenie() {
    for (const el of lista.querySelectorAll('.ciagniony,.cel-gora,.cel-dol')) {
      el.classList.remove('ciagniony', 'cel-gora', 'cel-dol');
    }
    lista.classList.remove('cel-koniec');
  }

  lista.addEventListener('drop', (e) => {
    if (ciagniony === null) return;
    e.preventDefault();
    const li = e.target.closest('[data-krok]');
    // Upuszczenie pod ostatnim kafelkiem dokłada krok na koniec.
    const cel = li ? Number(li.dataset.krok) : plan.kroki.length - 1;
    if (cel !== ciagniony) {
      const [krok] = plan.kroki.splice(ciagniony, 1);
      plan.kroki.splice(cel, 0, krok);
      przelicz();
      zaznaczony = null;
    }
    ciagniony = null;
    posprzatajPodswietlenie();
    rysuj();
  });

  lista.addEventListener('dragend', () => { ciagniony = null; posprzatajPodswietlenie(); });

  $('dodaj-dochod').addEventListener('click', () => {
    plan.dochody.push({
      czasS: pytajOLiczbe('Od której godziny od startu obowiązuje?') * 3600,
      drewnoD: pytajOLiczbe('Drewno na dobę'),
      glinaD: pytajOLiczbe('Glina na dobę'),
      zelazoD: pytajOLiczbe('Żelazo na dobę'),
    });
    plan.dochody.sort((a, b) => a.czasS - b.czasS);
    rysuj();
  });

  $('dodaj-zastrzyk').addEventListener('click', () => {
    plan.zastrzyki.push({
      czasS: pytajOLiczbe('W której godzinie od startu przychodzi dosyłka?') * 3600,
      drewno: pytajOLiczbe('Drewno'),
      glina: pytajOLiczbe('Glina'),
      zelazo: pytajOLiczbe('Żelazo'),
    });
    plan.zastrzyki.sort((a, b) => a.czasS - b.czasS);
    rysuj();
  });

  $('zapisz').addEventListener('click', () => { zapisz(); });
  $('wczytaj').addEventListener('click', () => { plan = wczytajPlan(); zaznaczony = null; rysuj(); });
  $('kopiuj-json').addEventListener('click', () => doSchowka(planJSON(plan), 'Plan w formacie JSON'));
  $('kopiuj-tekst').addEventListener('click', () => {
    const tekst = planTekst(plan, symuluj(plan), zapotrzebowanie(plan));
    doSchowka(tekst, 'Plan tekstem');
  });
  $('wklej-json').addEventListener('click', () => otworzModal('wklej', 'Wklej plan', ''));
  $('modal-anuluj').addEventListener('click', () => { $('modal').hidden = true; });
  $('modal-ok').addEventListener('click', () => {
    if (trybModalu === 'kopiuj') { $('modal').hidden = true; return; }
    try {
      plan = normalizujPlan(JSON.parse($('modal-pole').value));
      przelicz();
      zaznaczony = null;
      $('modal').hidden = true;
      rysuj();
    } catch (err) {
      $('modal-info').textContent = `Nie udało się wczytać: ${err.message}`;
    }
  });

  $('wyczysc').addEventListener('click', () => {
    plan = normalizujPlan({ swiat: plan.swiat });
    zaznaczony = null;
    rysuj();
  });

  $('swiat').innerHTML = Object.values(SWIATY)
    .map(x => `<option value="${esc(x.kod)}">${esc(x.nazwa)}</option>`).join('');
  $('swiat').value = plan.swiat;
  $('swiat').addEventListener('change', (e) => {
    plan = normalizujPlan({ swiat: e.target.value });
    zaznaczony = null;
    rysuj();
  });

  rysuj();
}

uruchom();
```

- [ ] **Step 4: Run tests and build**

Run: `node --test && node build.js`
Expected: PASS w komplecie; build bez błędów

Sprawdź sklejony skrypt:

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const h = readFileSync('dist/wioska/index.html','utf8');
writeFileSync('./sklejone-tmp.mjs', h.match(/<script type=\"module\">([\s\S]*?)<\/script>/)[1]);
" && node --check ./sklejone-tmp.mjs && node ./sklejone-tmp.mjs && rm -f ./sklejone-tmp.mjs && echo "sklejona strona OK"
```

- [ ] **Step 5: Verify every element id used by the code exists in the template**

Zapisz poniższy skrypt jako `sprawdz-id.mjs` w katalogu repozytorium, uruchom
i usuń. Rozbijanie po `$(` zamiast dopasowania wyrażeniem regularnym omija
kłopot z ucieczką znaku dolara w powłoce.

```js
import { readFileSync } from 'node:fs';
const tpl = readFileSync('src/wioska.template.html', 'utf8');
const js = readFileSync('src/wioska/strona.js', 'utf8');
const wSzablonie = new Set([...tpl.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const uzyte = new Set();
for (const kawalek of js.split('$(').slice(1)) {
  const q = kawalek.match(/^\s*'([^']+)'\s*\)/);
  if (q) uzyte.add(q[1]);
}
const brak = [...uzyte].filter(x => !wSzablonie.has(x));
console.log('uzyte:', [...uzyte].sort().join(', '));
console.log('BRAK W SZABLONIE:', brak.length ? brak.join(', ') : 'zadnych');
if (brak.length) process.exit(1);
```

```bash
node sprawdz-id.mjs && rm -f sprawdz-id.mjs
```

Expected: `BRAK W SZABLONIE: zadnych`

- [ ] **Step 6: Commit**

```bash
git add src/wioska/strona.js test/wioska-strona.test.js dist/
git commit -m "feat: wpiecie paska narzedzi, paska stanu i trzeciej kolumny"
```

---

## Self-Review

**Pokrycie specyfikacji:**

| Wymaganie ze specyfikacji | Task |
|---|---|
| Dochód i dosyłki na dobę, zgodność wsteczna | 1 |
| Poziomy budynków po kroku | 2 |
| Koniec rozpisywania przestojów, pozostałe ostrzeżenia zostają | 2 |
| Czas netto, wymagany dochód, wąskie gardło, brak na start | 3 |
| Eksport tekstowy bez `≈`, z nowymi liczbami | 4 |
| Widoki budynków i kolejki, brak kolumny czasu, wtrącenia | 5 |
| Pasek stanu wioski dla wskazanego momentu, ikony z poziomami | 6 |
| Górny pasek narzędzi, trzy kolumny, brak pól surowców startowych | 7 |
| Zaznaczanie kroku, czytelne przeciąganie, upuszczenie na koniec | 8 |
| Podział `strona.js` na widoki i wpinanie | 5, 6, 8 |

**Świadomie poza planem:** rekrutacja jednostek — specyfikacja odkłada ją do osobnej rundy; w układzie zostaje na nią trzecia kolumna i miejsce w pasku stanu.

**Uwaga o kolejności zadań:** Task 5 usuwa `wierszBudynkuHTML` i `krokHTML` ze `strona.js`, a Task 8 przepisuje ten plik w całości. Wykonanie Taska 8 przed 5 zostawiłoby duplikaty w jednym zakresie po sklejeniu — kolejność jest wiążąca.

**Znane założenie:** surowce startowe pozostają polem modelu planu i wynoszą 1000 każdego; interfejs przestaje je pokazywać, ale CLI i testy nadal mogą je nadpisywać.
