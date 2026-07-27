# Symulator budowy wioski — projekt

Data: 2026-07-26

Trzecie narzędzie w repozytorium, po dashboardzie PP i analizie kursów giełdy.
Tym samym repozytorium przestaje być „analizą PP", a staje się narzędziownikiem
do Plemion.

## Problem

Szablon budowy w Menedżerze Konta to lista rozbudów w ustalonej kolejności.
Ułożenie dobrej kolejności wymaga odpowiedzi na pytanie, na które gra nie
odpowiada: **kiedy to się skończy i gdzie będę stał bezczynnie**.

Suma kosztów nie wystarczy, bo dwie kolejności o identycznej sumie mogą różnić
się o dobę. Różnica bierze się z tego, kiedy produkcja zaczyna pracować na
gracza: wcześniejszy tartak skraca każde późniejsze oczekiwanie, wcześniejszy
ratusz skraca każdą późniejszą budowę, a za mały spichlerz potrafi zablokować
rozbudowę całkowicie.

Narzędzie symuluje budowę wioski od zera na osi czasu i pokazuje nie tylko
wynik, ale i przyczyny: który krok czekał, na co czekał i ile to kosztowało.

## Ograniczenia

- **Zero serwera.** Strona statyczna, cała symulacja w przeglądarce.
- **Zero zależności runtime.** Jak reszta repozytorium.
- **Bez połączenia z grą.** To symulacja teoretyczna, nie odczyt stanu konta.
  Gracz wpisuje stan startowy ręcznie.
- **Silnik musi działać w Node bez przeglądarki.** Wymóg twardy: Claude ma
  używać tego samego silnika co strona, przez CLI. Bez tego „przygotuj mi
  szablon" oznacza zgadywanie liczb.

## Zakres

W zakresie:

- dane światów generowane z publicznych endpointów `interface.php`,
- symulacja osi czasu: produkcja, magazyn z sufitem, oczekiwanie na surowce,
- ręczne wtrącenia gracza: zastrzyki jednorazowe i przedziały stałego dochodu,
- wymagania między budynkami,
- diagnostyka: przestoje, przepełnienie spichlerza, brak miejsca w zagrodzie,
  krok droższy niż pojemność magazynu,
- interfejs wzorowany na ekranie Ratusza,
- eksport planu jako czytelny tekst i jako JSON,
- CLI do uruchamiania symulacji poza przeglądarką.

Poza zakresem (v1):

- rekrutacja jednostek — silnik ma być na nią przygotowany, ale v1 jej nie liczy,
- natywny format szablonu Menedżera Konta — gracz przepisuje ręcznie,
- automatyczny optymalizator kolejności — rolę optymalizatora pełni Claude,
  uruchamiając CLI na wariantach,
- wiele wiosek naraz,
- burzenie budynków,
- zbieractwo i farmienie jako osobne mechaniki — wchodzą jako stały dochód.

## Warstwa danych

### Dane świata

`tools/fetch-swiat.js pl231` pobiera trzy publiczne endpointy (`get_config`,
`get_building_info`, `get_unit_info`) i wypisuje na stdout gotowy wpis do
wklejenia do stałej `SWIATY` w `src/wioska/swiaty.js` — nie plik JSON. Dane
świata żyją jako moduł JS z nazwanym eksportem, bo `build.js` skleja moduły
przez usuwanie linii `import`, a import pliku JSON tego by nie przetrwał.
Endpointy nie wymagają logowania. Strona nie pobiera ich w locie — CORS na to
nie pozwala — więc światy są wbudowane w paczkę, a poza tym strona przyjmuje
wklejony config świata, którego w paczce nie ma.

Plik świata zawiera prędkości, `base_production`, `buildtime_formula`, listę
aktywnych budynków oraz per budynek: bazę i mnożnik dla drewna, gliny, żelaza,
ludności i czasu, a także `max_level` i `min_level`.

**Tabele kosztów nie są zapisywane.** Zostało zweryfikowane, że wzór
`zaokrągl(baza × mnożnik^(poziom−1))`, z zaokrąglaniem w górę od połówki,
odtwarza 1281 z 1290 ręcznie wprowadzonych wartości z `_share/budynki.xlsx`.
Dziewięć rozbieżności to literówki w arkuszu (m.in. `4.042` zamiast `4042`),
nie błędy wzoru. Ludność liczy się tak samo i jest skumulowana.

