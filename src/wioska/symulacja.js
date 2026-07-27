// src/wioska/symulacja.js
// Przebieg osi czasu. W wiosce buduje sie jeden budynek naraz, wiec kroki
// ida sekwencyjnie — liczba slotow kolejki nie zmienia laczonego czasu.

import { swiat } from './swiaty.js';
import { kosztPoziomu, ludnoscPoziomu, budynkiSwiata } from './swiat.js';
import { pojemnosc, maksLudnosc, produkcjaGodzinowa } from './tabele.js';
import { czasBudowy } from './czas.js';
import { brakujaceWymagania, opisWymagan } from './wymagania.js';
import { NAZWY, NAZWY_SUROWCOW } from './nazwy.js';
import { czasCzytelny } from './format.js';

const SUROWCE = ['drewno', 'glina', 'zelazo'];
// Prog, powyzej ktorego przestoj przestaje byc szumem i warto o nim powiedziec.
const PROG_PRZESTOJU_S = 3600;
// Tolerancja na blad zaokraglenia zmiennoprzecinkowego. Bez niej "starczy na
// koszt" potrafi zostac tuz ponizej progu (np. 59,999999999999986 zamiast 60)
// o kwote mniejsza niz precyzja dodawania do zegara — dt liczony wprost z tej
// reszty wtedy nie przesuwa juz czasu i petla nigdy sie nie konczy.
const EPS = 1e-6;

const zeroSurowce = () => ({ drewno: 0, glina: 0, zelazo: 0 });

function produkcjaNaSekunde(s, poziomy, dochod) {
  return {
    drewno: (produkcjaGodzinowa(s, poziomy.tartak ?? 0) + dochod.drewnoH) / 3600,
    glina: (produkcjaGodzinowa(s, poziomy.cegielnia ?? 0) + dochod.glinaH) / 3600,
    zelazo: (produkcjaGodzinowa(s, poziomy.huta ?? 0) + dochod.zelazoH) / 3600,
  };
}

// Dochod obowiazuje od swojego czasu do nastepnego wpisu. Przed pierwszym
// wpisem gracz nie ma zadnego dodatkowego zrodla.
function dochodWChwili(dochody, czas) {
  let biezacy = { czasS: 0, drewnoH: 0, glinaH: 0, zelazoH: 0 };
  for (const d of dochody) {
    if (d.czasS <= czas) biezacy = d; else break;
  }
  return biezacy;
}

function nastepneZdarzenie(plan, czas) {
  let naj = Infinity;
  for (const d of plan.dochody) if (d.czasS > czas && d.czasS < naj) naj = d.czasS;
  for (const z of plan.zastrzyki) if (z.czasS > czas && z.czasS < naj) naj = z.czasS;
  return naj;
}

function dolej(stan, ile, sufit) {
  for (const r of SUROWCE) {
    const suma = stan.zasoby[r] + ile[r];
    if (suma > sufit) {
      stan.zmarnowane[r] += suma - sufit;
      stan.zasoby[r] = sufit;
    } else {
      stan.zasoby[r] = suma;
    }
  }
}

