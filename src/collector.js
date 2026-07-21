// src/collector.js
import { parsePremiumDate } from './shared-date.js';

export function buildLogUrl(baseHref, page) {
  if (/([?&])page=\d+/.test(baseHref)) return baseHref.replace(/([?&]page=)\d+/, `$1${page}`);
  return baseHref + (baseHref.includes('?') ? '&' : '?') + `page=${page}`;
}

// Selektor wierszy tabeli logu. Bierzemy wiersze z co najmniej 6 komórkami td,
// których pierwsza komórka wygląda jak data (odsiewa nagłówek i śmieci).
export function extractRawRows(doc) {
  const trs = doc.querySelectorAll('#premium_history_table tr, table tr');
  const out = [];
  for (const tr of trs) {
    const cells = tr.querySelectorAll('td');
    if (!cells || cells.length < 6) continue;
    const t = i => (cells[i].textContent || '').replace(/ /g, ' ').trim();
    const dateRaw = t(0);
    if (!/^\s*\d{2}\.\d{2}\./.test(dateRaw)) continue;
    out.push({ dateRaw, world: t(1), txType: t(2), changeRaw: t(3), balanceRaw: t(4), info: t(5) });
  }
  return out;
}

export function oldestDate(rows, now) {
  let oldest = null;
  for (const r of rows) {
    const d = parsePremiumDate(r.dateRaw, now);
    if (!oldest || d < oldest) oldest = d;
  }
  return oldest;
}

export function shouldStop(rows, sinceDate, now) {
  const oldest = oldestDate(rows, now);
  return oldest !== null && oldest < sinceDate;
}

// ——— Panel uruchamiany tylko w przeglądarce ———
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  (async function () {
    const now = new Date();
    const trybNowe = confirm('OK = pobierz NOWE od daty; Anuluj = pobierz WSZYSTKO');
    let sinceDate = null;
    if (trybNowe) {
      const v = prompt('Pobierz wpisy od daty (RRRR-MM-DD):',
        new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
      if (!v) return;
      sinceDate = new Date(v + 'T00:00:00');
    }
    // Dwa tryby tempa: grzeczny (pauza ~1s/stronę — mały ślad) lub szybki (bez pauzy).
    const grzecznie = confirm('Tempo pobierania:\n\nOK = GRZECZNY — pauza ~1 s na stronę (mały ślad, tempo jak przeglądanie)\nAnuluj = SZYBKI — bez pauzy');
    const delayMs = grzecznie ? 1000 : 0;
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const all = [];
    let page = 0;
    for (;;) {
      const url = buildLogUrl(location.href, page);
      let doc;
      try {
        const res = await fetch(url, { credentials: 'include' });
        const html = await res.text();
        doc = new DOMParser().parseFromString(html, 'text/html');
      } catch (e) { alert('Błąd pobierania strony ' + page + ': ' + e.message); break; }
      const rows = extractRawRows(doc);
      if (!rows.length) break;                 // koniec paginacji
      all.push(...rows);
      console.log('strona', page, '→', rows.length, 'wierszy (łącznie', all.length + ')');
      if (sinceDate && shouldStop(rows, sinceDate, now)) break;
      page++;
      if (delayMs) await sleep(delayMs);
    }

    // filtr trybu przyrostowego: odetnij wpisy starsze niż sinceDate
    let outRows = all;
    if (sinceDate) {
      outRows = all.filter(r => {
        try { return parsePremiumDate(r.dateRaw, now) >= sinceDate; } catch { return true; }
      });
    }
    const payload = { exportedAt: now.toISOString(), count: outRows.length, rows: outRows };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plemiona-log-' + now.toISOString().slice(0, 16).replace(/[-:T]/g, '') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    alert('Zapisano ' + outRows.length + ' wpisów do pliku JSON.');
  })();
}