### Tabele uniwersalne

Niezależne od świata, wyprowadzone wzorami zweryfikowanymi względem arkusza:

| Wielkość | Wzór |
|---|---|
| Produkcja surowca /h | `base_production × 1,16311^(poziom−1)` |
| Pojemność spichlerza | `1000 × 1,2295^(poziom−1)` |
| Maks. ludność zagrody | `240 × 1,1721^(poziom−1)` |
| Schowane surowce | `150 × 1,3333^(poziom−1)` |
| Współczynnik obrony muru | `1,037^poziom − 1` |
| Liczba kupców w rynku | tabela (brak wzoru) |

Produkcja skaluje się z `base_production` danego świata, więc świat x2 liczy się
poprawnie bez żadnej dodatkowej tabeli.

### Czas budowy

```
czas = maks( 10 sekund,
             build_time_budynku × G(poziom) × 1,05^(−poziom_ratusza) ÷ prędkość_świata )
```

Struktura jest rozdzielna: czas zależy od bazy budynku, od **czystej funkcji
poziomu** `G` wspólnej dla wszystkich budynków, i od poziomu Ratusza. Nie ma
w niej członu zależnego od budynku poza samą bazą.

**Człon ratusza `1,05^(−poziom)` jest potwierdzony dwukrotnie i niezależnie.**
Raz względem tabeli współczynników z gry, na wszystkich 30 poziomach. Drugi raz
obserwacyjnie: te same poziomy docelowe zmierzone w wiosce z Ratuszem 3 i w
wiosce z Ratuszem 14 dają po podzieleniu przez ten człon identyczne `G` —
rozbieżność 0,08% dla poziomu 3 i 0,03% dla poziomu 4.

**Minimum 10 sekund** jest obserwowane wprost: w świeżej wiosce sześć różnych
budynków o bazach od 900 do 1200 pokazuje równo `0:00:10`, podczas gdy wzór daje
im od 6,5 do 8,8 sekundy. Budynki, którym wzór daje powyżej 10 sekund, pokazują
wartość niezaokrągloną — Schowek 13 s przy wyliczonych 13,2, Piedestał 11 s przy
wyliczonych 11,0.

### Tabela G

Wartości zmierzone, każda jako średnia z niezależnych obserwacji:

| Poziom | G | Obserwacje | Rozrzut |
|---|---|---|---|
| 1 | 0,00772 | 3 budynki, 3 poziomy Ratusza | — |
| 2 | 0,00772 | 1 budynek, przyjęte równe G(1) | niska pewność |
| 3 | 0,16146 | 4 budynki, 2 wioski | 0,17% |
| 4 | 0,50042 | 9 budynków, 2 wioski | 0,11% |
| 7 | 2,15879 | 1 | — |
| 9 | 3,82677 | 1 | — |
| 10 | 4,89263 | 1 | — |
| 11 | 6,15777 | 2 | 0,01% |
| 12 | 7,65959 | 2 | 0,01% |
| 13 | 9,44427 | 1 | — |
| 14 | 11,56610 | 1 | — |
| 15 | 14,08831 | 1 | — |
| 21 | 43,05963 | 1 | — |

Zgodność rzędu 0,1% przy dziewięciu różnych budynkach na jednym poziomie
dowodzi, że `G` naprawdę nie zależy od budynku.

`G` **nie ma zwartej postaci** — najlepsze dopasowanie dwoma wykładnikami myli
się o 2,8%, czyli o rząd wielkości gorzej niż sam pomiar. Dlatego `G` jest
przechowywane jako **tabela pomiarowa**, a nie jako wzór.

**Poziomy bez pomiaru** (5, 6, 8, 16–20, 22–30) uzupełnia interpolacja `ln G`
splajnem po zmierzonych węzłach. Walidacja leave-one-out: tam, gdzie sąsiednie
poziomy są zmierzone, interpolacja trafia w 0,1%; tam, gdzie trzeba przeskoczyć
lukę szerokości czterech poziomów, myli się nawet o 20%. Poziomy interpolowane
są w danych oznaczone i interfejs sygnalizuje je jako mniej pewne.

### Kalibracja

