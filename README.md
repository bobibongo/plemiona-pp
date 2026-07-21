# Analiza punktów premium — Plemiona

Prywatny dashboard do analizy logu **punktów premium (PP)** z gry Plemiona.pl.
Wszystko liczy się **lokalnie w Twojej przeglądarce** — żadne dane nie trafiają na
serwer. Strona jest tylko statycznym kodem; każdy użytkownik ma własny, lokalny
magazyn danych (`localStorage`).

## Jak używać (wersja hostowana)

1. **Krok 1 – kolektor.** Otwórz stronę główną i przeciągnij przycisk „Pobierz log PP”
   na pasek zakładek przeglądarki.
2. **Krok 2 – pobierz log.** Zaloguj się w grze, wejdź na *Premium → Log punktów*,
   kliknij zakładkę. Zapisze się plik `plemiona-log-*.json`.
3. **Krok 3 – analiza.** Otwórz dashboard i przeciągnij na niego plik JSON (lub CSV).
   Zobaczysz bilans PP, arbitraż giełdowy, wydatki i wykresy.

## Prywatność

Dane każdego użytkownika zostają w jego przeglądarce (`localStorage`) i nigdy nie są
wysyłane. Wchodząc na stronę widzisz **tylko swoje** dane. Możesz je wyeksportować
(„Eksportuj scalone”) jako backup.

## Budowanie

Zero zależności runtime. Wymaga tylko Node.js.

```bash
node --test     # testy jednostkowe
node build.js   # generuje dist/: index.html, dashboard.html, collector-install.html
```

## Hosting

`dist/` to komplet statycznych plików — wrzuć na dowolny hosting statyczny
(GitHub Pages, Synology Web Station, Netlify, …). W tym repo deploy na GitHub Pages
robi workflow w `.github/workflows/deploy.yml` (build + publikacja `dist/`).

## Uwaga o regulaminie

Kolektor czyta wyłącznie Twój własny log premium, w Twojej sesji przeglądarki.
Używaj świadomie i z umiarem.
