// src/rates-parse.js
// Odczyt kursów giełdy premium z dokumentu, który gracz sam otworzył.
// Ten moduł niczego nie pobiera — dostaje gotowy Document i tylko go czyta.

const RATE_IDS = {
  wood: 'premium_exchange_rate_wood',
  stone: 'premium_exchange_rate_stone',
  iron: 'premium_exchange_rate_iron',
};

// Komórka kursu to "<ikona> 378  ⇄  <ikona> 1". Bierzemy pierwszą liczbę, ale
// tak, żeby nie skleiła się z jedynką po strzałce: po spacji akceptujemy dalszy
// ciąg tylko jako pełną trójkę cyfr (separator tysięcy).
export function parseRate(text) {
  const m = String(text ?? '').replace(/ /g, ' ').match(/\d+(?:[ .]\d{3})*/);
  if (!m) return null;
  const n = Number(m[0].replace(/[ .]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Albo komplet trzech kursów, albo null. Częściowy odczyt jest bezużyteczny
// i groziłby nadpisaniem dobrego wiersza połową danych.
export function readRates(doc) {
  const out = {};
  for (const [res, id] of Object.entries(RATE_IDS)) {
    const cell = doc.getElementById(id);
    if (!cell) return null;
    const seps = cell.querySelectorAll ? cell.querySelectorAll('.premium-exchange-sep') : null;
    const source = (seps && seps[0]) || cell;
    const value = parseRate(source.textContent);
    if (value === null) return null;
    out[res] = value;
  }
  return out;
}
