// src/wioska/widok-kolejka.js
// Kolejka jako os czasu. Czas kroku nie jest tu pokazywany — pasek stanu
// podaje go dla zaznaczonego momentu, a tu zabieralby miejsce w kazdym wierszu.

import { NAZWY, NAZWY_SUROWCOW, NAZWY_JEDNOSTEK, SKROTY_JEDNOSTEK } from './nazwy.js';
import { esc, ikonaHTML } from './widok-budynki.js';
import { osBezPrzestojow, osRekrutacjiBezPrzestojow, zapotrzebowanieDzienne, wojskoNaKoniecDnia } from './zapotrzebowanie.js';
import { punktyWioski } from './punkty.js';
import { czasCzytelny } from './format.js';

// Grupa laczy kilka bezposrednio sasiadujacych krokow tego samego budynku
// (np. Tartak +3) w jeden kafelek. `grupa` niesie ostatni krok pasma (do jego
// poziomu i punktow docelowych) oraz liczbe krokow — reszta kafelka liczy sie
// z pojedynczego `krok`, wiec wywolania bez grupy dzialaja jak wczesniej.
export function krokHTML(krok, indeks, zaznaczony, grupa = null, dzien = null, dzienAktywny = false, ostatniWDniu = false) {
  const liczba = grupa ? grupa.liczba : 1;
  const ostatni = grupa ? grupa.ostatniKrok : krok;
  const ostatniIndeks = grupa ? grupa.ostatniIndeks : indeks;
  const przyrost = liczba > 1 ? ` (+${liczba})` : '';
  const nazwa = `${NAZWY[krok.budynek] ?? krok.budynek} → ${ostatni.doPoziomu}${przyrost}`;
  const czeka = grupa ? grupa.czekanieS > 0 : krok.czekanieS > 0;
  const czekanieNa = grupa ? grupa.czekanieNa : krok.czekanieNa;
  const klasy = ['krok'];
  if (grupa ? grupa.blad : krok.blad) klasy.push('blad');
  if (zaznaczony) klasy.push('zaznaczony');
  // Kroki naleza wizualnie do bloku swojej doby — CSS wciaga je pod ramke
  // dnia, a przy zaznaczeniu podswietla razem z paskami.
  if (dzienAktywny) klasy.push('dzien-aktywny');
  if (ostatniWDniu) klasy.push('ostatni-w-dniu');
  if (czeka) klasy.push('czeka');
  // Czekanie na surowce sygnalizujemy klasa i podpowiedzia, bez dodatkowej
  // ikony — ta lamala siatke kafelka i rozjezdzala kolumne czasu.
  const tytulCzekania = czeka
    ? ` title="Czeka na ${esc(NAZWY_SUROWCOW[czekanieNa] ?? czekanieNa)}"`
    : '';
  const punkty = ostatni.poziomyPo ? punktyWioski(ostatni.poziomyPo) : 0;
  // Czas budowy: dla grupy suma calego pasma, dla pojedynczego kroku jego
  // wlasne trwanie. Bez czekania na surowce — to jest czas samej budowy.
  const trwanieS = grupa ? grupa.trwanieS : krok.trwanieS;
  const czas = trwanieS > 0
    ? `<span class="czas-budowy" title="Czas budowy${liczba > 1 ? ` ${liczba} poziomów` : ''}">${czasCzytelny(trwanieS)}</span>`
    : '<span class="czas-budowy"></span>';
  const atrDzien = dzien === null ? '' : ` data-dzien-kroku="${dzien}"`;
  return `<li class="${klasy.join(' ')}" draggable="true" data-krok="${indeks}" data-krok-do="${ostatniIndeks}"${atrDzien}${tytulCzekania}>`
    + `<span class="nr" title="Punkty wioski po tym kroku">${punkty}</span>`
    + `<span class="opis">${ikonaHTML(krok.budynek, nazwa)}${esc(nazwa)}</span>`
    + `${czas}`
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

// Dzien to blok trzech elementow: naglowek, pasek budowy i pasek wojska.
// Wszystkie niosa data-dzien, zeby klikniecie w dowolny z nich zaznaczylo
// caly dzien (patrz strona.js) — jednostka interakcji jest doba, nie krok.
export function naglowekDniaHTML(wiersz, wojsko = null, aktywny = false) {
  const klasy = aktywny ? 'naglowek-dnia aktywny' : 'naglowek-dnia';
  const wojskoHTML = paskiemWojskaHTML(wojsko, wiersz.dzien, aktywny);
  // Blok dnia domyka ten pasek, ktory jest ostatni — bez wojska robi to
  // budowa. Selektor :last-child by tu nie pomogl, bo zaraz po paskach ida
  // kafelki krokow tego dnia.
  return `<li class="${klasy}" data-dzien="${wiersz.dzien}">Dzień ${wiersz.dzien + 1} · `
    + `${wiersz.liczbaKrokow} ${wiersz.liczbaKrokow === 1 ? 'krok' : 'kroki'}</li>`
    + paskiemBudowyHTML(wiersz, aktywny, wojskoHTML === '')
    + wojskoHTML;
}

// Pasek budowy: ile surowcow zjadaja kroki rozpoczete tego dnia. Inny akcent
// kolorystyczny niz wojsko (patrz wioska.css), zeby na pierwszy rzut oka bylo
// widac podzial doby na budowe i rekrutacje.
export function paskiemBudowyHTML(wiersz, aktywny = false, domykaBlok = false) {
  if (!wiersz) return '';
  const suma = wiersz.drewno + wiersz.glina + wiersz.zelazo;
  if (suma <= 0) return '';
  const komorka = (skrot, nazwa, ile) => `<span class="budowa-poz" title="${esc(nazwa)}: ${Math.round(ile)}">`
    + `<span class="budowa-skrot">${skrot}</span>`
    + `<span class="budowa-ile">${Math.round(ile).toLocaleString('pl-PL')}</span></span>`;
  return `<li class="pasek-budowy${aktywny ? ' aktywny' : ''}${domykaBlok ? ' domyka' : ''}" data-dzien="${wiersz.dzien}"`
    + ` title="Surowce zużyte na budowę tego dnia">`
    + komorka('D', 'Drewno', wiersz.drewno)
    + komorka('G', 'Glina', wiersz.glina)
    + komorka('Ż', 'Żelazo', wiersz.zelazo)
    + `<span class="budowa-suma">${Math.round(suma).toLocaleString('pl-PL')} razem</span></li>`;
}

// Wezszy pasek pod naglowkiem dnia: stan armii na koniec tej doby. Milczy,
// dopoki nie ma ani jednej gotowej jednostki — pusty pasek w kazdym dniu
// przed pierwsza rekrutacja tylko rozbijalby liste.
export function paskiemWojskaHTML(wojsko, dzien = null, aktywny = false) {
  if (!wojsko) return '';
  const wpisy = Object.entries(wojsko.jednostki).filter(([, ile]) => ile > 0);
  if (wpisy.length === 0) return '';
  const komorki = wpisy.map(([jednostka, ile]) => {
    const nazwa = NAZWY_JEDNOSTEK[jednostka] ?? jednostka;
    const skrot = SKROTY_JEDNOSTEK[jednostka] ?? jednostka.slice(0, 3).toUpperCase();
    return `<span class="wojsko-poz" title="${esc(nazwa)}: ${ile}">`
      + `<span class="wojsko-skrot">${esc(skrot)}</span>`
      + `<span class="wojsko-ile">${ile.toLocaleString('pl-PL')}</span></span>`;
  }).join('');
  const atrDzien = dzien === null ? '' : ` data-dzien="${dzien}"`;
  return `<li class="pasek-wojska${aktywny ? ' aktywny' : ''}"${atrDzien} title="Stan wojska na koniec doby">`
    + `${komorki}<span class="wojsko-pop">${wojsko.populacja.toLocaleString('pl-PL')} pop.</span></li>`;
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
  const wojsko = wojskoNaKoniecDnia(plan);
  // Zaznaczenie niesie indeks kroku, ale podswietlamy cala dobe, w ktorej
  // ten krok sie zaczyna — dzien jest jednostka interakcji.
  const dzienAktywny = zaznaczony === null || !os[zaznaczony]
    ? null
    : Math.floor(os[zaznaczony].startS / DOBA_KOLEJKI_S);
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
    for (let d = ostatniDzien + 1; d <= dzienKroku; d++) out.push(naglowekDniaHTML(dni[d], wojsko[d], d === dzienAktywny));
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
      trwanieS: wynik.kroki.slice(i, j + 1).reduce((suma, krok) => suma + krok.trwanieS, 0),
    } : null;
    // Czy po tym kafelku konczy sie doba? Jesli tak, to on domyka kartke dnia.
    const nastepnyIndeks = j + 1;
    const koniecDoby = nastepnyIndeks >= wynik.kroki.length
      || Math.floor(os[nastepnyIndeks].startS / DOBA_KOLEJKI_S) !== dzienKroku;
    out.push(krokHTML(k, i, i === zaznaczony, grupa, dzienKroku, dzienKroku === dzienAktywny, koniecDoby));
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
      for (let d = ostatniDzien + 1; d <= dzienWpisu && d < dni.length; d++) out.push(naglowekDniaHTML(dni[d], wojsko[d], d === dzienAktywny));
      if (dzienWpisu > ostatniDzien) ostatniDzien = dzienWpisu;
    }
    out.push(wtracenieHTML(wpis.rodzaj, wpis.wpis, null, wpis.idx));
    w += 1;
  }
  for (let d = ostatniDzien + 1; d < dni.length; d++) out.push(naglowekDniaHTML(dni[d], wojsko[d], d === dzienAktywny));
  return out.join('');
}