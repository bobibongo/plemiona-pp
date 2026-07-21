// src/rates-history.js
// Historia kursów: scalanie kolejnych eksportów z kolektora w jeden przebieg.

const BLAD_KSZTALTU = 'To nie wygląda na dane z kolektora.';

function poprawny(r) {
  return !!r
    && typeof r.continent === 'string' && r.continent.length > 0
    && Number.isFinite(r.wood) && Number.isFinite(r.stone) && Number.isFinite(r.iron)
    && typeof r.at === 'string' && r.at.length > 0;
}

// Nie rzucamy wyjątkiem — strona ma pokazać komunikat, a nie się wywalić.
export function parseImport(text) {
  let dane;
  try { dane = JSON.parse(text); } catch { return { ok: false, error: BLAD_KSZTALTU }; }
  if (!dane || typeof dane !== 'object' || !Array.isArray(dane.readings)) {
    return { ok: false, error: BLAD_KSZTALTU };
  }
  const world = String(dane.world || 'nieznany');
  const records = [];
  let skipped = 0;
  for (const r of dane.readings) {
    if (!poprawny(r)) { skipped++; continue; }
    records.push({
      world,
      continent: r.continent,
      x: Number.isFinite(r.x) ? r.x : null,
      y: Number.isFinite(r.y) ? r.y : null,
      wood: r.wood, stone: r.stone, iron: r.iron,
      at: r.at,
    });
  }
  return { ok: true, world, records, skipped };
}

// Tożsamość odczytu. Dzięki niej wklejenie tego samego eksportu drugi raz
// niczego nie zmienia, a gracz nie musi pamiętać, co już wgrał.
export function recordKey(r) {
  return `${r.world}|${r.continent}|${r.at}`;
}

export function mergeHistory(history, records) {
  const znane = new Set(history.map(recordKey));
  const nowe = [];
  for (const r of records) {
    const k = recordKey(r);
    if (znane.has(k)) continue;
    znane.add(k);
    nowe.push(r);
  }
  const merged = [...history, ...nowe]
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return { history: merged, added: nowe.length, duplicates: records.length - nowe.length };
}

// Średnia z trzech surowców — sposób wyświetlania, nie forma przechowywania.
// Surowce zostają w rekordzie, więc rozbicie zawsze da się odzyskać.
export function average(r) {
  return Math.round((r.wood + r.stone + r.iron) / 3);
}

export function worlds(history) {
  return [...new Set(history.map(r => r.world))].sort();
}

export function forWorld(history, world) {
  return history.filter(r => r.world === world);
}

// 'K5' < 'K45' < 'K64' — po numerze, bo alfabetycznie wyszłoby K45, K5, K64.
function numerKontynentu(continent) {
  const n = Number(String(continent).replace(/^K/, ''));
  return Number.isFinite(n) ? n : Infinity;
}

export function continentsOf(history) {
  return [...new Set(history.map(r => r.continent))]
    .sort((a, b) => numerKontynentu(a) - numerKontynentu(b));
}

// Sygnał liczymy z najświeższego odczytu, nie z całej historii — interesuje nas
// stan teraz, a nie średnia z tygodnia.
export function latestPerContinent(history) {
  const najnowsze = new Map();
  for (const r of history) {
    const poprzedni = najnowsze.get(r.continent);
    if (!poprzedni || r.at > poprzedni.at) najnowsze.set(r.continent, r);
  }
  return continentsOf(history).map(c => najnowsze.get(c));
}

export function seriesByContinent(history) {
  return continentsOf(history).map(continent => ({
    continent,
    points: history
      .filter(r => r.continent === continent)
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
      .map(r => ({ t: Date.parse(r.at), y: average(r), rec: r })),
  }));
}
