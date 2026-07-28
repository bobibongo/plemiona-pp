// src/wioska/strona.js
// Warstwa DOM: stan interfejsu i wpinanie zdarzen. Cale budowanie HTML
// siedzi w modulach widok-*.js i jest testowane bez przegladarki.

import { SWIATY, swiat } from './swiaty.js';
import { kolejnoscBudynkow } from './kolejnosc-budynkow.js';
import { normalizujPlan, bledyPlanu } from './plan.js';
import { symuluj } from './symulacja.js';
import { zapotrzebowanie } from './zapotrzebowanie.js';
import { planJSON, planTekst } from './format.js';
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

  // Kotwica identyfikuje krok przez budynek i poziom. Gdy przelicz zmieni
  // poziomy po przeciaganiu lub usunieciu, odtwarzamy kotwice z tozsamosci
  // obiektu kroku, zeby wtracenie nie przeskoczylo na inny krok.
  function zapamietajKrokiKotwic() {
    return [...plan.dochody, ...plan.zastrzyki].map(wpis => ({
      wpis,
      krok: wpis.kotwica === null ? null : plan.kroki.find(k =>
        k.budynek === wpis.kotwica.budynek && k.doPoziomu === wpis.kotwica.doPoziomu) ?? null,
    }));
  }

  function odtworzKotwice(powiazania, usuwany = null, poprzedni = null) {
    for (const p of powiazania) {
      const krok = p.krok === usuwany ? poprzedni : p.krok;
      p.wpis.kotwica = krok && plan.kroki.includes(krok)
        ? { budynek: krok.budynek, doPoziomu: krok.doPoziomu }
        : null;
    }
  }

  // Wtracenia stoja zaraz po kroku wskazanym kotwica.
  function indeksKotwicyStrony(kotwica) {
    if (kotwica === null) return -1;
    return plan.kroki.findIndex(k => k.budynek === kotwica.budynek && k.doPoziomu === kotwica.doPoziomu);
  }

  function kolejkaHTML(wynik) {
    const wtracenia = [
      ...plan.dochody.map((d, idx) => ({ i: indeksKotwicyStrony(d.kotwica), rodzaj: 'dochod', wpis: d, idx })),
      ...plan.zastrzyki.map((z, idx) => ({ i: indeksKotwicyStrony(z.kotwica), rodzaj: 'dosylka', wpis: z, idx })),
    ].sort((a, b) => a.i - b.i);
    let w = 0;
    const out = [];
    wynik.kroki.forEach((k, i) => {
      while (w < wtracenia.length && wtracenia[w].i <= i - 1) {
        const wpis = wtracenia[w];
        out.push(wtracenieHTML(wpis.rodzaj, wpis.wpis, i, wpis.idx));
        w += 1;
      }
      out.push(krokHTML(k, i, i === zaznaczony));
    });
    while (w < wtracenia.length) {
      const wpis = wtracenia[w];
      out.push(wtracenieHTML(wpis.rodzaj, wpis.wpis, null, wpis.idx));
      w += 1;
    }
    return out.join('');
  }
  function zaopatrzenieHTML() {
    $('lista-dochodow').innerHTML = plan.dochody.map((d, i) =>
      `<li><span class="opis">${d.sumaD} na dobę (${esc(d.zrodlo)})</span>`
      + `<button data-usun-dochod="${i}" title="Usuń">×</button></li>`).join('');
    $('lista-dosylek').innerHTML = plan.zastrzyki.map((z, i) =>
      `<li><span class="opis">${z.drewno} / ${z.glina} / ${z.zelazo}</span>`
      + `<button data-usun-dosylke="${i}" title="Usuń">×</button></li>`).join('');
  }

  function rysuj() {
    const s = swiat(plan.swiat);
    const poziomy = poziomyPoKolejce();
    $('tabela-budynkow').tBodies[0].innerHTML = kolejnoscBudynkow(s)
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
      // Poziom docelowy nadaje przelicz(), zeby regula numeracji zyla
      // w jednym miejscu — tak samo jak przy usuwaniu i zmianie kolejnosci.
      plan.kroki.push({ budynek, doPoziomu: 0 });
      przelicz();
      rysuj();
      return;
    }
    const usun = e.target.closest('[data-usun]');
    if (usun) {
      const indeksUsuwany = Number(usun.dataset.usun);
      const usuwanyKrok = plan.kroki[indeksUsuwany];
      const poprzedniKrok = indeksUsuwany > 0 ? plan.kroki[indeksUsuwany - 1] : null;
      const powiazania = zapamietajKrokiKotwic();
      plan.kroki.splice(indeksUsuwany, 1);
      zaznaczony = null;
      przelicz();
      odtworzKotwice(powiazania, usuwanyKrok, poprzedniKrok);
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
    const krokEl = e.target.closest('[data-krok]');
    const wtracenieEl = !krokEl ? e.target.closest('[data-wtracenie]') : null;
    if (!krokEl && !wtracenieEl) return;
    if (krokEl) {
      ciagniony = { typ: 'krok', indeks: Number(krokEl.dataset.krok) };
      krokEl.classList.add('ciagniony');
    } else {
      ciagniony = { typ: wtracenieEl.dataset.wtracenieRodzaj, indeks: Number(wtracenieEl.dataset.wtracenie) };
      wtracenieEl.classList.add('ciagniony');
    }
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });

  // Cel upuszczenia moze byc kafelkiem kroku albo wtraceniem, ktore niesie
  // indeks kroku stojacego za nim. Brak obu znaczy upuszczenie pod lista.
  function elementCelu(e) {
    return e.target.closest('[data-krok],[data-przed-krokiem]');
  }
  function indeksZElementu(el) {
    if (!el) return null;
    const wartosc = el.dataset.krok ?? el.dataset.przedKrokiem;
    return wartosc === undefined ? null : Number(wartosc);
  }

  // Bez podswietlenia celu nie widac, gdzie krok wyladuje.
  lista.addEventListener('dragover', (e) => {
    if (ciagniony === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    for (const el of lista.querySelectorAll('.cel-gora,.cel-dol')) el.classList.remove('cel-gora', 'cel-dol');
    lista.classList.remove('cel-koniec');
    const el = elementCelu(e);
    const cel = indeksZElementu(el);
    if (cel === null) { lista.classList.add('cel-koniec'); return; }
    const referencyjny = ciagniony.typ === 'krok' ? ciagniony.indeks : cel;
    el.classList.add(cel < referencyjny ? 'cel-gora' : 'cel-dol');
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
    const indeksCelu = indeksZElementu(elementCelu(e));
    if (ciagniony.typ === 'krok') {
      const cel = indeksCelu === null ? plan.kroki.length - 1 : indeksCelu;
      if (cel !== ciagniony.indeks) {
        const powiazania = zapamietajKrokiKotwic();
        const [krok] = plan.kroki.splice(ciagniony.indeks, 1);
        plan.kroki.splice(cel, 0, krok);
        przelicz();
        odtworzKotwice(powiazania);
        zaznaczony = null;
      }
    } else {
      const listaWtracen = ciagniony.typ === 'dochod' ? plan.dochody : plan.zastrzyki;
      const wpis = listaWtracen[ciagniony.indeks];
      if (wpis) {
        const poprzedni = indeksCelu === null
          ? plan.kroki[plan.kroki.length - 1]
          : (indeksCelu > 0 ? plan.kroki[indeksCelu - 1] : null);
        wpis.kotwica = poprzedni ? { budynek: poprzedni.budynek, doPoziomu: poprzedni.doPoziomu } : null;
      }
    }
    ciagniony = null;
    posprzatajPodswietlenie();
    rysuj();
  });

  lista.addEventListener('dragend', () => { ciagniony = null; posprzatajPodswietlenie(); });

  function kotwicaOdZaznaczenia() {
    if (zaznaczony === null || !plan.kroki[zaznaczony]) return null;
    const k = plan.kroki[zaznaczony];
    return { budynek: k.budynek, doPoziomu: k.doPoziomu };
  }

  $('dodaj-dochod').addEventListener('click', () => {
    const zrodlo = confirm('OK = zbieractwo, Anuluj = farma') ? 'zbieractwo' : 'farma';
    plan.dochody.push({
      kotwica: kotwicaOdZaznaczenia(),
      sumaD: pytajOLiczbe('Suma na dobę (dzielona równo na drewno/glinę/żelazo)'),
      zrodlo,
    });
    rysuj();
  });

  $('dodaj-zastrzyk').addEventListener('click', () => {
    plan.zastrzyki.push({
      kotwica: kotwicaOdZaznaczenia(),
      drewno: pytajOLiczbe('Drewno'),
      glina: pytajOLiczbe('Glina'),
      zelazo: pytajOLiczbe('Żelazo'),
    });
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
