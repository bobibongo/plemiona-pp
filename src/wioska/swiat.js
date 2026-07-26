// src/wioska/swiat.js
// Wyprowadzenie kosztow i ludnosci z danych swiata. Gra liczy je ze wzoru,
// wiec my tez — dzieki temu dowolny swiat dziala bez wklejania tabel.

// Math.round(-0.5) daje -0, a gra zaokragla polowke zawsze w gore.
export function zaokr(x) {
  return Math.floor(x + 0.5);
}

function danegoBudynku(s, budynek) {
  const d = s.budynki[budynek];
  if (!d) throw new Error(`Budynek ${budynek} nie istnieje na świecie ${s.kod}`);
  return d;
}

export function kosztPoziomu(s, budynek, poziom) {
  const d = danegoBudynku(s, budynek);
  return {
    drewno: zaokr(d.drewno * d.fDrewno ** (poziom - 1)),
    glina: zaokr(d.glina * d.fGlina ** (poziom - 1)),
    zelazo: zaokr(d.zelazo * d.fZelazo ** (poziom - 1)),
  };
}

// Wartosc w tabeli gry jest skumulowana: to laczna ludnosc budynku na tym
// poziomie, a nie przyrost wzgledem poprzedniego.
export function ludnoscPoziomu(s, budynek, poziom) {
  const d = danegoBudynku(s, budynek);
  if (poziom <= 0 || d.pop === 0) return 0;
  return zaokr(d.pop * d.fPop ** (poziom - 1));
}

export function maksPoziom(s, budynek) {
  return danegoBudynku(s, budynek).maks;
}

// Budynek nieobecny w configu swiata jest na nim wylaczony (np. Kosciol na 231).
export function budynkiSwiata(s) {
  return Object.keys(s.budynki);
}

export function poziomyStartowe(s) {
  const p = {};
  for (const b of budynkiSwiata(s)) p[b] = s.budynki[b].min;
  return p;
}
