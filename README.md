# Analiza logu punktów premium — Plemiona

Dwa narzędzia bez żadnych zależności runtime:

- **Kolektor** (bookmarklet) — pobiera log PP ze strony gry do pliku JSON.
- **Dashboard** (`dist/dashboard.html`) — jeden plik HTML, offline; wczytuje dane,
  scala, deduplikuje i pokazuje bilans PP, arbitraż giełdowy i wydatki na usługi.

## Budowanie

```bash
npm run build      # generuje dist/dashboard.html i dist/collector-install.html
npm test           # uruchamia testy jednostkowe (node --test)
```

## Instalacja kolektora

1. Otwórz `dist/collector-install.html` w przeglądarce.
2. Przeciągnij przycisk „Pobierz log PP" na pasek zakładek.

## Pobieranie danych

1. Zaloguj się w grze, wejdź na ekran **Premium → Log punktów**
   (`game.php?...&screen=premium&mode=log&page=0`).
2. Kliknij zakładkę. Wybierz tryb:
   - **Wszystko** — pełne pierwsze pobranie.
   - **Nowe od daty** — tylko wpisy od podanej daty (aktualizacja przyrostowa).
   - Opcjonalne opóźnienie między stronami (0 = bez).
3. Zapisze się plik `plemiona-log-*.json`.

## Analiza

1. Otwórz `dist/dashboard.html` (dwuklik).
2. Przeciągnij na stronę pliki JSON z kolektora i/lub CSV / `dist/legacy-*.json`.
3. Dane trafiają do magazynu przeglądarki (localStorage) i są deduplikowane —
   kolejne pobrania możesz dokładać bez ryzyka duplikatów.
4. Filtruj po świecie / dacie / granulacji. **Efektywny kurs licz per świat.**
   Przycisk „Eksportuj scalone" robi backup całego zbioru.

## Historia (stare XLSX)

```bash
python tools/xlsx_to_json.py            # _share/*.xlsx -> dist/legacy-*.json
```

## Uwaga o regulaminie

Kolektor czyta wyłącznie Twój własny log, w Twojej sesji, w przeglądarce.
Uruchamiaj świadomie i okazjonalnie.
