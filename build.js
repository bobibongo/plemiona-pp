// build.js
import { readFileSync, writeFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const stripModule = code => code
  .replace(/^\s*import[^\n]*\n/gm, '')
  .replace(/^\s*export\s+/gm, '');

const LOGIC = ['src/shared-date.js', 'src/parse.js', 'src/merge.js', 'src/aggregate.js', 'src/charts.js', 'src/ui.js'];

export function buildDashboard() {
  const css = read('./src/dashboard.css');
  const js = LOGIC.map(p => stripModule(read('./' + p))).join('\n');
  return read('./src/dashboard.template.html')
    .replace('/*INJECT:css*/', () => css)
    .replace('/*INJECT:js*/', () => js);
}

export function buildBookmarklet() {
  const js = ['src/shared-date.js', 'src/collector.js'].map(p => stripModule(read('./' + p))).join('\n');
  const oneLine = 'javascript:(()=>{' + js.replace(/\n\s*/g, ' ') + '})()';
  return oneLine;
}

function buildInstallPage(bm) {
  const href = bm.replace(/"/g, '&quot;');
  return `<!doctype html><meta charset="utf-8"><title>Instalacja kolektora</title>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h1>Kolektor logu PP</h1>
<p>Przeciągnij poniższy przycisk na pasek zakładek. Potem wejdź na stronę logu premium w grze i kliknij zakładkę.</p>
<p><a href="${href}" style="display:inline-block;padding:10px 16px;background:#5b3a1e;color:#f4e9d8;border-radius:6px;text-decoration:none">Pobierz log PP</a></p>
<p style="color:#666">Tryb pobierania i opóźnienie wybierzesz w oknach dialogowych po kliknięciu.</p>`;
}

if (process.argv[1] && process.argv[1].endsWith('build.js')) {
  const html = buildDashboard();
  writeFileSync(new URL('./dist/dashboard.html', import.meta.url), html);
  const bm = buildBookmarklet();
  writeFileSync(new URL('./dist/collector-install.html', import.meta.url), buildInstallPage(bm));
  console.log('Zbudowano dist/dashboard.html oraz dist/collector-install.html');
}
