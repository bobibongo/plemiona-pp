// src/wioska/widok-status.js
// Stan wioski na wskazany moment osi, w dwoch kolumnach: stan wioski (lewa)
// i bilans zaopatrzenia (prawa). Rzad ikon budynkow wzorowany na
// "Podsumowaniu" w Menedzerze Konta, z poziomem pod ikona.

import { produkcjaGodzinowa, maksLudnosc, pojemnosc } from './tabele.js';
import { ludnoscPoziomu } from './swiat.js';
import { czasCzytelny } from './format.js';
import { NAZWY, NAZWY_SUROWCOW } from './nazwy.js';
import { esc, ikonaHTML } from './widok-budynki.js';
import { kolejnoscBudynkow } from './kolejnosc-budynkow.js';
import { bilansHTML } from './widok-bilans.js';
import { punktyWioski } from './punkty.js';
import { ludnoscRekrutacjiDoCzasu, kosztyDoMomentu, osBezPrzestojow } from './zapotrzebowanie.js';
import { IKONY_SUROWCOW } from './ikony.js';

const SUROWCE_S = ['drewno', 'glina', 'zelazo'];

// Ludnosc rekrutacji jest liczona na osi budowy BEZ przestojow (patrz
// osRekrutacjiBezPrzestojow) nawet gdy krok budowy niesie czas Z przestojami
// (koniecS z symulacji) — to swiadome uproszczenie: rekrutacja ma pokazywac
// zapotrzebowanie w czasie, nie byc zsynchronizowana co do sekundy z
// realnymi przestojami budowy na innej osi.
function stanNaKrok(s, plan, wynik, indeks) {
  if (indeks === null || !wynik.kroki[indeks]) {
    const ostatni = wynik.kroki[wynik.kroki.length - 1];
    const ludnoscBudynkow = ostatni ? ostatni.ludnoscPo : kolejnoscBudynkow(s)
      .reduce((suma, b) => suma + ludnoscPoziomu(s, b, plan.start.poziomy[b] ?? 0), 0);
    return {
      poziomy: ostatni ? ostatni.poziomyPo : { ...plan.start.poziomy },
      czasS: wynik.podsumowanie.czasS,
      ludnosc: ludnoscBudynkow + ludnoscRekrutacjiDoCzasu(plan, Infinity),
      wydano: wynik.podsumowanie.koszt,
      indeks: null,
    };
  }
  const k = wynik.kroki[indeks];
  const wydano = { drewno: 0, glina: 0, zelazo: 0 };
  for (let i = 0; i <= indeks; i++) {
    if (wynik.kroki[i].blad) continue;
    for (const r of SUROWCE_S) wydano[r] += wynik.kroki[i].koszt[r];
  }
  const ludnosc = k.ludnoscPo + ludnoscRekrutacjiDoCzasu(plan, k.koniecS);
  return { poziomy: k.poziomyPo, czasS: k.koniecS, ludnosc, wydano, indeks };
}

// Trojka surowcow z ikonami — jeden wzorzec dla calego paska stanu i bilansu.
export function trojkaSurowcowHTML(w) {
  return ['drewno', 'glina', 'zelazo'].map(r => {
    const src = IKONY_SUROWCOW[r];
    const ikona = src ? `<img class="ikona-surowca" src="${esc(src)}" alt="" title="${esc(NAZWY_SUROWCOW[r] ?? r)}">` : '';
    return `<span class="sur"${src ? '' : ` title="${esc(NAZWY_SUROWCOW[r] ?? r)}"`}>${ikona}${Math.round(w[r]).toLocaleString('pl-PL')}</span>`;
  }).join('');
}

