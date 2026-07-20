// src/charts.js
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const M = { left: 56, right: 14, top: 22, bottom: 42 };

function empty(width, height) {
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="chart">` +
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#888">brak danych</text></svg>`;
}

// Ładne wartości podziałki osi Y.
function niceTicks(min, max, count = 5) {
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

// Wspólne rusztowanie: osie Y (siatka + etykiety) i podpis tytułu.
function frame(width, height, title, domainMin, domainMax) {
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const yOf = v => M.top + (domainMax - v) / (domainMax - domainMin) * plotH;
  const ticks = niceTicks(domainMin, domainMax);
  let grid = '';
  for (const t of ticks) {
    if (t < domainMin - 1e-9 || t > domainMax + 1e-9) continue;
    const y = yOf(t);
    grid += `<line x1="${M.left}" y1="${y.toFixed(1)}" x2="${width - M.right}" y2="${y.toFixed(1)}" stroke="#e6ddc8"/>`;
    grid += `<text x="${M.left - 6}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="#777">${esc(fmtTick(t))}</text>`;
  }
  const t = title ? `<text x="${M.left}" y="14" font-size="13" fill="#333">${esc(title)}</text>` : '';
  return { plotW, plotH, yOf, grid, titleEl: t };
}

export function barChartSVG(series, opts = {}) {
  const { width = 900, height = 260, title = '' } = opts;
  if (!series.length) return empty(width, height);
  const vals = series.map(s => s.value);
  const domainMax = Math.max(1, 0, ...vals);
  const domainMin = Math.min(0, ...vals);
  const { plotW, yOf, grid, titleEl } = frame(width, height, title, domainMin, domainMax);
  const zeroY = yOf(0);
  const bw = plotW / series.length;
  const everyX = Math.ceil(series.length / 14);
  let bars = '', xlabels = '';
  series.forEach((s, i) => {
    const x = M.left + i * bw + bw * 0.15;
    const w = bw * 0.7;
    const y = s.value >= 0 ? yOf(s.value) : zeroY;
    const h = Math.max(1, Math.abs(yOf(s.value) - zeroY));
    const color = s.color || (s.value >= 0 ? '#2e7d32' : '#c62828');
    bars += `<rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" data-label="${esc(s.label)}" data-value="${s.value}"><title>${esc(s.label)}: ${s.value}</title></rect>`;
    if (i % everyX === 0) {
      const cx = M.left + i * bw + bw / 2;
      xlabels += `<text x="${cx.toFixed(1)}" y="${(height - M.bottom + 14).toFixed(1)}" text-anchor="end" font-size="10" fill="#777" transform="rotate(-40 ${cx.toFixed(1)} ${(height - M.bottom + 14).toFixed(1)})">${esc(s.label)}</text>`;
    }
  });
  const zeroLine = `<line x1="${M.left}" y1="${zeroY.toFixed(1)}" x2="${width - M.right}" y2="${zeroY.toFixed(1)}" stroke="#b0a080"/>`;
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="chart">${titleEl}${grid}${zeroLine}${bars}${xlabels}</svg>`;
}

export function lineChartSVG(points, opts = {}) {
  const { width = 900, height = 260, title = '' } = opts;
  if (!points.length) return empty(width, height);
  const ys = points.map(p => p.y);
  let domainMin = Math.min(...ys), domainMax = Math.max(...ys);
  if (domainMin === domainMax) { domainMin -= 1; domainMax += 1; }
  const { plotW, yOf, grid, titleEl } = frame(width, height, title, domainMin, domainMax);
  const xOf = i => M.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const coords = points.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.y).toFixed(1)}`).join(' ');
  let dots = '';
  for (let i = 0; i < points.length; i++) {
    dots += `<circle class="dot" cx="${xOf(i).toFixed(1)}" cy="${yOf(points[i].y).toFixed(1)}" r="2.5" fill="#1565c0" data-label="${esc(points[i].x)}" data-value="${points[i].y}"><title>${esc(points[i].x)}: ${points[i].y}</title></circle>`;
  }
  const everyX = Math.ceil(points.length / 7);
  let xlabels = '';
  for (let i = 0; i < points.length; i += everyX) {
    const label = String(points[i].x).slice(0, 10);
    xlabels += `<text x="${xOf(i).toFixed(1)}" y="${(height - M.bottom + 14).toFixed(1)}" text-anchor="middle" font-size="10" fill="#777">${esc(label)}</text>`;
  }
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="chart">${titleEl}${grid}` +
    `<polyline fill="none" stroke="#1565c0" stroke-width="1.6" points="${coords}"/>${dots}${xlabels}</svg>`;
}
