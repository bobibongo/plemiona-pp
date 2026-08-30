// src/wioska/widok-bilans.js
// Bilans zaopatrzenia dla wskazanego momentu: trzy strumienie dochodu
// (eko, farma, zbieractwo), ich suma, zuzycie na dobe liczone po osi bez
// przestojow, i roznica — ile na dobe brakuje albo zostaje.

import { produkcjaGodzinowa, pojemnosc } from './tabele.js';
import { zuzycieNaDobe, osBezPrzestojow, zapotrzebowanieDzienne, kosztyDoMomentu } from './zapotrzebowanie.js';
import { esc } from './widok-budynki.js';
import { swiat } from './swiaty.js';
import { trojkaSurowcowHTML } from './widok-status.js';

const SUROWCE_B = ['drewno', 'glina', 'zelazo'];

// Kopia rozwiazywania kotwicy na indeks, analogiczna do symulacji, ale
// swiadomie osobna: widoki maja byc cienkie i nie ciagnac wewnetrznej,
// nieeksportowanej logiki silnika.
function indeksKotwicyWidoku(kotwica, kroki) {
  if (kotwica === null) return -1;
  return kroki.findIndex(k => k.budynek === kotwica.budynek && k.doPoziomu === kotwica.doPoziomu);
}

function sumaZrodla(plan, indeksAktywny, zrodlo) {
  const trafione = plan.dochody
    .map(d => ({ ...d, i: indeksKotwicyWidoku(d.kotwica, plan.kroki) }))
    .filter(d => d.zrodlo === zrodlo && d.i <= indeksAktywny)
    .sort((a, b) => a.i - b.i);
  // Tak jak w symulacji: kazde zrodlo ma jeden aktywny wpis naraz, ostatni
  // w kolejnosci indeksu kotwicy wygrywa.
  return trafione.length ? trafione[trafione.length - 1].sumaD : 0;
}

function dosylkiDoIndeksu(plan, indeks) {
  const suma = { drewno: 0, glina: 0, zelazo: 0 };
  for (const z of plan.zastrzyki) {
    const i = indeksKotwicyWidoku(z.kotwica, plan.kroki);
    if (i <= indeks) for (const r of SUROWCE_B) suma[r] += z[r];
  }
  return suma;
}

// Przeplyw dosylek przez kolejne doby. Dosylka nie znika w dniu, w ktorym
// wpadla: pokrywa deficyt tego dnia, a reszta zostaje zapasem i ratuje dni
// nastepne. Dodatni bilans tez powieksza zapas, ale calosc jest przycieta do
// pojemnosci spichlerza z danego dnia — tak jak w grze nadmiar przepada.
//
// Wejscie: [{ dzien, bilansSurowy:{d,g,z}, dosylka:{d,g,z}|null, sufit }]
// Wyjscie: to samo + { zapasPo, niedobor, zmarnowane, brakujeSurowca }.
export function przeniesDosylki(dni) {
  const zapas = { drewno: 0, glina: 0, zelazo: 0 };
  return dni.map(d => {
    const niedobor = { drewno: 0, glina: 0, zelazo: 0 };
    const uzyte = { drewno: 0, glina: 0, zelazo: 0 };
    for (const r of SUROWCE_B) {
      // Dosylka wpada do zapasu; zapas pokrywa WYLACZNIE ujemne saldo doby.
      // Dodatni bilans nie powieksza zapasu — produkcja i tak jest zjadana
      // przez kolejke, a mieszanie jej z dosylkami dawaloby fikcyjna nadwyzke.
      zapas[r] += d.dosylka ? d.dosylka[r] : 0;
      const deficyt = d.bilansSurowy[r] < 0 ? -d.bilansSurowy[r] : 0;
      if (deficyt > 0) {
        const pobrane = Math.min(zapas[r], deficyt);
        zapas[r] -= pobrane;
        uzyte[r] = pobrane;
        niedobor[r] = deficyt - pobrane;
      }
    }
    return {
      ...d,
      zapasPo: { ...zapas },
      uzyte,
      niedobor,
      brakujeSurowca: SUROWCE_B.some(r => niedobor[r] > 0),
    };
  });
}

// Koszt samej BUDOWY w tym samym oknie, ktore obejmuje zuzycieNaDobe:
// doba od startu wskazanego kroku, albo ogon do konca planu.
function zuzycieBudowyWOknie(plan, indeksKrokuLubNull) {
  const os = osBezPrzestojow(plan);
  const suma = { drewno: 0, glina: 0, zelazo: 0 };
  if (os.length === 0) return suma;
  const koniecOsi = os[os.length - 1].startS + os[os.length - 1].trwanieS;
  const T = indeksKrokuLubNull === null || !os[indeksKrokuLubNull]
    ? os[os.length - 1].startS
    : os[indeksKrokuLubNull].startS;
  const gorna = T + 86400 >= koniecOsi ? koniecOsi : T + 86400;
  for (const w of os) {
    if (w.startS >= T && w.startS < gorna) {
      for (const r of SUROWCE_B) suma[r] += w.koszt[r];
    }
  }
  return suma;
}

