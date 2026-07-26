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
`get_building_info`, `get_unit_info`) i zapisuje `src/data/swiaty/pl231.json`.
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
czas = build_time_budynku
     × (1,18083 × 1,1891^poziom − 1,78191)
     × 1,05^(−poziom_ratusza)
     ÷ prędkość_świata
```

Człon ratusza `1,05^(−poziom)` jest potwierdzony na wszystkich 30 poziomach
względem tabeli współczynników z gry.

Stałe krzywej poziomu wyznaczono z obserwacji przy Ratuszu 14, gdzie
`1,05^(−14) = 0,50507`. W tej postaci dopasowanie brzmi
`build_time × (0,59640 × 1,1891^poziom − 0,90000)`; stałe w formule powyżej to te
same wartości podzielone przez `0,50507`, żeby człon ratusza dało się wyciągnąć
osobno. Ma to znaczenie przy implementacji — pomnożenie dopasowanych stałych
przez człon ratusza po raz drugi liczyłoby go podwójnie.

Dzielenie przez prędkość świata jest założeniem — świat 231 ma prędkość 1, więc
nie dało się tego potwierdzić obserwacyjnie.

Krzywa poziomu została odtworzona z ekranu Ratusza wioski A004 (świat 231,
Ratusz 14) zapisanego w `_share/`. Przy odczycie trzeba było uwzględnić, że
ekran pokazuje koszty i czasy dla poziomów **po** kolejce budowy — Spichlerz był
w kolejce na 20, więc wiersz dotyczył poziomu 21, a Zagroda kolejkowana na 11–13
pokazywała poziom 14. Bez tej poprawki dane wyglądają na sprzeczne.

Dokładność: jedenaście pozycji na siedmiu budynkach mieści się w 0,1%.

**Znane ograniczenie.** Poniżej poziomu 7 model się rozjeżdża i rozjazd rośnie
im niżej: poziom 7 błąd 1,3%, poziom 4 około 16%, poziom 3 około 26%, dla
poziomu 1 wzór daje wartość ujemną. Jest to zakres, w którym symulacja „od zera"
spędza pierwsze kilkadziesiąt godzin, więc wymaga kalibracji.

Kalibracja wymaga zrzutu ekranu Ratusza z młodej wioski (Ratusz 3–6, budynki
0–5, najlepiej bez kolejki budowy). Da to kilkanaście punktów w brakującym
zakresie i pozwoli niezależnie potwierdzić człon ratusza przy innym jego
poziomie. Do czasu kalibracji krzywa poniżej poziomu 7 jest przybliżona, a
interfejs musi to oznaczać.

Krzywa czasu jest w kodzie **wymienną funkcją** z osobnym zestawem testów
kalibracyjnych, żeby poprawka była zmianą stałych, a nie przebudową silnika.

### Budynki nietypowe

- **Wieża strażnicza** — poziom 1 buduje się w 50 sekund przy koszcie 36 tysięcy
  surowców, czego nie da się pogodzić z żadną krzywą. Traktowana osobno, czas
  z tabeli, nie ze wzoru.
- **Plac, Piedestał, Pałac** — po jednym poziomie na świecie 231, więc krzywa
  ich nie dotyczy.
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
| Wieża strażnicza | brak — **niezweryfikowane** |

Pozostałe budynki nie mają wymagań.

## Model planu

Plan to czysty JSON, bez stanu interfejsu — to jest obiekt wymieniany między
graczem a Claude:

```json
{
  "swiat": "pl231",
  "start": {
    "poziomy": { "ratusz": 1, "zagroda": 1, "spichlerz": 1, "plac": 1 },
    "surowce": { "drewno": 500, "glina": 500, "zelazo": 500 }
  },
  "kroki": [ { "budynek": "spichlerz", "do_poziomu": 2 } ],
  "dochody": [ { "czas_s": 0, "drewno_h": 0, "glina_h": 0, "zelazo_h": 0 } ],
  "zastrzyki": [ { "czas_s": 172800, "drewno": 10000, "glina": 10000, "zelazo": 10000 } ]
}
```

**Poziomy startowe** domyślnie z `min_level` świata: Ratusz 1, Zagroda 1,
Spichlerz 1, Plac 1, reszta 0. Edytowalne.

**Surowce startowe** domyślnie 500/500/500. Edytowalne. Wartość przyjęta bez
pewnego źródła — do potwierdzenia.

**Dochody** to lista przedziałów. Wpis obowiązuje od swojego `czas_s` aż do
następnego wpisu. Reprezentuje farmienie i zbieractwo łącznie — gracz wpisuje
liczbę ręcznie, symulator nie modeluje tych mechanik.

**Zastrzyki** to dosyłki jednorazowe w danym momencie osi.

## Silnik

Czyste moduły ESM w `src/wioska/`, bez DOM-u i bez `window`:

- `swiat.js` — wczytanie danych świata, wyprowadzenie kosztów, czasów,
  produkcji, pojemności i ludności dla dowolnego budynku i poziomu,
- `czas.js` — krzywa czasu budowy, wymienna, z testami kalibracyjnymi,
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

**Oznaczenie niepewności** — dopóki krzywa czasu nie jest skalibrowana poniżej
poziomu 7, kroki w tym zakresie są wizualnie oznaczone jako przybliżone.

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
- **Kalibracja czasu** — silnik odtwarza czasy z zapisanego ekranu Ratusza
  wioski A004, z uwzględnieniem poprawki na kolejkę budowy. Test dokumentuje
  obecną dokładność i zaczerwieni się, gdy zmiana krzywej ją pogorszy.
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

1. **Kalibracja czasu poniżej poziomu 7** — potrzebny zrzut ekranu Ratusza z
   młodej wioski. Do tego czasu wyniki wczesnych poziomów są przybliżone.
2. **Wymagania Wieży strażniczej** — do sprawdzenia w grze.
3. **Surowce startowe świeżej wioski** — przyjęto 500/500/500.
