// src/wioska/zapotrzebowanie.js
// Dwie liczby odporne na wahania farmienia: ile plan trwa, gdy nic go nie
// zatrzymuje, i ile surowcow trzeba dowozic, zeby tej granicy dotrzymac.
// Przebieg pomocniczy ignoruje magazyn — interesuje nas dolna granica, a nie
// przebieg przy konkretnym dochodzie, ktory liczy symulacja.

import { swiat } from './swiaty.js';
import { kosztPoziomu } from './swiat.js';
import { produkcjaGodzinowa } from './tabele.js';
import { czasBudowy } from './czas.js';

const SUROWCE_Z = ['drewno', 'glina', 'zelazo'];
const KOPALNIA_SUROWCA = { drewno: 'tartak', glina: 'cegielnia', zelazo: 'huta' };
const DOBA_S = 86400;

export function zapotrzebowanie(plan) {
  const s = swiat(plan.swiat);
  const poziomy = { ...plan.start.poziomy };
  const skumulowany = { drewno: 0, glina: 0, zelazo: 0 };
  const wyprodukowane = { drewno: 0, glina: 0, zelazo: 0 };
  const wymagany = { drewno: 0, glina: 0, zelazo: 0 };
  let czas = 0;
  let waskieGardlo = null;
  let szczyt = 0;
  let brakNaStart = false;

  plan.kroki.forEach((krok, indeks) => {
    const koszt = kosztPoziomu(s, krok.budynek, krok.doPoziomu);
    for (const r of SUROWCE_Z) skumulowany[r] += koszt[r];

    for (const r of SUROWCE_Z) {
      const deficyt = skumulowany[r] - plan.start.surowce[r] - wyprodukowane[r];
      if (deficyt <= 0) continue;
      if (czas <= 0) {
        // Krok o zerowym czasie startu nie ma jak "zdazyc" — dzielenie
        // dalo by nieskonczonosc i zepsulo cala liczbe.
        brakNaStart = true;
        continue;
      }
      const naDobe = deficyt / (czas / DOBA_S);
      if (naDobe > wymagany[r]) wymagany[r] = naDobe;
      if (naDobe > szczyt) {
        szczyt = naDobe;
        waskieGardlo = { indeks, budynek: krok.budynek, doPoziomu: krok.doPoziomu, surowiec: r, czasS: Math.round(czas) };
      }
    }

    const { sekundy } = czasBudowy(s, krok.budynek, krok.doPoziomu, poziomy.ratusz ?? 1);
    for (const r of SUROWCE_Z) {
      wyprodukowane[r] += produkcjaGodzinowa(s, poziomy[KOPALNIA_SUROWCA[r]] ?? 0) * sekundy / 3600;
    }
    czas += sekundy;
    poziomy[krok.budynek] = krok.doPoziomu;
  });

  return {
    czasNettoS: Math.round(czas),
    wymaganyDobowo: {
      drewno: Math.ceil(wymagany.drewno),
      glina: Math.ceil(wymagany.glina),
      zelazo: Math.ceil(wymagany.zelazo),
    },
    waskieGardlo,
    brakNaStart,
  };
}
