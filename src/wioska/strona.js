// src/wioska/strona.js
// Warstwa DOM. Funkcje budujace HTML sa czyste — logika prezentacji siedzi
// w nich i daje sie testowac bez przegladarki. uruchom() to tylko wpiecie zdarzen.

import { SWIATY, swiat } from './swiaty.js';
import { kosztPoziomu, ludnoscPoziomu, maksPoziom, budynkiSwiata, poziomyStartowe } from './swiat.js';
import { czasBudowy } from './czas.js';
import { brakujaceWymagania, opisWymagan } from './wymagania.js';
import { normalizujPlan, bledyPlanu } from './plan.js';
import { symuluj } from './symulacja.js';
import { czasCzytelny, planJSON, planTekst } from './format.js';
import { NAZWY, NAZWY_SUROWCOW } from './nazwy.js';

export const KLUCZ_MAGAZYNU = 'plemiona-wioska';

const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function wierszBudynkuHTML(s, budynek, poziomy, poziomRatusza) {
  const obecny = poziomy[budynek] ?? 0;
  const nazwa = NAZWY[budynek] ?? budynek;
  const maks = maksPoziom(s, budynek);
  if (obecny >= maks) {
    return `<tr><td>${esc(nazwa)}<br><small>Poziom ${obecny}</small></td>`
      + `<td colspan="6"><em>Budynek całkowicie rozbudowany</em></td></tr>`;
  }
  const docelowy = obecny + 1;
  const k = kosztPoziomu(s, budynek, docelowy);
  const { sekundy, pewny } = czasBudowy(s, budynek, docelowy, poziomRatusza);
  const ludnosc = ludnoscPoziomu(s, budynek, docelowy) - ludnoscPoziomu(s, budynek, obecny);
  const brak = brakujaceWymagania(budynek, poziomy);
  const zablokowany = brak.length > 0;
  const przycisk = zablokowany
    ? `<button disabled>Poziom ${docelowy}</button><div class="powod">${esc(opisWymagan(brak, NAZWY))}</div>`
    : `<button data-dodaj="${esc(budynek)}">Poziom ${docelowy}</button>`;
  return `<tr class="${zablokowany ? 'zablokowany' : ''}">`
    + `<td>${esc(nazwa)}<br><small>${obecny === 0 ? 'nie istnieje' : `Poziom ${obecny}`}</small></td>`
    + `<td>${k.drewno}</td><td>${k.glina}</td><td>${k.zelazo}</td>`
    + `<td class="${pewny ? '' : 'niepewny'}">${pewny ? '' : '≈ '}${czasCzytelny(sekundy)}</td>`
    + `<td>${ludnosc}</td><td>${przycisk}</td></tr>`;
}

export function krokHTML(krok, indeks) {
  const nazwa = `${NAZWY[krok.budynek] ?? krok.budynek} → ${krok.doPoziomu}`;
  const klasy = ['krok'];
  if (krok.blad) klasy.push('blad');
  if (!krok.pewny) klasy.push('niepewny');
  const czekanie = krok.czekanieS > 0
    ? `<div class="czekanie">czeka ${czasCzytelny(krok.czekanieS)} na ${NAZWY_SUROWCOW[krok.czekanieNa] ?? krok.czekanieNa}</div>`
    : '';
  return `<li class="${klasy.join(' ')}" draggable="true" data-krok="${indeks}">`
    + `<span class="nr">${indeks + 1}</span>`
    + `<span class="opis">${esc(nazwa)}${czekanie}</span>`
    + `<span class="czas">${czasCzytelny(krok.startS)} · ${krok.pewny ? '' : '≈ '}${czasCzytelny(krok.trwanieS)}</span>`
    + `<button data-usun="${indeks}" title="Usuń">×</button></li>`;
}

export function podsumowanieHTML(wynik) {
  const { czasS, koszt, zmarnowane, zZastrzykow, czasNiepewnyS } = wynik.podsumowanie;
  const linie = [
    `<div><b>Łączny czas:</b> ${czasCzytelny(czasS)}</div>`,
    `<div><b>Surowce:</b> ${koszt.drewno} drewna · ${koszt.glina} gliny · ${koszt.zelazo} żelaza</div>`,
  ];
  if (zZastrzykow.drewno || zZastrzykow.glina || zZastrzykow.zelazo) {
    linie.push(`<div><b>Z dosyłek:</b> ${zZastrzykow.drewno} · ${zZastrzykow.glina} · ${zZastrzykow.zelazo}</div>`);
  }
  if (zmarnowane.drewno || zmarnowane.glina || zmarnowane.zelazo) {
    linie.push(`<div><b>Zmarnowane przez pełny spichlerz:</b> ${zmarnowane.drewno} · ${zmarnowane.glina} · ${zmarnowane.zelazo}</div>`);
  }
  if (czasNiepewnyS > 0) {
    const proc = Math.round(czasNiepewnyS / Math.max(1, czasS) * 100);
    linie.push(`<div class="niepewny">${proc}% czasu pochodzi z poziomów bez pomiaru (oznaczone ≈)</div>`);
  }
  return linie.join('');
}