// Bilans doba po dobie dla calego planu: dochod (eko + farma + zbieractwo)
// minus zuzycie (budowa + rekrutacja), z dosylkami przenoszonymi przez
// kolejne dni. Poziomy budynkow i aktywne zrodla dochodu bierzemy ze stanu
// na poczatek doby — tak samo jak robi to symulacja dla kroku.
export function bilansDzienny(plan, wynik) {
  const s = swiat(plan.swiat);
  const os = osBezPrzestojow(plan);
  const dniZuzycia = zapotrzebowanieDzienne(plan);
  if (dniZuzycia.length === 0) return [];

  // Indeks ostatniego kroku rozpoczetego przed poczatkiem danej doby —
  // wyznacza poziomy kopaln i aktywne wpisy dochodu.
  const ostatniKrokPrzed = (czasS) => {
    let idx = -1;
    for (let i = 0; i < os.length; i++) {
      if (os[i].startS < czasS) idx = i; else break;
    }
    return idx;
  };

  const poziomyPoKroku = (idx) => (idx < 0
    ? { ...plan.start.poziomy }
    : (wynik.kroki[idx]?.poziomyPo ?? { ...plan.start.poziomy }));

  // Dosylki trafiaja do doby, w ktorej konczy sie ich krok-kotwica.
  const dosylkiDnia = new Map();
  for (const z of plan.zastrzyki) {
    const i = indeksKotwicyWidoku(z.kotwica, plan.kroki);
    const czasS = i < 0 ? 0 : (os[i] ? os[i].startS + os[i].trwanieS : 0);
    const dzien = Math.floor(czasS / 86400);
    const biezaca = dosylkiDnia.get(dzien) ?? { drewno: 0, glina: 0, zelazo: 0 };
    for (const r of SUROWCE_B) biezaca[r] += z[r];
    dosylkiDnia.set(dzien, biezaca);
  }

  // Rozbicie zuzycia doby na budowe i rekrutacje — obie czesci licza sie po
  // tej samej dobie kalendarzowej, co reszta kolumny.
  const budowaDnia = new Map();
  for (const w of os) {
    const d = Math.floor(w.startS / 86400);
    const cel = budowaDnia.get(d) ?? { drewno: 0, glina: 0, zelazo: 0 };
    for (const r of SUROWCE_B) cel[r] += w.koszt[r];
    budowaDnia.set(d, cel);
  }

  const wiersze = dniZuzycia.map(d => {
    const poczatekDobyS = d.dzien * 86400;
    const idx = ostatniKrokPrzed(poczatekDobyS);
    const poziomy = poziomyPoKroku(idx);
    const eko = {
      drewno: produkcjaGodzinowa(s, poziomy.tartak ?? 0) * 24,
      glina: produkcjaGodzinowa(s, poziomy.cegielnia ?? 0) * 24,
      zelazo: produkcjaGodzinowa(s, poziomy.huta ?? 0) * 24,
    };
    const farmaD = sumaZrodla(plan, idx, 'farma');
    const zbieractwoD = sumaZrodla(plan, idx, 'zbieractwo');
    const farma = { drewno: farmaD / 3, glina: farmaD / 3, zelazo: farmaD / 3 };
    const zbieractwo = { drewno: zbieractwoD / 3, glina: zbieractwoD / 3, zelazo: zbieractwoD / 3 };
    const budowa = budowaDnia.get(d.dzien) ?? { drewno: 0, glina: 0, zelazo: 0 };
    const rekrutacja = {};
    const dochod = {};
    const bilansSurowy = {};
    for (const r of SUROWCE_B) {
      // d[r] to cale zuzycie doby (budowa + rekrutacja) z zapotrzebowanieDzienne.
      rekrutacja[r] = Math.max(0, d[r] - budowa[r]);
      dochod[r] = eko[r] + farma[r] + zbieractwo[r];
      bilansSurowy[r] = dochod[r] - d[r];
    }
    return {
      dzien: d.dzien,
      eko, farma, zbieractwo, dochod,
      budowa, rekrutacja,
      zuzycie: { drewno: d.drewno, glina: d.glina, zelazo: d.zelazo },
      bilansSurowy,
      dosylka: dosylkiDnia.get(d.dzien) ?? null,
    };
  });

  return przeniesDosylki(wiersze);
}