`tools/kalibracja.js` przyjmuje dowolną liczbę zapisanych stron Ratusza (HTML),
wyciąga z każdego wiersza budynek, poziom docelowy, czas i poziom Ratusza,
i wypisuje zaktualizowaną tabelę `G` wraz z rozrzutem.

Przy odczycie narzędzie musi uwzględnić **kolejkę budowy**: ekran pokazuje koszt
i czas dla poziomu *po* kolejce. W wiosce A004 Spichlerz stał w kolejce na 20,
więc wiersz dotyczył poziomu 21, a Zagroda kolejkowana na 11–13 pokazywała
poziom 14. Bez tej poprawki dane wyglądają na wewnętrznie sprzeczne — to była
główna przeszkoda przy odtwarzaniu wzoru.

Każda kolejna zapisana strona Ratusza domyka kolejne poziomy. Najcenniejsze są
wioski o poziomach budynków innych niż już zmierzone, zwłaszcza w zakresie 16–30.

Dzielenie przez prędkość świata jest założeniem — świat 231 ma prędkość 1, więc
nie dało się tego potwierdzić obserwacyjnie.

### Budynki nietypowe

- **Mur obronny** — jedyny budynek łamiący wspólną krzywą, i tylko na poziomach
  1 i 2: pokazuje `4:00` tam, gdzie wzór daje 14–24 sekundy. Na poziomie 3
  wraca do wspólnego `G` co do 0,1%. Traktowany jako wyjątek z własnym
  minimum, do potwierdzenia przy kolejnej kalibracji.
- **Wieża strażnicza** — **nie jest wyjątkiem.** Wcześniej wyglądała na
  anomalię (poziom 1 w 50 sekund przy koszcie 36 tysięcy surowców), ale przy
  zmierzonym `G(1) = 0,00772` wzór daje 51,4 sekundy. Rozbieżność brała się
  z błędnej krzywej, nie z budynku.
- **Plac, Piedestał, Pałac** — po jednym poziomie na świecie 231.
- **Kościół** — nieobecny w configu świata 231, czyli wyłączony. Budynki spoza
  configu nie pojawiają się w interfejsie.

### Wymagania

`src/data/wymagania.json`, wspólne dla światów:

| Budynek | Wymaga |
|---|---|
| Koszary | Ratusz 3 |
| Mur obronny | Koszary 1 |
| Kuźnia | Ratusz 5, Koszary 1 |
| Rynek | Ratusz 3, Spichlerz 2 |
| Stajnia | Ratusz 10, Koszary 5, Kuźnia 5 |
| Warsztat | Ratusz 10, Kuźnia 10 |
| Pałac | Ratusz 20, Kuźnia 20, Rynek 10 |
| Kościół | Ratusz 5, Zagroda 5 |
| Wieża strażnicza | Ratusz 5, Zagroda 5 |

Pozostałe budynki nie mają wymagań.

Wymagania Warsztatu i Pałacu są potwierdzone niezależnie — sekcja „Jeszcze
niedostępne" na zapisanym ekranie Ratusza podaje dokładnie te same wartości.

## Model planu

Plan to czysty JSON, bez stanu interfejsu — to jest obiekt wymieniany między
graczem a Claude:

```json
{
  "swiat": "pl231",
  "start": {
    "poziomy": { "ratusz": 1, "zagroda": 1, "spichlerz": 1, "plac": 1 },
    "surowce": { "drewno": 1000, "glina": 1000, "zelazo": 1000 }
  },
  "kroki": [ { "budynek": "spichlerz", "do_poziomu": 2 } ],
  "dochody": [ { "czas_s": 0, "drewno_h": 0, "glina_h": 0, "zelazo_h": 0 } ],
  "zastrzyki": [ { "czas_s": 172800, "drewno": 10000, "glina": 10000, "zelazo": 10000 } ]
}
```

**Poziomy startowe** domyślnie z `min_level` świata: Ratusz 1, Zagroda 1,
Spichlerz 1, Plac 1, reszta 0. Edytowalne.

**Surowce startowe** domyślnie 1000/1000/1000, podane przez gracza. Edytowalne.

**Dochody** to lista przedziałów. Wpis obowiązuje od swojego `czas_s` aż do
następnego wpisu. Reprezentuje farmienie i zbieractwo łącznie — gracz wpisuje
liczbę ręcznie, symulator nie modeluje tych mechanik.

