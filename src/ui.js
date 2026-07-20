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
  const rows = parseCSV(fileText);
  const start = /data/i.test(rows[0]?.[0] || '') ? 1 : 0;
  return rows.slice(start).filter(r => r.length >= 6).map(cells => {
    const raw = {}; COLS.forEach((k, i) => raw[k] = cells[i]);
    return enrich(raw, now);
  });
}

// ——— Część DOM (przeglądarka) ———
if (typeof document !== 'undefined') {
  const KEY = 'plemiona_pp_store_v1';
  const $ = sel => document.querySelector(sel);
  const ALL = '__all__';

  const loadStore = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const saveStore = arr => localStorage.setItem(KEY, JSON.stringify(arr));

  const fmt = n => (n > 0 ? '+' : '') + Math.round(n).toLocaleString('pl-PL');
  const fmtNum = n => Math.round(n).toLocaleString('pl-PL');
  const fmtRate = n => n == null ? '—' : n.toLocaleString('pl-PL', { maximumFractionDigits: 1 });

  const CATS = [
    ['handel', 'Handel'],
    ['zakup_pp', 'Zakup PP'],
    ['subskrypcje', 'Subskrypcje'],
    ['uslugi', 'Usługi'],
    ['eventy', 'Eventy'],
  ];

  function dateBounds() {
    const from = $('#f-from').value ? new Date($('#f-from').value + 'T00:00:00Z') : null;
    const to = $('#f-to').value ? new Date($('#f-to').value + 'T23:59:59Z') : null;
    return { from, to };
  }
  const inDate = (e, from, to) => {
    const d = new Date(e.ts);
    return !(from && d < from) && !(to && d > to);
  };

  function render() {
    const store = loadStore();
    const worlds = [...new Set(store.map(e => e.world))].sort();
    const sel = $('#f-world');
    const prev = sel.value || ALL;
    sel.innerHTML = `<option value="${ALL}">Wszystkie (sumarycznie)</option>` +
      worlds.map(w => `<option value="${w}">${w}</option>`).join('');
    sel.value = [...sel.options].some(o => o.value === prev) ? prev : ALL;
    const world = sel.value;

    const { from, to } = dateBounds();
    const dateFiltered = store.filter(e => inDate(e, from, to));           // wszystkie światy w okresie
    const scoped = world === ALL ? dateFiltered : dateFiltered.filter(e => e.world === world);

    const gran = $('#f-gran').value;
    const { buckets, totals } = aggregate(scoped, { granularity: gran });
    const rates = effectiveRates(scoped);
    const bilansPP = dateFiltered.reduce((s, e) => s + e.change, 0);       // wszystkie światy

    // KPI
    const kpi = (label, val, cls = '') => `<div class="kpi"><span>${label}</span><b class="${cls}">${fmt(val)}</b></div>`;
    $('#kpis').innerHTML =
      kpi('Bilans PP (wszystkie światy)', bilansPP, bilansPP >= 0 ? 'pos' : 'neg') +
      kpi('Bilans PP Handel', totals.handel, totals.handel >= 0 ? 'pos' : 'neg') +
      kpi('Zakup PP', totals.zakup_pp) +
      kpi('Subskrypcje', totals.subskrypcje, 'neg') +
      kpi('Usługi', totals.uslugi, 'neg') +
      kpi('Eventy', totals.eventy, totals.eventy >= 0 ? 'pos' : 'neg');

    // Inne światy: jedna liczba netto (tylko gdy wybrano konkretny świat)
    const ow = $('#otherworlds');
    if (world === ALL) {
      ow.style.display = 'none';
    } else {
      const other = dateFiltered.filter(e => e.world !== world).reduce((s, e) => s + e.change, 0);
      ow.style.display = '';
      ow.innerHTML = `<span>Inne światy razem (netto PP, ten sam okres):</span> <b class="${other >= 0 ? 'pos' : 'neg'}">${fmt(other)}</b>`;
    }

    // Wykresy — saldo najpierw, potem netto
    if (world === ALL) {
      $('#chart-saldo').innerHTML = `<p class="hint">Saldo PP w czasie pokazujemy dla pojedynczego świata — wybierz świat w filtrze.</p>`;
    } else {
      $('#chart-saldo').innerHTML = lineChartSVG(
        [...scoped].reverse().map(e => ({ x: e.ts.slice(0, 16).replace('T', ' '), y: e.balance })),
        { title: 'Saldo PP w czasie' });
    }
    $('#chart-balance').innerHTML = barChartSVG(
      buckets.map(b => ({ label: b.key, value: b.net })), { title: 'Bilans netto PP wg okresu' });

    // Kurs (surowce na 1 PP)
    const rr = r => `<tr><td>${r}</td><td>${fmtRate(rates[r].buy)}</td><td>${fmtRate(rates[r].sell)}</td></tr>`;
    $('#rates').innerHTML = `<tr><th>Surowiec</th><th>Kupno (szt./PP)</th><th>Sprzedaż (szt./PP)</th></tr>` +
      ['drewno', 'glina', 'zelazo'].map(rr).join('');

    // Wolumen surowców + różnica
    $('#res').innerHTML = `<tr><th>Surowiec</th><th>Kupione</th><th>Sprzedane</th><th>Różnica</th></tr>` +
      ['drewno', 'glina', 'zelazo'].map(r => {
        const x = totals.resources[r];
        return `<tr><td>${r}</td><td>${fmtNum(x.bought)}</td><td>${fmtNum(x.sold)}</td><td class="${x.diff >= 0 ? 'pos' : 'neg'}">${fmt(x.diff)}</td></tr>`;
      }).join('');

    // Rozbicie kategorii
    $('#breakdown').innerHTML = CATS.map(([key, label]) => {
      const rowsObj = totals.breakdown[key] || {};
      const rows = Object.entries(rowsObj).sort((a, b) => a[1] - b[1]);
      const body = rows.length
        ? rows.map(([k, v]) => `<tr><td>${k}</td><td class="${v >= 0 ? 'pos' : 'neg'}">${fmt(v)}</td></tr>`).join('')
        : `<tr><td colspan="2" class="muted">brak</td></tr>`;
      return `<div class="card"><h3>${label} <small>(${fmt(totals[key])} PP)</small></h3><table>` +
        `<tr><th>Pozycja</th><th>PP</th></tr>${body}</table></div>`;
    }).join('');

    // Tabela netto wg okresu
    $('#buckets').innerHTML = `<tr><th>Okres</th><th>Netto PP</th></tr>` +
      buckets.map(b => `<tr><td>${b.key}</td><td class="${b.net >= 0 ? 'pos' : 'neg'}">${fmt(b.net)}</td></tr>`).join('');

    $('#count').textContent = `${store.length} wpisów w magazynie, ${scoped.length} w widoku (${world === ALL ? 'wszystkie światy' : world})`;
  }

  async function handleFiles(fileList) {
    let store = loadStore();
    for (const f of fileList) {
      const buf = await f.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buf);
      if (/�/.test(text)) text = new TextDecoder('windows-1250').decode(buf);
      try {
        store = dedupeMerge(store, normalizeImport(text, f.name, new Date()));
      } catch (e) { alert('Błąd importu ' + f.name + ': ' + e.message); }
    }
    saveStore(store);
    render();
  }

  // Dymek (tooltip) dzielony dla wszystkich wykresów
  function setupTooltip() {
    const tt = document.createElement('div');
    tt.id = 'tt';
    document.body.appendChild(tt);
    document.addEventListener('mouseover', e => {
      const el = e.target.closest('[data-label]');
      if (!el) return;
      tt.innerHTML = `<b>${el.getAttribute('data-label')}</b><br>${Number(el.getAttribute('data-value')).toLocaleString('pl-PL')} PP`;
      tt.style.display = 'block';
    });
    document.addEventListener('mousemove', e => {
      if (tt.style.display !== 'block') return;
      tt.style.left = (e.clientX + 12) + 'px';
      tt.style.top = (e.clientY + 12) + 'px';
    });
    document.addEventListener('mouseout', e => {
      if (e.target.closest('[data-label]')) tt.style.display = 'none';
    });
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
    setupTooltip();
    render();
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', wire);
  else wire();
}
