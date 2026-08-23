// src/wioska/widok-wykres.js
// Wykres punktow wioski w czasie, jeden punkt danych na dzien (ta sama
// definicja dnia co naglowki w kolejce — os bez przestojow, patrz
// widok-kolejka.js). Klikniecie punktu zaznacza ostatni krok danego dnia,
// tak samo jak klikniecie kafelka w kolejce.

import { osBezPrzestojow } from './zapotrzebowanie.js';
import { punktyWioski } from './punkty.js';

const DOBA_WYKRESU_S = 86400;

// Dla kazdego dnia planu: indeks ostatniego kroku ukonczonego tego dnia
// (lub najblizszego wczesniejszego, gdy dzien nie konczy zadnego kroku)
// i laczne punkty wioski po tym kroku.
export function punktyWDniach(plan, wynik) {
  const os = osBezPrzestojow(plan);
  if (os.length === 0 || wynik.kroki.length === 0) return [];

  const ostatniDzien = Math.floor(os[os.length - 1].startS / DOBA_WYKRESU_S);
  const punkty = [];
  let indeksKroku = -1;
  for (let dzien = 0; dzien <= ostatniDzien; dzien++) {
    const granica = (dzien + 1) * DOBA_WYKRESU_S;
    while (indeksKroku + 1 < os.length && os[indeksKroku + 1].startS < granica) indeksKroku += 1;
    if (indeksKroku < 0) { punkty.push({ dzien, indeksKroku: null, punkty: punktyWioski(plan.start.poziomy) }); continue; }
    const krok = wynik.kroki[indeksKroku];
    // poziomyPo jest zapisywane na wejsciu do kazdego kroku symulacji, wiec
    // nawet krok zatrzymany bledem niesie poziomy sprzed proby jego budowy.
    punkty.push({ dzien, indeksKroku, punkty: punktyWioski(krok.poziomyPo) });
  }
  return punkty;
}

const SZER_SLUPKA = 34;
const ODSTEP = 6;
const WYS = 160;
const MARGINES = { gora: 12, dol: 26, lewo: 8, prawo: 8 };

// Slupek na dzien, indeks dnia podpisany pod kazdym z nich — szerokosc SVG
// rosnie z liczba dni (przewijana pozioma sekcja w CSS), zamiast sciskac
// slupki w stala szerokosc jak przy dawnym line-chart.
export function wykresHTML(plan, wynik, zaznaczony) {
  const seria = punktyWDniach(plan, wynik);
  if (seria.length === 0) return '<p class="wykres-pusty">Dodaj kroki do kolejki, żeby zobaczyć wykres.</p>';

  const szerRys = seria.length * SZER_SLUPKA + (seria.length - 1) * ODSTEP;
  const szer = MARGINES.lewo + szerRys + MARGINES.prawo;
  const wysRys = WYS - MARGINES.gora - MARGINES.dol;
  const maksPunkty = Math.max(...seria.map(p => p.punkty), 1);
  const x = (i) => MARGINES.lewo + i * (SZER_SLUPKA + ODSTEP);
  const wysSlupka = (p) => (p / maksPunkty) * wysRys;

  const dzienZaznaczony = zaznaczony === null
    ? null
    : seria.findIndex(p => p.indeksKroku !== null && p.indeksKroku >= zaznaczony);

  const slupki = seria.map((p, i) => {
    const aktywny = i === dzienZaznaczony;
    const h = Math.max(wysSlupka(p.punkty), 1);
    const yGora = MARGINES.gora + wysRys - h;
    return `<g class="${aktywny ? 'wykres-slupek aktywna' : 'wykres-slupek'}" data-dzien-krok="${p.indeksKroku ?? ''}">`
      + `<rect x="${x(i).toFixed(1)}" y="${yGora.toFixed(1)}" width="${SZER_SLUPKA}" height="${h.toFixed(1)}" rx="2">`
      + `<title>Dzień ${p.dzien + 1} · ${p.punkty} pkt</title></rect>`
      + `<text x="${(x(i) + SZER_SLUPKA / 2).toFixed(1)}" y="${(WYS - 8).toFixed(1)}" text-anchor="middle">${p.dzien + 1}</text>`
      + `</g>`;
  }).join('');

  return `<svg class="wykres-punkty" viewBox="0 0 ${szer} ${WYS}" width="${szer}" height="${WYS}" role="img" aria-label="Punkty wioski w czasie, słupek na dzień">`
    + slupki
    + `</svg>`;
}