export function symuluj(plan) {
  const s = swiat(plan.swiat);
  const poziomy = { ...plan.start.poziomy };
  const stan = {
    zasoby: { ...plan.start.surowce },
    zmarnowane: zeroSurowce(),
  };
  const zZastrzykow = zeroSurowce();
  const zastosowaneZastrzyki = new Set();
  let czas = 0;
  const kroki = [];
  const ostrzezenia = [];
  const koszt = zeroSurowce();
  let czasNiepewnyS = 0;

  const ludnoscZajeta = () => budynkiSwiata(s)
    .reduce((suma, b) => suma + ludnoscPoziomu(s, b, poziomy[b] ?? 0), 0);

  // Zastrzyki wpadaja dokladnie w swoim czasie; kazdy tylko raz.
  const wpuscZastrzyki = (doCzasu, sufit) => {
    for (let i = 0; i < plan.zastrzyki.length; i++) {
      const z = plan.zastrzyki[i];
      if (zastosowaneZastrzyki.has(i) || z.czasS > doCzasu) continue;
      zastosowaneZastrzyki.add(i);
      dolej(stan, { drewno: z.drewno, glina: z.glina, zelazo: z.zelazo }, sufit);
      for (const r of SUROWCE) zZastrzykow[r] += z[r];
    }
  };

  plan.kroki.forEach((krok, i) => {
    const sufit = pojemnosc(poziomy.spichlerz ?? 1);
    const wpis = {
      budynek: krok.budynek,
      doPoziomu: krok.doPoziomu,
      startS: czas,
      czekanieS: 0,
      czekanieNa: null,
      trwanieS: 0,
      koniecS: czas,
      koszt: zeroSurowce(),
      pewny: true,
      zasobyPo: { ...stan.zasoby },
      ludnoscPo: ludnoscZajeta(),
      blad: null,
    };

    const brak = brakujaceWymagania(krok.budynek, poziomy);
    if (brak.length) {
      wpis.blad = 'wymagania';
      ostrzezenia.push({ typ: 'wymagania', krok: i, tekst: `Krok ${i + 1}: ${opisWymagan(brak, NAZWY)}` });
      kroki.push(wpis);
      return;
    }

    const c = kosztPoziomu(s, krok.budynek, krok.doPoziomu);
    wpis.koszt = c;

    if (SUROWCE.some(r => c[r] > sufit)) {
      wpis.blad = 'ponad-spichlerz';
      ostrzezenia.push({
        typ: 'ponad-spichlerz', krok: i,
        tekst: `Krok ${i + 1}: ${NAZWY[krok.budynek]} ${krok.doPoziomu} kosztuje więcej, niż mieści Spichlerz ${poziomy.spichlerz} (${sufit}). Rozbuduj Spichlerz wcześniej.`,
      });
      kroki.push(wpis);
      return;
    }

    const ludnoscPo = ludnoscZajeta()
      - ludnoscPoziomu(s, krok.budynek, poziomy[krok.budynek] ?? 0)
      + ludnoscPoziomu(s, krok.budynek, krok.doPoziomu);
    const limit = maksLudnosc(poziomy.zagroda ?? 1);
    if (ludnoscPo > limit) {
      wpis.blad = 'ponad-zagrode';
      ostrzezenia.push({
        typ: 'ponad-zagrode', krok: i,
        tekst: `Krok ${i + 1}: ${NAZWY[krok.budynek]} ${krok.doPoziomu} wymaga ${ludnoscPo} ludności, a Zagroda ${poziomy.zagroda} daje ${limit}.`,
      });
      kroki.push(wpis);
      return;
    }

    // Przesuwaj zegar skokami miedzy zdarzeniami, az stac na krok.
    const poczatek = czas;
    let czekanieNa = null;
    // Zapamietane przed czekaniem: przelanie magazynu potrafi zdarzyc sie
    // zarowno w tej fazie, jak i pozniej w trakcie budowy — porownanie na
    // koncu kroku ma objac obie.
    const zmarnowanePrzed = SUROWCE.reduce((sum, r) => sum + stan.zmarnowane[r], 0);
    wpuscZastrzyki(czas, sufit);
    for (;;) {
      if (SUROWCE.every(r => stan.zasoby[r] >= c[r] - EPS)) break;
      const stawka = produkcjaNaSekunde(s, poziomy, dochodWChwili(plan.dochody, czas));
      let potrzebaS = 0;
      for (const r of SUROWCE) {
        const brakuje = c[r] - stan.zasoby[r];
        if (brakuje <= 0) continue;
        const dt = stawka[r] > 0 ? brakuje / stawka[r] : Infinity;
        if (dt > potrzebaS) { potrzebaS = dt; czekanieNa = r; }
      }
      const zdarzenie = nastepneZdarzenie(plan, czas);
      if (potrzebaS === Infinity && zdarzenie === Infinity) {
        wpis.blad = 'brak-dochodu';
        ostrzezenia.push({
          typ: 'przestoj', krok: i,
          tekst: `Krok ${i + 1}: przy zerowej produkcji ${czekanieNa} tego kroku nie da się nigdy opłacić.`,
        });
        break;
      }
      const doCzasu = Math.min(czas + potrzebaS, zdarzenie);
      const dt = doCzasu - czas;
      dolej(stan, {
        drewno: stawka.drewno * dt, glina: stawka.glina * dt, zelazo: stawka.zelazo * dt,
      }, sufit);
      czas = doCzasu;
      wpuscZastrzyki(czas, sufit);
    }

    if (wpis.blad) { kroki.push(wpis); return; }

    wpis.czekanieS = Math.round(czas - poczatek);
    wpis.czekanieNa = wpis.czekanieS > 0 ? czekanieNa : null;
    wpis.startS = Math.round(czas);
    if (wpis.czekanieS >= PROG_PRZESTOJU_S) {
      ostrzezenia.push({
        typ: 'przestoj', krok: i,
        tekst: `Krok ${i + 1}: ${czasCzytelny(wpis.czekanieS)} przestoju w oczekiwaniu na ${NAZWY_SUROWCOW[czekanieNa] ?? czekanieNa}.`,
      });
    }
    for (const r of SUROWCE) { stan.zasoby[r] = Math.max(0, stan.zasoby[r] - c[r]); koszt[r] += c[r]; }

    const { sekundy, pewny } = czasBudowy(s, krok.budynek, krok.doPoziomu, poziomy.ratusz ?? 1);
    wpis.trwanieS = sekundy;
    wpis.pewny = pewny;
    if (!pewny) czasNiepewnyS += sekundy;

    // Produkcja plynie takze w trakcie budowy. Stawka liczona osobno w kazdym
    // segmencie miedzy zdarzeniami — dochod gracza potrafi zmienic sie w
    // srodku okna budowy, wiec jednorazowe przeliczenie na starcie kroku
    // pomijaloby te zmiane.
    const koniec = czas + sekundy;
    let biezacy = czas;
    for (;;) {
      const stawka = produkcjaNaSekunde(s, poziomy, dochodWChwili(plan.dochody, biezacy));
      const zdarzenie = Math.min(nastepneZdarzenie(plan, biezacy), koniec);
      const dt = zdarzenie - biezacy;
      dolej(stan, {
        drewno: stawka.drewno * dt, glina: stawka.glina * dt, zelazo: stawka.zelazo * dt,
      }, sufit);
      biezacy = zdarzenie;
      wpuscZastrzyki(biezacy, sufit);
      if (biezacy >= koniec) break;
    }
    czas = koniec;

    // Ostrzegamy raz, ale dopiero po fazie budowy — magazyn potrafi przelac
    // sie wylacznie w jej trakcie, gdy na krok stac od reki i nie bylo
    // oczekiwania, wiec sprawdzenie sprzed fazy budowy by to przegapilo.
    const zmarnowanePo = SUROWCE.reduce((sum, r) => sum + stan.zmarnowane[r], 0);
    if (zmarnowanePo > zmarnowanePrzed && !ostrzezenia.some(o => o.typ === 'przepelnienie')) {
      ostrzezenia.push({
        typ: 'przepelnienie', krok: i,
        tekst: 'Spichlerz się przepełnia — część produkcji przepada. Rozbuduj go wcześniej.',
      });
    }

    poziomy[krok.budynek] = krok.doPoziomu;
    wpis.koniecS = Math.round(czas);
    wpis.zasobyPo = { ...stan.zasoby };
    wpis.ludnoscPo = ludnoscZajeta();
    kroki.push(wpis);
  });

  return {
    kroki,
    ostrzezenia,
    podsumowanie: {
      czasS: Math.round(czas),
      koszt,
      zZastrzykow,
      zmarnowane: {
        drewno: Math.round(stan.zmarnowane.drewno),
        glina: Math.round(stan.zmarnowane.glina),
        zelazo: Math.round(stan.zmarnowane.zelazo),
      },
      czasNiepewnyS,
    },
  };
}
