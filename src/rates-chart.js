// src/rates-chart.js
// Wykres przebiegu średniego kursu: oś czasu w poziomie, linia na kontynent,
// poziome linie progów. Moduł jest samowystarczalny — celowo nie korzysta
// z charts.js, żeby oba narzędzia dało się rozdzielić bez rozplątywania.

// Paleta sprawdzona walidatorem na pergaminie #f4ead2: pasmo jasności, chroma,
// rozróżnialność przy daltonizmie i kontrast. Kolejność jest stała — kolor
// przypisujemy po pozycji kontynentu, nigdy po jego miejscu w widoku.
export const SERIES_COLORS = ['#c0392b', '#1b6cc4', '#1f8a4c', '#7d3fb5', '#b06a00', '#c4187f'];
// Powyżej sześciu kontynentów nie generujemy nowych barw — wspólna szarość
// jest uczciwsza niż dwa odcienie nie do odróżnienia.
export const OTHER_COLOR = '#8a7a5e';

const MARGIN = { left: 54, right: 18, top: 30, bottom: 38 };
const AXIS_INK = '#93805f';
const GRID_LINE = '#ddcca2';
const BASE_LINE = '#c4ac7c';
const TITLE_INK = '#6b543a';
const THRESHOLD_INK = '#7c2b2b';

export function escXml(value) {
  return String(value).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function colorMap(continents) {
  const map = new Map();
  continents.forEach((c, i) => {
    map.set(c, i < SERIES_COLORS.length ? SERIES_COLORS[i] : OTHER_COLOR);
  });
  return map;
}

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const rawStep = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const ticks = [];
  const start = Math.floor(min / step) * step;
  for (let v = start; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

function dzienMiesiac(ms) {
  const d = new Date(ms);
  return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
}

// Średnia chowa to, który surowiec jest okazją — podpowiedź ma to oddać.
function podpowiedz(continent, p) {
  const glowa = `${continent} · ${dzienMiesiac(p.t)} · średnia ${p.y}`;
  const r = p.rec;
  if (!r || !Number.isFinite(r.wood)) return glowa;
  return `${glowa}\ndrewno ${r.wood} · glina ${r.stone} · żelazo ${r.iron}`;
}

function pusty(width, height) {
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="chart" preserveAspectRatio="xMidYMid meet">`
    + `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="${AXIS_INK}" font-size="12">brak danych</text></svg>`;
}

export function ratesChartSVG(series, opts = {}) {
  const { width = 1000, height = 340, thresholds = {} } = opts;
  const punkty = series.flatMap(s => s.points);
  if (!punkty.length) return pusty(width, height);

  const progi = [thresholds.high, thresholds.low].filter(v => Number.isFinite(v));
  const wartosci = punkty.map(p => p.y).concat(progi);
  let minY = Math.min(...wartosci);
  let maxY = Math.max(...wartosci);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const zapas = (maxY - minY) * 0.08;
  minY -= zapas; maxY += zapas;

  const czasy = punkty.map(p => p.t);
  const minT = Math.min(...czasy);
  const maxT = Math.max(...czasy);

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const yOf = v => MARGIN.top + (maxY - v) / (maxY - minY) * plotH;
  // Jeden punkt w czasie: rysujemy go pośrodku zamiast dzielić przez zero.
  const xOf = t => (maxT === minT ? MARGIN.left + plotW / 2
    : MARGIN.left + (t - minT) / (maxT - minT) * plotW);

  let siatka = '';
  for (const t of niceTicks(minY, maxY)) {
    if (t < minY || t > maxY) continue;
    const y = yOf(t);
    siatka += `<line x1="${MARGIN.left}" y1="${y.toFixed(1)}" x2="${width - MARGIN.right}" y2="${y.toFixed(1)}" stroke="${GRID_LINE}"/>`
      + `<text x="${MARGIN.left - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${AXIS_INK}" style="font-variant-numeric:tabular-nums">${Math.round(t)}</text>`;
  }

  // Progi: przerywane i w neutralnym akcencie, żeby nie udawały serii danych.
  let progiEl = '';
  for (const [klucz, etykieta] of [['high', 'kupuj powyżej'], ['low', 'sprzedawaj poniżej']]) {
    const v = thresholds[klucz];
    if (!Number.isFinite(v) || v < minY || v > maxY) continue;
    const y = yOf(v);
    progiEl += `<line x1="${MARGIN.left}" y1="${y.toFixed(1)}" x2="${width - MARGIN.right}" y2="${y.toFixed(1)}" stroke="${THRESHOLD_INK}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.75"/>`
      + `<text x="${width - MARGIN.right - 4}" y="${(y - 5).toFixed(1)}" text-anchor="end" font-size="10" fill="${THRESHOLD_INK}">${escXml(etykieta)} ${Math.round(v)}</text>`;
  }

  let linie = '';
  for (const s of series) {
    if (!s.points.length) continue;
    const wsp = s.points.map(p => `${xOf(p.t).toFixed(1)},${yOf(p.y).toFixed(1)}`).join(' ');
    linie += `<polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${wsp}"/>`;
    for (const p of s.points) {
      linie += `<circle class="dot" cx="${xOf(p.t).toFixed(1)}" cy="${yOf(p.y).toFixed(1)}" r="3.2" fill="${s.color}" stroke="#f4ead2" stroke-width="1.5" data-continent="${escXml(s.continent)}" data-t="${p.t}" data-y="${p.y}"><title>${escXml(podpowiedz(s.continent, p))}</title></circle>`;
    }
  }

  const os = `<line x1="${MARGIN.left}" y1="${(MARGIN.top + plotH).toFixed(1)}" x2="${width - MARGIN.right}" y2="${(MARGIN.top + plotH).toFixed(1)}" stroke="${BASE_LINE}"/>`;

  let etykietyX = '';
  const krokow = 6;
  for (let i = 0; i <= krokow; i++) {
    const t = minT + (maxT - minT) * (i / krokow);
    etykietyX += `<text x="${xOf(t).toFixed(1)}" y="${(height - MARGIN.bottom + 16).toFixed(1)}" text-anchor="middle" font-size="10" fill="${AXIS_INK}">${dzienMiesiac(t)}</text>`;
    if (maxT === minT) break;
  }

  // Legenda zawsze obecna: przy wielu seriach tożsamość nie może zależeć
  // wyłącznie od koloru.
  let legenda = '';
  series.forEach((s, i) => {
    const x = MARGIN.left + i * 78;
    legenda += `<rect x="${x}" y="${MARGIN.top - 20}" width="14" height="3" rx="1.5" fill="${s.color}"/>`
      + `<text x="${x + 19}" y="${MARGIN.top - 14}" font-size="10.5" fill="${TITLE_INK}">${escXml(s.continent)}</text>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="chart" preserveAspectRatio="xMidYMid meet">`
    + `${siatka}${os}${progiEl}${linie}${etykietyX}${legenda}</svg>`;
}
