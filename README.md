# Narzędziownik — Plemiona

Prywatny zestaw narzędzi do gry Plemiona.pl. Wszystko liczy się **lokalnie
w Twojej przeglądarce** — żadne dane nie trafiają na serwer.

- **Symulator budowy wioski** (`/wioska/`) — układasz kolejność rozbudowy,
  narzędzie symuluje oś czasu z produkcją surowców, pojemnością spichlerza
  i Twoimi dosyłkami, i mówi, gdzie kolejka stoi bezczynnie.
- **Kursy giełdy** (`/kursy/`) — historia kursów per kontynent i sygnały okazji.
- **Analiza punktów premium** (`/pp/`) — bilans PP, arbitraż i wydatki z logu.
- **Kolektory** (`/kolektor/`) — bookmarklet do logu PP i userscript do kursów.

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
node build.js   # generuje dist/: index.html, kolektor/, kursy/, kursy.user.js, wioska/, pp/
```

Symulator ma też tryb bez przeglądarki — ten sam silnik, ta sama arytmetyka:

```bash
node tools/plan.js plan.json          # symulacja planu z pliku
node tools/kalibracja.js strona.html  # tabela G z zapisanego ekranu Ratusza
node tools/fetch-swiat.js pl231       # dane nowego świata
```

## Hosting

`dist/` to komplet statycznych plików — wrzuć na dowolny hosting statyczny
(GitHub Pages, Synology Web Station, Netlify, …). W tym repo deploy na GitHub Pages
robi workflow w `.github/workflows/deploy.yml` (build + publikacja `dist/`).

## Uwaga o regulaminie

Kolektor czyta wyłącznie Twój własny log premium, w Twojej sesji przeglądarki.
Używaj świadomie i z umiarem.
