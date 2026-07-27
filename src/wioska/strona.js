// src/wioska/strona.js
// Warstwa DOM: stan interfejsu i wpinanie zdarzen. Cale budowanie HTML
// siedzi w modulach widok-*.js i jest testowane bez przegladarki.

import { SWIATY, swiat } from './swiaty.js';
import { budynkiSwiata } from './swiat.js';
import { normalizujPlan, bledyPlanu } from './plan.js';
import { symuluj } from './symulacja.js';
import { zapotrzebowanie } from './zapotrzebowanie.js';
import { planJSON, planTekst, czasCzytelny } from './format.js';
import { esc, wierszBudynkuHTML } from './widok-budynki.js';
import { krokHTML, wtracenieHTML } from './widok-kolejka.js';
import { pasekStanuHTML } from './widok-status.js';

export const KLUCZ_MAGAZYNU = 'plemiona-wioska';

export function uruchom() {
  if (typeof document === 'undefined') return;

  const $ = (id) => document.getElementById(id);
  let plan = wczytajPlan();
  let zaznaczony = null;
  let trybModalu = 'wklej';
  let ciagniony = null;

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

  // Tabela budynkow pokazuje stan po wszystkich krokach, zeby kolejne
  // klikniecie dokladalo nastepny poziom.
  function poziomyPoKolejce() {
    const p = { ...plan.start.poziomy };
    for (const k of plan.kroki) p[k.budynek] = k.doPoziomu;
    return p;
  }

  // Kroki niosa poziom docelowy, wiec po kazdej zmianie kolejnosci trzeba je
  // ponumerowac od nowa — inaczej plan przestaje byc ciagly.
  function przelicz() {
    const poziomy = { ...plan.start.poziomy };
    for (const k of plan.kroki) {
      k.doPoziomu = (poziomy[k.budynek] ?? 0) + 1;
      poziomy[k.budynek] = k.doPoziomu;
    }
  }

  // Wtracenia wchodza w kolejke tam, gdzie wypadaja na osi.
  function kolejkaHTML(wynik) {
    const wtracenia = [
      ...plan.dochody.map(d => ({ czasS: d.czasS, rodzaj: 'dochod', wpis: d })),
      ...plan.zastrzyki.map(z => ({ czasS: z.czasS, rodzaj: 'dosylka', wpis: z })),
    ].sort((a, b) => a.czasS - b.czasS);
    let w = 0;
    const out = [];
    wynik.kroki.forEach((k, i) => {
      while (w < wtracenia.length && wtracenia[w].czasS <= k.startS) {
        out.push(wtracenieHTML(wtracenia[w].rodzaj, wtracenia[w].wpis));
        w += 1;
      }
      out.push(krokHTML(k, i, i === zaznaczony));
    });
    while (w < wtracenia.length) {
      out.push(wtracenieHTML(wtracenia[w].rodzaj, wtracenia[w].wpis));
      w += 1;
    }
    return out.join('');
  }

  function zaopatrzenieHTML() {
    $('lista-dochodow').innerHTML = plan.dochody.map((d, i) =>
      `<li><span class="kiedy">od ${esc(czasCzytelny(d.czasS))}</span>`
      + `<span class="opis">${d.drewnoD} / ${d.glinaD} / ${d.zelazoD} na dobę</span>`
      + `<button data-usun-dochod="${i}" title="Usuń">×</button></li>`).join('');
    $('lista-dosylek').innerHTML = plan.zastrzyki.map((z, i) =>
      `<li><span class="kiedy">po ${esc(czasCzytelny(z.czasS))}</span>`
      + `<span class="opis">${z.drewno} / ${z.glina} / ${z.zelazo}</span>`
      + `<button data-usun-dosylke="${i}" title="Usuń">×</button></li>`).join('');
  }

  function rysuj() {
    const s = swiat(plan.swiat);
    const poziomy = poziomyPoKolejce();
    $('tabela-budynkow').tBodies[0].innerHTML = budynkiSwiata(s)
      .map(b => wierszBudynkuHTML(s, b, poziomy, poziomy.ratusz ?? 1)).join('');

    const bledy = bledyPlanu(plan);
    if (bledy.length) {
      $('lista-krokow').innerHTML = '';
      $('stan-wioski').innerHTML = '';
      $('ostrzezenia').innerHTML = bledy.map(b => `<li>${esc(b)}</li>`).join('');
      zaopatrzenieHTML();
      zapisz();
      return;
    }
    const wynik = symuluj(plan);
    const zap = zapotrzebowanie(plan);
    if (zaznaczony !== null && !wynik.kroki[zaznaczony]) zaznaczony = null;
    $('lista-krokow').innerHTML = kolejkaHTML(wynik);
    $('stan-wioski').innerHTML = pasekStanuHTML(s, plan, wynik, zap, zaznaczony);
    $('ostrzezenia').innerHTML = wynik.ostrzezenia.map(o => `<li>${esc(o.tekst)}</li>`).join('');
    zaopatrzenieHTML();
    zapisz();
  }

  function pytajOLiczbe(etykieta) {
    const v = prompt(etykieta, '0');
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

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

  document.addEventListener('click', (e) => {
    const dodaj = e.target.closest('[data-dodaj]');
    if (dodaj) {
      const budynek = dodaj.dataset.dodaj;
      plan.kroki.push({ budynek, doPoziomu: (poziomyPoKolejce()[budynek] ?? 0) + 1 });
      rysuj();
      return;
    }
    const usun = e.target.closest('[data-usun]');
    if (usun) {
      plan.kroki.splice(Number(usun.dataset.usun), 1);
      zaznaczony = null;
      przelicz();
      rysuj();
      return;
    }
    const usunD = e.target.closest('[data-usun-dochod]');
    if (usunD) { plan.dochody.splice(Number(usunD.dataset.usunDochod), 1); rysuj(); return; }
    const usunZ = e.target.closest('[data-usun-dosylke]');
    if (usunZ) { plan.zastrzyki.splice(Number(usunZ.dataset.usunDosylke), 1); rysuj(); return; }
    const krok = e.target.closest('[data-krok]');
    if (krok) {
      const i = Number(krok.dataset.krok);
      zaznaczony = zaznaczony === i ? null : i;
      rysuj();
    }
  });

  const lista = $('lista-krokow');

  lista.addEventListener('dragstart', (e) => {
    const li = e.target.closest('[data-krok]');
    if (!li) return;
    ciagniony = Number(li.dataset.krok);
    li.classList.add('ciagniony');
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });

  // Bez podswietlenia celu nie widac, gdzie krok wyladuje.
  lista.addEventListener('dragover', (e) => {
    if (ciagniony === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    for (const el of lista.querySelectorAll('.cel-gora,.cel-dol')) el.classList.remove('cel-gora', 'cel-dol');
    lista.classList.remove('cel-koniec');
    const li = e.target.closest('[data-krok]');
    if (!li) { lista.classList.add('cel-koniec'); return; }
    const cel = Number(li.dataset.krok);
    li.classList.add(cel < ciagniony ? 'cel-gora' : 'cel-dol');
  });

  function posprzatajPodswietlenie() {
    for (const el of lista.querySelectorAll('.ciagniony,.cel-gora,.cel-dol')) {
      el.classList.remove('ciagniony', 'cel-gora', 'cel-dol');
    }
    lista.classList.remove('cel-koniec');
  }

  lista.addEventListener('drop', (e) => {
    if (ciagniony === null) return;
    e.preventDefault();
    const li = e.target.closest('[data-krok]');
    // Upuszczenie pod ostatnim kafelkiem dokłada krok na koniec.
    const cel = li ? Number(li.dataset.krok) : plan.kroki.length - 1;
    if (cel !== ciagniony) {
      const [krok] = plan.kroki.splice(ciagniony, 1);
      plan.kroki.splice(cel, 0, krok);
      przelicz();
      zaznaczony = null;
    }
    ciagniony = null;
    posprzatajPodswietlenie();
    rysuj();
  });

  lista.addEventListener('dragend', () => { ciagniony = null; posprzatajPodswietlenie(); });

  $('dodaj-dochod').addEventListener('click', () => {
    plan.dochody.push({
      czasS: pytajOLiczbe('Od której godziny od startu obowiązuje?') * 3600,
      drewnoD: pytajOLiczbe('Drewno na dobę'),
      glinaD: pytajOLiczbe('Glina na dobę'),
      zelazoD: pytajOLiczbe('Żelazo na dobę'),
    });
    plan.dochody.sort((a, b) => a.czasS - b.czasS);
    rysuj();
  });

  $('dodaj-zastrzyk').addEventListener('click', () => {
    plan.zastrzyki.push({
      czasS: pytajOLiczbe('W której godzinie od startu przychodzi dosyłka?') * 3600,
      drewno: pytajOLiczbe('Drewno'),
      glina: pytajOLiczbe('Glina'),
      zelazo: pytajOLiczbe('Żelazo'),
    });
    plan.zastrzyki.sort((a, b) => a.czasS - b.czasS);
    rysuj();
  });

  $('zapisz').addEventListener('click', () => { zapisz(); });
  $('wczytaj').addEventListener('click', () => { plan = wczytajPlan(); zaznaczony = null; rysuj(); });
  $('kopiuj-json').addEventListener('click', () => doSchowka(planJSON(plan), 'Plan w formacie JSON'));
  $('kopiuj-tekst').addEventListener('click', () => {
    const tekst = planTekst(plan, symuluj(plan), zapotrzebowanie(plan));
    doSchowka(tekst, 'Plan tekstem');
  });
  $('wklej-json').addEventListener('click', () => otworzModal('wklej', 'Wklej plan', ''));
  $('modal-anuluj').addEventListener('click', () => { $('modal').hidden = true; });
  $('modal-ok').addEventListener('click', () => {
    if (trybModalu === 'kopiuj') { $('modal').hidden = true; return; }
    try {
      plan = normalizujPlan(JSON.parse($('modal-pole').value));
      przelicz();
      zaznaczony = null;
      $('modal').hidden = true;
      rysuj();
    } catch (err) {
      $('modal-info').textContent = `Nie udało się wczytać: ${err.message}`;
    }
  });

  $('wyczysc').addEventListener('click', () => {
    plan = normalizujPlan({ swiat: plan.swiat });
    zaznaczony = null;
    rysuj();
  });

  $('swiat').innerHTML = Object.values(SWIATY)
    .map(x => `<option value="${esc(x.kod)}">${esc(x.nazwa)}</option>`).join('');
  $('swiat').value = plan.swiat;
  $('swiat').addEventListener('change', (e) => {
    plan = normalizujPlan({ swiat: e.target.value });
    zaznaczony = null;
    rysuj();
  });

  rysuj();
}

uruchom();
