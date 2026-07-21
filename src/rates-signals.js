// src/rates-signals.js
// Progi i okazje. Kurs to ilość surowca za 1 PP, więc wysoka wartość znaczy,
// że surowce są tanie (opłaca się kupować), a niska — że drogie (opłaca się
// sprzedawać).

import { average, continentsOf } from './rates-history.js';

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

  const signals = [];
  for (const r of latest) {
    const avg = average(r);
    if (avg >= high) signals.push({ continent: r.continent, avg, action: 'kupuj' });
    else if (avg <= low) signals.push({ continent: r.continent, avg, action: 'sprzedawaj' });
  }
  // Kolejność kontynentów, żeby pasek nie skakał między odświeżeniami.
  const kolejnosc = continentsOf(latest);
  signals.sort((a, b) => kolejnosc.indexOf(a.continent) - kolejnosc.indexOf(b.continent));

  // Pustka jest dwuznaczna: nie wiadomo, czy nie ma okazji, czy coś się zepsuło.
  const message = signals.length ? '' : 'Brak okazji przy obecnych progach.';
  return { ready: true, signals, message };
}
