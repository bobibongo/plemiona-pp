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

// Kolejność ma znaczenie — pierwszy pasujący wygrywa.
const SUBSCRIPTION_MAP = [
  [/konto premium/i, 'Konto premium'],
  [/^premium\b/i, 'Konto premium'],
  [/men[ae]d[żz]er kont/i, 'Menadżer konta'],
  [/asystent farmera/i, 'Asystent farmera'],
  [/20\s*%.*(żelaz|zelaz)/i, '+20% żelaza'],
  [/20\s*%.*glin/i, '+20% gliny'],
  [/20\s*%.*drewn/i, '+20% drewna'],
];

const SERVICE_MAP = [
  [/redukcja czasu/i, 'Redukcja czasu budowy'],
  [/natychmiastowe zako[ńn]czenie/i, 'Natychmiastowe zakończenie'],
  [/miejscowym kupcem/i, 'Handel z miejscowym kupcem'],
  [/wymiana manuskryptu/i, 'Wymiana manuskryptu'],
  [/wskrzeszenie rycerza/i, 'Wskrzeszenie rycerza'],
  [/rekrutacja rycerza/i, 'Rekrutacja rycerza'],
  [/przekwalifikowanie rycerza/i, 'Przekwalifikowanie rycerza'],
  [/trening rycerza/i, 'Trening rycerza'],
  [/rycerz/i, 'Rycerz — inne'],
  [/zmniejsz koszt budowy/i, 'Zmniejsz koszt budowy'],
];

// Nazwa eventu: bez treści w nawiasach i bez ogona po " - ".
function eventLabel(info) {
  const s = String(info).replace(/\(.*?\)/g, '').replace(/\s*-\s.*$/, '').trim();
  return s || String(info).trim();
}

export function classify(raw) {
  const info = String(raw.info || '');
  const txType = String(raw.txType || '').replace(NBSP, '').trim();
  const { resource, amount } = extractResource(info);

  // 1. Handel (po treści, niezależnie od typu transakcji)
  if (/-kupno:/i.test(info)) return { category: 'handel', subtype: 'kupno', label: 'Kupno', resource, amount };
  if (/-sprzeda[żz]:/i.test(info)) return { category: 'handel', subtype: 'sprzedaz', label: 'Sprzedaż', resource, amount };

  // 2. Subskrypcje
  for (const [re, label] of SUBSCRIPTION_MAP) {
    if (re.test(info)) return { category: 'subskrypcje', subtype: label, label, resource: null, amount: null };
  }

  // 3. Usługi
  for (const [re, label] of SERVICE_MAP) {
    if (re.test(info)) return { category: 'uslugi', subtype: label, label, resource: null, amount: null };
  }

  // 4. Zakup PP (realne pieniądze lub przeniesienie PP od graczy)
  if (txType === 'Kupno' || txType === 'Przeniesienie') {
    return { category: 'zakup_pp', subtype: 'zakup_pp', label: 'Zakup PP', resource: null, amount: null };
  }

  // 5. Eventy / pozostałe — etykieta z opisu, a gdy pusty, z typu transakcji
  //    (np. "Darmowe PP", "Nagroda końcowa", "Wycofane", "Ręcznie")
  return { category: 'eventy', subtype: 'event', label: eventLabel(info) || txType || 'Inne', resource: null, amount: null };
}

// Zegar ścienny z logu (czas polski) zapisujemy jako UTC-ISO, żeby dzień/tydzień
// były deterministyczne niezależnie od strefy czasowej przeglądarki.
function wallClockISO(d) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T` +
    `${p(d.getHours())}:${p(d.getMinutes())}:00.000Z`;
}

export function enrich(raw, now = new Date()) {
  const ts = wallClockISO(parsePremiumDate(raw.dateRaw, now));
  const change = parseNumber(raw.changeRaw);
  const balance = parseNumber(raw.balanceRaw);
  const world = String(raw.world).replace(NBSP, '').trim();
  const info = String(raw.info).trim();
  const cls = classify(raw);
  return { ts, world, txType: String(raw.txType).replace(NBSP, '').trim(),
    change, balance, info, ...cls };
}

export function entryKey(e) {
  // saldo w kluczu: prawdziwe powtórzenia w tej samej minucie (ten sam opis/zmiana)
  // mają różne "Nowe saldo PP", więc nie zostaną błędnie zwinięte.
  return `${e.world}|${e.ts}|${e.change}|${e.balance}|${e.info}`;
}
