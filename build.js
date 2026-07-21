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
  <p><a class="btn go" href="../">Otwórz dashboard →</a></p>
</div>

<footer>Prywatność: cała analiza dzieje się w Twojej przeglądarce (localStorage). Twoje dane nie są nigdzie wysyłane.</footer>
</div></body></html>`;
}

if (process.argv[1] && process.argv[1].endsWith('build.js')) {
  mkdirSync(new URL('./dist/kolektor/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./dist/index.html', import.meta.url), buildDashboard());            // dashboard = strona główna
  writeFileSync(new URL('./dist/kolektor/index.html', import.meta.url), buildLanding(buildBookmarklet())); // kolektor pod /kolektor/
  console.log('Zbudowano dist/: index.html (dashboard), kolektor/index.html (kolektor)');
}
