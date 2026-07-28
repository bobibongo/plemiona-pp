// src/wioska/widok-bilans.js
// Bilans zaopatrzenia dla wskazanego momentu: trzy strumienie dochodu
// (eko, farma, zbieractwo), ich suma, zuzycie na dobe liczone po osi bez
// przestojow, i roznica — ile na dobe brakuje albo zostaje.

import { produkcjaGodzinowa } from './tabele.js';
import { zuzycieNaDobe } from './zapotrzebowanie.js';
import { esc } from './widok-budynki.js';

const SUROWCE_B = ['drewno', 'glina', 'zelazo'];

// Kopia rozwiazywania kotwicy na indeks, analogiczna do symulacji, ale
// swiadomie osobna: widoki maja byc cienkie i nie ciagnac wewnetrznej,
// nieeksportowanej logiki silnika.
function indeksKotwicyWidoku(kotwica, kroki) {
  if (kotwica === null) return -1;
  return kroki.findIndex(k => k.budynek === kotwica.budynek && k.doPoziomu === kotwica.doPoziomu);
}

function sumaZrodla(plan, indeksAktywny, zrodlo) {
  const trafione = plan.dochody
    .map(d => ({ ...d, i: indeksKotwicyWidoku(d.kotwica, plan.kroki) }))
    .filter(d => d.zrodlo === zrodlo && d.i <= indeksAktywny)
    .sort((a, b) => a.i - b.i);
  // Tak jak w symulacji: kazde zrodlo ma jeden aktywny wpis naraz, ostatni
  // w kolejnosci indeksu kotwicy wygrywa.
  return trafione.length ? trafione[trafione.length - 1].sumaD : 0;
}

function dosylkiDoIndeksu(plan, indeks) {
  const suma = { drewno: 0, glina: 0, zelazo: 0 };
  for (const z of plan.zastrzyki) {
    const i = indeksKotwicyWidoku(z.kotwica, plan.kroki);
    if (i <= indeks) for (const r of SUROWCE_B) suma[r] += z[r];
  }
  return suma;
}

export function bilansHTML(s, plan, wynik, zap, indeks) {
  const indeksAktywny = indeks === null ? plan.kroki.length - 1 : indeks;
  const poziomy = indeks === null
    ? (wynik.kroki[wynik.kroki.length - 1]?.poziomyPo ?? { ...plan.start.poziomy })
    : (wynik.kroki[indeks]?.poziomyPo ?? { ...plan.start.poziomy });

  const eko = {
    drewno: produkcjaGodzinowa(s, poziomy.tartak ?? 0) * 24,
    glina: produkcjaGodzinowa(s, poziomy.cegielnia ?? 0) * 24,
    zelazo: produkcjaGodzinowa(s, poziomy.huta ?? 0) * 24,
  };
  const farmaD = sumaZrodla(plan, indeksAktywny, 'farma');
  const zbieractwoD = sumaZrodla(plan, indeksAktywny, 'zbieractwo');
  const farma = { drewno: farmaD / 3, glina: farmaD / 3, zelazo: farmaD / 3 };
  const zbieractwo = { drewno: zbieractwoD / 3, glina: zbieractwoD / 3, zelazo: zbieractwoD / 3 };
  const razem = {};
  for (const r of SUROWCE_B) razem[r] = eko[r] + farma[r] + zbieractwo[r];

  const zuzycie = zuzycieNaDobe(plan, indeks);
  const etykietaZuzycia = zuzycie.doKonca ? 'Zużycie do końca planu' : 'Zużycie / dobę';

  const bilans = {};
  for (const r of SUROWCE_B) bilans[r] = razem[r] - zuzycie.suma[r];

  const dos = dosylkiDoIndeksu(plan, indeksAktywny);

  const wiersz = (etykieta, w) => `<div><b>${esc(etykieta)}</b> ${Math.round(w.drewno)} / ${Math.round(w.glina)} / ${Math.round(w.zelazo)}</div>`;
  const klasaBilansu = SUROWCE_B.some(r => bilans[r] < 0) ? 'bilans-ujemny' : '';

  return [
    '<div class="bilans">',
    wiersz('EKO / dobę', eko),
    wiersz('Farma / dobę', farma),
    wiersz('Zbieractwo / dobę', zbieractwo),
    '<hr>',
    wiersz('Razem', razem),
    wiersz(etykietaZuzycia, zuzycie.suma),
    `<div class="${klasaBilansu}"><b>Bilans</b> ${Math.round(bilans.drewno)} / ${Math.round(bilans.glina)} / ${Math.round(bilans.zelazo)}</div>`,
    `<div><b>Dosyłki razem</b> ${dos.drewno} / ${dos.glina} / ${dos.zelazo}</div>`,
    '</div>',
  ].join('');
}
