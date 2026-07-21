// src/rates-page.js
// Spięcie strony: magazyn w localStorage, zdarzenia, render.

import { parseImport, mergeHistory, average, worlds, forWorld, continentsOf, latestPerContinent, seriesByContinent } from './rates-history.js';
import { parseThreshold, evaluateSignals } from './rates-signals.js';
import { ratesChartSVG, colorMap, escXml } from './rates-chart.js';

const KLUCZ_HISTORII = 'plemiona-kursy:historia';
// Progi mają własny klucz, żeby czyszczenie historii ich nie kasowało.
const KLUCZ_PROGOW = 'plemiona-kursy:progi';

let HISTORIA = [];
let PROGI = { high: null, low: null };
let SWIAT = null;

const $ = id => document.getElementById(id);

function wczytajMagazyn() {
  try {
    const raw = JSON.parse(localStorage.getItem(KLUCZ_HISTORII) || '[]');
    if (Array.isArray(raw)) HISTORIA = raw;
  } catch { HISTORIA = []; }
  try {
    const p = JSON.parse(localStorage.getItem(KLUCZ_PROGOW) || '{}');
    PROGI = { high: parseThreshold(p.high), low: parseThreshold(p.low) };
  } catch { PROGI = { high: null, low: null }; }
}

function zapiszHistorie() {
  try {
    localStorage.setItem(KLUCZ_HISTORII, JSON.stringify(HISTORIA));
    return true;
  } catch { return false; }
}

function zapiszProgi() {
  try { localStorage.setItem(KLUCZ_PROGOW, JSON.stringify(PROGI)); } catch { /* pełny magazyn */ }
}

function fmtKiedy(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderSwiaty() {
  const lista = worlds(HISTORIA);
  const sel = $('f-world');
  if (!lista.includes(SWIAT)) SWIAT = lista[0] || null;
  sel.innerHTML = lista.map(w => `<option value="${escXml(w)}"${w === SWIAT ? ' selected' : ''}>${escXml(w)}</option>`).join('');
  sel.parentElement.style.display = lista.length > 1 ? '' : 'none';
}

function renderSygnaly(najnowsze) {
  const { signals, message } = evaluateSignals(najnowsze, PROGI);
  $('signals').innerHTML = signals.length
    ? signals.map(s => `<span class="sig ${s.action}"><span class="k">${escXml(s.continent)}</span>`
        + `<span class="res">${escXml(s.label)}</span><b>${s.value}</b>`
        + `<span class="act">${escXml(s.action)}</span></span>`).join('')
    : `<span class="sig-none">${escXml(message)}</span>`;
}

function renderTabela(najnowsze, kolory) {
  const wiersze = [...najnowsze].sort((a, b) => average(b) - average(a));
  $('latest').innerHTML =
    '<thead><tr><th>Kontynent</th><th>Średnia</th><th>Drewno</th><th>Glina</th><th>Żelazo</th><th>Odczytano</th></tr></thead>'
    + '<tbody>' + wiersze.map(r =>
      `<tr><td><span class="swatch" style="background:${kolory.get(r.continent)}"></span>${escXml(r.continent)}</td>`
      + `<td>${average(r)}</td><td>${r.wood}</td><td>${r.stone}</td><td>${r.iron}</td>`
      + `<td>${escXml(fmtKiedy(r.at))}</td></tr>`).join('') + '</tbody>';
}

function render() {
  renderSwiaty();
  const dane = SWIAT ? forWorld(HISTORIA, SWIAT) : [];
  $('count').textContent = `${HISTORIA.length} odczytów`;
  $('th-high').value = PROGI.high ?? '';
  $('th-low').value = PROGI.low ?? '';

  // Kolor po pozycji kontynentu w PEŁNEJ liście świata — filtr nigdy nie
  // przemalowuje serii.
  const kolory = colorMap(continentsOf(dane));
  const najnowsze = latestPerContinent(dane);

  renderSygnaly(najnowsze);
  renderTabela(najnowsze, kolory);

  const serie = seriesByContinent(dane).map(s => ({ ...s, color: kolory.get(s.continent) }));
  $('chart').innerHTML = ratesChartSVG(serie, { thresholds: PROGI, width: 1000, height: 340 });
}

// Jedna ścieżka wczytywania dla obu wejść: schowka i ręcznego wklejenia.
function wczytajTekst(tekst) {
  const wynik = parseImport(tekst);
  if (!wynik.ok) return { ok: false, komunikat: wynik.error };

  const scalone = mergeHistory(HISTORIA, wynik.records);
  HISTORIA = scalone.history;
  const zapisano = zapiszHistorie();
  render();

  const czesci = [`Dodano ${scalone.added}`];
  if (scalone.duplicates) czesci.push(`pominięto ${scalone.duplicates} powtórzonych`);
  if (wynik.skipped) czesci.push(`odrzucono ${wynik.skipped} niepełnych`);
  if (!zapisano) czesci.push('UWAGA: nie udało się zapisać — magazyn pełny');
  return { ok: zapisano, komunikat: czesci.join(', ') + '.' };
}

function pokazInfo(el, wynik) {
  el.textContent = wynik.komunikat;
  el.classList.toggle('err', !wynik.ok);
}

function otworzOkno(powod = '') {
  pokazInfo($('paste-info'), { ok: !powod, komunikat: powod });
  $('paste-modal').hidden = false;
  $('paste-area').focus();
}

// Odczyt schowka wymaga zgody przeglądarki, a strona otwierana z dysku bywa
// traktowana surowo. Gdy zgody nie ma, otwieramy okno ręczne z wyjaśnieniem —
// zamiast zostawiać gracza z przyciskiem, który nic nie robi.
function wklejZeSchowka() {
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    otworzOkno('Ta przeglądarka nie daje dostępu do schowka — wklej ręcznie (Ctrl+V).');
    return;
  }
  navigator.clipboard.readText().then(tekst => {
    if (!tekst || !tekst.trim()) {
      pokazInfo($('import-info'), { ok: false, komunikat: 'Schowek jest pusty — najpierw kliknij Eksportuj w grze.' });
      return;
    }
    pokazInfo($('import-info'), wczytajTekst(tekst));
  }, () => {
    otworzOkno('Przeglądarka nie wpuściła nas do schowka — wklej ręcznie (Ctrl+V).');
  });
}

wczytajMagazyn();
render();

$('paste-clipboard').addEventListener('click', wklejZeSchowka);
$('paste-open').addEventListener('click', () => otworzOkno());
$('paste-cancel').addEventListener('click', () => { $('paste-modal').hidden = true; });
$('paste-done').addEventListener('click', () => {
  const wynik = wczytajTekst($('paste-area').value);
  pokazInfo($('paste-info'), wynik);
  if (wynik.ok) $('paste-area').value = '';
});

$('f-world').addEventListener('change', e => { SWIAT = e.target.value; render(); });

for (const id of ['th-high', 'th-low']) {
  $(id).addEventListener('change', () => {
    PROGI = { high: parseThreshold($('th-high').value), low: parseThreshold($('th-low').value) };
    zapiszProgi();
    render();
  });
}

$('reset').addEventListener('click', () => {
  if (!confirm('Usunąć całą zgromadzoną historię kursów? Progi zostaną zachowane.')) return;
  HISTORIA = [];
  try { localStorage.removeItem(KLUCZ_HISTORII); } catch { /* nic nie szkodzi */ }
  render();
});
