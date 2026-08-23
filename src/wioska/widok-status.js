// src/wioska/widok-status.js
// Stan wioski na wskazany moment osi, w dwoch kolumnach: stan wioski (lewa)
// i bilans zaopatrzenia (prawa). Rzad ikon budynkow wzorowany na
// "Podsumowaniu" w Menedzerze Konta, z poziomem pod ikona.

import { produkcjaGodzinowa, maksLudnosc, pojemnosc } from './tabele.js';
import { ludnoscPoziomu } from './swiat.js';
import { czasCzytelny } from './format.js';
import { NAZWY } from './nazwy.js';
import { esc, ikonaHTML } from './widok-budynki.js';
import { kolejnoscBudynkow } from './kolejnosc-budynkow.js';
import { bilansHTML } from './widok-bilans.js';
import { punktyWioski } from './punkty.js';
import { ludnoscRekrutacjiDoCzasu } from './zapotrzebowanie.js';

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

  return [
    `<div class="stan-moment">● ${esc(etykieta)}</div>`,
    `<div class="stan-ikony">${ikony}</div>`,
    `<div class="stan-liczby">`,
    `<div title="Czas budowy przy założeniu, że surowców nigdy nie brakuje"><b>Czas budowy bez przerw</b> ${czasCzytelny(zap.czasNettoS)}</div>`,
    `<div title="Czas obejmujący produkcję i zaopatrzenie"><b>Czas budowy realny</b> ${czasCzytelny(wynik.podsumowanie.czasS)}</div>`,
    '<hr>',
    `<div><b>Punkty wioski</b> ${punkty}</div>`,
    `<div><b>Aktualne eko</b> ${Math.round(prodH.drewno)} / ${Math.round(prodH.glina)} / ${Math.round(prodH.zelazo)} na h</div>`,
    `<div><b>Populacja</b> ${st.ludnosc} / ${limit}</div>`,
    `<div><b>Spichlerz</b> ${magazyn} na surowiec</div>`,
    `<div><b>Wydano</b> ${st.wydano.drewno} / ${st.wydano.glina} / ${st.wydano.zelazo}</div>`,
    `</div>`,
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
