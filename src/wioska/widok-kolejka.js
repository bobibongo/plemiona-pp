// src/wioska/widok-kolejka.js
// Kolejka jako os czasu. Czas kroku nie jest tu pokazywany — pasek stanu
// podaje go dla zaznaczonego momentu, a tu zabieralby miejsce w kazdym wierszu.

import { NAZWY, NAZWY_SUROWCOW } from './nazwy.js';
import { esc, ikonaHTML } from './widok-budynki.js';
import { osBezPrzestojow, zapotrzebowanieDzienne } from './zapotrzebowanie.js';

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

export function naglowekDniaHTML(wiersz) {
  return `<li class="naglowek-dnia">Dzień ${wiersz.dzien + 1} · `
    + `${Math.round(wiersz.drewno)} / ${Math.round(wiersz.glina)} / ${Math.round(wiersz.zelazo)} · `
    + `${wiersz.liczbaKrokow} ${wiersz.liczbaKrokow === 1 ? 'krok' : 'kroki'}</li>`;
}

// Nazwa DOBA_S jest juz zajeta w zapotrzebowanie.js — build.js skleja oba
// pliki w jeden wspolny zakres (patrz LOGIC w build.js), wiec druga stala
// o tej samej nazwie bylaby bledem skladni w przegladarce.
const DOBA_KOLEJKI_S = 86400;

function indeksKotwicyKolejki(kotwica, kroki) {
  if (kotwica === null) return -1;
  return kroki.findIndex(k => k.budynek === kotwica.budynek && k.doPoziomu === kotwica.doPoziomu);
}

// Kroki, wtracenia gracza i naglowki dni w jednej liscie. Wtracenie stoi
// zaraz po kroku, do ktorego kotwiczy — nawet gdy ten krok konczy dzien,
// wiec wtracenie ma wyladowac PRZED naglowkiem kolejnego dnia, nie po nim.
export function kolejkaHTML(plan, wynik, zaznaczony) {
  const os = osBezPrzestojow(plan);
  const dni = zapotrzebowanieDzienne(plan);
  const wtracenia = [
    ...plan.dochody.map((d, idx) => ({ i: indeksKotwicyKolejki(d.kotwica, plan.kroki), rodzaj: 'dochod', wpis: d, idx })),
    ...plan.zastrzyki.map((z, idx) => ({ i: indeksKotwicyKolejki(z.kotwica, plan.kroki), rodzaj: 'dosylka', wpis: z, idx })),
  ].sort((a, b) => a.i - b.i);

  let w = 0;
  let ostatniDzien = -1;
  const out = [];
  wynik.kroki.forEach((k, i) => {
    while (w < wtracenia.length && wtracenia[w].i <= i - 1) {
      const wpis = wtracenia[w];
      out.push(wtracenieHTML(wpis.rodzaj, wpis.wpis, i, wpis.idx));
      w += 1;
    }
    const dzienKroku = Math.floor(os[i].startS / DOBA_KOLEJKI_S);
    for (let d = ostatniDzien + 1; d <= dzienKroku; d++) out.push(naglowekDniaHTML(dni[d]));
    ostatniDzien = dzienKroku;
    out.push(krokHTML(k, i, i === zaznaczony));
  });
  while (w < wtracenia.length) {
    const wpis = wtracenia[w];
    out.push(wtracenieHTML(wpis.rodzaj, wpis.wpis, null, wpis.idx));
    w += 1;
  }
  return out.join('');
}