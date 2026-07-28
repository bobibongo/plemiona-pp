// src/wioska/zapotrzebowanie.js
// Dwie rodziny liczb odporne na wahania farmienia, obie liczone na osi bez
// przestojow (magazyn i dochod sa ignorowane — to jest tempo, w jakim plan
// CHCIALBY isc, nie przebieg przy konkretnym zaopatrzeniu):
//   - czas netto i wymagany dochod dla calego planu (zapotrzebowanie),
//   - zuzycie w oknie doby od wskazanego momentu (zuzycieNaDobe) — pokazuje
//     zmiane tempa na kolejnych etapach, czego jedna liczba dla calego planu
//     nie widzi.
// Podstawa musi byc harmonogram BEZ przestojow: liczony po realnym (z
// symulacji) bilans zawsze wyszedlby zerowy przy braku surowcow, bo wtedy
// plan zuzywa dokladnie tyle, ile wplywa — miara mierzylaby sama siebie.

import { swiat } from './swiaty.js';
import { kosztPoziomu } from './swiat.js';
import { produkcjaGodzinowa } from './tabele.js';
import { czasBudowy } from './czas.js';

const SUROWCE_Z = ['drewno', 'glina', 'zelazo'];
const KOPALNIA_SUROWCA = { drewno: 'tartak', glina: 'cegielnia', zelazo: 'huta' };
const DOBA_S = 86400;

export function osBezPrzestojow(plan) {
  const s = swiat(plan.swiat);
  const poziomy = { ...plan.start.poziomy };
  let czas = 0;
  return plan.kroki.map(krok => {
    const koszt = kosztPoziomu(s, krok.budynek, krok.doPoziomu);
    const { sekundy } = czasBudowy(s, krok.budynek, krok.doPoziomu, poziomy.ratusz ?? 1);
    const wiersz = { budynek: krok.budynek, doPoziomu: krok.doPoziomu, startS: czas, trwanieS: sekundy, koszt };
    czas += sekundy;
    poziomy[krok.budynek] = krok.doPoziomu;
    return wiersz;
  });
}

export function zapotrzebowanie(plan) {
  const s = swiat(plan.swiat);
  const os = osBezPrzestojow(plan);
  const skumulowany = { drewno: 0, glina: 0, zelazo: 0 };
  const wyprodukowane = { drewno: 0, glina: 0, zelazo: 0 };
  const wymagany = { drewno: 0, glina: 0, zelazo: 0 };
  let waskieGardlo = null;
  let szczyt = 0;
  let brakNaStart = false;
  const poziomy = { ...plan.start.poziomy };

  os.forEach((wiersz, indeks) => {
    for (const r of SUROWCE_Z) skumulowany[r] += wiersz.koszt[r];

    for (const r of SUROWCE_Z) {
      const deficyt = skumulowany[r] - plan.start.surowce[r] - wyprodukowane[r];
      if (deficyt <= 0) continue;
      if (wiersz.startS <= 0) {
        brakNaStart = true;
        continue;
      }
      const naDobe = deficyt / (wiersz.startS / DOBA_S);
      if (naDobe > wymagany[r]) wymagany[r] = naDobe;
      if (naDobe > szczyt) {
        szczyt = naDobe;
        waskieGardlo = { indeks, budynek: wiersz.budynek, doPoziomu: wiersz.doPoziomu, surowiec: r, czasS: Math.round(wiersz.startS) };
      }
    }

    for (const r of SUROWCE_Z) {
      wyprodukowane[r] += produkcjaGodzinowa(s, poziomy[KOPALNIA_SUROWCA[r]] ?? 0) * wiersz.trwanieS / 3600;
    }
    poziomy[wiersz.budynek] = wiersz.doPoziomu;
  });

  const czasNettoS = os.length ? os[os.length - 1].startS + os[os.length - 1].trwanieS : 0;

  return {
    czasNettoS: Math.round(czasNettoS),
    wymaganyDobowo: {
      drewno: Math.ceil(wymagany.drewno),
      glina: Math.ceil(wymagany.glina),
      zelazo: Math.ceil(wymagany.zelazo),
    },
    waskieGardlo,
    brakNaStart,
  };
}

export function zuzycieNaDobe(plan, indeksKrokuLubNull) {
  const os = osBezPrzestojow(plan);
  const suma = { drewno: 0, glina: 0, zelazo: 0 };
  if (os.length === 0) return { suma, doKonca: true };

  const indeksBazowy = indeksKrokuLubNull === null ? os.length - 1 : indeksKrokuLubNull;
  const wiersz = os[indeksBazowy];
  if (!wiersz) return { suma, doKonca: true };

  const T = wiersz.startS;
  const koniecOsi = os[os.length - 1].startS + os[os.length - 1].trwanieS;
  const doKonca = T + DOBA_S >= koniecOsi;
  const gorna = doKonca ? koniecOsi : T + DOBA_S;

  for (const w of os) {
    if (w.startS >= T && w.startS < gorna) {
      for (const r of SUROWCE_Z) suma[r] += w.koszt[r];
    }
  }
  return { suma, doKonca };
}

export function zapotrzebowanieDzienne(plan) {
  const os = osBezPrzestojow(plan);
  if (os.length === 0) return [];

  const ostatni = os[os.length - 1];
  const czasNettoS = ostatni.startS + ostatni.trwanieS;
  const liczbaDni = Math.ceil(czasNettoS / DOBA_S);

  const dni = [];
  for (let i = 0; i < liczbaDni; i++) {
    dni.push({ dzien: i, drewno: 0, glina: 0, zelazo: 0, liczbaKrokow: 0 });
  }

  for (const wiersz of os) {
    const indeksDnia = Math.floor(wiersz.startS / DOBA_S);
    const cel = dni[indeksDnia];
    cel.liczbaKrokow += 1;
    for (const r of SUROWCE_Z) cel[r] += wiersz.koszt[r];
  }

  return dni;
}