export function bilansHTML(s, plan, wynik, zap, indeks) {
  const indeksAktywny = indeks === null ? plan.kroki.length - 1 : indeks;

  // Cala kolumna opisuje DOBE KALENDARZOWA, w ktorej lezy wskazany krok —
  // zgodnie z etykieta "doba: N". Wczesniej czesc liczb pochodzila z okna
  // "24h od startu kroku", przez co doba 1 potrafila pokazac rekrutacje
  // zaczynajaca sie dopiero doby 2.
  const osB = osBezPrzestojow(plan);
  const iOs = indeks === null ? osB.length - 1 : indeks;
  const dzienIdx = osB[iOs] ? Math.floor(osB[iOs].startS / 86400) : 0;
  const dzienNr = dzienIdx + 1;

  const przeplyw = bilansDzienny(plan, wynik);
  const stanDnia = przeplyw[dzienIdx] ?? null;

  const eko = stanDnia ? stanDnia.eko : { drewno: 0, glina: 0, zelazo: 0 };
  const farma = stanDnia ? stanDnia.farma : { drewno: 0, glina: 0, zelazo: 0 };
  const zbieractwo = stanDnia ? stanDnia.zbieractwo : { drewno: 0, glina: 0, zelazo: 0 };
  const zuzycieBudowa = stanDnia ? stanDnia.budowa : { drewno: 0, glina: 0, zelazo: 0 };
  const zuzycieRekrutacja = stanDnia ? stanDnia.rekrutacja : { drewno: 0, glina: 0, zelazo: 0 };
  const dosylkaDnia = stanDnia ? stanDnia.dosylka : null;
  const zZapasu = stanDnia ? stanDnia.uzyte : { drewno: 0, glina: 0, zelazo: 0 };

  const zuzycieRazem = {};
  const dochodRazem = {};
  const bilans = {};
  for (const r of SUROWCE_B) {
    zuzycieRazem[r] = zuzycieBudowa[r] + zuzycieRekrutacja[r];
    // "Dosyłka" to paczka, ktora wpadla dzis; "Surowce z dosylki" to ile
    // realnie poszlo na pokrycie deficytu (moze pochodzic z dzisiejszej
    // paczki albo z zapasu po wczesniejszych). Do sumy liczy sie to drugie,
    // inaczej paczka wpadajaca dzis byla by policzona dwa razy.
    dochodRazem[r] = eko[r] + farma[r] + zbieractwo[r] + zZapasu[r];
    bilans[r] = dochodRazem[r] - zuzycieRazem[r];
  }

  const dos = dosylkiDoIndeksu(plan, indeksAktywny);
  const wiersz = (etykieta, w, klasa = '') => `<div class="z-ikonami ${klasa}"><b>${esc(etykieta)}</b> ${trojkaSurowcowHTML(w)}</div>`;
  const pustyWiersz = (etykieta) => `<div class="z-ikonami pusty"><b>${esc(etykieta)}</b> <span class="brak">—</span></div>`;
  const klasaBilansu = SUROWCE_B.some(r => bilans[r] < -0.5) ? 'bilans-ujemny' : '';
  const maZapas = SUROWCE_B.some(r => zZapasu[r] > 0.5);
  const zakres = `<span class="zakres zakres-doba">doba: ${dzienNr}</span>`;

  return [
    '<div class="bilans">',

    `<section class="sekcja">`,
    `<h4 class="sekcja-tytul">Dochód ${zakres}</h4>`,
    wiersz('EKO', eko),
    wiersz('Farma', farma),
    wiersz('Zbieractwo', zbieractwo),
    // Oba wiersze dosylkowe pokazujemy tylko wtedy, gdy naprawde sa: paczka
    // wpadajaca dzis, albo surowce zostawione przez wczesniejsza paczke.
    dosylkaDnia ? wiersz('Dosyłka', dosylkaDnia, 'wyroznik-dosylka') : '',
    maZapas ? wiersz('Surowce z dosyłki', zZapasu, 'wyroznik-dosylka') : '',
    `<div class="z-ikonami suma-kosztow"><b>Razem</b> ${trojkaSurowcowHTML(dochodRazem)}</div>`,
    `</section>`,

    `<section class="sekcja">`,
    `<h4 class="sekcja-tytul">Zużycie ${zakres}</h4>`,
    wiersz('Budowa', zuzycieBudowa),
    wiersz('Rekrutacja', zuzycieRekrutacja),
    `<div class="z-ikonami suma-kosztow"><b>Razem</b> ${trojkaSurowcowHTML(zuzycieRazem)}</div>`,
    `</section>`,

    `<section class="sekcja sekcja-bilans">`,
    `<h4 class="sekcja-tytul">Bilans ${zakres}</h4>`,
    `<div class="z-ikonami ${klasaBilansu}"><b>Saldo doby</b> ${trojkaSurowcowHTML(bilans)}</div>`,
    `</section>`,

    '</div>',
  ].filter(Boolean).join('');
}
