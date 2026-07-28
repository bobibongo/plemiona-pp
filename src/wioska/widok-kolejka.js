// src/wioska/widok-kolejka.js
// Kolejka jako os czasu. Czas kroku nie jest tu pokazywany — pasek stanu
// podaje go dla zaznaczonego momentu, a tu zabieralby miejsce w kazdym wierszu.

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
// Wtracenie stojace przed jakims krokiem niesie jego indeks, zeby upuszczenie
// przeciaganego kafelka na ten wiersz trafilo w to miejsce kolejki, a nie
// zostalo pomylone z upuszczeniem pod cala lista.
export function wtracenieHTML(rodzaj, wpis, przedKrokiem = null, indeksWTablicy = null) {
  const cel = przedKrokiem === null ? '' : ` data-przed-krokiem="${przedKrokiem}"`;
  const wt = indeksWTablicy === null ? '' : ` draggable="true" data-wtracenie="${indeksWTablicy}" data-wtracenie-rodzaj="${rodzaj}"`;
  if (rodzaj === 'dochod') {
    const zrodlo = wpis.zrodlo === 'zbieractwo' ? 'zbieractwo' : 'farma';
    return `<li class="wtracenie dochod"${cel}${wt}>`
      + `<span class="opis">dochód (${esc(zrodlo)}) ${wpis.sumaD} na dobę</span></li>`;
  }
  return `<li class="wtracenie dosylka"${cel}${wt}>`
    + `<span class="opis">dosyłka ${wpis.drewno} / ${wpis.glina} / ${wpis.zelazo}</span></li>`;
}