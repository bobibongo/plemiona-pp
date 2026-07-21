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

// Lokalizacja wioski: "(499|613) K64". Oznaczenie kontynentu bywa pominięte,
// dlatego jest w grupie opcjonalnej.
const LOC_RE = /\((\d+)\|(\d+)\)(?:\s*K(\d+))?/;

// Kontynent to pierwsza cyfra Y, potem pierwsza cyfra X — w tej kolejności:
// (499|613) → K64. Zakładamy współrzędne trzycyfrowe, tak jak w grze.
// To i tak tylko zapas: normalnie kontynent bierzemy wprost z "K64" na stronie.
export function continentFromCoords(x, y) {
  return 'K' + String(y)[0] + String(x)[0];
}

export function parseLocation(text) {
  const m = LOC_RE.exec(String(text ?? ''));
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  return { x, y, continent: m[3] ? 'K' + m[3] : continentFromCoords(x, y) };
}

// Nie kotwiczymy się na układzie tabeli — szukamy pierwszego elementu,
// którego treść wygląda jak lokalizacja wioski.
export function findLocation(doc) {
  const els = doc.querySelectorAll('b.nowrap, .nowrap, #header_info b');
  for (const el of els) {
    const loc = parseLocation(el.textContent);
    if (loc) return loc;
  }
  return null;
}

// Pełny odczyt. null oznacza „to nie ten ekran" i nie rusza magazynu.
// Odczyt z continent === null jest ważny do pokazania w panelu, ale magazyn
// go odrzuci — nie wiadomo, który wiersz miałby nadpisać.
export function readReading(doc, now = new Date()) {
  const rates = readRates(doc);
  if (!rates) return null;
  const loc = findLocation(doc);
  return {
    continent: loc ? loc.continent : null,
    x: loc ? loc.x : null,
    y: loc ? loc.y : null,
    wood: rates.wood,
    stone: rates.stone,
    iron: rates.iron,
    at: now.toISOString(),
  };
}