**Zastrzyki** to dosyłki jednorazowe w danym momencie osi.

## Silnik

Czyste moduły ESM w `src/wioska/`, bez DOM-u i bez `window`:

- `swiat.js` — wczytanie danych świata, wyprowadzenie kosztów, czasów,
  produkcji, pojemności i ludności dla dowolnego budynku i poziomu,
- `czas.js` — tabela `G`, interpolacja brakujących poziomów, minimum 10 sekund,
  wyjątek Muru,
- `wymagania.js` — sprawdzenie, czy krok jest dozwolony przy danym stanie,
- `symulacja.js` — przebieg osi czasu,
- `plan.js` — walidacja i normalizacja obiektu planu,
- `format.js` — eksport do tekstu i do JSON.

Ten sam zestaw importuje strona (przez istniejący `build.js`) i CLI.

### Przebieg symulacji

W wiosce buduje się **jeden budynek naraz** — kolejka to harmonogram, nie
zrównoleglenie. Liczba slotów kolejki nie wpływa na czas budowy wioski, więc nie
jest parametrem.

Dla każdego kroku po kolei:

1. Sprawdź wymagania przy bieżącym stanie poziomów. Niespełnione → błąd kroku.
2. Policz koszt i czas. Czas zależy od poziomu Ratusza **w tym momencie**, więc
   rozbudowa Ratusza przyspiesza wszystko, co po niej następuje.
3. Sprawdź, czy koszt mieści się w pojemności spichlerza. Nie mieści się → błąd
   twardy, tego kroku nie da się wykonać nigdy.
4. Sprawdź miejsce w zagrodzie. Brak → błąd kroku.
5. Wyznacz moment, w którym stan magazynu pokryje koszt przy obowiązującym
   dochodzie i uwzględniając zastrzyki. Przesuń zegar do tego momentu.
6. Odejmij koszt, przesuń zegar o czas budowy, podnieś poziom.

Magazyn ma sufit z poziomu Spichlerza. Nadwyżka przepada i jest **raportowana
jako strata**, bo to bezpośredni sygnał „zbuduj spichlerz wcześniej".

### Wynik

Nie jedna liczba, tylko oś czasu z etykietami. Dla każdego kroku: moment startu,
długość przestoju przed nim, **surowiec, na który czekał**, czas trwania, stan
magazynu i zagrody po zakończeniu.

Do tego lista ostrzeżeń: kroki z przestojem powyżej progu, momenty przepełnienia
magazynu z ilością zmarnowanej produkcji, kroki niewykonalne z powodu pojemności
spichlerza, przekroczona zagroda, niespełnione wymagania.

Te ostrzeżenia są w praktyce ważniejsze niż suma kosztów, bo mówią, *dlaczego*
kolejność jest zła i co przestawić.

## Interfejs

Wzorowany na ekranie Ratusza w grze.

**Lewa strona — tabela budynków.** Ikona, nazwa, aktualny poziom w symulacji,
koszt następnego poziomu w trzech kolumnach, czas, ludność, przycisk
„Rozbuduj". Kliknięcie dokłada krok na koniec kolejki i podbija poziom w tabeli,
więc kolejne kliknięcie pokazuje już koszt następnego poziomu — ten sam rytm co
w grze. Budynek z niespełnionym wymaganiem jest wyszarzony z podanym powodem,
tak jak gra pokazuje „Zagroda za mała".

**Prawa strona — kolejka jako oś czasu.** Każdy krok z momentem startu, czasem
trwania i momentem ukończenia, plus **pasek oczekiwania** pokazujący długość
przestoju i surowiec, na który krok czeka. Kroki można przeciągać i usuwać;
każda zmiana przelicza całą oś od nowa.

**Pasek stanu** między nimi, dla momentu wskazanego kursorem: surowce,
produkcja na godzinę, zajętość zagrody, zapełnienie spichlerza.

**Wtrącenia gracza** — dwa przyciski wstawiające na oś zmianę stałego dochodu
i zastrzyk jednorazowy. Siedzą w tej samej osi co budynki, nie w osobnym panelu,
bo są elementem przebiegu.

