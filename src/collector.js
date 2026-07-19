// src/collector.js
import { parsePremiumDate } from './shared-date.js';

export function buildLogUrl(baseHref, page) {
  if (/([?&])page=\d+/.test(baseHref)) return baseHref.replace(/([?&]page=)\d+/, `$1${page}`);
  return baseHref + (baseHref.includes('?') ? '&' : '?') + `page=${page}`;
}

// Selektor wierszy tabeli logu. Bierzemy wiersze z co najmniej 6 komórkami td,
// których pierwsza komórka wygląda jak data (odsiewa nagłówek i śmieci).
export function extractRawRows(doc) {
  const trs = doc.querySelectorAll('#premium_history_table tr, table tr');
  const out = [];
  for (const tr of trs) {
    const cells = tr.querySelectorAll('td');
    if (!cells || cells.length < 6) continue;
    const t = i => (cells[i].textContent || '').replace(/ /g, ' ').trim();
    const dateRaw = t(0);
    if (!/^\s*\d{2}\.\d{2}\./.test(dateRaw)) continue;
    out.push({ dateRaw, world: t(1), txType: t(2), changeRaw: t(3), balanceRaw: t(4), info: t(5) });
  }
  return out;
}

export function oldestDate(rows, now) {
  let oldest = null;
  for (const r of rows) {
    const d = parsePremiumDate(r.dateRaw, now);
    if (!oldest || d < oldest) oldest = d;
  }
  return oldest;
}

export function shouldStop(rows, sinceDate, now) {
  const oldest = oldestDate(rows, now);
  return oldest !== null && oldest < sinceDate;
}
