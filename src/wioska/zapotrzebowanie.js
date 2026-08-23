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
import { kosztPoziomu, ludnoscPoziomu, budynkiSwiata } from './swiat.js';
import { produkcjaGodzinowa, maksLudnosc } from './tabele.js';
import { czasBudowy } from './czas.js';
import { kosztJednostki, populacjaJednostki, budynekJednostki, czasRekrutacji } from './jednostki.js';
import { NAZWY_JEDNOSTEK } from './nazwy.js';

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

function indeksKotwicyOsi(kotwica, kroki) {
  if (kotwica === null) return -1;
  return kroki.findIndex(k => k.budynek === kotwica.budynek && k.doPoziomu === kotwica.doPoziomu);
}

// Rekrutacja biegnie rownolegle do budowy, wiec nie wchodzi do osBezPrzestojow
// — dostaje wlasna os, zakotwiczona do tych samych krokow budowy co dochod
// i dosylki. Poziom budynku (koszary/stajnia/warsztat) jest zamrozony na
// moment kotwicy — spojne z tym, jak dochod zamraza swoja stawke na kroku.
// Surowce nigdy nie ograniczaja tempa (patrz komentarz w symulacja.js o
// przestojach budowy — tu celowo ich nie ma): rekrutacja ma tylko pokazywac
// zapotrzebowanie w czasie, nie symulowac kolejke z przestojami.
export function osRekrutacjiBezPrzestojow(plan) {
  const s = swiat(plan.swiat);
  const os = osBezPrzestojow(plan);
  const poziomy = { ...plan.start.poziomy };
  const poPoziomie = os.map(w => { const p = { ...poziomy }; poziomy[w.budynek] = w.doPoziomu; return p; });
  const poziomyNaStart = (indeksKotwicy) => (indeksKotwicy < 0 ? plan.start.poziomy : poPoziomie[indeksKotwicy] ?? poziomy);

  return plan.rekrutacje.map(r => {
    const indeksKotwicy = indeksKotwicyOsi(r.kotwica, plan.kroki);
    const startS = indeksKotwicy < 0 ? 0 : (os[indeksKotwicy]?.startS ?? 0) + (os[indeksKotwicy]?.trwanieS ?? 0);
    const budynek = budynekJednostki(s, r.jednostka);
    const poziomBudynku = poziomyNaStart(indeksKotwicy)[budynek] ?? 0;
    const czasSztukiS = czasRekrutacji(s, r.jednostka, poziomBudynku);
    const trwanieS = czasSztukiS * r.ilosc;
    const koszt = kosztJednostki(s, r.jednostka);
    return {
      jednostka: r.jednostka, ilosc: r.ilosc, budynek, poziomBudynku,
      startS, trwanieS, koniecS: startS + trwanieS,
      kosztSztuki: koszt,
      kosztCalkowity: { drewno: koszt.drewno * r.ilosc, glina: koszt.glina * r.ilosc, zelazo: koszt.zelazo * r.ilosc },
      populacjaCalkowita: populacjaJednostki(s, r.jednostka) * r.ilosc,
    };
  });
}

// Czesc kosztu wpisu rekrutacji, ktora przypada w oknie czasu [od, do) —
// zaklada rownomierne (liniowe) tempo produkcji sztuk w trakcie trwania.
function udzialWOknie(wiersz, od, doC) {
  const nakladanie = Math.min(wiersz.koniecS, doC) - Math.max(wiersz.startS, od);
  if (nakladanie <= 0 || wiersz.trwanieS <= 0) return 0;
  return nakladanie / wiersz.trwanieS;
}

// Populacja zajeta przez jednostki juz "gotowe" na dany moment — narastajaco,
// liniowo w trakcie trwania partii, tak samo jak jej koszt. Uzywane w bilansie
// ludnosci obok tej zajetej przez budynki (limit Zagrody dotyczy obu razem).
export function ludnoscRekrutacjiDoCzasu(plan, czasS) {
  const rekrutacje = osRekrutacjiBezPrzestojow(plan);
  return rekrutacje.reduce((suma, r) => {
    if (czasS <= r.startS || r.trwanieS <= 0) return suma;
    const udzial = Math.min(1, (czasS - r.startS) / r.trwanieS);
    return suma + r.populacjaCalkowita * udzial;
  }, 0);
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
  const rekrutacje = osRekrutacjiBezPrzestojow(plan);
  const suma = { drewno: 0, glina: 0, zelazo: 0 };
  if (os.length === 0 && rekrutacje.length === 0) return { suma, doKonca: true };

  const koniecBudowyS = os.length ? os[os.length - 1].startS + os[os.length - 1].trwanieS : 0;
  const koniecRekrutacjiS = rekrutacje.reduce((maks, r) => Math.max(maks, r.koniecS), 0);
  const koniecOsi = Math.max(koniecBudowyS, koniecRekrutacjiS);

  if (indeksKrokuLubNull !== null && !os[indeksKrokuLubNull]) return { suma, doKonca: true };
  // Przy null odnosimy sie do startu ostatniego kroku budowy (tak jak wczesniej,
  // bez rekrutacji) — gdy planu budowy nie ma wcale, jedynym punktem
  // odniesienia jest poczatek osi.
  const T = indeksKrokuLubNull === null
    ? (os.length ? os[os.length - 1].startS : 0)
    : os[indeksKrokuLubNull].startS;

  const doKonca = T + DOBA_S >= koniecOsi;
  const gorna = doKonca ? koniecOsi : T + DOBA_S;

  for (const w of os) {
    if (w.startS >= T && w.startS < gorna) {
      for (const r of SUROWCE_Z) suma[r] += w.koszt[r];
    }
  }
  for (const r of rekrutacje) {
    const udzial = udzialWOknie(r, T, gorna);
    if (udzial <= 0) continue;
    for (const su of SUROWCE_Z) suma[su] += r.kosztCalkowity[su] * udzial;
  }
  return { suma, doKonca };
}

