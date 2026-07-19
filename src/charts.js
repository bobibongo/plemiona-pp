// src/charts.js
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function empty(width, height) {
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">` +
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#888">brak danych</text></svg>`;
}

export function barChartSVG(series, opts = {}) {
  const { width = 640, height = 240, title = '' } = opts;
  if (!series.length) return empty(width, height);
  const pad = 30;
  const max = Math.max(1, ...series.map(s => Math.abs(s.value)));
  const zeroY = height / 2;
  const bw = (width - pad * 2) / series.length;
  const bars = series.map((s, i) => {
    const h = (Math.abs(s.value) / max) * (height / 2 - pad);
    const x = pad + i * bw + bw * 0.15;
    const w = bw * 0.7;
    const y = s.value >= 0 ? zeroY - h : zeroY;
    const color = s.color || (s.value >= 0 ? '#2e7d32' : '#c62828');
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" fill="${color}"><title>${esc(s.label)}: ${s.value}</title></rect>`;
  }).join('');
  const t = title ? `<text x="8" y="16" font-size="13" fill="#333">${esc(title)}</text>` : '';
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${t}` +
    `<line x1="${pad}" y1="${zeroY}" x2="${width - pad}" y2="${zeroY}" stroke="#ccc"/>${bars}</svg>`;
}

export function lineChartSVG(points, opts = {}) {
  const { width = 640, height = 240, title = '' } = opts;
  if (!points.length) return empty(width, height);
  const pad = 30;
  const ys = points.map(p => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((p.y - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const t = title ? `<text x="8" y="16" font-size="13" fill="#333">${esc(title)}</text>` : '';
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${t}` +
    `<polyline fill="none" stroke="#1565c0" stroke-width="2" points="${coords}"/></svg>`;
}
