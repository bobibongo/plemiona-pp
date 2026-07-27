// src/wioska/widok-kolejka.js
// Kolejka jako os czasu. Czas kroku nie jest tu pokazywany — pasek stanu
// podaje go dla zaznaczonego momentu, a tu zabieralby miejsce w kazdym wierszu.

import { czasCzytelny } from './format.js';
import { NAZWY, NAZWY_SUROWCOW } from './nazwy.js';
import { esc, ikonaHTML } from './widok-budynki.js';

export function krokHTML(krok, indeks, zaznaczony) {
  const nazwa = `${NAZWY[krok.budynek] ?? krok.budynek} → ${krok.doPoziomu}`;
  const klasy = ['krok'];
  if (krok.blad) klasy.push('blad');
  if (zaznaczony) klasy.push('zaznaczony');
  const czekanie = krok.czekanieS > 0
    ? `<span class="czekanie" title="czeka na ${esc(NAZWY_SUROWCOW[krok.czekanieNa] ?? krok.czekanieNa)}">⏳</span>`
    : '';
  return `<li class="${klasy.join(' ')}" draggable="true" data-krok="${indeks}">`
    + `<span class="nr">${indeks + 1}</span>`
    + `<span class="opis">${ikonaHTML(krok.budynek, nazwa)}${esc(nazwa)}</span>`
    + `${czekanie}`
    + `<button data-usun="${indeks}" title="Usuń">×</button></li>`;
}

// Wtracenia gracza pokazujemy w miejscu, w ktorym wypadaja na osi — edytuje
// sie je w kolumnie zaopatrzenia, ale dzialaja tutaj.
export function wtracenieHTML(rodzaj, wpis) {
  const kiedy = czasCzytelny(wpis.czasS);
  if (rodzaj === 'dochod') {
    return `<li class="wtracenie dochod">`
      + `<span class="kiedy">od ${esc(kiedy)}</span>`
      + `<span class="opis">dochód ${wpis.drewnoD} / ${wpis.glinaD} / ${wpis.zelazoD} na dobę</span></li>`;
  }
  return `<li class="wtracenie dosylka">`
    + `<span class="kiedy">po ${esc(kiedy)}</span>`
    + `<span class="opis">dosyłka ${wpis.drewno} / ${wpis.glina} / ${wpis.zelazo}</span></li>`;
}
