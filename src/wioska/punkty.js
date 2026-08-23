// src/wioska/punkty.js
// Punkty za rozbudowe kazdego poziomu budynku, przepisane z oficjalnej wiki
// Plemion, dzial Budynki, sekcja "Tabela punktow". Wartosci sa takie same we
// wszystkich swiatach — w odroznieniu od kosztow i czasu budowy nie skaluja
// sie wedlug ustawien swiata.

const PUNKTY_ZA_POZIOM = {
  ratusz: [10, 2, 2, 3, 4, 4, 5, 6, 7, 9, 10, 12, 15, 18, 21, 26, 31, 37, 44, 53, 64, 77, 92, 110, 133, 159, 191, 229, 274, 330],
  koszary: [16, 3, 4, 5, 5, 7, 8, 9, 12, 14, 16, 20, 24, 28, 34, 42, 49, 59, 71, 85, 102, 123, 147, 177, 212],
  stajnia: [20, 4, 5, 6, 6, 9, 10, 12, 14, 17, 21, 25, 29, 36, 43, 51, 62, 74, 88, 107],
  warsztat: [24, 5, 6, 6, 9, 10, 12, 14, 17, 21, 25, 29, 36, 43, 51],
  kuznia: [19, 4, 4, 6, 6, 8, 10, 11, 14, 16, 20, 23, 28, 34, 41, 49, 58, 71, 84, 101],
  palac: [512],
  plac: [0],
  piedestal: [24],
  rynek: [10, 2, 2, 3, 4, 4, 5, 6, 7, 9, 10, 12, 15, 18, 21, 26, 31, 37, 44, 53, 64, 77, 92, 110, 133],
  tartak: [6, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38, 46, 55, 66, 80, 95, 115, 137, 165, 198],
  cegielnia: [6, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38, 46, 55, 66, 80, 95, 115, 137, 165, 198],
  huta: [6, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38, 46, 55, 66, 80, 95, 115, 137, 165, 198],
  zagroda: [5, 1, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38, 46, 55, 66, 80, 95, 115, 137, 163],
  spichlerz: [6, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38, 46, 55, 66, 80, 95, 115, 137, 165, 198],
  schowek: [5, 1, 1, 2, 1, 2, 3, 3, 3, 5],
  mur: [8, 2, 2, 2, 3, 3, 4, 5, 5, 7, 9, 9, 12, 15, 17, 20, 25, 29, 36, 43],
  wieza: [42, 8, 10, 13, 14, 18, 20, 25, 31, 36, 43, 52, 62, 75, 90, 108, 130, 155, 186, 224],
};

// Suma punktow za wszystkie poziomy budynku od 1 do `poziom` wlacznie.
export function punktyBudynku(budynek, poziom) {
  const tabela = PUNKTY_ZA_POZIOM[budynek];
  if (!tabela || poziom <= 0) return 0;
  let suma = 0;
  for (let p = 1; p <= poziom && p <= tabela.length; p++) suma += tabela[p - 1];
  return suma;
}

export function punktyWioski(poziomy) {
  return Object.keys(PUNKTY_ZA_POZIOM)
    .reduce((suma, b) => suma + punktyBudynku(b, poziomy[b] ?? 0), 0);
}
