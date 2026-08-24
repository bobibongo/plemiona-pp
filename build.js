// build.js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const stripModule = code => code
  .replace(/^\s*import[^\n]*\n/gm, '')
  .replace(/^\s*export\s+/gm, '');

// Usuwa komentarze przed sklejeniem kodu w jedną linię (bookmarklet).
// Bez tego pierwszy // połyka cały kod po zamianie nowych linii na spacje.
// Bezpieczne dla collector.js/shared-date.js: brak // wewnątrz stringów i regexów.
const stripComments = code => code
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(/\r?\n/)
  .map(line => line.replace(/\/\/.*/, ''))
  .join('\n');

const LOGIC = ['src/shared-date.js', 'src/parse.js', 'src/merge.js', 'src/aggregate.js', 'src/charts.js', 'src/ui.js'];

export function buildDashboard() {
  const css = read('./src/dashboard.css');
  const js = LOGIC.map(p => stripModule(read('./' + p))).join('\n');
  return read('./src/dashboard.template.html')
    .replace('/*INJECT:css*/', () => css)
    .replace('/*INJECT:js*/', () => js);
}

export function buildBookmarklet() {
  const js = ['src/shared-date.js', 'src/collector.js']
    .map(p => stripComments(stripModule(read('./' + p)))).join('\n');
  const oneLine = 'javascript:(()=>{' + js.replace(/\n\s*/g, ' ').trim() + '})()';
  return oneLine;
}

export function buildScavBookmarklet() {
  const js = ['src/panel-theme.js', 'src/scav.js']
    .map(p => stripComments(stripModule(read('./' + p)))).join('\n');
  const oneLine = 'javascript:(()=>{' + js.replace(/\n\s*/g, ' ').trim() + '})()';
  return oneLine;
}

export function buildHandlarzPPBookmarklet() {
  const js = ['src/panel-theme.js', 'src/handlarz-pp.js']
    .map(p => stripComments(stripModule(read('./' + p)))).join('\n');
  const oneLine = 'javascript:(()=>{' + js.replace(/\n\s*/g, ' ').trim() + '})()';
  return oneLine;
}

export function buildKalkulatorCofkiBookmarklet() {
  const js = ['src/panel-theme.js', 'src/kalkulator-cofki.js']
    .map(p => stripComments(stripModule(read('./' + p)))).join('\n');
  const oneLine = 'javascript:(()=>{' + js.replace(/\n\s*/g, ' ').trim() + '})()';
  return oneLine;
}

// Userscript odpala sie automatycznie tylko na stronie Gieldy Premium
// (screen=market&mode=exchange), nie na kazdej stronie gry.
const HANDLARZ_PP_USERSCRIPT_META = `// ==UserScript==
// @name         Plemiona — Handlarz PP
// @namespace    plemiona-pp
// @version      1.0.0
// @description  Panel do Giełdy Premium: liczy ilość do sprzedania/kupienia względem progu wypełnienia giełdy i wypełnia pole. Nic nie klika ani nie wysyła samo.
// @author       plemiona-pp
// @match        https://*.plemiona.pl/game.php?*screen=market*mode=exchange*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
`;

export function buildHandlarzPPUserscript() {
  const js = ['src/panel-theme.js', 'src/handlarz-pp.js'].map(p => stripModule(read('./' + p))).join('\n');
  return HANDLARZ_PP_USERSCRIPT_META + '\n' + js + '\n';
}

const RATES_LOGIC = ['src/rates-history.js', 'src/rates-signals.js', 'src/rates-chart.js', 'src/rates-page.js'];

// Strona analizy kursów (dist/kursy/index.html) — samowystarczalny plik,
// otwierany z dysku. Nie sięga po nic z sieci.
export function buildRatesPage() {
  const css = read('./src/rates.css');
  const js = RATES_LOGIC.map(p => stripModule(read('./' + p))).join('\n');
  return read('./src/rates.template.html')
    .replace('/*INJECT:css*/', () => css)
    .replace('/*INJECT:js*/', () => js);
}

