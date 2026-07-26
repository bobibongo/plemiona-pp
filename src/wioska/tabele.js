// src/wioska/tabele.js
// Tabele niezalezne od swiata, przepisane z _share/budynki.xlsx i zweryfikowane
// wzgledem gry. Trzymamy tabele zamiast wzorow, bo najlepsze dopasowane wzory
// myla sie o jednostke na kilkunastu poziomach.

export const POJEMNOSC_SPICHLERZA = [
  1000, 1229, 1512, 1859, 2285, 2810, 3454, 4247, 5222, 6420,
  7893, 9705, 11932, 14670, 18037, 22177, 27266, 33523, 41217, 50675,
  62305, 76604, 94184, 115798, 142373, 175047, 215219, 264611, 325337, 400000,
];

export const MAKS_LUDNOSC_ZAGRODY = [
  240, 281, 329, 386, 452, 530, 622, 729, 854, 1002,
  1174, 1376, 1613, 1891, 2216, 2598, 3045, 3569, 4183, 4904,
  5748, 6737, 7896, 9255, 10848, 12715, 14904, 17469, 20476, 24000,
];

// Wartosci dla swiata o produkcjaBazowa = 30. Inne swiaty skaluja sie liniowo.
export const PRODUKCJA_H_BAZA30 = [
  30, 35, 41, 47, 55, 64, 74, 86, 100, 117,
  136, 158, 184, 214, 249, 289, 337, 391, 455, 530,
  616, 717, 833, 969, 1127, 1311, 1525, 1774, 2063, 2400,
];

export const SCHOWANE_SUROWCE = [150, 200, 267, 356, 474, 632, 843, 1125, 1500, 2000];

// Jedyna tabela bez wzoru: do 11 rosnie o jeden, potem skacze.
export const KUPCY = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 14, 19, 26, 35, 46, 59, 74, 91, 110,
  131, 154, 179, 206, 235,
];

function zTabeli(tabela, poziom, nazwa) {
  const v = tabela[poziom - 1];
  if (v === undefined) throw new Error(`${nazwa}: poziom ${poziom} poza zakresem 1–${tabela.length}`);
  return v;
}

export function pojemnosc(poziom) {
  return zTabeli(POJEMNOSC_SPICHLERZA, poziom, 'Spichlerz');
}

export function maksLudnosc(poziom) {
  return zTabeli(MAKS_LUDNOSC_ZAGRODY, poziom, 'Zagroda');
}

export function schowane(poziom) {
  return zTabeli(SCHOWANE_SUROWCE, poziom, 'Schowek');
}

export function kupcy(poziom) {
  return zTabeli(KUPCY, poziom, 'Rynek');
}

// Kopalnia na poziomie 0 nie produkuje nic. Zalozenie: nie udalo sie tego
// potwierdzic obserwacyjnie, ale bledna wartosc rzedu kilku jednostek na
// godzine zmienia wynik kilkudniowego planu o promile.
export function produkcjaGodzinowa(s, poziom) {
  if (poziom <= 0) return 0;
  return Math.floor(zTabeli(PRODUKCJA_H_BAZA30, poziom, 'Kopalnia') * s.produkcjaBazowa / 30 + 0.5);
}
