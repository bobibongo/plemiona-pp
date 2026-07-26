// src/wioska/czas.js
// czas = maks(10 s, build_time x G(poziom) x 1,05^(-ratusz) / predkosc swiata)

import { TABELA_G, MINIMALNY_CZAS_S, MUR_STALY_CZAS_S, MUR_STALY_DO_POZIOMU } from './czas-dane.js';

export function wspolczynnikG(poziom) {
  const w = TABELA_G[poziom];
  if (!w) throw new Error(`Brak współczynnika czasu dla poziomu ${poziom}`);
  return w;
}

export function czasBudowy(s, budynek, poziom, poziomRatusza) {
  if (budynek === 'mur' && poziom <= MUR_STALY_DO_POZIOMU) {
    return { sekundy: MUR_STALY_CZAS_S, pewny: true };
  }
  const d = s.budynki[budynek];
  if (!d) throw new Error(`Budynek ${budynek} nie istnieje na świecie ${s.kod}`);
  const { g, zmierzony } = wspolczynnikG(poziom);
  const surowy = d.czas * g * 1.05 ** -poziomRatusza / s.predkosc;
  return { sekundy: Math.max(MINIMALNY_CZAS_S, Math.round(surowy)), pewny: zmierzony };
}