**Podsumowanie na dole** — łączny czas, suma surowców z rozbiciem na własną
produkcję, dochód i zastrzyki, oraz lista ostrzeżeń.

**Oznaczenie niepewności** — kroki, których poziom nie ma pomiaru w tabeli `G`
i został uzupełniony interpolacją, są wizualnie oznaczone. Podsumowanie podaje,
jaka część łącznego czasu pochodzi z poziomów interpolowanych.

## Eksport

Dwie formy, obie do schowka:

- **tekst** — czytelna lista kroków z sumami, do przepisania do Menedżera Konta,
- **JSON** — pełny plan w formacie powyżej.

JSON jest ważniejszy, niż wygląda: to jest kanał wymiany z Claude. Gracz wkleja
plan, Claude ładuje go do CLI, przelicza warianty kolejności, oddaje nowy JSON,
gracz wkleja go z powrotem do strony i widzi ten sam wynik.

Natywny format szablonu Menedżera Konta jest poza zakresem — ekran „Menedżer
Budowy" służy wyłącznie do wyboru szablonu i nie ujawnia formatu, a gracz
akceptuje przepisywanie ręczne.

## CLI

`tools/plan.js` — wczytuje plan z pliku lub stdin, uruchamia symulację, wypisuje
oś czasu i ostrzeżenia. Pozwala Claude uruchomić dokładnie ten sam silnik co
strona i porównać warianty kolejności na twardych liczbach.

To jest mechanizm zastępujący automatyczny optymalizator: przestrzeń możliwych
kolejności jest zbyt duża na przeszukiwanie, a „najlepsza" zależy od celu,
którego nie da się zapisać z góry.

## Testy

- **Zgodność z arkuszem** — silnik odtwarza tabele kosztów i ludności z
  `_share/budynki.xlsx`, z listą dziewięciu znanych literówek jako wyjątków.
- **Kalibracja czasu** — silnik odtwarza co do sekundy wszystkie czasy z obu
  zapisanych ekranów Ratusza (A004 przy Ratuszu 14, Wioska yozeek przy
  Ratuszu 3), z uwzględnieniem poprawki na kolejkę budowy. Dwie wioski o różnym
  poziomie Ratusza w jednym teście pilnują, żeby człon ratusza nie wsiąkł
  w tabelę `G`.
- **Odczyt kalibracyjny** — `tools/kalibracja.js` na zapisanych stronach zwraca
  tabelę `G` zgodną z tą w danych.
- **Symulacja** — przypadki jednostkowe: oczekiwanie na jeden surowiec,
  przepełnienie magazynu, krok ponad pojemność spichlerza, przekroczona
  zagroda, niespełnione wymaganie, zastrzyk skracający oczekiwanie, zmiana
  dochodu w trakcie oczekiwania.
- **Plan** — walidacja i normalizacja, w tym plany niepoprawne.

## Zmiany w repozytorium

- `package.json` — nazwa z `plemiona-pp-analiza` na narzędziownik.
- `index.html` — strona główna staje się rozdzielnikiem do trzech narzędzi.
- `README.md` — opis repozytorium jako zestawu narzędzi.
- `build.js` — dołożenie nowej strony do generowanego `dist/`.

## Otwarte

1. **Poziomy `G` bez pomiaru** — 5, 6, 8, 16–20 i 22–30. Na razie interpolowane.
   Domyka je kolejna zapisana strona Ratusza przepuszczona przez
   `tools/kalibracja.js`; najcenniejsze są wioski z budynkami w zakresie 16–30.
2. **`G(2)`** — jedyna obserwacja (Schowek 13 s przy Ratuszu 1) daje przedział
   0,00729–0,00788, w którym mieści się `G(1)`. Przyjęto `G(2) = G(1)`, bo czas
   budowy nie może maleć z poziomem, a ta wartość nadal odtwarza obserwowane
   13 sekund. Rozdzielić te dwa poziomy da się dopiero pomiarem budynku
   o większej bazie czasowej.
3. **Minimum Muru na poziomach 1 i 2** — obserwowane `4:00` w dwóch wioskach,
   bez wyjaśnienia mechaniki. Do potwierdzenia przy kolejnej kalibracji.
4. **Wpływ prędkości świata na czas budowy** — założono dzielenie, brak
   możliwości potwierdzenia na świecie o prędkości 1.