// Kolejnosc ma znaczenie: stripModule usuwa importy, wiec dane musza byc
// zdefiniowane przed kodem, ktory z nich korzysta.
export const WIOSKA_LOGIC = [
  'src/wioska/swiaty.js',
  'src/wioska/czas-dane.js',
  'src/wioska/wymagania-dane.js',
  'src/wioska/nazwy.js',
  'src/wioska/ikony.js',
  'src/wioska/swiat.js',
  'src/wioska/tabele.js',
  'src/wioska/punkty.js',
  'src/wioska/czas.js',
  'src/wioska/wymagania.js',
  'src/wioska/kolejnosc-budynkow.js',
  'src/wioska/jednostki.js',
  'src/wioska/plan.js',
  'src/wioska/symulacja.js',
  'src/wioska/zapotrzebowanie.js',
  'src/wioska/format.js',
  'src/wioska/widok-budynki.js',
  'src/wioska/widok-kolejka.js',
  'src/wioska/widok-bilans.js',
  'src/wioska/widok-status.js',
  'src/wioska/widok-wykres.js',
  'src/wioska/strona.js',
];

function osadzIkonyBudynkow(js) {
  const katalog = './src/assets/buildings/';
  const pliki = [
    'main', 'barracks', 'stable', 'garage', 'watchtower', 'snob', 'smith',
    'place', 'statue', 'market', 'wood', 'stone', 'iron', 'farm', 'storage',
    'hide', 'wall',
  ];
  let wynik = js;
  for (const nazwa of pliki) {
    const sciezka = `../assets/buildings/${nazwa}.svg`;
    const base64 = readFileSync(new URL(`${katalog}${nazwa}.svg`, import.meta.url)).toString('base64');
    wynik = wynik.replaceAll(sciezka, `data:image/svg+xml;base64,${base64}`);
  }
  return wynik;
}
// Symulator budowy wioski (dist/wioska/index.html) — samowystarczalny plik.
export function buildWioskaPage() {
  const css = read('./src/wioska.css');
  const js = osadzIkonyBudynkow(WIOSKA_LOGIC.map(p => stripModule(read('./' + p))).join('\n').replace(/\r\n/g, '\n'));
  return read('./src/wioska.template.html')
    .replace('/*INJECT:css*/', () => css)
    .replace('/*INJECT:js*/', () => js);
}

// Userscript (dist/kursy.user.js) — kolektor kursów giełdy premium.
// Zostawiamy komentarze i nowe linie: userscript jest wielolinijkowy,
// więc nie grozi mu problem sklejania, który dotyczy bookmarkletu.
const USERSCRIPT_META = `// ==UserScript==
// @name         Plemiona — kursy giełdy
// @namespace    plemiona-pp
// @version      1.0.0
// @description  Odczytuje kursy giełdy premium z otwartej strony i zbiera je per kontynent. Nie wysyła żadnych zapytań.
// @author       plemiona-pp
// @match        https://*.plemiona.pl/game.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
`;

export function buildUserscript() {
  const js = ['src/rates-parse.js', 'src/rates-store.js', 'src/rates-panel.js', 'src/rates-collector.js']
    .map(p => stripModule(read('./' + p))).join('\n');
  return USERSCRIPT_META + '\n(function () {\n' + js + '\n})();\n';
}