export function uruchom() {
  if (typeof document === 'undefined') return;

  const $ = (id) => document.getElementById(id);
  let plan = wczytajPlan();

  function wczytajPlan() {
    try {
      const zapis = localStorage.getItem(KLUCZ_MAGAZYNU);
      if (zapis) return normalizujPlan(JSON.parse(zapis));
    } catch { /* uszkodzony zapis nie moze blokowac strony */ }
    return normalizujPlan({ swiat: 'pl231' });
  }

  function zapisz() {
    try { localStorage.setItem(KLUCZ_MAGAZYNU, planJSON(plan)); } catch { /* tryb prywatny */ }
  }

  // Poziomy w danym momencie kolejki — tabela budynkow pokazuje stan po
  // wszystkich krokach, zeby kolejne kilkniecie dokladalo nastepny poziom.
  function poziomyPoKolejce() {
    const p = { ...plan.start.poziomy };
    for (const k of plan.kroki) p[k.budynek] = k.doPoziomu;
    return p;
  }

  function rysuj() {
    const s = swiat(plan.swiat);
    const poziomy = poziomyPoKolejce();
    $('tabela-budynkow').tBodies[0].innerHTML = budynkiSwiata(s)
      .map(b => wierszBudynkuHTML(s, b, poziomy, poziomy.ratusz ?? 1)).join('');

    const bledy = bledyPlanu(plan);
    const wynik = bledy.length ? { kroki: [], ostrzezenia: [], podsumowanie: { czasS: 0, koszt: { drewno: 0, glina: 0, zelazo: 0 }, zZastrzykow: { drewno: 0, glina: 0, zelazo: 0 }, zmarnowane: { drewno: 0, glina: 0, zelazo: 0 }, czasNiepewnyS: 0 } } : symuluj(plan);
    $('lista-krokow').innerHTML = wynik.kroki.map(krokHTML).join('');
    $('podsumowanie').innerHTML = podsumowanieHTML(wynik);
    $('ostrzezenia').innerHTML = [...bledy.map(b => `<li>${esc(b)}</li>`),
      ...wynik.ostrzezenia.map(o => `<li>${esc(o.tekst)}</li>`)].join('');
    zapisz();
  }

  function pytajOLiczbe(etykieta) {
    const v = prompt(etykieta, '0');
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  document.addEventListener('click', (e) => {
    const dodaj = e.target.closest('[data-dodaj]');
    if (dodaj) {
      const budynek = dodaj.dataset.dodaj;
      const poziomy = poziomyPoKolejce();
      plan.kroki.push({ budynek, doPoziomu: (poziomy[budynek] ?? 0) + 1 });
      rysuj();
      return;
    }
    const usun = e.target.closest('[data-usun]');
    if (usun) {
      plan.kroki.splice(Number(usun.dataset.usun), 1);
      // Po usunieciu srodkowego kroku poziomy docelowe przestaja byc ciagle.
      przelicz();
      rysuj();
    }
  });

  // Kroki trzymaja poziom docelowy, wiec po zmianie kolejnosci trzeba je
  // ponumerowac od nowa — inaczej plan przestaje byc poprawny.
  function przelicz() {
    const poziomy = { ...plan.start.poziomy };
    for (const k of plan.kroki) {
      k.doPoziomu = (poziomy[k.budynek] ?? 0) + 1;
      poziomy[k.budynek] = k.doPoziomu;
    }
  }

  $('dodaj-dochod').addEventListener('click', () => {
    const czasS = pytajOLiczbe('Od której godziny obowiązuje (w godzinach od startu)?') * 3600;
    plan.dochody.push({
      czasS,
      drewnoH: pytajOLiczbe('Drewno na godzinę'),
      glinaH: pytajOLiczbe('Glina na godzinę'),
      zelazoH: pytajOLiczbe('Żelazo na godzinę'),
    });
    plan.dochody.sort((a, b) => a.czasS - b.czasS);
    rysuj();
  });

  $('dodaj-zastrzyk').addEventListener('click', () => {
    const czasS = pytajOLiczbe('W której godzinie od startu przychodzi dosyłka?') * 3600;
    plan.zastrzyki.push({
      czasS,
      drewno: pytajOLiczbe('Drewno'),
      glina: pytajOLiczbe('Glina'),
      zelazo: pytajOLiczbe('Żelazo'),
    });
    plan.zastrzyki.sort((a, b) => a.czasS - b.czasS);
    rysuj();
  });

  $('kopiuj-json').addEventListener('click', () => navigator.clipboard.writeText(planJSON(plan)));
  $('kopiuj-tekst').addEventListener('click', () => navigator.clipboard.writeText(planTekst(plan, symuluj(plan))));

  $('wklej-json').addEventListener('click', () => {
    $('modal').hidden = false;
    $('modal-pole').value = '';
    $('modal-pole').focus();
  });
  $('modal-anuluj').addEventListener('click', () => { $('modal').hidden = true; });
  $('modal-ok').addEventListener('click', () => {
    try {
      plan = normalizujPlan(JSON.parse($('modal-pole').value));
      $('modal').hidden = true;
      rysuj();
    } catch (err) {
      $('modal-info').textContent = `Nie udało się wczytać: ${err.message}`;
    }
  });

  $('wyczysc').addEventListener('click', () => {
    plan = normalizujPlan({ swiat: plan.swiat, start: plan.start });
    rysuj();
  });

  for (const pole of ['drewno', 'glina', 'zelazo']) {
    $(`start-${pole}`).addEventListener('change', (e) => {
      plan.start.surowce[pole] = Number(e.target.value) || 0;
      rysuj();
    });
  }

  $('swiat').innerHTML = Object.values(SWIATY)
    .map(s => `<option value="${s.kod}">${esc(s.nazwa)}</option>`).join('');
  $('swiat').value = plan.swiat;
  $('swiat').addEventListener('change', (e) => {
    plan = normalizujPlan({ swiat: e.target.value });
    plan.start.poziomy = poziomyStartowe(swiat(e.target.value));
    rysuj();
  });

  for (const pole of ['drewno', 'glina', 'zelazo']) $(`start-${pole}`).value = plan.start.surowce[pole];
  rysuj();
}

uruchom();
