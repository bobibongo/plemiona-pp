// src/rates-panel.js
// Panel w rogu ekranu gry. Układ generuje czysta funkcja panelHTML, więc da się
// go testować bez przeglądarki; mountPanel to cienka warstwa DOM nad nią.

import { exportText } from './rates-store.js';

export const PANEL_ID = 'kursy-panel';
const COLLAPSE_KEY = 'plemiona-kursy:zwiniety';

const RES = [['wood', 'Drewno'], ['stone', 'Glina'], ['iron', 'Żelazo']];

// Styl własny panelu — nie zależymy od CSS gry, żeby zmiana skórki go nie zepsuła.
// Motyw jak w dashboardzie: pergamin, oksbloodowy akcent.
export const PANEL_CSS = `
#${PANEL_ID} { position: fixed; top: 12px; right: 12px; z-index: 2147483000;
  font: 12px system-ui, -apple-system, "Segoe UI", sans-serif; color: #38291a;
  background: #f4ead2; border: 1px solid #c4ac7c; border-radius: 6px;
  box-shadow: 0 8px 22px rgba(0,0,0,.38); min-width: 240px; }
#${PANEL_ID} .kp-bar { display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  background: #7c2b2b; color: #f6ecd4; border-radius: 5px 5px 0 0; }
#${PANEL_ID} .kp-title { font-weight: 700; font-size: 11px; letter-spacing: .08em;
  text-transform: uppercase; flex: 1; }
#${PANEL_ID} .kp-btn-icon { background: none; border: none; color: #f6ecd4; cursor: pointer;
  font-size: 13px; line-height: 1; padding: 2px 4px; }
#${PANEL_ID} table { border-collapse: collapse; width: 100%; }
#${PANEL_ID} th, #${PANEL_ID} td { padding: 4px 8px; text-align: right;
  border-bottom: 1px solid #dccca4; }
#${PANEL_ID} th { font-size: 10px; letter-spacing: .06em; text-transform: uppercase;
  color: #7c2b2b; }
#${PANEL_ID} th:first-child, #${PANEL_ID} td:first-child { text-align: left; }
#${PANEL_ID} td { font-family: ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums; }
#${PANEL_ID} tr.kp-hit td { background: rgba(168,132,44,.3); }
#${PANEL_ID} .kp-empty { text-align: center; color: #93805f; font-style: italic; }
#${PANEL_ID} .kp-warn { padding: 5px 8px; background: #f6dcd6; color: #a5372a; font-size: 11px; }
#${PANEL_ID} .kp-foot { display: flex; align-items: center; gap: 6px; padding: 6px 8px; }
#${PANEL_ID} .kp-count { flex: 1; color: #6b543a; font-size: 11px; }
#${PANEL_ID} .kp-btn { padding: 4px 10px; border: 1px solid #c4ac7c; border-radius: 4px;
  background: #ecdfbf; color: #38291a; font: inherit; font-weight: 600; cursor: pointer; }
#${PANEL_ID} .kp-btn[disabled] { opacity: .45; cursor: default; }
#${PANEL_ID} .kp-manual { padding: 6px 8px; border-top: 1px solid #dccca4; }
#${PANEL_ID} .kp-manual p { margin: 0 0 4px; font-size: 11px; color: #a5372a;
  text-transform: none; letter-spacing: normal; }
#${PANEL_ID} .kp-manual textarea { width: 100%; height: 90px; resize: vertical;
  font: 11px ui-monospace, Consolas, monospace; color: #38291a; background: #ecdfbf;
  border: 1px solid #c4ac7c; border-radius: 4px; padding: 5px; }
`;

