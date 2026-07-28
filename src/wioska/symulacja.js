// src/wioska/symulacja.js
// Przebieg osi czasu. W wiosce buduje sie jeden budynek naraz, wiec kroki
// ida sekwencyjnie — liczba slotow kolejki nie zmienia laczonego czasu.
// Dochod i dosylki sa przypiete do krokow (kotwica), nie do czasu — dochod
// obowiazujacy w trakcie kroku i to ostatni wpis o indeksie <= i, a wtracenia
// przypiete do kroku i staja sie aktywne dopiero PO jego ukonczeniu.

import { swiat } from './swiaty.js';
import { kosztPoziomu, ludnoscPoziomu, budynkiSwiata } from './swiat.js';
import { pojemnosc, maksLudnosc, produkcjaGodzinowa } from './tabele.js';
import { czasBudowy } from './czas.js';
import { brakujaceWymagania, opisWymagan } from './wymagania.js';
import { NAZWY } from './nazwy.js';

const SUROWCE = ['drewno', 'glina', 'zelazo'];
// Tolerancja na blad zaokraglenia zmiennoprzecinkowego. Bez niej "starczy na
// koszt" potrafi zostac tuz ponizej progu o kwote mniejsza niz precyzja
// dodawania do zegara, i petla nigdy sie nie konczy.
const EPS = 1e-6;

const zeroSurowce = () => ({ drewno: 0, glina: 0, zelazo: 0 });

// Kotwica -> indeks kroku w plan.kroki. null = przed pierwszym krokiem (-1).
// Kotwica wskazujaca krok nieobecny w planie (mozliwe tylko przy recznie
// edytowanym JSON) rozwiazuje sie do -1 — to siatka bezpieczenstwa, nie
// sciezka uzywana przez interfejs.
function indeksKotwicy(kotwica, kroki) {
  if (kotwica === null) return -1;
  const i = kroki.findIndex(k => k.budynek === kotwica.budynek && k.doPoziomu === kotwica.doPoziomu);
  return i;
}

// Farma i zbieractwo sa niezaleznymi strumieniami. W kazdym z nich ostatni
// aktywny wpis wygrywa, a oba aktywne strumienie sumuja sie w produkcji.
function sumaAktywnychDochodow(posortowane, indeksBiezacy) {
  const aktywne = { farma: 0, zbieractwo: 0 };
  for (const w of posortowane) {
    if (w.indeksKotwicy > indeksBiezacy) break;
    aktywne[w.zrodlo === 'zbieractwo' ? 'zbieractwo' : 'farma'] = w.sumaD;
  }
  return aktywne.farma + aktywne.zbieractwo;
}

