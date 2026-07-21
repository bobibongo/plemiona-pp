// src/rates-store.js
// Migawka kursów: jeden wiersz na kontynent, nadpisywany przy powrocie.

export const STORE_PREFIX = 'plemiona-kursy';

// pl231.plemiona.pl → pl231
export function worldFromHost(host) {
  const first = String(host ?? '').split('.')[0];
  return first || 'nieznany';
}

// Klucz zawiera świat, żeby dane z dwóch światów się nie zmieszały.
export function storageKey(world) {
  return `${STORE_PREFIX}:${world}`;
}

// 'K5' < 'K45' < 'K64' — po numerze, bo alfabetycznie wyszłoby K45, K5, K64.
function continentNumber(continent) {
  const n = Number(String(continent).replace(/^K/, ''));
  return Number.isFinite(n) ? n : Infinity;
}

export function sortReadings(readings) {
  return [...readings].sort((a, b) => continentNumber(a.continent) - continentNumber(b.continent));
}

// Odczyt bez kontynentu nigdy nie trafia do magazynu — nie wiadomo, który
// wiersz miałby nadpisać. Zasada: popsuty odczyt nie psuje dobrego.
export function mergeReading(readings, reading) {
  if (!reading || !reading.continent) return sortReadings(readings);
  const rest = readings.filter(x => x.continent !== reading.continent);
  return sortReadings([...rest, reading]);
}

export function buildExport(world, readings, now = new Date()) {
  return { exportedAt: now.toISOString(), world, readings: sortReadings(readings) };
}

// Tekst trafiający do schowka — wklejasz go wprost na stronie analizy.
export function exportText(world, readings, now = new Date()) {
  return JSON.stringify(buildExport(world, readings, now), null, 2);
}
