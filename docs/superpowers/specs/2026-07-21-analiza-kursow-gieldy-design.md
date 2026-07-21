# Strona analizy kursów giełdy — projekt

Data: 2026-07-21

Etap drugi po kolektorze kursów
(`2026-07-21-kolektor-kursow-gieldy-design.md`). Kolektor zbiera kursy w grze
i kopiuje je do schowka; ta strona je gromadzi i analizuje.

## Problem

Kolektor trzyma tylko **migawkę** — jeden wiersz na kontynent, nadpisywany przy
każdym powrocie. Historia kursu nie powstaje nigdzie. Bez niej nie da się
odpowiedzieć na pytanie, czy dzisiejszy kurs jest dobry, ani zauważyć, że
któryś kontynent jest trwale tańszy.

Strona przyjmuje kolejne eksporty, składa z nich przebieg w czasie i mówi,
które kontynenty właśnie przebiły ustawione progi.

## Ograniczenia

- **Zero serwera.** Plik otwierany z dysku, cała analiza w przeglądarce,
  magazyn w `localStorage`. Nic nie wychodzi na zewnątrz.
- **Zero zależności runtime.** Własne wykresy SVG, jak w dashboardzie PP.
- Narzędzie **odrębne** od dashboardu PP — własny plik, własny magazyn.

## Zakres

W zakresie:

- import wklejonego JSON z kolektora, odporny na powtórki,
- historia odczytów w `localStorage`, z podziałem na światy w widoku,
- wykres przebiegu średniego kursu, linia na kontynent, linie progów,
- dwa progi (górny i dolny) wspólne dla wszystkich surowców i kontynentów,
- pasek okazji liczony z najświeższych odczytów,
- tabela aktualnego stanu.

Poza zakresem:

- dźwięk przy sygnale,
- powiadomienia e-mail,
- progi osobne per surowiec lub per kontynent,
- eksport historii dalej.

## Przepływ

1. Gracz kończy obchód wiosek, w grze klika **Eksportuj** (JSON w schowku).
2. Otwiera stronę analizy z dysku.
3. Wkleja JSON w oknie importu.
4. Strona dokłada nowe odczyty do historii i przelicza widok.
5. Pasek okazji mówi, gdzie warto handlować; wykres pokazuje, czy to
   wyjątkowa okazja, czy zwykły poziom.

## Model danych

Odczyt trafiający do historii — kształt z kolektora, wzbogacony o świat:

```json
{
  "world": "pl231",
  "continent": "K64",
  "x": 499, "y": 613,
  "wood": 378, "stone": 372, "iron": 406,
  "at": "2026-07-21T14:30:12.000Z"
}
```

Surowce zapisujemy **osobno**. Średnia jest sposobem wyświetlania, nie formą
przechowywania — gdyby kiedyś przydało się rozbicie, dane czekają.

Średnia kontynentu: `(wood + stone + iron) / 3`, zaokrąglona do liczby
całkowitej przy wyświetlaniu.

### Tożsamość odczytu

Klucz: `world | continent | at`.

Ten sam eksport wklejony drugi raz nie zmienia niczego. Wklejenie starego
pliku dokłada tylko brakujące odczyty. Dzięki temu import jest bezpieczny do
powtarzania i nie wymaga od gracza pilnowania, co już wgrał.

### Magazyn

`localStorage`, **jeden klucz na całą historię**, niezależnie od liczby światów.
Świat jest polem każdego odczytu, a nie osobnym magazynem — rozdzielenie
światów dzieje się przy wyświetlaniu, przez filtr. Dzięki temu import nie musi
wiedzieć, do którego magazynu trafia, a przełączenie świata nie wymaga
przeładowania danych.

Wolumen jest znikomy — kilka odczytów dziennie przez rok to rząd tysięcy
wierszy — więc bez kompresji stosowanej w dashboardzie logu.

Progi zapisujemy pod osobnym kluczem, żeby czyszczenie historii ich nie
kasowało.

## Sygnały

Dwie liczby wpisywane raz i zapamiętane lokalnie: **próg górny** i **próg
dolny**. Wspólne dla wszystkich surowców i kontynentów.

Kurs oznacza **ilość surowca za 1 PP**, więc:

| Warunek | Znaczenie | Etykieta |
|---|---|---|
| średnia ≥ próg górny | dużo surowca za 1 PP, surowce tanie | **kupuj** surowce za punkty |
| średnia ≤ próg dolny | mało surowca za 1 PP, surowce drogie | **sprzedawaj** surowce za punkty |