function stanWioskiHTML(s, plan, wynik, zap, st, indeks) {
  const ikony = kolejnoscBudynkow(s)
    .map(b => `<span class="poziom-budynku" data-poziom-${esc(b)}="${st.poziomy[b] ?? 0}">`
      + `${ikonaHTML(b, NAZWY[b] ?? b)}<b>${st.poziomy[b] ?? 0}</b></span>`)
    .join('');
  const prodH = {
    drewno: produkcjaGodzinowa(s, st.poziomy.tartak ?? 0),
    glina: produkcjaGodzinowa(s, st.poziomy.cegielnia ?? 0),
    zelazo: produkcjaGodzinowa(s, st.poziomy.huta ?? 0),
  };
  const limit = maksLudnosc(st.poziomy.zagroda ?? 1);
  const magazyn = pojemnosc(st.poziomy.spichlerz ?? 1);
  const punkty = punktyWioski(st.poziomy);
  const etykieta = indeks === null
    ? 'stan końcowy'
    : `krok ${indeks + 1} — ${czasCzytelny(st.czasS)}`;

  // Doba planu liczona po osi BEZ przestojow, wg STARTU kroku — dokladnie ta
  // sama definicja, co naglowki w kolejce, wykres i kolumna bilansu. Wczesniej
  // liczylismy ja z konca kroku, przez co krok przechodzacy przez polnoc
  // pokazywal "Dzien 8" obok "doba: 7" w sasiedniej kolumnie.
  const os = osBezPrzestojow(plan);
  const iOs = indeks === null ? os.length - 1 : indeks;
  const wpisOsi = os[iOs];
  const dzienNetto = wpisOsi ? Math.floor(wpisOsi.startS / 86400) + 1 : 1;
  const koszty = kosztyDoMomentu(plan, indeks);

  // Czasy liczymy DO KONCA zaznaczonej doby, nie dla calego planu — kolumna
  // ma opisywac ten sam moment, co reszta panelu. Netto bierzemy z osi bez
  // przestojow, realny z symulacji; roznica to przestoje na surowce.
  const ostatniKrokDoby = (() => {
    let idx = iOs;
    for (let i = 0; i < os.length; i++) {
      if (Math.floor(os[i].startS / 86400) === dzienNetto - 1) idx = i;
    }
    return idx;
  })();
  const wpisNetto = os[ostatniKrokDoby];
  const czasNettoS = wpisNetto ? wpisNetto.startS + wpisNetto.trwanieS : 0;
  const czasRealnyS = wynik.kroki[ostatniKrokDoby]
    ? wynik.kroki[ostatniKrokDoby].koniecS
    : wynik.podsumowanie.czasS;

  return [
    `<div class="stan-dzien" title="Doba planu — ta sama numeracja, co w kolejce i na wykresie">`
      + `<span class="dzien-duzy">Dzień ${dzienNetto}</span></div>`,
    `<div class="stan-ikony">${ikony}</div>`,

    `<section class="sekcja">`,
    `<h4 class="sekcja-tytul">Wioska <span class="zakres zakres-teraz">na ten moment</span></h4>`,
    `<div class="stan-liczby">`,
    `<div><b>Punkty wioski</b> ${punkty}</div>`,
    `<div class="z-ikonami"><b>Produkcja EKO / h</b> ${trojkaSurowcowHTML(prodH)}</div>`,
    `<div><b>Populacja</b> ${Math.round(st.ludnosc)} / ${limit}</div>`,
    `<div class="z-ikonami"><b>Pojemność spichlerza</b> ${trojkaSurowcowHTML({ drewno: magazyn, glina: magazyn, zelazo: magazyn })}</div>`,
    `</div></section>`,

    `<section class="sekcja">`,
    `<h4 class="sekcja-tytul">Wydatki <span class="zakres zakres-suma">narastająco od początku</span></h4>`,
    `<div class="stan-liczby">`,
    `<div class="z-ikonami" title="Surowce wydane na budynki do tego momentu"><b>Budowa</b> ${trojkaSurowcowHTML(koszty.budowa)}</div>`,
    `<div class="z-ikonami" title="Surowce wydane na jednostki do tego momentu"><b>Rekrutacja</b> ${trojkaSurowcowHTML(koszty.rekrutacja)}</div>`,
    `<div class="z-ikonami suma-kosztow"><b>Razem</b> ${trojkaSurowcowHTML(koszty.razem)}</div>`,
    `</div></section>`,

    `<section class="sekcja">`,
    `<h4 class="sekcja-tytul">Czas <span class="zakres zakres-doba">do końca doby ${dzienNetto}</span></h4>`,
    `<div class="stan-liczby">`,
    `<div title="Ile realnie zajmie dojście do tego momentu, z przestojami na surowce"><b>Realny</b> ${czasCzytelny(czasRealnyS)}</div>`,
    `<div title="Ile zajęłoby dojście tutaj, gdyby surowców nigdy nie brakowało"><b>Bez przestojów</b> ${czasCzytelny(czasNettoS)}</div>`,
    `<div class="stan-osobno" title="Opóźnienie wynikające z czekania na surowce"><b>Przestoje</b> ${czasCzytelny(Math.max(0, czasRealnyS - czasNettoS))}</div>`,
    `</div></section>`,
  ].join('');
}

export function pasekStanuHTML(s, plan, wynik, zap, indeks) {
  const st = stanNaKrok(s, plan, wynik, indeks);
  const lewa = stanWioskiHTML(s, plan, wynik, zap, st, indeks);
  const prawa = bilansHTML(s, plan, wynik, zap, indeks);
  const wiersze = [
    `<div class="stan-lewa">${lewa}</div>`,
    `<div class="stan-prawa">${prawa}</div>`,
  ];
  if (zap.brakNaStart) {
    wiersze.push('<div class="stan-gardlo">Na pierwszy krok nie starcza surowców startowych.</div>');
  }
  return wiersze.join('');
}
