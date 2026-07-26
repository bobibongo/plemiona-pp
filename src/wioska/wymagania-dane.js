// src/wioska/wymagania-dane.js
// Wymagania sa wspolne dla swiatow — nie ma ich w zadnym endpoincie
// interface.php, wiec pochodza z ekranu Ratusza i wiki.
// Budynki niewymienione nie maja zadnych wymagan.

export const WYMAGANIA = {
  koszary: { ratusz: 3 },
  mur: { koszary: 1 },
  kuznia: { ratusz: 5, koszary: 1 },
  rynek: { ratusz: 3, spichlerz: 2 },
  stajnia: { ratusz: 10, koszary: 5, kuznia: 5 },
  warsztat: { ratusz: 10, kuznia: 10 },
  palac: { ratusz: 20, kuznia: 20, rynek: 10 },
  kosciol: { ratusz: 5, zagroda: 5 },
  wieza: { ratusz: 5, zagroda: 5 },
};
