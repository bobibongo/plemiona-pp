// src/parse.js
import { parsePremiumDate } from './shared-date.js';

const NBSP = / /g;

export function parseNumber(raw) {
  const s = String(raw).replace(NBSP, '').replace(/\s/g, '').replace('+', '');
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`Nieparsowalna liczba: ${JSON.stringify(raw)}`);
  return n;
}

const RESOURCE_MAP = [
  [/drewno/i, 'drewno'],
  [/glina/i, 'glina'],
  [/(żelazo|zelazo)/i, 'zelazo'],
];

export function extractResource(info) {
  const s = String(info);
  const amountMatch = /\((\d+)\)/.exec(s);
  for (const [re, key] of RESOURCE_MAP) {
    if (re.test(s)) {
      return { resource: key, amount: amountMatch ? Number(amountMatch[1]) : null };
    }
  }
  return { resource: null, amount: null };
}

const SERVICE_SUBTYPES = [
  [/natychmiastowe zako[ńn]czenie/i, 'natychmiastowe_zakonczenie'],
  [/redukcja czasu/i, 'redukcja_czasu'],
  [/miejscowym kupcem/i, 'handel_kupiec'],
  [/rycerz/i, 'rycerz'],
  [/zmniejsz koszt budowy/i, 'zmniejsz_koszt'],
];

export function classify(raw) {
  const info = String(raw.info || '');
  const txType = String(raw.txType || '').replace(NBSP, '').trim();
  const { resource, amount } = extractResource(info);

  if (/-kupno:/i.test(info)) return { category: 'arbitraz', subtype: 'kupno', resource, amount };
  if (/-sprzeda[żz]:/i.test(info)) return { category: 'arbitraz', subtype: 'sprzedaz', resource, amount };

  if (/^Premium\b/i.test(info)) return { category: 'zewnetrzne_pp', subtype: 'subskrypcja', resource: null, amount: null };
  if (txType === 'Kupno') return { category: 'zewnetrzne_pp', subtype: 'zakup_pp', resource: null, amount: null };

  if (txType === 'Użycie') {
    for (const [re, sub] of SERVICE_SUBTYPES) {
      if (re.test(info)) return { category: 'usluga', subtype: sub, resource: null, amount: null };
    }
    return { category: 'usluga', subtype: 'inne', resource: null, amount: null };
  }
  return { category: 'inne', subtype: 'inne', resource: null, amount: null };
}

export function enrich(raw, now = new Date()) {
  const ts = parsePremiumDate(raw.dateRaw, now).toISOString();
  const change = parseNumber(raw.changeRaw);
  const balance = parseNumber(raw.balanceRaw);
  const world = String(raw.world).replace(NBSP, '').trim();
  const info = String(raw.info).trim();
  const cls = classify(raw);
  return { ts, world, txType: String(raw.txType).replace(NBSP, '').trim(),
    change, balance, info, ...cls };
}

export function entryKey(e) {
  return `${e.world}|${e.ts}|${e.change}|${e.info}`;
}
