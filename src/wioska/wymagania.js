// src/wioska/wymagania.js

import { WYMAGANIA } from './wymagania-dane.js';

// Pusta lista znaczy „mozna budowac". Kolejnosc wynikow idzie za kolejnoscia
// wpisow w WYMAGANIA, zeby komunikat byl zawsze taki sam.
export function brakujaceWymagania(budynek, poziomy) {
  const wym = WYMAGANIA[budynek];
  if (!wym) return [];
  const brak = [];
  for (const [wymagany, poziom] of Object.entries(wym)) {
    if ((poziomy[wymagany] ?? 0) < poziom) brak.push({ budynek: wymagany, poziom });
  }
  return brak;
}

export function opisWymagan(brakujace, nazwy) {
  if (!brakujace.length) return '';
  const czesci = brakujace.map(b => `${nazwy[b.budynek] ?? b.budynek} ${b.poziom}`);
  return `Wymaga: ${czesci.join(', ')}`;
}
