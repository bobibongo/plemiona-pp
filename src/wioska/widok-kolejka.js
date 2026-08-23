// src/wioska/widok-kolejka.js
// Kolejka jako os czasu. Czas kroku nie jest tu pokazywany — pasek stanu
// podaje go dla zaznaczonego momentu, a tu zabieralby miejsce w kazdym wierszu.

import { NAZWY, NAZWY_SUROWCOW, NAZWY_JEDNOSTEK } from './nazwy.js';
import { esc, ikonaHTML } from './widok-budynki.js';
import { osBezPrzestojow, osRekrutacjiBezPrzestojow, zapotrzebowanieDzienne } from './zapotrzebowanie.js';
import { punktyWioski } from './punkty.js';
import { czasCzytelny } from './format.js';

// Grupa laczy kilka bezposrednio sasiadujacych krokow tego samego budynku
// (np. Tartak +3) w jeden kafelek. `grupa` niesie ostatni krok pasma (do jego
// poziomu i punktow docelowych) oraz liczbe krokow — reszta kafelka liczy sie
// z pojedynczego `krok`, wiec wywolania bez grupy dzialaja jak wczesniej.
export function krokHTML(krok, indeks, zaznaczony, grupa = null) {
  const liczba = grupa ? grupa.liczba : 1;
  const ostatni = grupa ? grupa.ostatniKrok : krok;
  const ostatniIndeks = grupa ? grupa.ostatniIndeks : indeks;
  const przyrost = liczba > 1 ? ` (+${liczba})` : '';
  const nazwa = `${NAZWY[krok.budynek] ?? krok.budynek} → ${ostatni.doPoziomu}${przyrost}`;
  const klasy = ['krok'];
  if (grupa ? grupa.blad : krok.blad) klasy.push('blad');
  if (zaznaczony) klasy.push('zaznaczony');
  const czeka = grupa ? grupa.czekanieS > 0 : krok.czekanieS > 0;
  const czekanieNa = grupa ? grupa.czekanieNa : krok.czekanieNa;
  const czekanie = czeka
    ? `<span class="czekanie" title="czeka na ${esc(NAZWY_SUROWCOW[czekanieNa] ?? czekanieNa)}">⏳</span>`
    : '';
  const punkty = ostatni.poziomyPo ? punktyWioski(ostatni.poziomyPo) : 0;
  return `<li class="${klasy.join(' ')}" draggable="true" data-krok="${indeks}" data-krok-do="${ostatniIndeks}">`
    + `<span class="nr" title="Punkty wioski po tym kroku">${punkty}</span>`
    + `<span class="opis">${ikonaHTML(krok.budynek, nazwa)}${esc(nazwa)}</span>`
    + `${czekanie}`
    + `<button data-usun="${indeks}" data-usun-do="${ostatniIndeks}" title="Usuń">×</button></li>`;
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
  if (rodzaj === 'rekrutacja') {
    const nazwa = NAZWY_JEDNOSTEK[wpis.jednostka] ?? wpis.jednostka;
    const czas = wpis.trwanieS !== undefined ? ` — ${czasCzytelny(wpis.trwanieS)}` : '';
    return `<li class="wtracenie rekrutacja"${cel}${wt}>`
      + `<span class="opis">⚔ ${wpis.ilosc}× ${esc(nazwa)} (${esc(NAZWY[wpis.budynek] ?? wpis.budynek)} ${wpis.poziomBudynku ?? ''})${czas}</span></li>`;
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
  const rekrutacjeOs = osRekrutacjiBezPrzestojow(plan);
  const wtracenia = [
    ...plan.dochody.map((d, idx) => ({ i: indeksKotwicyKolejki(d.kotwica, plan.kroki), rodzaj: 'dochod', wpis: d, idx })),
    ...plan.zastrzyki.map((z, idx) => ({ i: indeksKotwicyKolejki(z.kotwica, plan.kroki), rodzaj: 'dosylka', wpis: z, idx })),
    ...plan.rekrutacje.map((r, idx) => ({
      i: indeksKotwicyKolejki(r.kotwica, plan.kroki), rodzaj: 'rekrutacja', idx,
      wpis: { ...r, ...rekrutacjeOs[idx] },
    })),
  ].sort((a, b) => a.i - b.i);

  // Zbior indeksow, na ktorych wtracenie lub zmiana dnia wypada PRZED tym
  // krokiem — taki krok nie moze wejsc w srodek grupy, bo wtracenie/naglowek
  // musi zostac wyrenderowany na swoim miejscu w kolejnosci.
  const wPelniZajete = new Set(wtracenia.map(wp => wp.i + 1));

  let w = 0;
  let ostatniDzien = -1;
  const out = [];
  let i = 0;
  while (i < wynik.kroki.length) {
    while (w < wtracenia.length && wtracenia[w].i <= i - 1) {
      const wpis = wtracenia[w];
      out.push(wtracenieHTML(wpis.rodzaj, wpis.wpis, i, wpis.idx));
      w += 1;
    }
    const dzienKroku = Math.floor(os[i].startS / DOBA_KOLEJKI_S);
    for (let d = ostatniDzien + 1; d <= dzienKroku; d++) out.push(naglowekDniaHTML(dni[d]));
    ostatniDzien = dzienKroku;

    const k = wynik.kroki[i];
    // Grupa rosnie, dopoki kolejny krok jest ten sam budynek, ani on ani
    // poczatek grupy nie sa zaznaczone (zaznaczenie musi celowac w konkretny
    // krok, wiec nie moze siedziec w srodku zlaczonego kafelka), i nie zaczyna
    // nowego dnia ani nie ma wtracenia zakotwiczonego przed nim.
    let j = i;
    while (
      i !== zaznaczony
      && j + 1 < wynik.kroki.length
      && wynik.kroki[j + 1].budynek === k.budynek
      && j + 1 !== zaznaczony
      && !wPelniZajete.has(j + 1)
      && Math.floor(os[j + 1].startS / DOBA_KOLEJKI_S) === dzienKroku
    ) {
      j += 1;
    }

    const grupa = j > i ? {
      liczba: j - i + 1,
      ostatniKrok: wynik.kroki[j],
      ostatniIndeks: j,
      blad: wynik.kroki.slice(i, j + 1).some(krok => krok.blad),
      czekanieS: wynik.kroki.slice(i, j + 1).reduce((suma, krok) => suma + krok.czekanieS, 0),
      czekanieNa: wynik.kroki.slice(i, j + 1).find(krok => krok.czekanieS > 0)?.czekanieNa ?? null,
    } : null;
    out.push(krokHTML(k, i, i === zaznaczony, grupa));
    i = j + 1;
  }
  // Po ostatnim kroku budowy moga zostac wtracenia bez wlasnego kroku (np.
  // rekrutacja bez kotwicy w planie bez zadnej budowy, albo rekrutacja tak
  // dluga, ze konczy sie po ostatnim kroku) — doliczamy im naglowki dni wg
  // czasu startu (rekrutacja niesie startS; dochod/dosylka sa punktowe i
  // historycznie nie maja wlasnego dnia, wiec ladujemy je od razu po
  // ostatnim juz wypisanym naglowku, bez proby ich datowania).
  while (w < wtracenia.length) {
    const wpis = wtracenia[w];
    if (wpis.rodzaj === 'rekrutacja' && wpis.wpis.startS !== undefined) {
      const dzienWpisu = Math.floor(wpis.wpis.startS / DOBA_KOLEJKI_S);
      for (let d = ostatniDzien + 1; d <= dzienWpisu && d < dni.length; d++) out.push(naglowekDniaHTML(dni[d]));
      if (dzienWpisu > ostatniDzien) ostatniDzien = dzienWpisu;
    }
    out.push(wtracenieHTML(wpis.rodzaj, wpis.wpis, null, wpis.idx));
    w += 1;
  }
  for (let d = ostatniDzien + 1; d < dni.length; d++) out.push(naglowekDniaHTML(dni[d]));
  return out.join('');
}