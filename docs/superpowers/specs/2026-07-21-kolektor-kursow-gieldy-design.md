# Kolektor kursów giełdy premium — projekt

Data: 2026-07-21

## Problem

Kurs giełdy premium (ile surowca za 1 PP) różni się między kontynentami i zmienia
się w czasie. Żeby ocenić, gdzie opłaca się handlować, trzeba obejść wioski na
kilku kontynentach i spisać kursy — ręcznie, do notatnika. Jest to żmudne i
łatwo o pomyłkę.

Narzędzie ma odczytać te same liczby, które gracz i tak widzi na ekranie, i
złożyć je w jeden zestaw gotowy do analizy.

## Ograniczenie nadrzędne: zero zapytań do serwera

Skrypt czyta **wyłącznie DOM strony, którą gracz sam otworzył**. Nie wysyła
żadnego zapytania — ani `fetch`, ani `XMLHttpRequest`, ani przeładowania. Nie
automatyzuje żadnej akcji w grze i nie zmienia zachowania gracza.

Konsekwencja: z punktu widzenia serwera odczyt jest nieodróżnialny od
przepisania liczb ręcznie, bo nie generuje żadnego ruchu sieciowego. To
odróżnia to narzędzie od istniejącego kolektora logu PP, który pobiera kolejne
strony logu i dlatego ma tryb „grzeczny" z pauzą.

Ten warunek jest wiążący dla implementacji: kod nie może zawierać wywołań
sieciowych ani wymuszać nawigacji.

## Zakres v1

W zakresie:

- odczyt kursów trzech surowców z otwartego ekranu giełdy premium,
- ustalenie kontynentu bieżącej wioski,
- pamięć migawkowa: jeden wiersz na kontynent, nadpisywany,
- panel w rogu strony pokazujący zebrane kontynenty,
- eksport zebranych danych do schowka jako JSON.

Poza zakresem (osobny etap):

- progi i alarmy o korzystnym kursie,
- wykresy i historia kursu,
- strona analizy importująca ten JSON.

## Postać dostarczenia

**Userscript** (Tampermonkey/Violentmonkey), uruchamiany automatycznie na
ekranie giełdy premium. Wybrany zamiast bookmarkletu, bo panel ma odtwarzać
się sam przy każdym przeskoku do kolejnej wioski, bez klikania. Pod względem
ruchu sieciowego oba warianty są identyczne (zero zapytań) — decyduje wygoda.

## Przepływ użytkownika

1. Gracz wchodzi na ekran giełdy premium w dowolnej wiosce.
2. Skrypt odczytuje kursy i kontynent, zapisuje, rysuje panel w rogu.
3. Gracz przeskakuje do wioski na innym kontynencie i znów wchodzi na giełdę.
4. Panel odtwarza się z pamięci i dokłada nowy wiersz.
5. Po obejściu wiosek gracz klika **Kopiuj do schowka**.
6. JSON wkleja na stronie analizy.

Na ekranach innych niż giełda premium panel się nie pokazuje.

## Odczyt ze strony

### Kursy

Trzy komórki o stabilnych identyfikatorach:

- `#premium_exchange_rate_wood` — drewno
- `#premium_exchange_rate_stone` — glina
- `#premium_exchange_rate_iron` — żelazo

Każda zawiera trzy elementy `.premium-exchange-sep`: ilość surowca, znak `⇄`,
oraz `1` (punkt premium). Wartością kursu jest **pierwsza liczba** w komórce.

Przykład struktury:

```html
<td id="premium_exchange_rate_wood" class="center">
  <div class="premium-exchange-sep"><img src="…wood_18x16.png" alt=""> 378</div>
  <div class="premium-exchange-sep">⇄</div>
  <div class="premium-exchange-sep"><img src="…premium.webp"> 1</div>
</td>
```

Jednostka: **ilość surowca za 1 PP**. Wyższa wartość jest korzystniejsza przy
kupowaniu surowca za punkty. Nie ma podziału na kurs kupna i sprzedaży — giełda
podaje jedną wartość na surowiec.

Parsowanie usuwa spacje nierozdzielające i separatory tysięcy przed konwersją
na liczbę, tak jak robi to istniejący parser logu.

### Kontynent

Strona podaje kontynent wprost, w komórce z lokalizacją bieżącej wioski:

```html
<td class="box-item" style="padding-right: 6px"><b class="nowrap">(499|613) K64</b></td>
```

Odczyt: dopasowanie wzorca `(\d+)\|(\d+)\)\s*K(\d+)` w treści strony. Daje
jednocześnie współrzędne i kontynent.

