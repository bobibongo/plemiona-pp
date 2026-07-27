// src/wioska/format.js
// Dwie postacie eksportu: tekst do przepisania do Menedzera Konta
// i JSON, ktory jest kanalem wymiany planu z Claude.

import { NAZWY, NAZWY_SUROWCOW } from './nazwy.js';

export function czasCzytelny(sekundy) {
  const s = Math.max(0, Math.round(sekundy));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d} d ${String(h).padStart(2, '0')} h ${String(m).padStart(2, '0')} min`;
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min`;
}

export function planJSON(plan) {
  return JSON.stringify(plan, null, 2);
}

function liczba(n) {
  return Math.round(n).toLocaleString('pl-PL');
}

export function planTekst(plan, wynik) {
  const linie = [`Plan budowy — ${plan.swiat}`, ''];
  plan.kroki.forEach((k, i) => {
    linie.push(`${String(i + 1).padStart(3)}. ${NAZWY[k.budynek] ?? k.budynek} → ${k.doPoziomu}`);
  });
  const { koszt, czasS, zmarnowane, zZastrzykow } = wynik.podsumowanie;
  linie.push('', 'Podsumowanie');
  linie.push(`  Łączny czas: ${czasCzytelny(czasS)}`);
  linie.push(`  Surowce: ${liczba(koszt.drewno)} drewna, ${liczba(koszt.glina)} gliny, ${liczba(koszt.zelazo)} żelaza`);
  if (zZastrzykow.drewno || zZastrzykow.glina || zZastrzykow.zelazo) {
    linie.push(`  Z dosyłek: ${liczba(zZastrzykow.drewno)} / ${liczba(zZastrzykow.glina)} / ${liczba(zZastrzykow.zelazo)}`);
  }
  if (zmarnowane.drewno || zmarnowane.glina || zmarnowane.zelazo) {
    linie.push(`  Zmarnowane przez pełny spichlerz: ${liczba(zmarnowane.drewno)} / ${liczba(zmarnowane.glina)} / ${liczba(zmarnowane.zelazo)}`);
  }
  return linie.join('\n');
}

export function osCzasuTekst(wynik) {
  const linie = ['  # | start        | krok                      | trwanie      | uwagi'];
  wynik.kroki.forEach((k, i) => {
    const nazwa = `${NAZWY[k.budynek] ?? k.budynek} → ${k.doPoziomu}`;
    const uwagi = [];
    if (k.blad) uwagi.push(`BŁĄD: ${k.blad}`);
    if (k.czekanieS > 0) uwagi.push(`czeka ${czasCzytelny(k.czekanieS)} na ${NAZWY_SUROWCOW[k.czekanieNa] ?? k.czekanieNa}`);
    if (!k.pewny) uwagi.push('≈ czas z poziomu bez pomiaru');
    linie.push(
      `${String(i + 1).padStart(3)} | ${czasCzytelny(k.startS).padEnd(12)} | ${nazwa.padEnd(25)} | ${czasCzytelny(k.trwanieS).padEnd(12)} | ${uwagi.join('; ')}`,
    );
  });
  if (wynik.ostrzezenia.length) {
    linie.push('', 'Ostrzeżenia:');
    for (const o of wynik.ostrzezenia) linie.push(`  • ${o.tekst}`);
  }
  return linie.join('\n');
}