// Strona kolektora (/kolektor) — bookmarklet + instrukcja + wejście do dashboardu.
export function buildLanding(bm) {
  const href = bm.replace(/"/g, '&quot;');
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Analiza PP — Plemiona</title>
<style>
  :root{--w:#2c2015;--w2:#170f08;--pg:#f4ead2;--ink:#38291a;--ink2:#6b543a;--acc:#7c2b2b;--gold:#a8842c;--line:#c4ac7c}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);
    background:radial-gradient(ellipse at 50% -10%,#3a2c1c,var(--w) 45%,var(--w2)) fixed;min-height:100vh}
  .wrap{width:90%;max-width:760px;margin:0 auto;padding:36px 0 60px}
  header{text-align:center;color:#f6ecd4;margin-bottom:26px}
  .eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);font-weight:700}
  h1{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:30px;margin:6px 0 8px}
  header p{opacity:.85;margin:0}
  .card{background:radial-gradient(120% 80% at 25% 0%,rgba(255,251,240,.55),transparent 55%),var(--pg);
    border:1px solid var(--line);border-radius:8px;padding:20px 22px;margin:16px 0;
    box-shadow:0 8px 22px rgba(0,0,0,.38)}
  .card h2{margin:0 0 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--acc)}
  .step{font-size:10px;color:var(--gold);font-weight:700;letter-spacing:.1em}
  ol{margin:8px 0 0 18px}li{margin:4px 0}
  .btn{display:inline-block;padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:700}
  .bm{background:#5b3a1e;color:#f4e9d8;border:2px solid var(--gold)}
  .go{background:var(--acc);color:#f6ecd4}
  .muted{color:var(--ink2);font-size:13px}
  code{background:#0002;padding:1px 5px;border-radius:4px}
  footer{text-align:center;color:#e8cfa8;opacity:.7;font-size:12px;margin-top:24px}
</style></head>
<body><div class="wrap">
<header>
  <div class="eyebrow">Plemiona · analiza PP</div>
  <h1>Bilans punktów premium</h1>
  <p>Twój prywatny dashboard do logu PP — dane liczone lokalnie w przeglądarce, nic nie trafia na serwer.</p>
</header>

<div class="card">
  <span class="step">Krok 1</span>
  <h2>Zainstaluj kolektor</h2>
  <p class="muted">Przeciągnij ten przycisk na <b>pasek zakładek</b> przeglądarki:</p>
  <p><a class="btn bm" href="${href}">📥 Pobierz log PP</a></p>
</div>

<div class="card">
  <span class="step">Krok 2</span>
  <h2>Pobierz swój log</h2>
  <ol>
    <li>Zaloguj się w grze i wejdź na <b>Premium → Log punktów</b>.</li>
    <li>Kliknij zakładkę „Pobierz log PP”. Wybierz tryb (wszystko / od daty) i opcjonalne opóźnienie.</li>
    <li>Zapisze się plik <code>plemiona-log-*.json</code>.</li>
  </ol>
</div>

<div class="card">
  <span class="step">Krok 3</span>
  <h2>Analizuj</h2>
  <p class="muted">Otwórz dashboard i przeciągnij na niego swój plik JSON (lub CSV). Dane zostają u Ciebie.</p>
  <p><a class="btn go" href="../pp/">Otwórz dashboard →</a></p>
</div>

<footer>Prywatność: cała analiza dzieje się w Twojej przeglądarce (localStorage). Twoje dane nie są nigdzie wysyłane.</footer>
</div></body></html>`;
}

// Strona kolektora zbieractwa — bookmarklet + instrukcja, osobna od buildLanding
// (ten bookmarklet klika i wysyła wojska w grze, nie tylko czyta dane).
export function buildScavLanding(bm) {
  const href = bm.replace(/"/g, '&quot;');
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zbieractwo — Plemiona</title>
<style>
  :root{--w:#2c2015;--w2:#170f08;--pg:#f4ead2;--ink:#38291a;--ink2:#6b543a;--acc:#7c2b2b;--gold:#a8842c;--line:#c4ac7c}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);
    background:radial-gradient(ellipse at 50% -10%,#3a2c1c,var(--w) 45%,var(--w2)) fixed;min-height:100vh}
  .wrap{width:90%;max-width:760px;margin:0 auto;padding:36px 0 60px}
  header{text-align:center;color:#f6ecd4;margin-bottom:26px}
  .eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);font-weight:700}
  h1{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:30px;margin:6px 0 8px}
  header p{opacity:.85;margin:0}
  .card{background:radial-gradient(120% 80% at 25% 0%,rgba(255,251,240,.55),transparent 55%),var(--pg);
    border:1px solid var(--line);border-radius:8px;padding:20px 22px;margin:16px 0;
    box-shadow:0 8px 22px rgba(0,0,0,.38)}
  .card h2{margin:0 0 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--acc)}
  .step{font-size:10px;color:var(--gold);font-weight:700;letter-spacing:.1em}
  ol{margin:8px 0 0 18px}li{margin:4px 0}
  .btn{display:inline-block;padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:700}
  .bm{background:#5b3a1e;color:#f4e9d8;border:2px solid var(--gold)}
  .muted{color:var(--ink2);font-size:13px}
  code{background:#0002;padding:1px 5px;border-radius:4px}
  footer{text-align:center;color:#e8cfa8;opacity:.7;font-size:12px;margin-top:24px}
</style></head>
<body><div class="wrap">
<header>
  <div class="eyebrow">Plemiona · zbieractwo</div>
  <h1>Zbieractwo masowe — własne serie</h1>
  <p>Wysyła kolejno kilka grup zbieractwa (np. lekka albo pikinier) na wybrane poziomy, z losowym odstępem między kliknięciami.</p>
</header>

<div class="card">
  <span class="step">Krok 1</span>
  <h2>Zainstaluj bookmarklet</h2>
  <p class="muted">Przeciągnij ten przycisk na <b>pasek zakładek</b> przeglądarki:</p>
  <p><a class="btn bm" href="${href}">🐴 Zbieractwo — własne serie</a></p>
</div>

<div class="card">
  <span class="step">Krok 2</span>
  <h2>Otwórz zbieractwo masowe</h2>
  <ol>
    <li>Wejdź na <b>Plac → Zbieractwo masowe</b> (wymaga Konta Premium do wysyłki z wielu wiosek).</li>
    <li>Kliknij zakładkę bookmarkletu — w prawym górnym rogu pojawi się panel.</li>
    <li>Wybierz typ jednostki i liczby dla poziomów 4/3/2/1, kliknij Start.</li>
  </ol>
</div>

<footer>Panel działa tylko na aktualnie otwartej stronie zbieractwa masowego. Nic nie jest zapisywane ani wysyłane poza samą grę.</footer>
</div></body></html>`;
}

// Strona kolektora Handlarza PP — bookmarklet + userscript + instrukcja.
// Panel tylko odczytuje pojemnosc/stan gieldy i wypelnia pole kup/sprzedaz; nic nie klika ani nie wysyla.
export function buildHandlarzPPLanding(bm) {
  const href = bm.replace(/"/g, '&quot;');
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Handlarz PP — Plemiona</title>
<style>
  :root{--w:#2c2015;--w2:#170f08;--pg:#f4ead2;--ink:#38291a;--ink2:#6b543a;--acc:#7c2b2b;--gold:#a8842c;--line:#c4ac7c}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);
    background:radial-gradient(ellipse at 50% -10%,#3a2c1c,var(--w) 45%,var(--w2)) fixed;min-height:100vh}
  .wrap{width:90%;max-width:760px;margin:0 auto;padding:36px 0 60px}
  header{text-align:center;color:#f6ecd4;margin-bottom:26px}
  .eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);font-weight:700}
  h1{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:30px;margin:6px 0 8px}
  header p{opacity:.85;margin:0}
  .card{background:radial-gradient(120% 80% at 25% 0%,rgba(255,251,240,.55),transparent 55%),var(--pg);
    border:1px solid var(--line);border-radius:8px;padding:20px 22px;margin:16px 0;
    box-shadow:0 8px 22px rgba(0,0,0,.38)}
  .card h2{margin:0 0 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--acc)}
  .step{font-size:10px;color:var(--gold);font-weight:700;letter-spacing:.1em}
  ol{margin:8px 0 0 18px}li{margin:4px 0}
  .btn{display:inline-block;padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:700}
  .bm{background:#5b3a1e;color:#f4e9d8;border:2px solid var(--gold)}
  .us{background:#2a4a35;color:#e4f4e9;border:2px solid #4c8c62}
  .muted{color:var(--ink2);font-size:13px}
  code{background:#0002;padding:1px 5px;border-radius:4px}
  footer{text-align:center;color:#e8cfa8;opacity:.7;font-size:12px;margin-top:24px}
</style></head>
<body><div class="wrap">
<header>
  <div class="eyebrow">Plemiona · giełda premium</div>
  <h1>Handlarz PP</h1>
  <p>Wybierz tryb (SELL / BUY / BUY ALL), próg wypełnienia giełdy w % i zaokrąglenie, kliknij przycisk surowca — skrypt policzy ilość do tego progu (zaokrągloną w dół) i wpisze ją w odpowiednie pole. Resztę (kalkulacja oferty, wysyłka) robisz ręcznie.</p>
</header>

<div class="card">
  <span class="step">Wariant 1 — bookmarklet</span>
  <h2>Klikany ręcznie, gdy potrzebny</h2>
  <p class="muted">Przeciągnij ten przycisk na <b>pasek zakładek</b> przeglądarki:</p>
  <p><a class="btn bm" href="${href}">💱 Handlarz PP</a></p>
  <p class="muted">Wejdź na <b>Rynek → Giełda Premium</b>, kliknij zakładkę bookmarkletu — w prawym rogu pojawi się panel.</p>
</div>

<div class="card">
  <span class="step">Wariant 2 — userscript (Tampermonkey)</span>
  <h2>Odpala się automatycznie na Giełdzie Premium</h2>
  <p class="muted">Wymaga rozszerzenia <a href="https://www.tampermonkey.net/" target="_blank">Tampermonkey</a>. Kliknij, żeby zainstalować:</p>
  <p><a class="btn us" href="../handlarz-pp.user.js">⚙️ Zainstaluj userscript</a></p>
  <p class="muted">Po instalacji panel pojawia się sam za każdym razem, gdy wejdziesz na Giełdę Premium — nie trzeba już klikać zakładki.</p>
</div>

<div class="card">
  <span class="step">Obsługa panelu</span>
  <ol>
    <li>Wybierz tryb: <b>SELL</b> (sprzedaj do progu wypełnienia), <b>BUY</b> (kup nadwyżkę stanu ponad próg) lub <b>BUY ALL</b> (skup cały aktualny stan giełdy, próg ignorowany).</li>
    <li>Ustaw próg wypełnienia giełdy w % (domyślnie 96% dla SELL, 98% dla BUY) — strzałki ±0,1 / ±1 obok pola, albo wpisz ręcznie.</li>
    <li>Opcjonalnie wybierz zaokrąglenie w dół (10/100/1000) — wynik nigdy nie przekroczy obliczonego limitu.</li>
    <li>Kliknij przycisk surowca (Drewno/Glina/Żelazo) — pole wypełni się od razu, pozostałe pola tego samego typu (kup/sprzedaj) zostaną wyczyszczone.</li>
  </ol>
</div>

<footer>Panel tylko odczytuje pojemność i stan giełdy oraz wypełnia pole kup/sprzedaj — nic nie klika ani nie wysyła samo.</footer>
</div></body></html>`;
}

// Strona kolektora Kalkulatora cofki — bookmarklet + instrukcja.
// Panel tylko liczy i wyswietla moment przerwania komendy; nic nie klika ani nie wysyla.
export function buildKalkulatorCofkiLanding(bm) {
  const href = bm.replace(/"/g, '&quot;');
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kalkulator cofki — Plemiona</title>
<style>
  :root{--w:#2c2015;--w2:#170f08;--pg:#f4ead2;--ink:#38291a;--ink2:#6b543a;--acc:#7c2b2b;--gold:#a8842c;--line:#c4ac7c}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);
    background:radial-gradient(ellipse at 50% -10%,#3a2c1c,var(--w) 45%,var(--w2)) fixed;min-height:100vh}
  .wrap{width:90%;max-width:760px;margin:0 auto;padding:36px 0 60px}
  header{text-align:center;color:#f6ecd4;margin-bottom:26px}
  .eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);font-weight:700}
  h1{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:30px;margin:6px 0 8px}
  header p{opacity:.85;margin:0}
  .card{background:radial-gradient(120% 80% at 25% 0%,rgba(255,251,240,.55),transparent 55%),var(--pg);
    border:1px solid var(--line);border-radius:8px;padding:20px 22px;margin:16px 0;
    box-shadow:0 8px 22px rgba(0,0,0,.38)}
  .card h2{margin:0 0 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--acc)}
  .step{font-size:10px;color:var(--gold);font-weight:700;letter-spacing:.1em}
  ol{margin:8px 0 0 18px}li{margin:4px 0}
  .btn{display:inline-block;padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:700}
  .bm{background:#5b3a1e;color:#f4e9d8;border:2px solid var(--gold)}
  .muted{color:var(--ink2);font-size:13px}
  code{background:#0002;padding:1px 5px;border-radius:4px}
  footer{text-align:center;color:#e8cfa8;opacity:.7;font-size:12px;margin-top:24px}
</style></head>
<body><div class="wrap">
<header>
  <div class="eyebrow">Plemiona · klin z cofki</div>
  <h1>Kalkulator cofki</h1>
  <p>Liczy dokładny moment przerwania wysłanej komendy tak, żeby wojsko wróciło o zadanej sekundzie.</p>
</header>

<div class="card">
  <span class="step">Krok 1</span>
  <h2>Zainstaluj bookmarklet</h2>
  <p class="muted">Przeciągnij ten przycisk na <b>pasek zakładek</b> przeglądarki:</p>
  <p><a class="btn bm" href="${href}">⏱️ Kalkulator cofki</a></p>
</div>

<div class="card">
  <span class="step">Krok 2</span>
  <h2>Użycie</h2>
  <ol>
    <li>Wyślij atak (dowolny cel, dowolna godzina), wejdź w podgląd tej komendy (<b>Rozkazy → Podgląd</b>).</li>
    <li>Kliknij zakładkę bookmarkletu — panel sam odczyta czas wysłania z tej strony.</li>
    <li>Wklej docelowy czas powrotu (np. <code>22:00:00:523</code> — milisekundy można wkleić, nie mają wpływu na wynik) i kliknij Policz.</li>
    <li>Panel pokaże dokładną godzinę przerwania, odliczanie na żywo i „TERAZ!” w odpowiednim momencie.</li>
  </ol>
</div>

<footer>Odstęp między wysłaniem a celem musi być parzysty w sekundach, żeby trafić idealnie — panel ostrzega, gdy tak nie jest. Panel tylko liczy i wyświetla; nic nie klika ani nie wysyła.</footer>
</div></body></html>`;
}

// Strona glowna narzedziownika — rozdzielnik do poszczegolnych narzedzi.
// base: prefiks wzgledny do katalogu dist/ (pusty dla /, '../' dla podkatalogu jak /bagajaja/).
// rozszerzony: dolacza karty narzedzi nieobecne w publicznej wersji (np. zbieractwo).
export function buildRozdzielnik({ base = './', rozszerzony = false } = {}) {
  const dodatkoweKarty = rozszerzony
    ? `<a class="karta" href="${base}zbieractwo/">
    <h2>Zbieractwo — własne serie</h2>
    <p>Bookmarklet do zbieractwa masowego: własne liczby jednostek per poziom, wysyłane z losowym odstępem.</p>
  </a>
  <a class="karta" href="${base}handlarz-pp/">
    <h2>Handlarz PP</h2>
    <p>Bookmarklet/userscript do Giełdy Premium: liczy ile kupić/sprzedać do progu wypełnienia giełdy i wypełnia pole.</p>
  </a>
  <a class="karta" href="${base}cofka/">
    <h2>Kalkulator cofki</h2>
    <p>Liczy dokładny moment przerwania komendy, żeby wojsko wróciło o zadanej sekundzie (klin z cofki).</p>
  </a>`
    : '';
  return read('./src/rozdzielnik.template.html')
    .replace(/\/\*BASE\*\//g, base)
    .replace('<!--DODATKOWE_KARTY-->', dodatkoweKarty);
}

if (process.argv[1] && process.argv[1].endsWith('build.js')) {
  mkdirSync(new URL('./dist/kolektor/', import.meta.url), { recursive: true });
  mkdirSync(new URL('./dist/pp/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./dist/index.html', import.meta.url), buildRozdzielnik({ base: './', rozszerzony: false })); // rozdzielnik publiczny = strona główna
  writeFileSync(new URL('./dist/pp/index.html', import.meta.url), buildDashboard());          // dashboard pod /pp/
  writeFileSync(new URL('./dist/kolektor/index.html', import.meta.url), buildLanding(buildBookmarklet())); // kolektor pod /kolektor/
  writeFileSync(new URL('./dist/kursy.user.js', import.meta.url), buildUserscript());
  mkdirSync(new URL('./dist/kursy/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./dist/kursy/index.html', import.meta.url), buildRatesPage());
  mkdirSync(new URL('./dist/wioska/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./dist/wioska/index.html', import.meta.url), buildWioskaPage());
  mkdirSync(new URL('./dist/zbieractwo/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./dist/zbieractwo/index.html', import.meta.url), buildScavLanding(buildScavBookmarklet()));
  mkdirSync(new URL('./dist/handlarz-pp/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./dist/handlarz-pp/index.html', import.meta.url), buildHandlarzPPLanding(buildHandlarzPPBookmarklet()));
  writeFileSync(new URL('./dist/handlarz-pp.user.js', import.meta.url), buildHandlarzPPUserscript());
  mkdirSync(new URL('./dist/cofka/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./dist/cofka/index.html', import.meta.url), buildKalkulatorCofkiLanding(buildKalkulatorCofkiBookmarklet()));
  mkdirSync(new URL('./dist/bagajaja/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./dist/bagajaja/index.html', import.meta.url), buildRozdzielnik({ base: '../', rozszerzony: true })); // rozdzielnik rozszerzony, adres nigdzie nie linkowany
  console.log('Zbudowano dist/: index.html (rozdzielnik), pp/index.html (dashboard), kolektor/index.html (kolektor), kursy.user.js (userscript), kursy/index.html (analiza kursów), wioska/index.html (symulator budowy), zbieractwo/index.html (bookmarklet zbieractwa), handlarz-pp/index.html (bookmarklet+userscript handlarza PP), cofka/index.html (bookmarklet kalkulatora cofki), bagajaja/index.html (rozdzielnik rozszerzony)');
}
