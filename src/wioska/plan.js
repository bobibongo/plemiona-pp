// src/wioska/plan.js
// Plan to czysty obiekt bez stanu interfejsu — ten sam ksztalt jedzie
// do CLI, do schowka i do localStorage.

import { SWIATY, swiat } from './swiaty.js';
import { poziomyStartowe, maksPoziom, budynkiSwiata } from './swiat.js';
import { czasBudowy } from './czas.js';

// Obie stale sa wspoldzielone przez caly proces. Zamrazamy je, zeby
// przypadkowa mutacja wywalila sie od razu, zamiast po cichu zmienic
// wartosci domyslne kolejnych planow. Kopie do modyfikacji daje
// normalizujPlan, ktory zawsze buduje nowe obiekty.
function zamroz(obiekt) {
  for (const v of Object.values(obiekt)) {
    if (v && typeof v === 'object') zamroz(v);
  }
  return Object.freeze(obiekt);
}

export const SUROWCE_STARTOWE = zamroz({ drewno: 1000, glina: 1000, zelazo: 1000 });

export const PLAN_PUSTY = zamroz(normalizujPlan({ swiat: 'pl231' }));

// Os migracyjna nie moze zalezec od dochodu, ktory jest wlasnie migrowany.
// Dlatego odtwarza tylko kolejne czasy budowy, bez przestojow i magazynu.
function osBezPrzestojowDoMigracji(s, poziomyStart, kroki) {
  const poziomy = { ...poziomyStart };
  let czas = 0;
  return kroki.map(k => {
    const startS = czas;
    const { sekundy } = czasBudowy(s, k.budynek, k.doPoziomu, poziomy.ratusz ?? 1);
    czas += sekundy;
    poziomy[k.budynek] = k.doPoziomu;
    return { budynek: k.budynek, doPoziomu: k.doPoziomu, startS };
  });
}

function kotwicaZCzasu(os, czasS) {
  if (os.length === 0 || czasS <= os[0].startS) return null;
  const trafiony = os.find(k => k.startS >= czasS);
  const krok = trafiony ?? os[os.length - 1];
  return { budynek: krok.budynek, doPoziomu: krok.doPoziomu };
}

export function normalizujPlan(surowy) {
  const kod = surowy?.swiat ?? 'pl231';
  const s = SWIATY[kod];
  const poziomy = s ? poziomyStartowe(s) : {};
  const kroki = (surowy?.kroki ?? []).map(k => ({
    budynek: k.budynek,
    doPoziomu: Number(k.doPoziomu),
  }));
  const startPoziomy = { ...poziomy, ...(surowy?.start?.poziomy ?? {}) };
  const potrzebnaOs = (surowy?.dochody ?? []).some(d => d.czasS !== undefined && d.kotwica === undefined)
    || (surowy?.zastrzyki ?? []).some(z => z.czasS !== undefined && z.kotwica === undefined);
  const os = s && potrzebnaOs ? osBezPrzestojowDoMigracji(s, startPoziomy, kroki) : [];
  const kluczeKrokow = new Set(kroki.map(k => `${k.budynek}|${k.doPoziomu}`));
  const kotwicaZ = (wpis) => {
    if (wpis.kotwica === undefined) return kotwicaZCzasu(os, Number(wpis.czasS ?? 0));
    if (wpis.kotwica === null) return null;
    const kotwica = { budynek: wpis.kotwica.budynek, doPoziomu: Number(wpis.kotwica.doPoziomu) };
    return kluczeKrokow.has(`${kotwica.budynek}|${kotwica.doPoziomu}`) ? kotwica : null;
  };
  const dobowa = (d, surowiec) => Number(d[`${surowiec}D`] ?? (d[`${surowiec}H`] ?? 0) * 24);
  return {
    swiat: kod,
    start: {
      poziomy: startPoziomy,
      surowce: { ...SUROWCE_STARTOWE, ...(surowy?.start?.surowce ?? {}) },
    },
    kroki,
    dochody: (surowy?.dochody ?? []).map(d => ({
      kotwica: kotwicaZ(d),
      sumaD: Number(d.sumaD ?? (dobowa(d, 'drewno') + dobowa(d, 'glina') + dobowa(d, 'zelazo'))),
      zrodlo: d.zrodlo === 'zbieractwo' ? 'zbieractwo' : 'farma',
    })),
    zastrzyki: (surowy?.zastrzyki ?? []).map(z => ({
      kotwica: kotwicaZ(z),
      drewno: Number(z.drewno ?? 0),
      glina: Number(z.glina ?? 0),
      zelazo: Number(z.zelazo ?? 0),
    })),
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
