// src/wioska/kolejnosc-budynkow.js
// Jawna kolejnosc wyswietlania, wspolna dla tabeli budynkow i rzedu ikon
// w pasku stanu. Budynki jednorazowe sa na koncu listy.

import { budynkiSwiata } from './swiat.js';

const NA_KONIEC = ['plac', 'piedestal', 'palac'];

export function kolejnoscBudynkow(s) {
  const wszystkie = budynkiSwiata(s);
  return [
    ...wszystkie.filter(b => !NA_KONIEC.includes(b)),
    ...NA_KONIEC.filter(b => wszystkie.includes(b)),
  ];
}