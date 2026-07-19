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

export function aggregate(entries, { granularity }) {
  const map = new Map();
  const totals = {
    earned: 0, spent: 0, net: 0, arbitrageProfit: 0, serviceCost: 0, externalPP: 0,
    resources: Object.fromEntries(RES.map(r => [r, { bought: 0, sold: 0 }])),
    serviceBreakdown: {},
  };
  for (const e of entries) {
    const key = bucketKey(e.ts, granularity);
    if (!map.has(key)) map.set(key, { key, earned: 0, spent: 0, net: 0, arbitrageProfit: 0, serviceCost: 0, externalPP: 0 });
    const b = map.get(key);
    if (e.change >= 0) { b.earned += e.change; totals.earned += e.change; }
    else { b.spent += e.change; totals.spent += e.change; }
    b.net += e.change; totals.net += e.change;
    if (e.category === 'arbitraz') { b.arbitrageProfit += e.change; totals.arbitrageProfit += e.change; }
    if (e.category === 'usluga') {
      b.serviceCost += e.change; totals.serviceCost += e.change;
      totals.serviceBreakdown[e.subtype] = (totals.serviceBreakdown[e.subtype] || 0) + e.change;
    }
    if (e.category === 'zewnetrzne_pp') { b.externalPP += e.change; totals.externalPP += e.change; }
    if (e.category === 'arbitraz' && e.resource && e.amount) {
      totals.resources[e.resource][e.subtype === 'kupno' ? 'bought' : 'sold'] += e.amount;
    }
  }
  const buckets = [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { buckets, totals };
}

export function effectiveRates(entries) {
  const acc = Object.fromEntries(RES.map(r => [r, { buyPP: 0, buyAmt: 0, sellPP: 0, sellAmt: 0 }]));
  for (const e of entries) {
    if (e.category !== 'arbitraz' || !e.resource || !e.amount) continue;
    const a = acc[e.resource];
    if (e.subtype === 'kupno') { a.buyPP += Math.abs(e.change); a.buyAmt += e.amount; }
    else { a.sellPP += Math.abs(e.change); a.sellAmt += e.amount; }
  }
  const out = {};
  for (const r of RES) {
    const a = acc[r];
    out[r] = {
      buy: a.buyAmt ? (a.buyPP / a.buyAmt) * 1000 : null,
      sell: a.sellAmt ? (a.sellPP / a.sellAmt) * 1000 : null,
    };
  }
  return out;
}