function esc(value) {
  return String(value).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function hhmm(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// 1 kontynent / 2–4 kontynenty / 5+ kontynentów, z wyjątkiem nastolatek (12–14).
function odmiana(n) {
  if (n === 1) return 'kontynent';
  const dwie = n % 100;
  const jedna = n % 10;
  if (jedna >= 2 && jedna <= 4 && !(dwie >= 12 && dwie <= 14)) return 'kontynenty';
  return 'kontynentów';
}

export function panelHTML({ readings, justUpdated = null, warning = null, collapsed = false, manual = null }) {
  const bar = `<div class="kp-bar"><span class="kp-title">Kursy giełdy</span>`
    + `<button class="kp-btn-icon" data-act="collapse" title="${collapsed ? 'Rozwiń' : 'Zwiń'}">`
    + `${collapsed ? '▣' : '─'}</button>`
    + `<button class="kp-btn-icon" data-act="hide" title="Ukryj">✕</button></div>`;
  if (collapsed) return bar;

  const head = `<tr><th>K</th>${RES.map(([, label]) => `<th>${label}</th>`).join('')}</tr>`;
  const body = readings.length
    ? readings.map(row => {
        const hit = row.continent === justUpdated ? ' class="kp-hit"' : '';
        const cells = RES.map(([key]) => `<td>${esc(row[key])}</td>`).join('');
        return `<tr${hit}><td>${esc(row.continent)}</td>${cells}</tr>`;
      }).join('')
    : `<tr><td colspan="4" class="kp-empty">Brak odczytów</td></tr>`;

  const warn = warning ? `<div class="kp-warn">${esc(warning)}</div>` : '';
  const latest = readings.reduce((max, row) => (row.at > max ? row.at : max), '');
  const stamp = latest ? ` · ${hhmm(latest)}` : '';
  const count = `${readings.length} ${odmiana(readings.length)}${stamp}`;
  const disabled = readings.length ? '' : ' disabled';

  // Awaryjnie, gdy przeglądarka nie wpuści nas do schowka: pokazujemy tekst
  // do zaznaczenia i skopiowania ręcznie, zamiast zostawiać gracza z niczym.
  const reczne = manual
    ? `<div class="kp-manual"><p>Schowek zablokowany — zaznacz i skopiuj (Ctrl+C):</p>`
      + `<textarea readonly spellcheck="false">${esc(manual)}</textarea></div>`
    : '';

  return bar + `<table><thead>${head}</thead><tbody>${body}</tbody></table>` + warn + reczne
    + `<div class="kp-foot"><span class="kp-count">${count}</span>`
    + `<button class="kp-btn" data-act="export"${disabled}>Eksportuj</button>`
    + `<button class="kp-btn" data-act="clear">Wyczyść</button></div>`;
}

// ——— Warstwa przeglądarkowa ———

// Kopiowanie wymaga gestu użytkownika — stąd wywołanie prosto z obsługi kliknięcia.
function kopiuj(state, przycisk, render) {
  const tekst = exportText(state.world, state.readings);

  const potwierdz = () => {
    przycisk.textContent = 'Skopiowano ✓';
    setTimeout(() => { przycisk.textContent = 'Eksportuj'; }, 2000);
  };
  const awaryjnie = () => {
    state.manual = tekst;
    render();
    const pole = document.querySelector('#' + PANEL_ID + ' .kp-manual textarea');
    if (pole) { pole.focus(); pole.select(); }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tekst).then(potwierdz, awaryjnie);
  } else {
    awaryjnie();
  }
}

export function mountPanel(state) {
  if (!document.getElementById(PANEL_ID + '-css')) {
    const style = document.createElement('style');
    style.id = PANEL_ID + '-css';
    style.textContent = PANEL_CSS;
    document.head.appendChild(style);
  }

  let el = document.getElementById(PANEL_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = PANEL_ID;
    document.body.appendChild(el);
  }

  let collapsed = false;
  try { collapsed = localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { collapsed = false; }

  const render = () => { el.innerHTML = panelHTML({ ...state, collapsed }); };
  render();

  el.addEventListener('click', event => {
    const act = event.target && event.target.getAttribute
      ? event.target.getAttribute('data-act') : null;
    if (!act) return;

    if (act === 'collapse') {
      collapsed = !collapsed;
      try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* pełny magazyn */ }
      render();
      return;
    }
    // Ukrycie dotyczy tylko oglądanej strony i nie wyłącza zbierania —
    // przy następnym wejściu na giełdę panel wraca z kompletem danych.
    if (act === 'hide') { el.remove(); return; }
    if (act === 'export') { kopiuj(state, event.target, render); return; }
    if (act === 'clear') {
      if (!confirm('Wyczyścić zebrane kursy dla świata ' + state.world + '?')) return;
      try { localStorage.removeItem(state.key); } catch { /* nic nie szkodzi */ }
      state.readings = [];
      state.justUpdated = null;
      state.warning = null;
      state.manual = null;
      render();
    }
  });
}
