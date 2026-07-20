// src/charts.js
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const M = { left: 52, right: 16, top: 22, bottom: 46 };
const INK = 'var(--c-axis, #8b95a3)';    // atrament etykiet osi
const GRID = 'var(--c-grid, #e4e9ef)';   // hairline siatki
const BASE = 'var(--c-base, #cbd3dd)';   // linia bazowa / oś
const POS = 'var(--c-pos, #1a7f4b)';     // dodatnie
const NEG = 'var(--c-neg, #c1443a)';     // ujemne
const LINE = 'var(--c-line, #3b4aa0)';   // seria salda
const INK2 = 'var(--c-ink2, #566072)';   // tytuł

function empty(width, height) {
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="chart" preserveAspectRatio="xMidYMid meet">` +
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="${INK}" font-size="12">brak danych</text></svg>`;
}

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const rawStep = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

function fmtTick(n) {
  const a = Math.abs(n);
  if (a >= 1000) return (n / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + 'k';
  return n.toLocaleString('pl-PL', { maximumFractionDigits: 0 });
}

function frame(width, height, title, domainMin, domainMax) {
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const yOf = v => M.top + (domainMax - v) / (domainMax - domainMin) * plotH;
  const ticks = niceTicks(domainMin, domainMax);
  let grid = '';
  for (const t of ticks) {
    if (t < domainMin - 1e-9 || t > domainMax + 1e-9) continue;
    const y = yOf(t);
    grid += `<line x1="${M.left}" y1="${y.toFixed(1)}" x2="${width - M.right}" y2="${y.toFixed(1)}" stroke="${GRID}"/>`;
    grid += `<text x="${M.left - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${INK}" style="font-variant-numeric:tabular-nums">${esc(fmtTick(t))}</text>`;
  }
  const t = title ? `<text x="${M.left}" y="13" font-size="12.5" fill="${INK2}" font-weight="600">${esc(title)}</text>` : '';
  return { plotW, plotH, yOf, grid, titleEl: t };
}

export function barChartSVG(series, opts = {}) {
  const { width = 1000, height = 260, title = '' } = opts;
  if (!series.length) return empty(width, height);
  const vals = series.map(s => s.value);
  const domainMax = Math.max(1, 0, ...vals);
  const domainMin = Math.min(0, ...vals);
  const { plotW, yOf, grid, titleEl } = frame(width, height, title, domainMin, domainMax);
  const zeroY = yOf(0);
  const bw = plotW / series.length;
  const everyX = Math.ceil(series.length / 16);
  let bars = '', xlabels = '';
  series.forEach((s, i) => {
    const x = M.left + i * bw + bw * 0.18;
    const w = Math.max(1, bw * 0.64);
    const top = s.value >= 0 ? yOf(s.value) : zeroY;
    const h = Math.max(1, Math.abs(yOf(s.value) - zeroY));
    const color = s.color || (s.value >= 0 ? POS : NEG);
    const rx = Math.min(2, w / 2);
    bars += `<rect class="bar" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}" fill="${color}" data-label="${esc(s.label)}" data-value="${s.value}"><title>${esc(s.label)}: ${s.value}</title></rect>`;
    if (i % everyX === 0) {
      const cx = M.left + i * bw + bw / 2;
      const ly = height - M.bottom + 14;
      xlabels += `<text x="${cx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="end" font-size="9.5" fill="${INK}" transform="rotate(-38 ${cx.toFixed(1)} ${ly.toFixed(1)})">${esc(s.label)}</text>`;
    }
  });
  const zeroLine = `<line x1="${M.left}" y1="${zeroY.toFixed(1)}" x2="${width - M.right}" y2="${zeroY.toFixed(1)}" stroke="${BASE}"/>`;
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="chart" preserveAspectRatio="xMidYMid meet">${titleEl}${grid}${zeroLine}${bars}${xlabels}</svg>`;
}

export function lineChartSVG(points, opts = {}) {
  const { width = 1000, height = 260, title = '', endLabel = false } = opts;
  if (!points.length) return empty(width, height);
  const { overlay, legend } = opts;   // overlay: {points,color} rysowana słabiej; legend: [{color,label}]
  const ys = points.map(p => p.y).concat(overlay ? overlay.points.map(p => p.y) : []);
  let domainMin = Math.min(...ys), domainMax = Math.max(...ys);
  if (domainMin === domainMax) { domainMin -= 1; domainMax += 1; }
  const { plotW, plotH, yOf, grid, titleEl } = frame(width, height, title, domainMin, domainMax);
  const xOf = i => M.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const bottomY = M.top + plotH;
  const coords = points.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.y).toFixed(1)}`).join(' ');
  // wypełnienie pod linią (obszar) dla czytelności
  const areaPts = `${xOf(0).toFixed(1)},${bottomY.toFixed(1)} ${coords} ${xOf(points.length - 1).toFixed(1)},${bottomY.toFixed(1)}`;
  const showDots = points.length <= 45;
  let dots = '';
  for (let i = 0; i < points.length; i++) {
    const r = showDots ? 2.6 : 0;
    dots += `<circle class="dot" cx="${xOf(i).toFixed(1)}" cy="${yOf(points[i].y).toFixed(1)}" r="${r}" fill="${LINE}" stroke="var(--c-surface, #fff)" stroke-width="1" data-label="${esc(points[i].x)}" data-value="${points[i].y}"><title>${esc(points[i].x)}: ${points[i].y}</title></circle>`;
  }
  const axis = `<line x1="${M.left}" y1="${bottomY.toFixed(1)}" x2="${width - M.right}" y2="${bottomY.toFixed(1)}" stroke="${BASE}"/>`;
  const everyX = Math.ceil(points.length / 6);
  let xlabels = '';
  for (let i = 0; i < points.length; i += everyX) {
    xlabels += `<text x="${xOf(i).toFixed(1)}" y="${(height - M.bottom + 16).toFixed(1)}" text-anchor="middle" font-size="10" fill="${INK}">${esc(String(points[i].x))}</text>`;
  }
  let endMark = '';
  if (endLabel) {
    const i = points.length - 1;
    const ex = xOf(i), ey = yOf(points[i].y);
    const val = Number(points[i].y).toLocaleString('pl-PL');
    const anchor = ex > width - M.right - 60 ? 'end' : 'start';
    const tx = anchor === 'end' ? ex - 8 : ex + 8;
    endMark = `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="4" fill="${LINE}" stroke="var(--c-surface,#fff)" stroke-width="1.5"/>` +
      `<text x="${tx.toFixed(1)}" y="${(ey - 8).toFixed(1)}" text-anchor="${anchor}" font-size="12" font-weight="700" fill="${LINE}">${val} PP</text>`;
  }
  let overlayEl = '';
  if (overlay && overlay.points.length) {
    const oc = overlay.points.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.y).toFixed(1)}`).join(' ');
    overlayEl = `<polyline fill="none" stroke="${overlay.color}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.9" points="${oc}"/>`;
  }
  let legendEl = '';
  if (legend && legend.length) {
    const lx = M.left + 8, ly = M.top + 4;
    legendEl = legend.map((it, i) => {
      const y = ly + i * 15;
      return `<rect x="${lx}" y="${(y - 4).toFixed(1)}" width="14" height="3" rx="1.5" fill="${it.color}"/>` +
        `<text x="${lx + 20}" y="${(y + 1).toFixed(1)}" font-size="10.5" fill="${INK2}">${esc(it.label)}</text>`;
    }).join('');
  }
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="chart" preserveAspectRatio="xMidYMid meet">${titleEl}${grid}${axis}` +
    `<polygon points="${areaPts}" fill="${LINE}" fill-opacity="0.10"/>${overlayEl}` +
    `<polyline fill="none" stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round" points="${coords}"/>${dots}${endMark}${legendEl}${xlabels}</svg>`;
}