Sygnał liczymy z **najświeższego** odczytu każdego kontynentu — nie z całej
historii. Pasek okazji pokazuje wiersze w postaci `K55 · 412 · kupuj`.

Gdy nic nie przebija progów, pasek mówi to wprost („Brak okazji przy obecnych
progach") zamiast znikać. Puste miejsce jest dwuznaczne: nie wiadomo, czy nie
ma okazji, czy coś się zepsuło.

Gdy progi nie są jeszcze ustawione, pasek zaprasza do ich wpisania.

## Wykres

Jeden wykres. Oś pozioma: czas. Oś pionowa: średni kurs.

- **Linia na kontynent**, kolor przypisany do kontynentu na stałe. Kolor nie
  wędruje między kontynentami po zmianie zakresu dat — inaczej filtr
  przemalowywałby serie i wykres kłamałby przy porównaniu z poprzednim
  spojrzeniem.
- **Dwie poziome linie progów** przez całą szerokość, wyraźnie odróżnione od
  serii danych (przerywane, neutralny kolor).
- **Legenda zawsze obecna**, bo serii jest więcej niż jedna — tożsamość
  kontynentu nie może zależeć wyłącznie od koloru.
- **Najechanie na punkt** pokazuje datę, kontynent, średnią i rozbicie na trzy
  surowce. Tu wraca szczegół, który średnia chowa.

Odczyty są nieregularne (zbierane wtedy, gdy gracz akurat obchodzi wioski),
więc punkty rysujemy wprost tam, gdzie wypadły, bez sztucznego wyrównywania do
siatki dni.

## Układ strony

Od góry:

1. **Pasek importu** — przycisk „Wklej dane", licznik odczytów w historii,
   przełącznik świata (widoczny, gdy światów jest więcej niż jeden).
2. **Progi i pasek okazji** — dwa pola liczbowe i lista sygnałów.
3. **Wykres**.
4. **Tabela aktualnego stanu** — kontynent, średnia, drewno, glina, żelazo,
   kiedy odczytane. Sortowana po średniej malejąco, żeby najtańszy kontynent
   był na górze.

Wygląd spójny z dashboardem PP: pergamin na ciemnym drewnie, oksbloodowy
akcent, liczby monospace.

## Obsługa błędów

- **Wklejony tekst nie jest JSON-em** → komunikat „To nie wygląda na dane
  z kolektora", historia nietknięta.
- **JSON bez pola `readings`** → ten sam komunikat. Nie zgadujemy kształtu.
- **Odczyt bez kontynentu lub bez kompletu kursów** → pomijany, reszta importu
  wchodzi. Podsumowanie mówi, ile wierszy przyjęto i ile pominięto.
- **Pusta historia** → strona pokazuje zaproszenie do wklejenia danych zamiast
  pustego wykresu.
- **Magazyn pełny** → komunikat, że nie udało się zapisać; widok w pamięci
  zostaje, żeby gracz nie stracił właśnie wklejonych danych.

Zasada: popsuty import nigdy nie psuje zgromadzonej historii.

## Struktura kodu

Nowe pliki w `src/`, prefiks `rates-` jak w kolektorze, płasko zgodnie
z konwencją repozytorium. Logika czysta, testowana przez `node --test`:

| Plik | Odpowiedzialność |
|---|---|
| `rates-history.js` | Scalanie importu z historią, dedup, średnie, filtr świata |
| `rates-signals.js` | Progi, wyznaczanie okazji z najświeższych odczytów |
| `rates-chart.js` | Wykres liniowy SVG z liniami progów |
| `rates-page.js` | Spięcie: magazyn, zdarzenia, render |
| `rates.template.html` | Szkielet strony |
| `rates.css` | Styl |

Strona **nie korzysta** z `rates-store.js` kolektora. Ten moduł opisuje migawkę
w grze i ma inne zadanie; wspólny jest tylko format JSON, który przechodzi
przez schowek. Sklejanie ich jednym modułem związałoby oba narzędzia bez
korzyści.

Budowa dokłada cel `dist/kursy/index.html` do `build.js`, obok dashboardu
i strony kolektora.

## Kryteria ukończenia

- Wklejenie eksportu z kolektora dokłada odczyty i pokazuje je na wykresie.
- Wklejenie tego samego eksportu drugi raz nie zmienia liczby odczytów.
- Ustawienie progów pokazuje okazje zgodne z tabelą wyżej.
- Progi przeżywają zamknięcie przeglądarki.
- Wykres rysuje linię na kontynent, dwie linie progów i legendę.
- Strona działa otwarta z dysku, bez serwera.
- Testy jednostkowe przechodzą.
