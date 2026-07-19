# Analiza logu punktów premium (Plemiona) — projekt

**Data:** 2026-07-20
**Autor:** Piotr (gracz), spisane wspólnie z Claude
**Status:** zatwierdzony do planu implementacji

## Cel

Narzędzie, które z logu punktów premium (PP) z gry Plemiona.pl robi czytelną
analizę: bilans PP w podziale na dni/tygodnie, ile PP zarobione a ile wydane i
na co, ile surowców kupionych/sprzedanych, oraz efektywność strategii opartej na
handlu na giełdzie premium (arbitraż surowce ↔ PP).

Kontekst gracza: strategia polega na kupowaniu surowców taniej i sprzedawaniu
drożej na giełdzie premium, żeby generować „darmowe" PP i surowce wspomagające
rozwój konta. Narzędzie ma pokazać, na ile ta strategia działa.

## Zakres

W zakresie:
- Pobieranie logu PP z gry (kolektor) i analiza (dashboard).
- Wszystkie dane z kolumn logu: data, świat, typ transakcji, zmiana PP, nowe
  saldo, dalsze informacje.
- Klasyfikacja transakcji na: arbitraż (kupno/sprzedaż surowców), usługi w grze,
  zewnętrzne PP (zakup za pieniądze, subskrypcje).

Poza zakresem (świadomie odłożone):
- Kursy giełdy / arbitraż między kontynentami — tych danych NIE ma w logu PP,
  wymagają osobnego źródła (ekran rynku). Ewentualny drugi etap.
- Automatyczne logowanie do gry / pełny scraper serwerowy.

## Architektura

Dwa niezależne artefakty:

### A) Kolektor — bookmarklet (jeden plik JS)

Wklejany jako zakładka w przeglądarce, uruchamiany na stronie logu premium
(`game.php?...&screen=premium&mode=log&page=N`).

Odpowiedzialność: **tylko pobranie i zapis surowych danych**. Nie analizuje.

Zachowanie:
- Przy starcie pokazuje mały panel z wyborem:
  - **Tryb „Wszystko"** — pobiera od `page=0` aż do ostatniej strony (wykrywa
    koniec paginacji z linków „następna"/numeru ostatniej strony).
  - **Tryb „Nowe od daty D"** — pobiera od `page=0` w górę i zatrzymuje się, gdy
    natrafi na wpisy starsze niż podana data D. Tryb przyrostowej aktualizacji.
  - **Opóźnienie** — jedno opcjonalne pole liczbowe (ms), domyślnie 0 lub
    minimalne. Zwykła kontrola tempa, bez randomizacji „pod człowieka".
- Parsuje tabelę logu na każdej stronie do obiektów.
- Na końcu zapisuje plik `plemiona-log-RRRRMMDD-HHMM.json` (fallback: kopia do
  schowka).

Zależność: struktura DOM strony logu (kolumny: Data, Świat, Transakcja, Zmiana,
Nowe saldo PP, Dalsze informacje). Parser musi być odporny na drobne zmiany.

### B) Dashboard — jeden plik `.html`

Otwierany lokalnie dwuklikiem. Self-contained: cały JS i CSS inline, wykresy
rysowane bez zależności sieciowych (SVG/canvas własny lub biblioteka wklejona
inline). Działa offline.

Odpowiedzialność: **wczytanie, scalenie, deduplikacja, analiza, wizualizacja**.

## Model danych

Jeden wpis logu = obiekt:

```
{
  ts:        ISO 8601 (data+czas z dopisanym rokiem),
  world:     string (np. "Świat 231", "Świat 217", "Szybkie"),
  txType:    string surowy ("Giełda Premium", "Przeniesienie", "Użycie", "Kupno"),
  change:    number (zmiana PP, +/-),
  balance:   number (nowe saldo PP),
  info:      string (dalsze informacje, surowe),
  // pola pochodne (liczone przy imporcie):
  category:  "arbitraz" | "usluga" | "zewnetrzne_pp" | "inne",
  subtype:   string (np. "kupno", "sprzedaz", "redukcja_czasu", "zakup_pp"),
  resource:  "drewno" | "glina" | "zelazo" | null,
  amount:    number | null   // ilość surowca z nawiasu, np. (20316)
}
```

### Parsowanie roku

Format daty w logu: `DD.MM. HH:MM` (rok bieżący, brak sufiksu) lub
`DD.MM.YY HH:MM` (starszy rok, sufiks dwucyfrowy).

