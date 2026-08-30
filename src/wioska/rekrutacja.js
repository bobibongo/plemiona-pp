// src/wioska/rekrutacja.js
// Model rekrutacji odwzorowujacy sposob, w jaki kolejke wypelnia Menedzer
// Konta: nie zamawia sie calej partii naraz, tylko paczkami stalej wielkosci
// (50 piechoty / 20 kawalerii / 10 machin), a kolejnosc paczek dobiera sie
// tak, zeby proporcje wojska ciagle zblizaly sie do docelowego skladu.
//
// Dzieki temu plan "7000 pik + 7000 luk" nie oznacza 7000 pikinierow, a
// dopiero potem lucznikow — obie jednostki rosna rownolegle, a jesli jedna
// ma juz przewage (np. 550 pik ze zbieractwa), najpierw nadrabia druga.

import { budynekJednostki } from './jednostki.js';

// Wielkosc paczki wg budynku, ktory produkuje jednostke.
export const ROZMIAR_PACZKI = Object.freeze({
  koszary: 50,   // piechota
  stajnia: 20,   // kawaleria (zwiad, LK, CK, LŁ)
  warsztat: 10,  // machiny (taran, katapulta)
});

export function rozmiarPaczki(s, jednostka) {
  return ROZMIAR_PACZKI[budynekJednostki(s, jednostka)] ?? 10;
}

// Kolejnosc paczek prowadzaca od stanu obecnego do celu.
//
// W kazdym kroku wybieramy jednostke NAJBARDZIEJ z tylu wzgledem swojego
// udzialu w docelowym skladzie. Miara jest postep wzgledny (ile juz mam / ile
// mam miec) — jednostka o najnizszym postepie dostaje kolejna paczke. To
// odtwarza zachowanie Menedzera: skoro 1000 pik juz stoi przy celu 5000+5000,
// pikinier ma postep 0,2, a lucznik 0 — wiec ida same luki, az sie zrownaja.
//
// `stan` to jednostki juz zrekrutowane (moga pochodzic z wczesniejszych
// wpisow planu); nadmiar ponad cel po prostu nie generuje paczek.
export function kolejnoscPaczek(s, cel, stan = {}) {
  const jednostki = Object.keys(cel).filter(j => (cel[j] ?? 0) > (stan[j] ?? 0));
  if (jednostki.length === 0) return [];

  const zrobione = {};
  const brakuje = {};
  for (const j of jednostki) {
    zrobione[j] = Math.min(stan[j] ?? 0, cel[j]);
    brakuje[j] = cel[j] - zrobione[j];
  }

  const paczki = [];
  // Petla konczy sie, bo kazdy obrot zdejmuje co najmniej jedna sztuke
  // z `brakuje`; limit to siatka bezpieczenstwa na wypadek bledu danych.
  const limit = Object.values(brakuje).reduce((a, b) => a + b, 0) + jednostki.length;
  for (let krok = 0; krok < limit; krok++) {
    let wybrana = null;
    let najnizszyPostep = Infinity;
    for (const j of jednostki) {
      if (brakuje[j] <= 0) continue;
      const postep = zrobione[j] / cel[j];
      // Remis rozstrzyga kolejnosc zadeklarowania — stabilnie i przewidywalnie.
      if (postep < najnizszyPostep - 1e-9) {
        najnizszyPostep = postep;
        wybrana = j;
      }
    }
    if (wybrana === null) break;
    const sztuk = Math.min(rozmiarPaczki(s, wybrana), brakuje[wybrana]);
    paczki.push({ jednostka: wybrana, sztuk, budynek: budynekJednostki(s, wybrana) });
    zrobione[wybrana] += sztuk;
    brakuje[wybrana] -= sztuk;
  }
  return paczki;
}
