// src/wioska/strona.js
// Warstwa DOM. Funkcje budujace HTML sa czyste — logika prezentacji siedzi
// w nich i daje sie testowac bez przegladarki. uruchom() to tylko wpiecie zdarzen.

import { SWIATY, swiat } from './swiaty.js';
import { budynkiSwiata } from './swiat.js';
import { normalizujPlan, bledyPlanu } from './plan.js';
import { symuluj } from './symulacja.js';
import { czasCzytelny, planJSON, planTekst } from './format.js';
import { esc, wierszBudynkuHTML } from './widok-budynki.js';
import { krokHTML, wtracenieHTML } from './widok-kolejka.js';

export const KLUCZ_MAGAZYNU = 'plemiona-wioska';

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
    $('lista-krokow').innerHTML = wynik.kroki.map((k, i) => krokHTML(k, i, false)).join('');
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

  // Po zmianie kolejnosci poziomy docelowe przestaja byc ciagle, wiec przelicz()
  // numeruje je od nowa wedlug nowej kolejnosci krokow.
  let ciagniony = null;
  const lista = $('lista-krokow');

  lista.addEventListener('dragstart', (e) => {
    const li = e.target.closest('[data-krok]');
    if (!li) return;
    ciagniony = Number(li.dataset.krok);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });

  lista.addEventListener('dragover', (e) => {
    if (ciagniony === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  });

  lista.addEventListener('drop', (e) => {
    const li = e.target.closest('[data-krok]');
    if (ciagniony === null || !li) return;
    e.preventDefault();
    const cel = Number(li.dataset.krok);
    if (cel !== ciagniony) {
      const [krok] = plan.kroki.splice(ciagniony, 1);
      plan.kroki.splice(cel, 0, krok);
      przelicz();
      rysuj();
    }
    ciagniony = null;
  });

  lista.addEventListener('dragend', () => { ciagniony = null; });

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

  // Okno sluzy dwóm rzeczom: wklejaniu planu i awaryjnemu kopiowaniu recznemu,
  // gdy przegladarka nie da Clipboard API (zdarza sie przy otwarciu z dysku).
  let trybModalu = 'wklej';

  function otworzModal(tryb, tytul, tresc) {
    trybModalu = tryb;
    $('modal-tytul').textContent = tytul;
    $('modal-pole').value = tresc;
    $('modal-info').textContent = '';
    $('modal').hidden = false;
    $('modal-pole').focus();
    if (tryb === 'kopiuj') $('modal-pole').select();
  }

  async function doSchowka(tekst, opis) {
    try {
      await navigator.clipboard.writeText(tekst);
    } catch {
      otworzModal('kopiuj', `${opis} — skopiuj ręcznie`, tekst);
    }
  }

  $('kopiuj-json').addEventListener('click', () => doSchowka(planJSON(plan), 'Plan w formacie JSON'));
  $('kopiuj-tekst').addEventListener('click', () => doSchowka(planTekst(plan, symuluj(plan)), 'Plan tekstem'));

  $('wklej-json').addEventListener('click', () => otworzModal('wklej', 'Wklej plan', ''));
  $('modal-anuluj').addEventListener('click', () => { $('modal').hidden = true; });
  $('modal-ok').addEventListener('click', () => {
    if (trybModalu === 'kopiuj') { $('modal').hidden = true; return; }
    try {
      plan = normalizujPlan(JSON.parse($('modal-pole').value));
      przelicz();
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
    rysuj();
  });

  for (const pole of ['drewno', 'glina', 'zelazo']) $(`start-${pole}`).value = plan.start.surowce[pole];
  rysuj();
}

uruchom();
