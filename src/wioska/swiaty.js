// src/wioska/swiaty.js
// Dane swiatow generowane przez tools/fetch-swiat.js z publicznych endpointow
// interface.php. Nie edytowac recznie — zmiany nadpisze kolejne uruchomienie.
// Tabele kosztow nie sa tu zapisywane: licza sie ze wzoru baza x mnoznik^(poziom-1).

export const SWIATY = {
  pl231: {
    kod: 'pl231',
    nazwa: 'Świat 231',
    predkosc: 1,
    predkoscJednostek: 1,
    produkcjaBazowa: 30,
    wzorCzasu: 2,
    budynki: {
      ratusz:    { kod: 'main',       maks: 30, min: 1, drewno: 90,    glina: 80,    zelazo: 70,    pop: 5,   fDrewno: 1.26,  fGlina: 1.275, fZelazo: 1.26,  fPop: 1.17,  czas: 900 },
      koszary:   { kod: 'barracks',   maks: 25, min: 0, drewno: 200,   glina: 170,   zelazo: 90,    pop: 7,   fDrewno: 1.26,  fGlina: 1.28,  fZelazo: 1.26,  fPop: 1.17,  czas: 1800 },
      stajnia:   { kod: 'stable',     maks: 20, min: 0, drewno: 270,   glina: 240,   zelazo: 260,   pop: 8,   fDrewno: 1.26,  fGlina: 1.28,  fZelazo: 1.26,  fPop: 1.17,  czas: 6000 },
      warsztat:  { kod: 'garage',     maks: 15, min: 0, drewno: 300,   glina: 240,   zelazo: 260,   pop: 8,   fDrewno: 1.26,  fGlina: 1.28,  fZelazo: 1.26,  fPop: 1.17,  czas: 6000 },
      kuznia:    { kod: 'smith',      maks: 20, min: 0, drewno: 220,   glina: 180,   zelazo: 240,   pop: 20,  fDrewno: 1.26,  fGlina: 1.275, fZelazo: 1.26,  fPop: 1.17,  czas: 6000 },
      palac:     { kod: 'snob',       maks: 1,  min: 0, drewno: 15000, glina: 25000, zelazo: 10000, pop: 80,  fDrewno: 2,     fGlina: 2,     fZelazo: 2,     fPop: 1.17,  czas: 586800 },
      plac:      { kod: 'place',      maks: 1,  min: 0, drewno: 10,    glina: 40,    zelazo: 30,    pop: 0,   fDrewno: 1.26,  fGlina: 1.275, fZelazo: 1.26,  fPop: 1.17,  czas: 10860 },
      piedestal: { kod: 'statue',     maks: 1,  min: 0, drewno: 220,   glina: 220,   zelazo: 220,   pop: 10,  fDrewno: 1.26,  fGlina: 1.275, fZelazo: 1.26,  fPop: 1.17,  czas: 1500 },
      rynek:     { kod: 'market',     maks: 25, min: 0, drewno: 100,   glina: 100,   zelazo: 100,   pop: 20,  fDrewno: 1.26,  fGlina: 1.275, fZelazo: 1.26,  fPop: 1.17,  czas: 2700 },
      tartak:    { kod: 'wood',       maks: 30, min: 0, drewno: 50,    glina: 60,    zelazo: 40,    pop: 5,   fDrewno: 1.25,  fGlina: 1.275, fZelazo: 1.245, fPop: 1.155, czas: 900 },
      cegielnia: { kod: 'stone',      maks: 30, min: 0, drewno: 65,    glina: 50,    zelazo: 40,    pop: 10,  fDrewno: 1.27,  fGlina: 1.265, fZelazo: 1.24,  fPop: 1.14,  czas: 900 },
      huta:      { kod: 'iron',       maks: 30, min: 0, drewno: 75,    glina: 65,    zelazo: 70,    pop: 10,  fDrewno: 1.252, fGlina: 1.275, fZelazo: 1.24,  fPop: 1.17,  czas: 1080 },
      zagroda:   { kod: 'farm',       maks: 30, min: 1, drewno: 45,    glina: 40,    zelazo: 30,    pop: 0,   fDrewno: 1.3,   fGlina: 1.32,  fZelazo: 1.29,  fPop: 1,     czas: 1200 },
      spichlerz: { kod: 'storage',    maks: 30, min: 1, drewno: 60,    glina: 50,    zelazo: 40,    pop: 0,   fDrewno: 1.265, fGlina: 1.27,  fZelazo: 1.245, fPop: 1.15,  czas: 1020 },
      schowek:   { kod: 'hide',       maks: 10, min: 0, drewno: 50,    glina: 60,    zelazo: 50,    pop: 2,   fDrewno: 1.25,  fGlina: 1.25,  fZelazo: 1.25,  fPop: 1.17,  czas: 1800 },
      mur:       { kod: 'wall',       maks: 20, min: 0, drewno: 50,    glina: 100,   zelazo: 20,    pop: 5,   fDrewno: 1.26,  fGlina: 1.275, fZelazo: 1.26,  fPop: 1.17,  czas: 3600 },
      wieza:     { kod: 'watchtower', maks: 20, min: 0, drewno: 12000, glina: 14000, zelazo: 10000, pop: 500, fDrewno: 1.17,  fGlina: 1.17,  fZelazo: 1.18,  fPop: 1.18,  czas: 13200 },
    },
    // Koszty i czasy sa standardem TW (identyczne na wiekszosci swiatow);
    // budynek = ten, ktorego kolejka rekrutuje dana jednostke i ktorego
    // poziom przyspiesza rekrutacje wg wzoru w jednostki.js.
    jednostki: {
      pikinier:         { budynek: 'koszary', drewno: 50,    glina: 30,    zelazo: 10,    pop: 1,   czas: 1020 },
      miecznik:         { budynek: 'koszary', drewno: 30,    glina: 30,    zelazo: 70,    pop: 1,   czas: 1500 },
      topornik:         { budynek: 'koszary', drewno: 60,    glina: 30,    zelazo: 40,    pop: 1,   czas: 1320 },
      lucznik:          { budynek: 'koszary', drewno: 100,   glina: 30,    zelazo: 60,    pop: 1,   czas: 1800 },
      zwiadowca:        { budynek: 'stajnia', drewno: 50,    glina: 50,    zelazo: 20,    pop: 2,   czas: 900 },
      lekka:            { budynek: 'stajnia', drewno: 125,   glina: 100,   zelazo: 250,   pop: 4,   czas: 1800 },
      lucznikNaKoniu:   { budynek: 'stajnia', drewno: 250,   glina: 100,   zelazo: 150,   pop: 5,   czas: 2700 },
      ciezka:           { budynek: 'stajnia', drewno: 200,   glina: 150,   zelazo: 600,   pop: 6,   czas: 3600 },
      taran:            { budynek: 'warsztat', drewno: 300,  glina: 200,   zelazo: 200,   pop: 5,   czas: 4800 },
      katapulta:        { budynek: 'warsztat', drewno: 320,  glina: 400,   zelazo: 100,   pop: 8,   czas: 7200 },
    },
  },
};

export function swiat(kod) {
  const s = SWIATY[kod];
  if (!s) throw new Error(`Nieznany świat: ${kod}. Dostępne: ${Object.keys(SWIATY).join(', ')}`);
  return s;
}
