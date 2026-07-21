// src/rates-signals.js
// Progi i okazje. Kurs to ilość surowca za 1 PP, więc wysoka wartość znaczy,
// że surowce są tanie (opłaca się kupować), a niska — że drogie (opłaca się
// sprzedawać).

import { continentsOf } from './rates-history.js';

// Kolejność stała, żeby przy remisie zawsze wygrywał ten sam surowiec.
const SUROWCE = [['wood', 'drewno'], ['stone', 'glina'], ['iron', 'żelazo']];

function skrajny(r, wybierz) {
  let najlepszy = null;
  for (const [key, label] of SUROWCE) {
    const value = r[key];
    if (!Number.isFinite(value)) continue;
    if (najlepszy === null || wybierz(value, najlepszy.value)) najlepszy = { key, label, value };
  }
  return najlepszy;
}

export function parseThreshold(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function evaluateSignals(latest, { high, low }) {
  if (high === null || high === undefined || low === null || low === undefined) {
    return { ready: false, signals: [], message: 'Ustaw progi, żeby zobaczyć okazje.' };
  }
  if (low >= high) {
    return { ready: false, signals: [], message: 'Próg dolny musi być mniejszy niż górny.' };
  }

  // Liczymy z ekstremum, nie ze średniej — średnia rozcieńcza okazję:
  // żelazo 430 przy glinie 380 daje 405 i sygnał by przepadł.
  // Oba warunki mogą zajść naraz przy rozstrzelonych kursach. To nie pomyłka,
  // tylko dwie różne transakcje na dwóch różnych surowcach.
  const signals = [];
  for (const r of latest) {
    const gora = skrajny(r, (a, b) => a > b);
    if (gora && gora.value >= high) {
      signals.push({ continent: r.continent, resource: gora.key, label: gora.label, value: gora.value, action: 'kupuj' });
    }
    const dol = skrajny(r, (a, b) => a < b);
    if (dol && dol.value <= low) {
      signals.push({ continent: r.continent, resource: dol.key, label: dol.label, value: dol.value, action: 'sprzedawaj' });
    }
  }
  // Kolejność kontynentów, żeby pasek nie skakał między odświeżeniami.
  const kolejnosc = continentsOf(latest);
  signals.sort((a, b) => kolejnosc.indexOf(a.continent) - kolejnosc.indexOf(b.continent));

  // Pustka jest dwuznaczna: nie wiadomo, czy nie ma okazji, czy coś się zepsuło.
  const message = signals.length ? '' : 'Brak okazji przy obecnych progach.';
  return { ready: true, signals, message };
}
