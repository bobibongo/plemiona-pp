// tools/kalibracja.js
// Wyliczenie tabeli G z zapisanych stron Ratusza.
// Uzycie: node tools/kalibracja.js "_share/A004*.html" "_share/Wioska yozeek*.html"
//
// G(poziom) = czas / (build_time budynku x 1,05^(-poziom ratusza))
// Wartosc nie zalezy od budynku, wiec rozrzut w kolumnie "rozrzut" jest
// miara zaufania: powyzej 1% cos jest nie tak z odczytem.

import { readFileSync } from 'node:fs';
import { swiat } from '../src/wioska/swiaty.js';
import { pomiaryZeStrony } from '../src/wioska/odczyt-ratusza.js';
import { MUR_STALY_DO_POZIOMU } from '../src/wioska/czas-dane.js';

const pliki = process.argv.slice(2);
if (!pliki.length) {
  console.error('Użycie: node tools/kalibracja.js <plik.html> [plik2.html ...]');
  process.exit(1);
}

const s = swiat('pl231');
const wg = new Map();

for (const plik of pliki) {
  for (const p of pomiaryZeStrony(readFileSync(plik, 'utf8'))) {
    // Mur na najnizszych poziomach ma staly czas — zepsulby srednia.
    if (p.budynek === 'mur' && p.poziom <= MUR_STALY_DO_POZIOMU) continue;
    const baza = s.budynki[p.budynek]?.czas;
    if (!baza) continue;
    const g = p.sekundy / (baza * 1.05 ** -p.poziomRatusza);
    if (!wg.has(p.poziom)) wg.set(p.poziom, []);
    wg.get(p.poziom).push({ g, budynek: p.budynek, ratusz: p.poziomRatusza });
  }
}

console.log('poziom |         G | n | rozrzut | budynki');
for (const poziom of [...wg.keys()].sort((a, b) => a - b)) {
  const w = wg.get(poziom);
  const gs = w.map(x => x.g);
  const sr = gs.reduce((a, b) => a + b, 0) / gs.length;
  const rozrzut = gs.length > 1 ? (Math.max(...gs) - Math.min(...gs)) / sr * 100 : 0;
  const zrodla = w.map(x => `${x.budynek}/R${x.ratusz}`).join(' ');
  console.log(`${String(poziom).padStart(6)} | ${sr.toFixed(5).padStart(9)} | ${String(gs.length).padStart(1)} | ${rozrzut.toFixed(2).padStart(6)}% | ${zrodla}`);
}
console.log('\nWartości z n≥2 i rozrzutem poniżej 1% wpisz do TABELA_G jako zmierzony: true.');
