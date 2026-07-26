// src/wioska/czas-dane.js
// Tabela G — czysta funkcja poziomu, wspolna dla wszystkich budynkow.
// Generowana przez tools/kalibracja.js z zapisanych stron Ratusza.
//
// zmierzony: true  — wartosc odczytana z gry
// zmierzony: false — interpolacja miedzy pomiarami (poziomy 5, 6, 8, 16-20)
//                    albo ekstrapolacja wspolczynnikiem 1,20467 (poziomy 22-30)

export const TABELA_G = {
  1: { g: 0.00772, zmierzony: true },
  // Poziomy 1 i 2 sa nierozroznialne: gra pokazuje czasy w pelnych sekundach,
  // a jedyna obserwacja poziomu 2 (Schowek 13 s przy Ratuszu 1) daje przedzial
  // 0,00729-0,00788, w ktorym miesci sie G(1). Bierzemy wartosc rowna G(1),
  // bo czas budowy nie moze malec z poziomem, a 0,00772 nadal odtwarza te 13 s.
  2: { g: 0.00772, zmierzony: true },
  3: { g: 0.16146, zmierzony: true },
  4: { g: 0.50042, zmierzony: true },
  5: { g: 1.05552, zmierzony: false },
  6: { g: 1.61879, zmierzony: false },
  7: { g: 2.15879, zmierzony: true },
  8: { g: 2.88378, zmierzony: false },
  9: { g: 3.82677, zmierzony: true },
  10: { g: 4.89263, zmierzony: true },
  11: { g: 6.15777, zmierzony: true },
  12: { g: 7.65959, zmierzony: true },
  13: { g: 9.44427, zmierzony: true },
  14: { g: 11.5661, zmierzony: true },
  15: { g: 14.08831, zmierzony: true },
  16: { g: 17.08524, zmierzony: false },
  17: { g: 20.64453, zmierzony: false },
  18: { g: 24.87289, zmierzony: false },
  19: { g: 29.90201, zmierzony: false },
  20: { g: 35.89576, zmierzony: false },
  21: { g: 43.05963, zmierzony: true },
  22: { g: 51.8727, zmierzony: false },
  23: { g: 62.48955, zmierzony: false },
  24: { g: 75.27937, zmierzony: false },
  25: { g: 90.6869, zmierzony: false },
  26: { g: 109.24791, zmierzony: false },
  27: { g: 131.60782, zmierzony: false },
  28: { g: 158.54416, zmierzony: false },
  29: { g: 190.9936, zmierzony: false },
  30: { g: 230.08451, zmierzony: false },
};

export const MINIMALNY_CZAS_S = 10;

// Mur na poziomach 1 i 2 pokazuje rowne 4:00 w wioskach o Ratuszu 3 i 14,
// czyli nie skaluje sie wcale. Mechanika nieznana — wartosc obserwowana.
export const MUR_STALY_CZAS_S = 240;
export const MUR_STALY_DO_POZIOMU = 2;
