// src/wioska/widok-budynki.js
// Tabela budynkow, wzorowana na ekranie Ratusza w grze.

import { kosztPoziomu, ludnoscPoziomu, maksPoziom } from './swiat.js';
import { czasBudowy } from './czas.js';
import { brakujaceWymagania, opisWymagan } from './wymagania.js';
import { czasCzytelny } from './format.js';
import { NAZWY } from './nazwy.js';
import { IKONY_BUDYNKOW } from './ikony.js';

export const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function ikonaHTML(budynek, nazwa) {
  const src = IKONY_BUDYNKOW[budynek];
  return src ? `<img class="ikona" src="${esc(src)}" alt="" title="${esc(nazwa)}">` : '';
}

export function wierszBudynkuHTML(s, budynek, poziomy, poziomRatusza) {
  const obecny = poziomy[budynek] ?? 0;
  const nazwa = NAZWY[budynek] ?? budynek;
  const maks = maksPoziom(s, budynek);
  if (obecny >= maks) {
    return `<tr><td>${ikonaHTML(budynek, nazwa)}${esc(nazwa)}<br><small>Poziom ${obecny}</small></td>`
      + '<td colspan="6"><em>Budynek całkowicie rozbudowany</em></td></tr>';
  }
  const docelowy = obecny + 1;
  const k = kosztPoziomu(s, budynek, docelowy);
  const { sekundy } = czasBudowy(s, budynek, docelowy, poziomRatusza);
  const ludnosc = ludnoscPoziomu(s, budynek, docelowy) - ludnoscPoziomu(s, budynek, obecny);
  const brak = brakujaceWymagania(budynek, poziomy);
  const zablokowany = brak.length > 0;
  const przycisk = zablokowany
    ? `<button disabled>Poziom ${docelowy}</button><div class="powod">${esc(opisWymagan(brak, NAZWY))}</div>`
    : `<button data-dodaj="${esc(budynek)}">Poziom ${docelowy}</button>`;
  return `<tr class="${zablokowany ? 'zablokowany' : ''}">`
    + `<td>${ikonaHTML(budynek, nazwa)}${esc(nazwa)}<br><small>${obecny === 0 ? 'nie istnieje' : `Poziom ${obecny}`}</small></td>`
    + `<td>${k.drewno}</td><td>${k.glina}</td><td>${k.zelazo}</td>`
    + `<td>${czasCzytelny(sekundy)}</td>`
    + `<td>${ludnosc}</td><td>${przycisk}</td></tr>`;
}
