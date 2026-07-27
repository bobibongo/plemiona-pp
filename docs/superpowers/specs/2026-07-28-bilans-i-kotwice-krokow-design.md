# Bilans zaopatrzenia i kotwice krokowe — projekt

Data: 2026-07-28

Trzecia runda symulatora budowy wioski, po
`2026-07-27-przebudowa-interfejsu-symulatora-design.md`.

## Problem

Dwie rzeczy w obecnej wersji są pomyślane od złej strony.

**Wtrącenia gracza są kotwiczone w czasie.** Dosyłkę wpisuje się „po dwudziestu
czterech godzinach", a zmianę dochodu „od drugiego dnia". Tymczasem szablon
Menedżera Konta to **ciąg kroków, nie harmonogram** — godziny są wynikiem
symulacji, nie danymi wejściowymi. Skutek jest podwójny: myśli się w złych
jednostkach („po wybudowaniu Spichlerza" trzeba przetłumaczyć na godziny), a
przeciąganie wtrąceń w kolejce nie może działać poprawnie, bo zmiana czasu
zmienia przebieg, który zmienia moment, w którym wtrącenie wypada.

**Zapotrzebowanie jest podane jako jedna liczba dla całego planu.** Wymagany
dochód na dobę to maksimum po wszystkich krokach, więc nie mówi, że ostatni
odcinek planu pali o połowę szybciej niż początek. Przy szablonie budowanym od
zera to właśnie tempo na danym etapie decyduje o tym, kiedy dołożyć farmienia.

Do tego pasek stanu wystaje poza układ na szerokim ekranie, wymagania budynków
rozbijają rytm tabeli, a Plac, Piedestał i Pałac siedzą w jej środku, choć mają
po jednym poziomie i nic się z nimi nie robi.

## Zakres

W zakresie:

- kotwice krokowe zamiast czasu dla dosyłek i zmian dochodu,
- przeciąganie wtrąceń w kolejce,
- dochód jako jedna suma na dobę, dzielona równo na trzy surowce, z podziałem na
  farmę i zbieractwo,
- zużycie surowców na dobę liczone po harmonogramie bez przestojów,
- pasek stanu w dwóch kolumnach: stan wioski po lewej, bilans po prawej,
- wymagania budynków w dymku przycisku,
- jawna kolejność budynków z Placem, Piedestałem i Pałacem na końcu.

Poza zakresem:

- **rekrutacja jednostek** — nadal osobna runda. Bilans dostaje miejsce na
  pozycję zużycia przez wojsko, ale jej nie liczy.
- kotwiczenie wtrąceń w czasie bezwzględnym — zastąpione kotwicami krokowymi,
- natywny format szablonu Menedżera Konta,
- automatyczny optymalizator kolejności.

## Kotwice krokowe

### Model

`dochody[i]` i `zastrzyki[i]` tracą pole `czasS`, a dostają `kotwica`:

- `null` — obowiązuje od startu planu, przed pierwszym krokiem,
- `{ budynek, doPoziomu }` — obowiązuje od chwili **ukończenia** tego kroku.

W poprawnym planie para budynek plus poziom docelowy występuje dokładnie raz, bo
kroki idą po jednym poziomie w górę. Kotwica jest więc jednoznaczna i — co
najważniejsze — **przeżywa zmianę kolejności kroków**: wtrącenie wędruje razem
ze swoim krokiem, bez przeliczania czegokolwiek.

### Rozwiązywanie kotwic w symulacji

Na wejściu symulacja tłumaczy każdą kotwicę na indeks kroku w planie: `null` na
`−1`, a `{ budynek, doPoziomu }` na pozycję odpowiadającego kroku. Potem sortuje
wtrącenia po tym indeksie.

Po ukończeniu kroku o indeksie `i` symulacja stosuje wszystkie dosyłki o indeksie
`i` i przełącza dochód na ostatni wpis o indeksie nie większym niż `i`. Przed
pierwszym krokiem obowiązują wpisy o indeksie `−1`.

Dwa wpisy dochodu przypięte do tego samego kroku: obowiązuje **ostatni w
kolejności tablicy**. Dwie dosyłki przypięte do tego samego kroku: obie się
stosują, bo są sumami, nie stanem.

### Usunięcie kroku, do którego coś było przypięte

Wtrącenia przypięte do usuwanego kroku **przypinają się po cichu do kroku
poprzedniego**; gdy usuwany krok był pierwszy, przypinają się do startu planu.
Dzieje się to w obsłudze usuwania, bo tylko tam znana jest pozycja usuwanego
kroku.

Świadoma konsekwencja: usunięcie kroku może zmienić wynik symulacji, bo dochód
zacznie obowiązywać wcześniej. Wariant z pozostawieniem wtrącenia bez kotwicy
został rozważony i odrzucony jako trudniejszy w obsłudze.

### Kotwica wisząca

Kotwica wskazująca na krok nieobecny w planie — możliwa wyłącznie przy ręcznie
edytowanym JSON — jest przy normalizacji zamieniana na `null`, czyli start
planu. To siatka bezpieczeństwa dla wklejonego z zewnątrz pliku, nie ścieżka
używana w interfejsie.

### Przeciąganie wtrąceń

Wiersz wtrącenia w kolejce da się przeciągać tak jak kafelek kroku. Upuszczenie
bezpośrednio przed krokiem o indeksie `n` ustawia kotwicę na krok `n − 1`;
upuszczenie przed pierwszym krokiem ustawia `null`. Nie ma tu żadnego dryfu,
bo kotwica nie jest czasem.

Stan przeciągania musi odtąd rozróżniać, co jest ciągnięte: krok, dosyłka czy
zmiana dochodu.

### Migracja istniejących planów

Plan zapisany w przeglądarce ma wtrącenia z polem `czasS`. Normalizacja
przypina każde do pierwszego kroku, który w harmonogramie **bez przestojów**
startuje nie wcześniej niż ten moment; wtrącenia sprzed pierwszego kroku dostają
`null`, a te wypadające za końcem harmonogramu — ostatni krok planu. Bez tego
zapisany plan straciłby całe zaopatrzenie.

Migracja opiera się na harmonogramie bez przestojów, bo harmonogram realny
zależy od dochodu, a dochód jest właśnie tym, co migrujemy — liczenie go
wymagałoby już rozwiązanych kotwic. Przypisanie jest więc przybliżone i
jednorazowe; po migracji gracz może przeciągnąć wtrącenie tam, gdzie chce.

## Dochód jako jedna suma

Wpis dochodu traci trzy pola i dostaje dwa:

- `sumaD` — suma na dobę, dzielona **równo** na trzy surowce przy użyciu,
- `zrodlo` — `'farma'` albo `'zbieractwo'`.

Dzielenie na trzy odbywa się przy użyciu, nie przy zapisie, więc suma
niepodzielna przez trzy nie gubi reszty — dochód jest tempem, a nie liczbą
całkowitą sztuk.

Wpisy w starym formacie przeliczają się przez **zsumowanie** trzech
dotychczasowych wartości. Łączny dochód zostaje ten sam, rozkład na surowce się
wyrównuje. Wpisy bez pola `zrodlo` trafiają do farmy.

Dosyłki zostają przy trzech osobnych polach — przy ręcznym przesyłaniu gracz
decyduje, ile którego surowca wysyła.

## Zużycie na dobę

Moduł zapotrzebowania zaczyna zwracać **oś bez przestojów**: listę kroków z
momentem startu i kosztem, liczoną wyłącznie z czasów budowy.

Osobna czysta funkcja liczy z niej zużycie w dobie od wskazanego momentu: sumę
kosztów kroków, których start wypada w przedziale `[T, T + 24 h)`. Gdy do końca
planu zostaje mniej niż doba, funkcja zwraca sumę do końca i zaznacza to flagą —
pasek pisze wtedy „do końca planu" zamiast przeliczać dwie godziny na dobę.

**Podstawą jest harmonogram bez przestojów, nie realny.** Gdyby liczyć po
realnym, miara mierzyłaby samą siebie: przy braku surowców plan zużywa dokładnie
tyle, ile wpływa, więc bilans zawsze wyszedłby zerowy i nigdy nie powiedziałby,
że dochód jest za mały.

Zmierzone na planie 60 kroków (kopalnie do 10, Spichlerz 12, Zagroda 8, Ratusz
10; czas netto 1 d 03 h): tempo trzyma się około 13 000 drewna na dobę przez
większość planu i rośnie do 20 800 na ostatnim odcinku, gdzie wchodzą drogie
poziomy Ratusza.

## Pasek stanu w dwóch kolumnach

Szerokość dostaje ten sam sufit co siatka kolumn pod nim — dziś pasek jest bez
ograniczenia i na szerokim ekranie wystaje poza układ.

**Lewa kolumna — stan wioski.** Rząd ikon budynków z poziomem **pod ikoną**,
wyśrodkowanym w swojej kolumnie. Pod nim:

| Pozycja | Treść | Dymek |
|---|---|---|
| Czas budowy bez przerw | czas netto planu | czas przy założeniu, że surowców nigdy nie brakuje |
| Czas budowy realny | czas z symulacji | czas z uwzględnieniem produkcji i zaopatrzenia |
| Aktualne eko | produkcja kopalń na godzinę we wskazanym momencie | — |
| Populacja | zajęta i limit Zagrody | — |
| Wydano | suma kosztów do wskazanego momentu | — |

**Prawa kolumna — bilans**, wszystko na dobę:

```
EKO / dobę            2 808 /  2 808 /  2 808
Farma / dobę          5 000 /  5 000 /  5 000
Zbieractwo / dobę     3 000 /  3 000 /  3 000
──────────────────────────────────────────────
Razem                10 808 / 10 808 / 10 808
Zużycie              13 714 / 12 743 /  9 432
Bilans               −2 906 / −1 935 / +1 376
Dosyłki razem         5 000 /  5 000 /  5 000
```

Ostatni wiersz bilansu jest różnicą i mówi wprost, ile na dobę brakuje albo
zostaje. Ujemna wartość jest wyróżniona wizualnie.

Wiersz dosyłek sumuje te, których kotwica wypada **nie później** niż wskazany
krok — dotąd sumowanie szło po czasie, teraz po indeksie kroku. Pozostałe
pozycje bilansu, poza zużyciem, zależą od dochodu obowiązującego w tym samym
momencie.

Wymagany dochód na dobę **znika z paska** — zostaje w eksporcie tekstowym.
W bilansie byłby czwartą liczbą w tej samej jednostce i tylko mylił.

## Tabela budynków

Powód zablokowania budynku przenosi się z osobnego wiersza pod przyciskiem do
atrybutu `title` samego przycisku. Tabela odzyskuje równy rytm, a informacja jest
po najechaniu.

Kolejność wyświetlania staje się **jawną listą**, wspólną dla tabeli budynków i
rzędu ikon w pasku stanu — inaczej te dwa miejsca rozjechałyby się przy pierwszej
zmianie. Plac, Piedestał i Pałac idą na koniec: mają po jednym poziomie i po
wybudowaniu nic się z nimi nie robi.

## Podział kodu

`widok-status.js` rozrasta się o drugą kolumnę, więc dzieli się na dwa moduły:
stan wioski i bilans. Nowa arytmetyka zużycia idzie do `zapotrzebowanie.js` jako
osobna funkcja. Jawna kolejność budynków ląduje obok nazw, bo jedno i drugie to
dane prezentacyjne.

## Testy

- **Kotwice** — rozwiązywanie na indeksy, sortowanie, stosowanie po właściwym
  kroku, dwa wpisy dochodu na tym samym kroku, dwie dosyłki na tym samym kroku,
  kotwica `null` przed pierwszym krokiem, kotwica wisząca zamieniana na `null`.
- **Zmiana kolejności** — wtrącenie zostaje przy swoim kroku po przestawieniu.
- **Usunięcie kroku z kotwicą** — wtrącenie przypina się do poprzedniego kroku,
  a przy usunięciu pierwszego — do startu planu.
- **Migracja** — plan ze starym `czasS` wczytuje się i przypina wtrącenia do
  kroków; plan ze starym trójpolowym dochodem daje tę samą sumę dobową.
- **Zużycie na dobę** — okno pełnej doby, okno krótsze niż doba z flagą,
  niezależność od dochodu i dosyłek, plan pusty.
- **Bilans** — suma trzech strumieni, różnica dodatnia i ujemna, rozdzielenie
  farmy od zbieractwa.
- **Tabela budynków** — powód zablokowania w atrybucie `title`, brak osobnego
  wiersza, kolejność z Placem, Piedestałem i Pałacem na końcu, ta sama kolejność
  w pasku stanu.
- **Przeciąganie wtrąceń** — upuszczenie przed krokiem `n` ustawia kotwicę na
  `n − 1`, upuszczenie przed pierwszym ustawia `null`.
- **Samowystarczalność strony** — bez zmian, nadal pilnowana w `test/build.test.js`.

## Otwarte

1. **Rekrutacja** — poza zakresem; bilans ma przewidziane miejsce na pozycję
   zużycia przez wojsko.
2. **Weryfikacja w przeglądarce** — żaden agent nie ma do niej dostępu, więc
   działanie przeciągania wtrąceń, dymków i zaznaczania potwierdza gracz.
