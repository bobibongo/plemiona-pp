// src/wioska/plan.js
// Plan to czysty obiekt bez stanu interfejsu — ten sam ksztalt jedzie
// do CLI, do schowka i do localStorage.

import { SWIATY, swiat } from './swiaty.js';
import { poziomyStartowe, maksPoziom, budynkiSwiata } from './swiat.js';

export const SUROWCE_STARTOWE = { drewno: 1000, glina: 1000, zelazo: 1000 };

export const PLAN_PUSTY = normalizujPlan({ swiat: 'pl231' });

export function normalizujPlan(surowy) {
  const kod = surowy?.swiat ?? 'pl231';
  const s = SWIATY[kod];
  const poziomy = s ? poziomyStartowe(s) : {};
  return {
    swiat: kod,
    start: {
      poziomy: { ...poziomy, ...(surowy?.start?.poziomy ?? {}) },
      surowce: { ...SUROWCE_STARTOWE, ...(surowy?.start?.surowce ?? {}) },
    },
    kroki: (surowy?.kroki ?? []).map(k => ({
      budynek: k.budynek,
      doPoziomu: Number(k.doPoziomu),
    })),
    dochody: [...(surowy?.dochody ?? [])]
      .map(d => ({
        czasS: Number(d.czasS ?? 0),
        drewnoH: Number(d.drewnoH ?? 0),
        glinaH: Number(d.glinaH ?? 0),
        zelazoH: Number(d.zelazoH ?? 0),
      }))
      .sort((a, b) => a.czasS - b.czasS),
    zastrzyki: [...(surowy?.zastrzyki ?? [])]
      .map(z => ({
        czasS: Number(z.czasS ?? 0),
        drewno: Number(z.drewno ?? 0),
        glina: Number(z.glina ?? 0),
        zelazo: Number(z.zelazo ?? 0),
      }))
      .sort((a, b) => a.czasS - b.czasS),
  };
}

export function bledyPlanu(plan) {
  const bledy = [];
  let s;
  try {
    s = swiat(plan.swiat);
  } catch (e) {
    return [e.message];
  }
  const dostepne = new Set(budynkiSwiata(s));
  // Kopia poziomow startowych — sprawdzamy, czy kroki tworza ciagla sciezke.
  const poziomy = { ...plan.start.poziomy };
  plan.kroki.forEach((krok, i) => {
    if (!dostepne.has(krok.budynek)) {
      bledy.push(`Krok ${i + 1}: budynek ${krok.budynek} nie istnieje na świecie ${plan.swiat}`);
      return;
    }
    const maks = maksPoziom(s, krok.budynek);
    if (krok.doPoziomu > maks) {
      bledy.push(`Krok ${i + 1}: ${krok.budynek} ma maksymalnie ${maks} poziomów, nie ${krok.doPoziomu}`);
      return;
    }
    const oczekiwany = (poziomy[krok.budynek] ?? 0) + 1;
    if (krok.doPoziomu !== oczekiwany) {
      bledy.push(`Krok ${i + 1}: ${krok.budynek} powinien iść na poziom ${oczekiwany}, nie ${krok.doPoziomu}`);
      return;
    }
    poziomy[krok.budynek] = krok.doPoziomu;
  });
  return bledy;
}
