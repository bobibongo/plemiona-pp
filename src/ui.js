// src/ui.js
import { enrich, entryKey } from './parse.js';
import { dedupeMerge } from './merge.js';
import { aggregate, effectiveRates } from './aggregate.js';
import { barChartSVG, lineChartSVG } from './charts.js';

export function parseCSV(text) {
  const firstLine = text.split('\n')[0];
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (line === '') continue;
    const cells = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

const COLS = ['dateRaw', 'world', 'txType', 'changeRaw', 'balanceRaw', 'info'];

export function normalizeImport(fileText, fileName, now = new Date()) {
  const trimmed = fileText.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const data = JSON.parse(trimmed);
    if (Array.isArray(data)) return data;                 // legacy Entry[]
    if (Array.isArray(data.rows)) return data.rows.map(r => enrich(r, now));
    throw new Error('Nieznany format JSON');
  }
  // CSV
  const rows = parseCSV(fileText);
  const start = /data/i.test(rows[0]?.[0] || '') ? 1 : 0;   // pomiń nagłówek
  return rows.slice(start).filter(r => r.length >= 6).map(cells => {
    const raw = {}; COLS.forEach((k, i) => raw[k] = cells[i]);
    return enrich(raw, now);
  });
}

// ——— Część DOM (przeglądarka) ———
if (typeof document !== 'undefined') {
  const KEY = 'plemiona_pp_store_v1';
  const $ = sel => document.querySelector(sel);

  const loadStore = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const saveStore = arr => localStorage.setItem(KEY, JSON.stringify(arr));

  const fmt = n => (n > 0 ? '+' : '') + Math.round(n).toLocaleString('pl-PL');

  function applyFilters(entries) {
    const world = $('#f-world').value;
    const from = $('#f-from').value ? new Date($('#f-from').value + 'T00:00:00Z') : null;
    const to = $('#f-to').value ? new Date($('#f-to').value + 'T23:59:59Z') : null;
    return entries.filter(e => {
      const d = new Date(e.ts);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (world && world !== '__all__' && e.world !== world) return false;
      return true;
    });
  }

  function render() {
    const store = loadStore();
    const worlds = [...new Set(store.map(e => e.world))].sort();
    const sel = $('#f-world');
    const prev = sel.value;
    sel.innerHTML = `<option value="__all__">Wszystkie (sumarycznie)</option>` +
      worlds.map(w => `<option value="${w}">${w}</option>`).join('');
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;

    const gran = $('#f-gran').value;
    const filtered = applyFilters(store);
    const { buckets, totals } = aggregate(filtered, { granularity: gran });
    const rates = effectiveRates(filtered);

    $('#kpis').innerHTML = `
      <div class="kpi"><span>Arbitraż (PP)</span><b class="${totals.arbitrageProfit >= 0 ? 'pos' : 'neg'}">${fmt(totals.arbitrageProfit)}</b></div>
      <div class="kpi"><span>Usługi (PP)</span><b class="neg">${fmt(totals.serviceCost)}</b></div>
      <div class="kpi"><span>Zewnętrzne PP</span><b>${fmt(totals.externalPP)}</b></div>
      <div class="kpi"><span>Bilans netto</span><b class="${totals.net >= 0 ? 'pos' : 'neg'}">${fmt(totals.net)}</b></div>`;

    $('#chart-balance').innerHTML = barChartSVG(
      buckets.map(b => ({ label: b.key, value: b.net })), { title: 'Bilans netto PP wg okresu', width: 900 });
    $('#chart-saldo').innerHTML = lineChartSVG(
      [...filtered].reverse().map(e => ({ x: e.ts, y: e.balance })), { title: 'Saldo PP w czasie', width: 900 });

    const rr = r => `<tr><td>${r}</td><td>${rates[r].buy != null ? rates[r].buy.toFixed(2) : '—'}</td><td>${rates[r].sell != null ? rates[r].sell.toFixed(2) : '—'}</td></tr>`;
    $('#rates').innerHTML = `<tr><th>Surowiec</th><th>Kupno PP/1000</th><th>Sprzedaż PP/1000</th></tr>` +
      ['drewno', 'glina', 'zelazo'].map(rr).join('');

    const svcEntries = Object.entries(totals.serviceBreakdown).sort((a, b) => a[1] - b[1]);
    $('#svc').innerHTML = `<tr><th>Usługa</th><th>PP</th></tr>` +
      (svcEntries.length ? svcEntries.map(([k, v]) => `<tr><td>${k}</td><td>${fmt(v)}</td></tr>`).join('')
        : `<tr><td colspan="2">brak danych</td></tr>`);

    $('#res').innerHTML = `<tr><th>Surowiec</th><th>Kupione</th><th>Sprzedane</th></tr>` +
      ['drewno', 'glina', 'zelazo'].map(r =>
        `<tr><td>${r}</td><td>${totals.resources[r].bought.toLocaleString('pl-PL')}</td><td>${totals.resources[r].sold.toLocaleString('pl-PL')}</td></tr>`).join('');

    $('#buckets').innerHTML = `<tr><th>Okres</th><th>Zarobione</th><th>Wydane</th><th>Netto</th><th>Arbitraż</th></tr>` +
      buckets.map(b => `<tr><td>${b.key}</td><td>${fmt(b.earned)}</td><td>${fmt(b.spent)}</td><td>${fmt(b.net)}</td><td>${fmt(b.arbitrageProfit)}</td></tr>`).join('');

    $('#count').textContent = `${store.length} wpisów w magazynie, ${filtered.length} po filtrach`;
  }

  async function handleFiles(fileList) {
    let store = loadStore();
    for (const f of fileList) {
      const buf = await f.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buf);
      if (/�/.test(text)) text = new TextDecoder('windows-1250').decode(buf);
      try {
        const entries = normalizeImport(text, f.name, new Date());
        store = dedupeMerge(store, entries);
      } catch (e) { alert('Błąd importu ' + f.name + ': ' + e.message); }
    }
    saveStore(store);
    render();
  }

  function wire() {
    const dz = $('#dropzone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); handleFiles(e.dataTransfer.files); });
    $('#file').addEventListener('change', e => handleFiles(e.target.files));
    ['#f-world', '#f-from', '#f-to', '#f-gran'].forEach(s => $(s).addEventListener('change', render));
    $('#export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(loadStore(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'plemiona-scalone.json'; a.click();
    });
    $('#reset').addEventListener('click', () => { if (confirm('Wyczyścić magazyn?')) { localStorage.removeItem(KEY); location.reload(); } });
    render();
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', wire);
  else wire();
}