Zapas: jeśli oznaczenie `K` nie występuje, kontynent liczymy ze współrzędnych
jako `K` + pierwsza cyfra Y + pierwsza cyfra X. Dla `(499|613)` daje to `K64` —
zgodnie z tym, co strona podaje wprost.

## Model danych

Pojedynczy odczyt:

```json
{
  "continent": "K64",
  "x": 499,
  "y": 613,
  "wood": 378,
  "stone": 372,
  "iron": 406,
  "at": "2026-07-21T14:30:12.000Z"
}
```

Eksport:

```json
{
  "exportedAt": "2026-07-21T14:32:00.000Z",
  "world": "pl231",
  "readings": [ /* … */ ]
}
```

Każdy odczyt niesie własny znacznik czasu. Kolektor trzyma tylko migawkę, ale
strona analizy zbuduje z kolejnych eksportów historię kursu w czasie.

## Pamięć

- Jeden wiersz na kontynent; powtórny odczyt nadpisuje poprzedni.
- `localStorage` domeny świata (np. `pl231.plemiona.pl`) — przeżywa
  przeładowania i zamknięcie przeglądarki.
- Klucz magazynu zawiera identyfikator świata, żeby dane z różnych światów się
  nie mieszały. Świat odczytujemy z nazwy hosta.
- Wolumen danych jest znikomy (kilkanaście wierszy), więc nie potrzeba
  kompresji stosowanej w dashboardzie logu.

## Panel

Zakotwiczony w rogu okna, nad treścią gry.

```
┌──────────────────────────────────┐
│ Kursy giełdy              ─   ✕  │
├──────┬────────┬───────┬──────────┤
│ K    │ Drewno │ Glina │ Żelazo   │
├──────┼────────┼───────┼──────────┤
│ K64  │  378   │  372  │  406     │
│ K45  │  325   │  331  │  254     │
├──────┴────────┴───────┴──────────┤
│ 2 kontynenty · 14:32             │
│ [ Kopiuj do schowka ] [ Wyczyść ]│
└──────────────────────────────────┘
```

Zachowanie:

- Wiersz właśnie zaktualizowany podświetla się na moment, więc widać, że odczyt
  zaskoczył, bez wpatrywania się w liczby.
- `─` zwija panel do samego paska tytułowego; wybór jest zapamiętany między
  stronami, więc panel wraca zwinięty.
- `✕` chowa panel do końca oglądania tej strony. Przy następnym wejściu na
  giełdę panel wraca — ukrycie nie wyłącza zbierania danych.
- Kontynenty posortowane rosnąco po numerze.
- **Kopiuj do schowka** kopiuje JSON i potwierdza to na przycisku.
- **Wyczyść** kasuje pamięć po potwierdzeniu.

Wygląd nawiązuje do motywu dashboardu (pergamin, oksbloodowy akcent), ale panel
jest samodzielny — style wstrzykiwane przez skrypt, bez zależności od CSS gry.

## Obsługa błędów

- **Brak kursów na stronie** (inny ekran, treść niewczytana): skrypt nie
  zapisuje nic i nie rusza pamięci.
- **Nie da się ustalić kontynentu**: panel pokazuje odczyt z ostrzeżeniem
  zamiast zapisywać go pod złym kluczem.
- **Kurs nie parsuje się do liczby**: odczyt odrzucony w całości.

Zasada: popsuty odczyt nigdy nie nadpisuje dobrego.

- **Schowek niedostępny** (brak uprawnień): panel pokazuje JSON w polu
  tekstowym do ręcznego skopiowania.

## Struktura kodu

Osobne narzędzie, ale w tym samym repozytorium — strona analizy kursów będzie
z nim rozmawiać przez wspólny format JSON.

Logika czysta, testowana przez `node --test` jak reszta projektu:

- odczyt kursów z dokumentu,
- ustalenie kontynentu (odczyt + wyliczenie zapasowe),
- scalanie odczytu z migawką,
- budowa ładunku eksportu.

Userscript jest cienką warstwą nad tymi modułami: nagłówek metadanych,
wykrycie ekranu, render panelu, obsługa przycisków. Budowa userscriptu dołącza
do istniejącego `build.js` jako kolejny cel.

## Kryteria ukończenia

- Wejście na giełdę na trzech kontynentach daje panel z trzema wierszami i
  poprawnymi kursami.
- Powrót na wcześniej odwiedzony kontynent nadpisuje jego wiersz, nie dokłada
  nowego.
- Eksport daje JSON zgodny z modelem wyżej.
- Przegląd kodu potwierdza brak jakichkolwiek wywołań sieciowych.
- Testy jednostkowe przechodzą.
