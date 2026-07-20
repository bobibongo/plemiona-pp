// src/aggregate.js
function isoWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (date.getUTCDay() + 6) % 7;          // pon=0
  date.setUTCDate(date.getUTCDate() - day + 3);     // czwartek tego tygodnia
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { year: date.getUTCFullYear(), week };
}

export function bucketKey(ts, granularity) {
  const d = new Date(ts);
  if (granularity === 'week') {
    const { year, week } = isoWeek(d);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0'), day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const RES = ['drewno', 'glina', 'zelazo'];
const CATEGORIES = ['handel', 'zakup_pp', 'subskrypcje', 'uslugi', 'eventy'];

export function aggregate(entries, { granularity }) {
  const map = new Map();
  const totals = {
    net: 0,
    resources: Object.fromEntries(RES.map(r => [r, { bought: 0, sold: 0, diff: 0 }])),
    breakdown: Object.fromEntries(CATEGORIES.map(c => [c, {}])),
  };
  for (const c of CATEGORIES) totals[c] = 0;

  for (const e of entries) {
    const key = bucketKey(e.ts, granularity);
    if (!map.has(key)) map.set(key, { key, net: 0 });
    map.get(key).net += e.change;
    totals.net += e.change;

    if (CATEGORIES.includes(e.category)) {
      totals[e.category] += e.change;
      const label = e.label || e.subtype || 'inne';
      totals.breakdown[e.category][label] = (totals.breakdown[e.category][label] || 0) + e.change;
    }
    if (e.category === 'handel' && e.resource && e.amount) {
      totals.resources[e.resource][e.subtype === 'kupno' ? 'bought' : 'sold'] += e.amount;
    }
  }
  for (const r of RES) totals.resources[r].diff = totals.resources[r].bought - totals.resources[r].sold;

  const buckets = [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { buckets, totals };
}

// Efektywny kurs jako ILOŚĆ SUROWCA na 1 PP (kupno i sprzedaż osobno).
export function effectiveRates(entries) {
  const acc = Object.fromEntries(RES.map(r => [r, { buyPP: 0, buyAmt: 0, sellPP: 0, sellAmt: 0 }]));
  for (const e of entries) {
    if (e.category !== 'handel' || !e.resource || !e.amount) continue;
    const a = acc[e.resource];
    if (e.subtype === 'kupno') { a.buyPP += Math.abs(e.change); a.buyAmt += e.amount; }
    else { a.sellPP += Math.abs(e.change); a.sellAmt += e.amount; }
  }
  const out = {};
  for (const r of RES) {
    const a = acc[r];
    out[r] = {
      buy: a.buyPP ? a.buyAmt / a.buyPP : null,
      sell: a.sellPP ? a.sellAmt / a.sellPP : null,
    };
  }
  return out;
}
