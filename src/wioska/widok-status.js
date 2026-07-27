// src/wioska/widok-status.js
// Stan wioski na wskazany moment osi. Gorna czesc to rzad ikon z poziomami,
// wzorowany na "Podsumowaniu" w Menedzerze Konta — z ta roznica, ze pokazuje
// wioske w wybranej chwili, a nie stan koncowy.

import { budynkiSwiata } from './swiat.js';
import { produkcjaGodzinowa, maksLudnosc } from './tabele.js';
import { czasCzytelny } from './format.js';
import { NAZWY } from './nazwy.js';
import { esc, ikonaHTML } from './widok-budynki.js';

const SUROWCE_S = ['drewno', 'glina', 'zelazo'];

function stanNaKrok(plan, wynik, indeks) {
  if (indeks === null || !wynik.kroki[indeks]) {
    const ostatni = wynik.kroki[wynik.kroki.length - 1];
    return {
      poziomy: ostatni ? ostatni.poziomyPo : { ...plan.start.poziomy },
      czasS: wynik.podsumowanie.czasS,
      ludnosc: ostatni ? ostatni.ludnoscPo : 0,
      wydano: wynik.podsumowanie.koszt,
      indeks: null,
    };
  }
  const k = wynik.kroki[indeks];
  const wydano = { drewno: 0, glina: 0, zelazo: 0 };
  for (let i = 0; i <= indeks; i++) {
    for (const r of SUROWCE_S) wydano[r] += wynik.kroki[i].koszt[r];
  }
  return { poziomy: k.poziomyPo, czasS: k.koniecS, ludnosc: k.ludnoscPo, wydano, indeks };
}

function dosylkiDo(plan, czasS) {
  const suma = { drewno: 0, glina: 0, zelazo: 0 };
  for (const z of plan.zastrzyki) {
    if (z.czasS <= czasS) for (const r of SUROWCE_S) suma[r] += z[r];
  }
  return suma;
}

function dochodWChwiliS(plan, czasS) {
  let biezacy = { drewnoD: 0, glinaD: 0, zelazoD: 0 };
  for (const d of plan.dochody) { if (d.czasS <= czasS) biezacy = d; else break; }
  return biezacy;
}

export function pasekStanuHTML(s, plan, wynik, zap, indeks) {
  const st = stanNaKrok(plan, wynik, indeks);
  const ikony = budynkiSwiata(s)
    .map(b => `<span class="poziom-budynku" data-poziom-${esc(b)}="${st.poziomy[b] ?? 0}">`
      + `${ikonaHTML(b, NAZWY[b] ?? b)}<b>${st.poziomy[b] ?? 0}</b></span>`)
    .join('');

  const prodH = {
    drewno: produkcjaGodzinowa(s, st.poziomy.tartak ?? 0),
    glina: produkcjaGodzinowa(s, st.poziomy.cegielnia ?? 0),
    zelazo: produkcjaGodzinowa(s, st.poziomy.huta ?? 0),
  };
  const limit = maksLudnosc(st.poziomy.zagroda ?? 1);
  const dos = dosylkiDo(plan, st.czasS);
  const doch = dochodWChwiliS(plan, st.czasS);
  const w = zap.wymaganyDobowo;
  const etykieta = indeks === null
    ? 'stan końcowy'
    : `krok ${indeks + 1} — ${czasCzytelny(st.czasS)}`;

  const wiersze = [
    `<div class="stan-moment">● ${esc(etykieta)}</div>`,
    `<div class="stan-ikony">${ikony}</div>`,
    `<div class="stan-liczby">`,
    `<span><b>Czas netto</b> ${czasCzytelny(zap.czasNettoS)} · <b>realny</b> ${czasCzytelny(wynik.podsumowanie.czasS)}</span>`,
    `<span><b>Populacja</b> ${st.ludnosc} / ${limit}</span>`,
    `<span><b>Wydano</b> ${st.wydano.drewno} / ${st.wydano.glina} / ${st.wydano.zelazo}</span>`,
    `<span><b>Produkcja</b> ${prodH.drewno} / ${prodH.glina} / ${prodH.zelazo} na h · ${prodH.drewno * 24} / ${prodH.glina * 24} / ${prodH.zelazo * 24} na dobę</span>`,
    `<span><b>Dochód</b> ${doch.drewnoD} / ${doch.glinaD} / ${doch.zelazoD} na dobę · <b>wymagany</b> ${w.drewno} / ${w.glina} / ${w.zelazo} na dobę</span>`,
    `<span><b>Dosłano</b> ${dos.drewno} / ${dos.glina} / ${dos.zelazo}</span>`,
    `</div>`,
  ];
  if (zap.waskieGardlo) {
    const g = zap.waskieGardlo;
    wiersze.push(`<div class="stan-gardlo">Wąskie gardło: krok ${g.indeks + 1} — ${esc(NAZWY[g.budynek] ?? g.budynek)} → ${g.doPoziomu}</div>`);
  }
  if (zap.brakNaStart) {
    wiersze.push('<div class="stan-gardlo">Na pierwszy krok nie starcza surowców startowych.</div>');
  }
  return wiersze.join('');
}
