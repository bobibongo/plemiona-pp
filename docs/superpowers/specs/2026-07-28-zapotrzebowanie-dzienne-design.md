# Zapotrzebowanie dzienne — projekt

Data: 2026-07-28

Czwarta runda symulatora budowy wioski, po
`2026-07-28-bilans-i-kotwice-krokow-design.md`.

## Problem

Gracz planuje zaopatrzenie w cyklu: dosyłka albo start zbieractwa, kilka dni
spokoju, kolejna dosyłka. Żeby ustawić ten cykl, potrzebuje wiedzieć, **w
którym dniu budowy plan żąda ile surowców** — nie jednej liczby dla całego
planu (dzisiejsze `wymaganyDobowo`), tylko rozkładu w czasie.

Dzisiejsze `waskieGardlo` w `zapotrzebowanie()` wskazuje jeden, globalny
szczyt zapotrzebowania (największe `naDobe` po wszystkich krokach) i nie
reaguje na nic, co gracz zmienia w planie poza samymi krokami — bo liczy się
zawsze po tej samej osi bez przestojów. To dezorientuje: dodanie surowców
startowych albo dosyłki w interfejsie nie zmienia komunikatu o wąskim gardle,
bo ten komunikat w ogóle nie patrzy na zaopatrzenie.

Ten projekt **nie naprawia** wąskiego gardła ani nie podpina dochodu/dosyłek —
to celowo osobny, mniejszy krok: dać silnikowi surowy rozkład zapotrzebowania
w czasie, na którym dalsze rundy (kolejka podzielona na dni, realny bilans
dzienny z dochodem i dosyłkami) będą mogły się oprzeć.

## Zakres

W zakresie:

- nowa funkcja `zapotrzebowanieDzienne(plan)` w `zapotrzebowanie.js`,
- rozkład kosztu budowy na dni **osi bez przestojów** (bez dochodu, bez
  dosyłek, bez pojemności spichlerza, bez realnego czasu z symulacji).

Poza zakresem (świadomie, do kolejnych rund):

- podpięcie tego rozkładu pod kolejkę (podział widoku na dni),
- podpięcie pod pasek stanu / bilans,
- uwzględnienie dochodu, dosyłek, magazynu — czyli **realny** przebieg,
- poprawa dzisiejszego `waskieGardlo`,
- rekrutacja jednostek (dalej poza zakresem symulatora budowy).

## Projekt

### `zapotrzebowanieDzienne(plan)`

Liczy na tej samej osi co `osBezPrzestojow(plan)`. Dzieli oś na kolejne okna
24-godzinne od startu planu (`t = 0`) i dla każdego okna sumuje koszt kroków,
których `startS` w nim wypada.

**Krok przypisany w całości do dnia startu.** Krok, który trwa dłużej niż
dobę albo przecina granicę dwóch dni, liczy się w całości w dniu, w którym
się zaczyna — tak samo jak dziś liczy `zuzycieNaDobe`. To utrzymuje spójność
z istniejącą funkcją i daje czytelną tabelę: „tego dnia ruszasz z tymi
budowami, tyle to kosztuje", bez rozbijania pojedynczego kosztu na ułamkowe
części.

**Pełna liczba dni, ostatni może być niepełny.** Długość tablicy to
`Math.ceil(czasNettoS / DOBA_S)`. Dzień bez żadnego startującego kroku (np.
gdy jeden długi krok, jak wysoki poziom Ratusza, obejmuje sobą cały kolejny
dzień) dostaje wiersz z zerami, nie jest pomijany — numeracja dni musi być
ciągła, żeby dało się do niej odwołać wprost indeksem.

### Kształt wyniku

```js
[
  { dzien: 0, drewno: 12000, glina: 8000, zelazo: 5000, liczbaKrokow: 4 },
  { dzien: 1, drewno: 0, glina: 0, zelazo: 0, liczbaKrokow: 0 },
  { dzien: 2, drewno: 20000, glina: 15000, zelazo: 18000, liczbaKrokow: 2 },
]
```

Plan bez kroków zwraca pustą tablicę.

### Relacja do istniejących funkcji

- `osBezPrzestojow(plan)` — źródło danych, bez zmian.
- `zuzycieNaDobe(plan, indeks)` — licząca zużycie w oknie doby **od
  wskazanego momentu** (dowolny punkt startowy, jedno okno). Zostaje bez
  zmian, ma inne zastosowanie: pasek stanu pyta o okno „od teraz".
- `zapotrzebowanieDzienne(plan)` — nowa, liczy **wszystkie** okna naraz,
  wyrównane do siatki dni od startu planu (dzień 0, 1, 2, ...), nie od
  dowolnego momentu. To jest tabela do przeglądania całego planu naraz, nie
  odpowiedź na pytanie o jeden punkt.

Obie funkcje współdzielą tę samą oś i tę samą zasadę przypisania kroku do
okna (start kroku decyduje), ale nie dzielą kodu — są na tyle krótkie, że
wydzielanie wspólnej pomocniczej na tym etapie tylko dodałoby pośredni poziom
bez realnej korzyści.

## Testy

- Plan mieszczący się w jednym dniu — tablica jednoelementowa, suma równa
  całkowitemu kosztowi planu.
- Plan rozciągnięty na kilka dni — kroki trafiają do właściwych dni po
  `startS`.
- Krok trwający dłużej niż dobę — koszt w całości w dniu startu, kolejny
  dzień (lub dni) dostaje wiersz zerowy, nie jest pomijany.
- Ostatni dzień niepełny — wciąż obecny w tablicy, liczba dni to `ceil`.
- Plan bez kroków — pusta tablica.
- Suma kosztów po wszystkich dniach równa sumie kosztów wszystkich kroków
  (kontrola spójności z `osBezPrzestojow`).

## Otwarte

Jak ten rozkład trafi do interfejsu (kolejka podzielona na dni, bilans
dzienny z realnym zaopatrzeniem) — osobne rundy, do zaprojektowania po tym,
jak fundament będzie scommitowany i przetestowany.