export function zapotrzebowanieDzienne(plan) {
  const os = osBezPrzestojow(plan);
  const rekrutacje = osRekrutacjiBezPrzestojow(plan);
  if (os.length === 0 && rekrutacje.length === 0) return [];

  const koniecBudowyS = os.length ? os[os.length - 1].startS + os[os.length - 1].trwanieS : 0;
  const koniecRekrutacjiS = rekrutacje.reduce((maks, r) => Math.max(maks, r.koniecS), 0);
  const czasNettoS = Math.max(koniecBudowyS, koniecRekrutacjiS);
  const liczbaDni = Math.max(1, Math.ceil(czasNettoS / DOBA_S));

  const dni = [];
  for (let i = 0; i < liczbaDni; i++) {
    dni.push({ dzien: i, drewno: 0, glina: 0, zelazo: 0, liczbaKrokow: 0, rekrutacje: [] });
  }

  for (const wiersz of os) {
    const indeksDnia = Math.floor(wiersz.startS / DOBA_S);
    const cel = dni[indeksDnia];
    cel.liczbaKrokow += 1;
    for (const r of SUROWCE_Z) cel[r] += wiersz.koszt[r];
  }

  // Rekrutacja moze rozciagac sie na wiele dni naraz — kazdy dzien dostaje
  // proporcjonalny wycinek jej kosztu wg czasu, ktory w nim faktycznie splynal.
  rekrutacje.forEach((r, idx) => {
    const pierwszyDzien = Math.max(0, Math.floor(r.startS / DOBA_S));
    const ostatniDzien = Math.min(dni.length - 1, Math.floor(Math.max(r.startS, r.koniecS - 1) / DOBA_S));
    for (let d = pierwszyDzien; d <= ostatniDzien; d++) {
      const udzial = udzialWOknie(r, d * DOBA_S, (d + 1) * DOBA_S);
      if (udzial <= 0) continue;
      const cel = dni[d];
      for (const su of SUROWCE_Z) cel[su] += r.kosztCalkowity[su] * udzial;
      cel.rekrutacje.push({ indeks: idx, jednostka: r.jednostka, sztuk: Math.round(r.ilosc * udzial) });
    }
  });

  return dni;
}

// Ludnosc zajeta przez budynki na dany moment osi bez przestojow — poziomy
// najnowszego kroku budowy, ktorego start juz minal.
function poziomyNaCzas(os, poziomyStart, czasS) {
  const poziomy = { ...poziomyStart };
  for (const w of os) {
    if (w.startS > czasS) break;
    poziomy[w.budynek] = w.doPoziomu;
  }
  return poziomy;
}

// Rekrutacja nie ma przestojow (patrz naglowek pliku), wiec jej jedyny
// mozliwy problem z populacja to przekroczenie limitu Zagrody. Populacja
// rosnie monotonicznie, wiec wystarczy sprawdzic szczyt na koncu kazdego
// wpisu rekrutacji — wczesniej w jego trakcie zajete miejsce jest mniejsze.
export function ostrzezeniaRekrutacji(plan) {
  const s = swiat(plan.swiat);
  const os = osBezPrzestojow(plan);
  const rekrutacje = osRekrutacjiBezPrzestojow(plan);
  const budynki = budynkiSwiata(s);
  const ostrzezenia = [];

  rekrutacje.forEach((r, idx) => {
    const poziomy = poziomyNaCzas(os, plan.start.poziomy, r.koniecS);
    const ludnoscBudynkow = budynki.reduce((suma, b) => suma + ludnoscPoziomu(s, b, poziomy[b] ?? 0), 0);
    const ludnoscCalkowita = ludnoscBudynkow + ludnoscRekrutacjiDoCzasu(plan, r.koniecS);
    const limit = maksLudnosc(poziomy.zagroda ?? 1);
    if (ludnoscCalkowita > limit) {
      ostrzezenia.push({
        typ: 'rekrutacja-ponad-zagrode', rekrutacja: idx,
        tekst: `Rekrutacja ${idx + 1}: ${r.ilosc}× ${NAZWY_JEDNOSTEK[r.jednostka] ?? r.jednostka} wymaga `
          + `${Math.round(ludnoscCalkowita)} ludności łącznie, a Zagroda ${poziomy.zagroda ?? 1} daje ${limit}.`,
      });
    }
  });

  return ostrzezenia;
}
