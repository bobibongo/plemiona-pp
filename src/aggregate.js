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
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0');
  if (granularity === 'month') return `${y}-${m}`;
  if (granularity === 'week') {
    const { year, week } = isoWeek(d);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const RES = ['drewno', 'glina', 'zelazo'];
const CATEGORIES = ['handel', 'zakup_pp', 'subskrypcje', 'uslugi', 'eventy'];

function newBucket(key) {
  const b = { key, net: 0, earned: 0, spent: 0, bought: 0, sold: 0, resDiff: 0 };
  for (const c of CATEGORIES) b[c] = 0;
  return b;
}

export function aggregate(entries, { granularity }) {
  const map = new Map();
  const totals = {
    net: 0, earned: 0, spent: 0,
    resources: Object.fromEntries(RES.map(r => [r, { bought: 0, sold: 0, diff: 0 }])),
    resTotal: { bought: 0, sold: 0, diff: 0 },
    breakdown: Object.fromEntries(CATEGORIES.map(c => [c, {}])),
  };
  for (const c of CATEGORIES) totals[c] = 0;

  for (const e of entries) {
    const key = bucketKey(e.ts, granularity);
    if (!map.has(key)) map.set(key, newBucket(key));
    const b = map.get(key);

    b.net += e.change; totals.net += e.change;
    if (e.change >= 0) { b.earned += e.change; totals.earned += e.change; }
    else { b.spent += e.change; totals.spent += e.change; }

    if (CATEGORIES.includes(e.category)) {
      b[e.category] += e.change;
      totals[e.category] += e.change;
      const label = e.label || e.subtype || 'inne';
      totals.breakdown[e.category][label] = (totals.breakdown[e.category][label] || 0) + e.change;
    }
    if (e.category === 'handel' && e.resource && e.amount) {
      const dir = e.subtype === 'kupno' ? 'bought' : 'sold';
      totals.resources[e.resource][dir] += e.amount;
      totals.resTotal[dir] += e.amount;
      b[dir] += e.amount;
    }
  }

  for (const r of RES) totals.resources[r].diff = totals.resources[r].bought - totals.resources[r].sold;
  totals.resTotal.diff = totals.resTotal.bought - totals.resTotal.sold;
  for (const b of map.values()) b.resDiff = b.bought - b.sold;

  const buckets = [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { buckets, totals };
}

// Stan/zdrowie logu: zakres, liczba wpisów/światów i wykrywanie LUK.
// Luki wykrywamy rekonstruując łańcuch salda: dla każdego wpisu (saldo − zmiana)
// powinno równać się saldu po poprzednim wpisie. W obrębie tej samej minuty
// odtwarzamy właściwą kolejność po saldzie (ts ma rozdzielczość do minuty),
// więc metoda jest odporna na dwuznaczność kolejności w minucie.
export function logHealth(entries) {
  const count = entries.length;
  if (!count) return { count: 0, worlds: 0, minTs: null, maxTs: null, gaps: [], gapCount: 0, missingPP: 0, complete: true };
  const sorted = [...entries].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  const worlds = new Set(entries.map(e => e.world)).size;
  const gaps = [];
  let expected = null;
  for (let i = 0; i < sorted.length;) {
    let j = i; while (j < sorted.length && sorted[j].ts === sorted[i].ts) j++;
    const pool = sorted.slice(i, j);
    let exp = expected;
    while (pool.length) {
      let idx = exp === null ? -1 : pool.findIndex(e => e.balance - e.change === exp);
      if (idx === -1) {
        // głowa łańcucha w grupie: wpis, którego poprzednie saldo nie jest wśród pozostałych
        const produced = new Set(pool.map(e => e.balance));
        idx = pool.findIndex(e => !produced.has(e.balance - e.change));
        if (idx === -1) idx = 0;
        if (exp !== null) gaps.push({ ts: sorted[i].ts, missing: (pool[idx].balance - pool[idx].change) - exp });
      }
      exp = pool[idx].balance;
      pool.splice(idx, 1);
    }
    expected = exp;
    i = j;
  }
  const missingPP = gaps.reduce((s, g) => s + g.missing, 0);
  // Werdykt po missingPP (netto): mówi, czy sumy PP są wiarygodne. Sama liczba
  // „gaps” bywa zawyżona przez dwuznaczność kolejności w minucie (netto 0).
  return { count, worlds, minTs: sorted[0].ts, maxTs: sorted[sorted.length - 1].ts, gaps, gapCount: gaps.length, missingPP, complete: missingPP === 0 };
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
