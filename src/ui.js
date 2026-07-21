// src/ui.js
import { enrich, entryKey, classify } from './parse.js';
import { dedupeMerge } from './merge.js';
import { aggregate, effectiveRates, bucketKey } from './aggregate.js';
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

  // Dane trzymamy w pamięci (szybki render). Do localStorage zapisujemy formę
  // kompaktową (bez pól pochodnych) skompresowaną gzipem — pełny wieloletni log
  // (dziesiątki tys. wpisów) nie mieści się w localStorage jako pełny JSON.
  let STORE = [];

  const COMPACT_FIELDS = ['ts', 'world', 'txType', 'change', 'balance', 'info'];
  const toCompact = e => { const o = {}; for (const k of COMPACT_FIELDS) o[k] = e[k]; return o; };
  const hydrate = e => ({ ...e, ...classify({ txType: e.txType, info: e.info, changeRaw: e.change }) });

  const bytesToB64 = bytes => { let s = ''; const CH = 0x8000; for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return btoa(s); };
  const b64ToBytes = b64 => { const s = atob(b64); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
  async function gzip(str) {
    const cs = new CompressionStream('gzip'); const w = cs.writable.getWriter();
    w.write(new TextEncoder().encode(str)); w.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  }
  async function gunzip(bytes) {
    const ds = new DecompressionStream('gzip'); const w = ds.writable.getWriter();
    w.write(bytes); w.close();
    return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
  }

  async function loadStore() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    try {
      const json = raw.startsWith('gz:') ? await gunzip(b64ToBytes(raw.slice(3))) : raw;
      const arr = JSON.parse(json);
      return arr.map(hydrate);   // odtwarza kategorie/etykiety/surowce z info
    } catch (e) { console.error('Błąd wczytania magazynu:', e); return []; }
  }
  async function persist(store) {
    const json = JSON.stringify(store.map(toCompact));
    try {
      if (typeof CompressionStream !== 'undefined') {
        localStorage.setItem(KEY, 'gz:' + bytesToB64(await gzip(json)));
      } else {
        localStorage.setItem(KEY, json);
      }
    } catch (e) {
      try { localStorage.setItem(KEY, json); }
      catch (e2) { alert('Za dużo danych na magazyn przeglądarki. Zawęź zakres dat lub wyeksportuj i podziel dane.'); }
    }
  }

  const fmt = n => (n > 0 ? '+' : '') + Math.round(n).toLocaleString('pl-PL');
  const fmtNum = n => Math.round(n).toLocaleString('pl-PL');
  const fmtRate = n => n == null ? '—' : Math.round(n).toLocaleString('pl-PL');   // kurs w całościach
  const sc = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';

  const selectedBuckets = new Set();   // wybrane dni w tabeli okresowej (prawa kolumna liczy dla nich)
  let granTouched = false;             // czy użytkownik ręcznie wybrał granulację
  let periodSort = { key: 'date', dir: 'asc' };   // sortowanie tabeli okresowej

  // Auto-dobór granulacji do długości zakresu (długi zakres = czytelniej miesiącami)
  function suggestGran(entries) {
    if (entries.length < 2) return 'day';
    let min = Infinity, max = -Infinity;
    for (const e of entries) { const t = +new Date(e.ts); if (t < min) min = t; if (t > max) max = t; }
    const days = (max - min) / 86400000;
    return days > 730 ? 'month' : days > 180 ? 'week' : 'day';
  }

  // Wykres salda rysujemy na dokładny rozmiar kontenera (wypełnia całą wysokość karty).
  let lastSaldoPts = [];
  let lastSaldoTitle = 'Saldo PP';
  let lastSaldoOverlay = null, lastSaldoLegend = null;
  function drawSaldo() {
    const box = $('#chart-saldo');
    if (!box) return;
    const w = Math.max(360, Math.round(box.clientWidth) || 900);
    const h = Math.max(240, Math.round(box.clientHeight) || 300);
    box.innerHTML = lineChartSVG(lastSaldoPts, {
      title: lastSaldoTitle, width: w, height: h, endLabel: true,
      overlay: lastSaldoOverlay, legend: lastSaldoLegend,
    });
  }

  function dateBounds() {
    const from = $('#f-from').value ? new Date($('#f-from').value + 'T00:00:00Z') : null;
    const to = $('#f-to').value ? new Date($('#f-to').value + 'T23:59:59Z') : null;
    return { from, to };
  }
  const inDate = (e, from, to) => {
    const d = new Date(e.ts);
    return !(from && d < from) && !(to && d > to);
  };

  const kpi = (label, val, { unit = 'PP', signed = true, cls, sum = false, sub = '' } = {}) => {
    const txt = signed ? fmt(val) : fmtNum(val);
    const c = cls !== undefined ? cls : sc(val);
    return `<div class="kpi${sum ? ' sum' : ''}"><span>${label}</span><b class="${c}">${txt}<i>${unit}</i></b>` +
      (sub ? `<div class="kpi-sub">${sub}</div>` : '') + `</div>`;
  };
  const lrow = (label, val, { unit = 'PP', signed = true, cls, sum = false } = {}) => {
    const txt = signed ? fmt(val) : fmtNum(val);
    const c = cls !== undefined ? cls : sc(val);
    return `<div class="lrow${sum ? ' sum' : ''}"><span>${label}</span><b class="${c}">${txt}<i>${unit}</i></b></div>`;
  };
  const block = (title, rows) => `<div class="card block"><h3>${title}</h3>${rows}</div>`;

  // Kolejność światów: numerycznie malejąco (nowsze/wyższe wyżej), nienumeryczne (np. Szybkie) na końcu
  function worldCmp(a, b) {
    const na = parseInt((a.match(/\d+/) || [])[0], 10), nb = parseInt((b.match(/\d+/) || [])[0], 10);
    const aNum = !Number.isNaN(na), bNum = !Number.isNaN(nb);
    if (aNum && bNum) return nb - na;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b, 'pl');
  }

  function render() {
    const store = STORE;
    const worlds = [...new Set(store.map(e => e.world))].sort(worldCmp);
    const sel = $('#f-world');
    const prev = sel.value || ALL;
    sel.innerHTML = `<option value="${ALL}">Wszystkie (sumarycznie)</option>` +
      worlds.map(w => `<option value="${w}">${w}</option>`).join('');
    sel.value = [...sel.options].some(o => o.value === prev) ? prev : ALL;
    const world = sel.value;
    const worldName = world === ALL ? 'Wszystkie światy' : world;
    const chosen = world !== ALL;

    const { from, to } = dateBounds();
    const dateFiltered = store.filter(e => inDate(e, from, to));
    const scoped = chosen ? dateFiltered.filter(e => e.world === world) : dateFiltered;

    let gran = $('#f-gran').value;
    if (!granTouched) { gran = suggestGran(scoped); if ($('#f-gran').value !== gran) $('#f-gran').value = gran; }
    const { buckets, totals: t } = aggregate(scoped, { granularity: gran });

    const handelIn = t.breakdown.handel['Sprzedaż'] || 0;
    const handelOut = t.breakdown.handel['Kupno'] || 0;
    const pozaSuma = t.subskrypcje + t.uslugi + t.eventy;

    // === Górny rząd: 5 kafli głównych sum (wybrany świat) ===
    $('#kpi-row').innerHTML =
      kpi('Bilans ogólny', t.net, { sum: true }) +
      kpi('Handel PP', t.handel) +
      kpi('Handel surowce', t.resTotal.diff, { unit: 'szt.' }) +
      kpi('Wydatki poza handlem', pozaSuma) +
      kpi('Zakupione / otrzymane PP', t.zakup_pp);

    // === 3 bloki szczegółów ===
    $('#blocks').innerHTML =
      block('Handel PP',
        lrow('Zyskane (sprzedaż)', handelIn, { cls: 'pos' }) +
        lrow('Wydane (kupno)', handelOut, { cls: 'neg' }) +
        lrow('Suma', t.handel, { sum: true })) +
      block('Handel surowce',
        lrow('Kupione', t.resTotal.bought, { unit: 'szt.', signed: false, cls: '' }) +
        lrow('Sprzedane', t.resTotal.sold, { unit: 'szt.', signed: false, cls: '' }) +
        lrow('Różnica', t.resTotal.diff, { unit: 'szt.', sum: true })) +
      block('Wydatki poza handlem',
        lrow('Subskrypcje', t.subskrypcje, { cls: 'neg' }) +
        lrow('Usługi', t.uslugi, { cls: 'neg' }) +
        lrow('Eventy', t.eventy, { cls: sc(t.eventy) }) +
        lrow('Suma', pozaSuma, { sum: true }));

    // === Wykres salda ===
    const shortKey = k =>
      k.length === 10 ? k.slice(8, 10) + '.' + k.slice(5, 7)          // YYYY-MM-DD -> DD.MM
        : /^\d{4}-\d{2}$/.test(k) ? k.slice(5, 7) + '.' + k.slice(0, 4) // YYYY-MM -> MM.YYYY
          : k.replace(/^\d{4}-/, '');                                    // YYYY-Www -> Www
    const asc = (a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);

    if (!chosen) {
      // całe konto: saldo (Nowe saldo PP) na koniec okresu
      const closing = new Map();
      for (const e of [...dateFiltered].sort(asc)) closing.set(bucketKey(e.ts, gran), e.balance);
      lastSaldoPts = [...closing].map(([k, v]) => ({ x: shortKey(k), y: v }));
      lastSaldoTitle = 'Saldo PP — całe konto';
      lastSaldoOverlay = null; lastSaldoLegend = null;
    } else {
      // wybrany świat: skumulowany wkład tego świata + saldo konta w tle (różnica = inne światy)
      const sortedScoped = [...scoped].sort(asc);
      const minTs = sortedScoped[0]?.ts, maxTs = sortedScoped[sortedScoped.length - 1]?.ts;
      const inRange = e => e.ts >= minTs && e.ts <= maxTs;
      const acct = new Map();       // saldo konta (wszystkie światy) w oknie
      for (const e of dateFiltered.filter(inRange).sort(asc)) acct.set(bucketKey(e.ts, gran), e.balance);
      const wnet = new Map();       // zmiana wybranego świata na okres
      for (const e of scoped) { const k = bucketKey(e.ts, gran); wnet.set(k, (wnet.get(k) || 0) + e.change); }
      let cum = 0;
      const worldPts = [], acctPts = [];
      for (const k of acct.keys()) {
        cum += (wnet.get(k) || 0);
        worldPts.push({ x: shortKey(k), y: cum });
        acctPts.push({ x: shortKey(k), y: acct.get(k) });
      }
      lastSaldoPts = worldPts;
      lastSaldoTitle = `Skumulowany bilans PP — ${world}`;
      lastSaldoOverlay = { points: acctPts, color: 'var(--c-axis, #8b95a3)' };
      lastSaldoLegend = [
        { color: 'var(--c-line, #3b4aa0)', label: `Wkład: ${world}` },
        { color: 'var(--c-axis, #8b95a3)', label: 'Saldo całego konta' },
      ];
    }
    drawSaldo();

    // === Wykres bilansu netto (wybrany świat lub wszystkie sumarycznie) ===
    $('#chart-balance').innerHTML = barChartSVG(
      buckets.map(b => ({ label: shortKey(b.key), value: b.net })),
      { title: `Bilans netto PP wg okresu — ${chosen ? world : 'wszystkie światy'}` });

    // === Bilans okresowy (lewa kolumna, klikalne daty, sortowalne kolumny) ===
    const arrow = k => periodSort.key === k ? (periodSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    const sortVal = (b, k) => k === 'date' ? b.key : b[k];
    const sortedBuckets = [...buckets].sort((a, b) => {
      const av = sortVal(a, periodSort.key), bv = sortVal(b, periodSort.key);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return periodSort.dir === 'asc' ? cmp : -cmp;
    });
    $('#buckets').innerHTML =
      `<tr><th data-sort="date">Data${arrow('date')}</th><th data-sort="net">Bilans PP${arrow('net')}</th>` +
      `<th data-sort="handel">PP z handlu${arrow('handel')}</th><th data-sort="resDiff">Różnica surowców${arrow('resDiff')}</th></tr>` +
      sortedBuckets.map(b => `<tr data-key="${b.key}"${selectedBuckets.has(b.key) ? ' class="sel"' : ''}><td>${b.key}</td>` +
        `<td class="${sc(b.net)}">${fmt(b.net)}</td>` +
        `<td class="${sc(b.handel)}">${fmt(b.handel)}</td>` +
        `<td class="${sc(b.resDiff)}">${b.resDiff ? fmt(b.resDiff) : '—'}</td></tr>`).join('');
    const n = selectedBuckets.size;
    $('#period-hint').innerHTML = n
      ? `Wybrane dni: <b>${n}</b> — <span class="link" id="clear-sel">wyczyść</span>`
      : `Kliknij wiersze, aby policzyć prawą kolumnę dla wybranych dni.`;

    // === Prawa kolumna (konsolidacja dla wyboru) ===
    const consEntries = n ? scoped.filter(e => selectedBuckets.has(bucketKey(e.ts, gran))) : scoped;
    const { totals: ct } = aggregate(consEntries, { granularity: gran });
    const crates = effectiveRates(consEntries);

    $('#restable').innerHTML =
      `<tr><th>Surowiec</th><th>Kupione</th><th>Sprzedane</th><th>Różnica</th></tr>` +
      ['drewno', 'glina', 'zelazo'].map(r => {
        const x = ct.resources[r];
        return `<tr><td>${r}</td><td>${fmtNum(x.bought)}</td><td>${fmtNum(x.sold)}</td>` +
          `<td class="${sc(x.diff)}">${fmt(x.diff)}</td></tr>`;
      }).join('');

    $('#rates').innerHTML =
      `<tr><th>Surowiec</th><th>Kurs kupno</th><th>Kurs sprzedaż</th></tr>` +
      ['drewno', 'glina', 'zelazo'].map(r =>
        `<tr><td>${r}</td><td>${fmtRate(crates[r].buy)}</td><td>${fmtRate(crates[r].sell)}</td></tr>`).join('');

    // wszystkie pozycje jako lista {label, v}, rozdzielone po znaku (przychody / wydatki)
    const CATLABEL = { subskrypcje: 'Subskrypcje', uslugi: 'Usługi', eventy: 'Eventy' };
    const items = [
      { label: 'Sprzedaż na giełdzie', v: ct.breakdown.handel['Sprzedaż'] || 0 },
      { label: 'Zakup na giełdzie', v: ct.breakdown.handel['Kupno'] || 0 },
      { label: 'Zakup / otrzymanie PP', v: ct.zakup_pp },
    ];
    for (const cat of ['subskrypcje', 'uslugi', 'eventy'])
      for (const [lbl, v] of Object.entries(ct.breakdown[cat]))
        items.push({ label: `${CATLABEL[cat]} · ${lbl}`, v });
    const przychody = items.filter(i => i.v > 0).sort((a, b) => b.v - a.v);
    const wydatki = items.filter(i => i.v < 0).sort((a, b) => a.v - b.v);
    const sumIn = przychody.reduce((s, i) => s + i.v, 0);
    const sumOut = wydatki.reduce((s, i) => s + i.v, 0);
    const rowsHtml = arr => arr.map(i => `<tr><td>${i.label}</td><td class="${sc(i.v)}">${fmt(i.v)}</td></tr>`).join('')
      || `<tr><td colspan="2" class="muted">brak</td></tr>`;
    const d =
      `<tr class="grp-row"><td>Przychody</td><td class="pos">${fmt(sumIn)}</td></tr>${rowsHtml(przychody)}` +
      `<tr class="grp-row"><td>Wydatki</td><td class="neg">${fmt(sumOut)}</td></tr>${rowsHtml(wydatki)}` +
      `<tr class="total-row"><td>Bilans PP</td><td class="${sc(ct.net)}">${fmt(ct.net)}</td></tr>`;
    $('#detail').innerHTML = `<tr><th>Pozycja</th><th>PP</th></tr>${d}`;

    // aktualne saldo konta = "Nowe saldo PP" najnowszego wpisu (całe konto, niezależnie od filtrów)
    const newest = store.reduce((a, b) => (!a || b.ts > a.ts ? b : a), null);
    const currentPP = newest ? newest.balance : 0;
    $('#count').innerHTML = `Aktualne saldo konta: <b>${fmtNum(currentPP)} PP</b> · ` +
      `${store.length} wpisów, ${scoped.length} w widoku (${worldName})`;
  }

  async function handleFiles(fileList) {
    for (const f of fileList) {
      const buf = await f.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buf);
      if (/�/.test(text)) text = new TextDecoder('windows-1250').decode(buf);
      try {
        STORE = dedupeMerge(STORE, normalizeImport(text, f.name, new Date()));
      } catch (e) { alert('Błąd importu ' + f.name + ': ' + e.message); }
    }
    await persist(STORE);
    render();
  }

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

  async function wire() {
    const dz = $('#dropzone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); handleFiles(e.dataTransfer.files); });
    $('#file').addEventListener('change', e => handleFiles(e.target.files));
    ['#f-world', '#f-from', '#f-to'].forEach(s => $(s).addEventListener('change', () => { granTouched = false; selectedBuckets.clear(); render(); }));
    $('#f-gran').addEventListener('change', () => { granTouched = true; selectedBuckets.clear(); render(); });
    $('#buckets').addEventListener('click', e => {
      const th = e.target.closest('th[data-sort]');
      if (th) {
        const k = th.getAttribute('data-sort');
        if (periodSort.key === k) periodSort.dir = periodSort.dir === 'asc' ? 'desc' : 'asc';
        else periodSort = { key: k, dir: k === 'date' ? 'asc' : 'desc' };
        render();
        return;
      }
      const tr = e.target.closest('tr[data-key]');
      if (!tr) return;
      const k = tr.getAttribute('data-key');
      selectedBuckets.has(k) ? selectedBuckets.delete(k) : selectedBuckets.add(k);
      render();
    });
    document.addEventListener('click', e => {
      if (e.target.id === 'clear-sel') { selectedBuckets.clear(); render(); }
    });
    $('#export').addEventListener('click', () => {
      // pełne wpisy (z kategoriami) — tablica Entry[], którą import wczyta bez zmian
      const blob = new Blob([JSON.stringify(STORE)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'plemiona-scalone.json'; a.click();
    });
    $('#reset').addEventListener('click', () => { if (confirm('Wyczyścić magazyn?')) { localStorage.removeItem(KEY); STORE = []; render(); } });
    let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawSaldo, 150); });
    setupTooltip();
    STORE = await loadStore();
    render();
    requestAnimationFrame(drawSaldo);
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', wire);
  else wire();
}
