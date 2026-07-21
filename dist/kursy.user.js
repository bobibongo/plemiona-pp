// ==UserScript==
// @name         Plemiona — kursy giełdy
// @namespace    plemiona-pp
// @version      1.0.0
// @description  Odczytuje kursy giełdy premium z otwartej strony i zbiera je per kontynent. Nie wysyła żadnych zapytań.
// @author       plemiona-pp
// @match        https://*.plemiona.pl/game.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
// src/rates-parse.js
// Odczyt kursów giełdy premium z dokumentu, który gracz sam otworzył.
// Ten moduł niczego nie pobiera — dostaje gotowy Document i tylko go czyta.

const RATE_IDS = {
  wood: 'premium_exchange_rate_wood',
  stone: 'premium_exchange_rate_stone',
  iron: 'premium_exchange_rate_iron',
};

// Komórka kursu to "<ikona> 378  ⇄  <ikona> 1". Bierzemy pierwszą liczbę, ale
// tak, żeby nie skleiła się z jedynką po strzałce: po spacji akceptujemy dalszy
// ciąg tylko jako pełną trójkę cyfr (separator tysięcy).
function parseRate(text) {
  const m = String(text ?? '').replace(/ /g, ' ').match(/\d+(?:[ .]\d{3})*/);
  if (!m) return null;
  const n = Number(m[0].replace(/[ .]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Albo komplet trzech kursów, albo null. Częściowy odczyt jest bezużyteczny
// i groziłby nadpisaniem dobrego wiersza połową danych.
function readRates(doc) {
  const out = {};
  for (const [res, id] of Object.entries(RATE_IDS)) {
    const cell = doc.getElementById(id);
    if (!cell) return null;
    const seps = cell.querySelectorAll ? cell.querySelectorAll('.premium-exchange-sep') : null;
    const source = (seps && seps[0]) || cell;
    const value = parseRate(source.textContent);
    if (value === null) return null;
    out[res] = value;
  }
  return out;
}

// Lokalizacja wioski: "(499|613) K64". Oznaczenie kontynentu bywa pominięte,
// dlatego jest w grupie opcjonalnej.
const LOC_RE = /\((\d+)\|(\d+)\)(?:\s*K(\d+))?/;

// Kontynent to pierwsza cyfra Y, potem pierwsza cyfra X — w tej kolejności:
// (499|613) → K64. Zakładamy współrzędne trzycyfrowe, tak jak w grze.
// To i tak tylko zapas: normalnie kontynent bierzemy wprost z "K64" na stronie.
function continentFromCoords(x, y) {
  return 'K' + String(y)[0] + String(x)[0];
}
function parseLocation(text) {
  const m = LOC_RE.exec(String(text ?? ''));
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  return { x, y, continent: m[3] ? 'K' + m[3] : continentFromCoords(x, y) };
}

// Nie kotwiczymy się na układzie tabeli — szukamy pierwszego elementu,
// którego treść wygląda jak lokalizacja wioski.
function findLocation(doc) {
  const els = doc.querySelectorAll('b.nowrap, .nowrap, #header_info b');
  for (const el of els) {
    const loc = parseLocation(el.textContent);
    if (loc) return loc;
  }
  return null;
}

// Pełny odczyt. null oznacza „to nie ten ekran" i nie rusza magazynu.
// Odczyt z continent === null jest ważny do pokazania w panelu, ale magazyn
// go odrzuci — nie wiadomo, który wiersz miałby nadpisać.
function readReading(doc, now = new Date()) {
  const rates = readRates(doc);
  if (!rates) return null;
  const loc = findLocation(doc);
  return {
    continent: loc ? loc.continent : null,
    x: loc ? loc.x : null,
    y: loc ? loc.y : null,
    wood: rates.wood,
    stone: rates.stone,
    iron: rates.iron,
    at: now.toISOString(),
  };
}

// src/rates-store.js
// Migawka kursów: jeden wiersz na kontynent, nadpisywany przy powrocie.
const STORE_PREFIX = 'plemiona-kursy';

// pl231.plemiona.pl → pl231
function worldFromHost(host) {
  const first = String(host ?? '').split('.')[0];
  return first || 'nieznany';
}

// Klucz zawiera świat, żeby dane z dwóch światów się nie zmieszały.
function storageKey(world) {
  return `${STORE_PREFIX}:${world}`;
}

// 'K5' < 'K45' < 'K64' — po numerze, bo alfabetycznie wyszłoby K45, K5, K64.
function continentNumber(continent) {
  const n = Number(String(continent).replace(/^K/, ''));
  return Number.isFinite(n) ? n : Infinity;
}
function sortReadings(readings) {
  return [...readings].sort((a, b) => continentNumber(a.continent) - continentNumber(b.continent));
}

// Odczyt bez kontynentu nigdy nie trafia do magazynu — nie wiadomo, który
// wiersz miałby nadpisać. Zasada: popsuty odczyt nie psuje dobrego.
function mergeReading(readings, reading) {
  if (!reading || !reading.continent) return sortReadings(readings);
  const rest = readings.filter(x => x.continent !== reading.continent);
  return sortReadings([...rest, reading]);
}
function buildExport(world, readings, now = new Date()) {
  return { exportedAt: now.toISOString(), world, readings: sortReadings(readings) };
}

// Tekst trafiający do schowka — wklejasz go wprost na stronie analizy.
function exportText(world, readings, now = new Date()) {
  return JSON.stringify(buildExport(world, readings, now), null, 2);
}

// src/rates-panel.js
// Panel w rogu ekranu gry. Układ generuje czysta funkcja panelHTML, więc da się
// go testować bez przeglądarki; mountPanel to cienka warstwa DOM nad nią.
const PANEL_ID = 'kursy-panel';
const COLLAPSE_KEY = 'plemiona-kursy:zwiniety';

const RES = [['wood', 'Drewno'], ['stone', 'Glina'], ['iron', 'Żelazo']];

// Styl własny panelu — nie zależymy od CSS gry, żeby zmiana skórki go nie zepsuła.
// Motyw jak w dashboardzie: pergamin, oksbloodowy akcent.
const PANEL_CSS = `
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
function panelHTML({ readings, justUpdated = null, warning = null, collapsed = false, manual = null }) {
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
function mountPanel(state) {
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

// src/rates-collector.js
// Punkt wejścia userscriptu. Budzi się przy każdym wejściu na ekran giełdy
// premium, czyta to, co strona już wyświetliła, i odświeża panel.
//
// Ten plik nie wysyła i nie może wysyłać żadnego zapytania — patrz test
// „userscript nie wykonuje żadnych zapytań sieciowych" w test/build.test.js.

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  (function () {
    const reading = readReading(document);
    if (!reading) return;              // inny ekran — panelu nie pokazujemy

    const world = worldFromHost(location.hostname);
    const key = storageKey(world);

    let readings = [];
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(raw)) readings = raw;
    } catch { readings = []; }         // popsuty magazyn zaczynamy od zera

    // mergeReading sam odrzuci odczyt bez kontynentu, żeby nie nadpisał
    // niewłaściwego wiersza. Gracz dowiaduje się o tym z panelu.
    const warning = reading.continent
      ? null
      : 'Nie rozpoznano kontynentu — tego odczytu nie zapisano.';

    readings = mergeReading(readings, reading);
    try { localStorage.setItem(key, JSON.stringify(readings)); } catch { /* pełny magazyn */ }

    mountPanel({ readings, justUpdated: reading.continent, warning, world, key });
  })();
}

})();