function produkcjaNaSekunde(s, poziomy, sumaD) {
  return {
    drewno: produkcjaGodzinowa(s, poziomy.tartak ?? 0) / 3600 + sumaD / 3 / 86400,
    glina: produkcjaGodzinowa(s, poziomy.cegielnia ?? 0) / 3600 + sumaD / 3 / 86400,
    zelazo: produkcjaGodzinowa(s, poziomy.huta ?? 0) / 3600 + sumaD / 3 / 86400,
  };
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
  const kroki = [];
  const ostrzezenia = [];
  const koszt = zeroSurowce();
  let czasNiepewnyS = 0;
  let czas = 0;

  const dochody = plan.dochody
    .map(d => ({ ...d, indeksKotwicy: indeksKotwicy(d.kotwica, plan.kroki) }))
    .sort((a, b) => a.indeksKotwicy - b.indeksKotwicy);
  const zastrzyki = plan.zastrzyki
    .map(z => ({ ...z, indeksKotwicy: indeksKotwicy(z.kotwica, plan.kroki) }))
    .sort((a, b) => a.indeksKotwicy - b.indeksKotwicy);
  const zastosowaneZastrzyki = new Set();

  const ludnoscZajeta = () => budynkiSwiata(s)
    .reduce((suma, b) => suma + ludnoscPoziomu(s, b, poziomy[b] ?? 0), 0);

  // Dosylki przypiete do indeksu <= indeksBiezacy wpadaja dokladnie raz.
  const wpuscZastrzyki = (indeksBiezacy, sufit) => {
    zastrzyki.forEach((z, idx) => {
      if (zastosowaneZastrzyki.has(idx) || z.indeksKotwicy > indeksBiezacy) return;
      zastosowaneZastrzyki.add(idx);
      dolej(stan, { drewno: z.drewno, glina: z.glina, zelazo: z.zelazo }, sufit);
      for (const r of SUROWCE) zZastrzykow[r] += z[r];
    });
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
      poziomyPo: { ...poziomy },
      blad: null,
    };

    // Dochod i dosylki przypiete do kroku i-1 lub wczesniej dzialaja juz
    // podczas kroku i (czyli PO ukonczeniu poprzedniego kroku); przypiete
    // do kroku i same jeszcze nie dzialaja w jego trakcie.
    const indeksAktywny = i - 1;
    wpuscZastrzyki(indeksAktywny, sufit);

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

    // Przesuwaj zegar w krokach czasowych, az stac na koszt. Stawka jest
    // stala w trakcie oczekiwania na dany krok (dochod nie zmienia sie
    // wewnatrz trwania jednego kroku), wiec nie trzeba juz dzielic petli
    // na segmenty wedlug zdarzen czasowych.
    const poczatek = czas;
    let czekanieNa = null;
    const zmarnowanePrzed = SUROWCE.reduce((sum, r) => sum + stan.zmarnowane[r], 0);
    const sumaD = sumaAktywnychDochodow(dochody, indeksAktywny);
    const stawka = produkcjaNaSekunde(s, poziomy, sumaD);
    for (;;) {
      if (SUROWCE.every(r => stan.zasoby[r] >= c[r] - EPS)) break;
      let potrzebaS = 0;
      for (const r of SUROWCE) {
        const brakuje = c[r] - stan.zasoby[r];
        if (brakuje <= 0) continue;
        const dt = stawka[r] > 0 ? brakuje / stawka[r] : Infinity;
        if (dt > potrzebaS) { potrzebaS = dt; czekanieNa = r; }
      }
      if (potrzebaS === Infinity) {
        wpis.blad = 'brak-dochodu';
        ostrzezenia.push({
          typ: 'przestoj', krok: i,
          tekst: `Krok ${i + 1}: przy zerowej produkcji ${czekanieNa} tego kroku nie da się nigdy opłacić.`,
        });
        break;
      }
      dolej(stan, {
        drewno: stawka.drewno * potrzebaS, glina: stawka.glina * potrzebaS, zelazo: stawka.zelazo * potrzebaS,
      }, sufit);
      czas += potrzebaS;
    }

    if (wpis.blad) { kroki.push(wpis); return; }

    wpis.czekanieS = Math.round(czas - poczatek);
    wpis.czekanieNa = wpis.czekanieS > 0 ? czekanieNa : null;
    wpis.startS = Math.round(czas);
    for (const r of SUROWCE) { stan.zasoby[r] = Math.max(0, stan.zasoby[r] - c[r]); koszt[r] += c[r]; }

    const { sekundy, pewny } = czasBudowy(s, krok.budynek, krok.doPoziomu, poziomy.ratusz ?? 1);
    wpis.trwanieS = sekundy;
    wpis.pewny = pewny;
    if (!pewny) czasNiepewnyS += sekundy;

    // Produkcja plynie takze w trakcie budowy, ta sama stawka co w oczekiwaniu
    // — dochod przypiety do tego kroku zacznie dzialac dopiero po jego koncu.
    dolej(stan, {
      drewno: stawka.drewno * sekundy, glina: stawka.glina * sekundy, zelazo: stawka.zelazo * sekundy,
    }, sufit);
    czas += sekundy;

    // Ostrzegamy raz, ale dopiero po fazie budowy — magazyn potrafi przelac
    // sie wylacznie w jej trakcie, gdy na krok stac od reki i nie bylo
    // oczekiwania.
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
    wpis.poziomyPo = { ...poziomy };
    kroki.push(wpis);

    // Dosylki przypiete do tego kroku wpadaja teraz, po jego ukonczeniu —
    // zanim ruszy oczekiwanie na krok nastepny.
    wpuscZastrzyki(i, pojemnosc(poziomy.spichlerz ?? 1));
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