Reguła: jeśli jest sufiks `.YY` → rok = `2000 + YY`. Jeśli brak → rok bieżący
(kotwica: zegar serwera / data importu). Chronologia logu (malejąca) służy jako
kontrola sanity, nie jako główne źródło roku.

### Klasyfikacja (z pola `info`/`txType`)

- **Arbitraż**
  - kupno: `info` zawiera „Giełda Premium-kupno: <surowiec> (<ilość>)", `change` < 0
  - sprzedaż: `info` zawiera „Giełda Premium-sprzedaż: <surowiec> (<ilość>)", `change` > 0
  - (uwaga: sprzedaż bywa typu „Przeniesienie", kupno typu „Giełda Premium" —
    klasyfikujemy po treści `info`, nie po `txType`)
  - surowiec i ilość wyciągane z tekstu; Drewno/Glina/Żelazo osobno.
- **Usługi w grze** (`txType` = „Użycie", `change` < 0): redukcja czasu budowy,
  natychmiastowe zakończenie, handel z miejscowym kupcem, wskrzeszenie rycerza,
  itp. — podtypy rozpoznawane po `info`.
- **Zewnętrzne PP**
  - zakup PP za pieniądze: `txType` = „Kupno", `change` > 0 (np. „Metoda
    płatności: …")
  - subskrypcja/premium: `info` zawiera „Premium …" (świat „Szybkie" itp.)
- **Inne**: cokolwiek niedopasowane — pokazywane w tabeli „nierozpoznane", żeby
  nic nie ginęło po cichu.

## Magazyn i import (dashboard)

- **Wejście przez drag & drop**: pliki JSON z kolektora ORAZ dotychczasowe
  CSV/XLSX z ręcznej historii (żeby zachować historię świata 229, której
  kolektor już nie dociągnie). Import XLSX obsługuje kodowanie Windows-1250.
- **Trwały magazyn**: `localStorage` przeglądarki. Każdy import **scala** z
  istniejącym zbiorem i **deduplikuje**.
  - Klucz deduplikacji: `world + ts + change + info`.
  - Nakładające się strony (efekt trybu przyrostowego) nie tworzą duplikatów.
- **Eksport scalonego zbioru**: przycisk „Eksportuj scalone" → jeden plik JSON
  jako backup / przenośność.
- **Reset**: przycisk czyszczenia magazynu (z potwierdzeniem).

## Filtry (dashboard)

- **Świat**: wybór jednego świata do widoku szczegółowego. Pozostałe światy
  występujące w logu pokazywane tylko sumarycznie (agregat), nie szczegółowo.
- **Zakres dat**: od–do.
- **Granulacja**: dzień / tydzień.

## Metryki i wizualizacje

Nagłówkowe (odpowiadają na pytanie „czy strategia działa"):
- **PP zarobione na arbitrażu** = suma(sprzedaż) − suma(kupno) — „darmowe" PP z
  giełdy.
- **PP kupione za pieniądze** (zewnętrzne) — osobno.
- **PP przejedzone na usługi** — osobno, z rozbiciem na co.
- **Bilans PP netto** i saldo końcowe.

Wykresy (każdy z tabelą dokładnych danych pod spodem):
- Bilans PP dzień/tydzień: słupki zarobione vs wydane.
- Saldo PP w czasie: linia (kolumna „nowe saldo" jako weryfikacja).
- Arbitraż: wolumen surowców kupionych/sprzedanych (Drewno/Glina/Żelazo).
- **Efektywny kurs**: PP na 1000 jednostek surowca, kupno vs sprzedaż — pokazuje
  marżę na każdym surowcu.
- Rozbicie wydatków na usługi (redukcja czasu / natychmiastowe zakończenie /
  handel z kupcem / rycerz / …).

## Kwestie techniczne

- **Polskie znaki**: XLSX zapisane w Windows-1250 — dekodowanie przy imporcie.
- **Odporność parsera**: nierozpoznane wpisy nie znikają — trafiają do kategorii
  „inne" i osobnej tabeli.
- **Wszystko offline/self-contained**: jeden plik HTML, jeden plik JS
  bookmarkletu; brak zależności sieciowych w runtime.

## Wersjonowanie

Projekt nie jest jeszcze repozytorium git. Do ustalenia: czy zainicjować `git`
dla wersjonowania narzędzia i specyfikacji.
