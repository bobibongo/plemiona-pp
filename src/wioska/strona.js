// src/wioska/strona.js
// Warstwa DOM: stan interfejsu i wpinanie zdarzen. Cale budowanie HTML
// siedzi w modulach widok-*.js i jest testowane bez przegladarki.

import { SWIATY, swiat } from './swiaty.js';
import { kolejnoscBudynkow } from './kolejnosc-budynkow.js';
import { normalizujPlan, bledyPlanu } from './plan.js';
import { symuluj } from './symulacja.js';
import { zapotrzebowanie, osRekrutacjiBezPrzestojow, ostrzezeniaRekrutacji, osBezPrzestojow } from './zapotrzebowanie.js';
import { jednostkiSwiata } from './jednostki.js';
import { planJSON, planTekst, czasCzytelny } from './format.js';
import { esc, wierszBudynkuHTML } from './widok-budynki.js';
import { kolejkaHTML } from './widok-kolejka.js';
import { pasekStanuHTML } from './widok-status.js';
import { wykresHTML, punktyWDniach } from './widok-wykres.js';
import { NAZWY_JEDNOSTEK } from './nazwy.js';

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
    return [...plan.dochody, ...plan.zastrzyki, ...plan.rekrutacje].map(wpis => ({
      wpis,
      krok: wpis.kotwica === null ? null : plan.kroki.find(k =>
        k.budynek === wpis.kotwica.budynek && k.doPoziomu === wpis.kotwica.doPoziomu) ?? null,
    }));
  }

  function odtworzKotwice(powiazania, usuwane = null, poprzedni = null) {
    for (const p of powiazania) {
      const krok = usuwane && usuwane.includes(p.krok) ? poprzedni : p.krok;
      p.wpis.kotwica = krok && plan.kroki.includes(krok)
        ? { budynek: krok.budynek, doPoziomu: krok.doPoziomu }
        : null;
    }
  }

  // Dzien, w ktorym wtracenie zaczyna dzialac: po ukonczeniu kroku-kotwicy
  // (kotwica null = od poczatku planu). Ta sama definicja doby, co naglowki
  // w kolejce, zeby dalo sie je ze soba zestawic.
  function dzienKotwicy(kotwica) {
    if (kotwica === null) return 1;
    const os = osBezPrzestojow(plan);
    const i = plan.kroki.findIndex(k => k.budynek === kotwica.budynek && k.doPoziomu === kotwica.doPoziomu);
    if (i < 0 || !os[i]) return 1;
    return Math.floor((os[i].startS + os[i].trwanieS) / 86400) + 1;
  }

  function znacznikDnia(kotwica) {
    return `<span class="od-dnia" title="Zaczyna działać tego dnia planu">dzień ${dzienKotwicy(kotwica)}</span>`;
  }

  function zaopatrzenieHTML() {
    // Wpisy sortujemy po dniu — lista czyta sie wtedy jak harmonogram,
    // a nie jak kolejnosc przypadkowego dodawania.
    const wgDnia = (a, b) => dzienKotwicy(a.kotwica) - dzienKotwicy(b.kotwica);

    const dochody = plan.dochody.map((d, i) => ({ d, i })).sort((a, b) => wgDnia(a.d, b.d));
    $('lista-dochodow').innerHTML = dochody.map(({ d, i }) =>
      `<li>${znacznikDnia(d.kotwica)}<span class="opis">${esc(d.zrodlo)} · ${d.sumaD.toLocaleString('pl-PL')} / dobę</span>`
      + `<button data-usun-dochod="${i}" title="Usuń">×</button></li>`).join('')
      || '<li class="pusto">Brak — dodaj dochód z farmy lub zbieractwa.</li>';

    const dosylki = plan.zastrzyki.map((z, i) => ({ z, i })).sort((a, b) => wgDnia(a.z, b.z));
    $('lista-dosylek').innerHTML = dosylki.map(({ z, i }) =>
      `<li>${znacznikDnia(z.kotwica)}<span class="opis">`
      + `${z.drewno.toLocaleString('pl-PL')} / ${z.glina.toLocaleString('pl-PL')} / ${z.zelazo.toLocaleString('pl-PL')}</span>`
      + `<button data-usun-dosylke="${i}" title="Usuń">×</button></li>`).join('')
      || '<li class="pusto">Brak — dosyłka pokrywa ujemne saldo doby, reszta przechodzi dalej.</li>';

    const rekrutacjeOs = osRekrutacjiBezPrzestojow(plan);
    const rekrutacje = plan.rekrutacje.map((r, i) => ({ r, i })).sort((a, b) => wgDnia(a.r, b.r));
    $('lista-rekrutacji').innerHTML = rekrutacje.map(({ r, i }) => {
      const os = rekrutacjeOs[i];
      const nazwa = NAZWY_JEDNOSTEK[r.jednostka] ?? r.jednostka;
      const doDnia = os ? Math.floor(os.koniecS / 86400) + 1 : null;
      const zakres = doDnia ? `<span class="do-dnia" title="Ostatnia sztuka gotowa tego dnia">do ${doDnia}</span>` : '';
      const czas = os ? `<span class="ile-trwa">${czasCzytelny(os.trwanieS)}</span>` : '';
      return `<li>${znacznikDnia(r.kotwica)}${zakres}`
        + `<span class="opis">${r.ilosc.toLocaleString('pl-PL')}× ${esc(nazwa)}</span>${czas}`
        + `<button data-usun-rekrutacje="${i}" title="Usuń">×</button></li>`;
    }).join('') || '<li class="pusto">Brak — dodaj jednostki, żeby zobaczyć ich koszt w bilansie.</li>';
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
    $('lista-krokow').innerHTML = kolejkaHTML(plan, wynik, zaznaczony);
    $('stan-wioski').innerHTML = pasekStanuHTML(s, plan, wynik, zap, zaznaczony);
    $('wykres-uchwyt').innerHTML = wykresHTML(plan, wynik, zaznaczony);
    const ostrzezenia = [...wynik.ostrzezenia, ...ostrzezeniaRekrutacji(plan)];
    $('ostrzezenia').innerHTML = ostrzezenia.map(o => `<li>${esc(o.tekst)}</li>`).join('');
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

  const lista = $('lista-krokow');

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
      const od = Number(usun.dataset.usun);
      const do_ = Number(usun.dataset.usunDo ?? od);
      const usuwaneKroki = plan.kroki.slice(od, do_ + 1);
      const poprzedniKrok = od > 0 ? plan.kroki[od - 1] : null;
      const powiazania = zapamietajKrokiKotwic();
      plan.kroki.splice(od, do_ - od + 1);
      zaznaczony = null;
      przelicz();
      odtworzKotwice(powiazania, usuwaneKroki, poprzedniKrok);
      rysuj();
      return;
    }
    const usunD = e.target.closest('[data-usun-dochod]');
    if (usunD) { plan.dochody.splice(Number(usunD.dataset.usunDochod), 1); rysuj(); return; }
    const usunZ = e.target.closest('[data-usun-dosylke]');
    if (usunZ) { plan.zastrzyki.splice(Number(usunZ.dataset.usunDosylke), 1); rysuj(); return; }
    const usunR = e.target.closest('[data-usun-rekrutacje]');
    if (usunR) { plan.rekrutacje.splice(Number(usunR.dataset.usunRekrutacje), 1); rysuj(); return; }
    const krok = e.target.closest('[data-krok]');
    if (krok) {
      const i = Number(krok.dataset.krok);
      zaznaczony = zaznaczony === i ? null : i;
      rysuj();
      return;
    }
    // Klikniecie w naglowek dnia albo w ktorykolwiek z jego paskow zaznacza
    // caly dzien — reprezentowany przez pierwszy krok, ktory sie w nim zaczyna.
    const dzienEl = e.target.closest('[data-dzien]');
    if (dzienEl) {
      const d = Number(dzienEl.dataset.dzien);
      const i = pierwszyKrokDnia(d);
      if (i !== null) {
        zaznaczony = dzienZaznaczenia() === d ? null : i;
        rysuj();
      }
      return;
    }
    const kropka = e.target.closest('[data-dzien-krok]');
    if (kropka && kropka.dataset.dzienKrok !== '') {
      const i = Number(kropka.dataset.dzienKrok);
      zaznaczony = zaznaczony === i ? null : i;
      rysuj();
      przewinDoZaznaczonegoDnia();
    }
  });

  $('do-konca').addEventListener('click', () => {
    lista.scrollTo({ top: lista.scrollHeight, behavior: 'smooth' });
  });

  lista.addEventListener('dragstart', (e) => {
    const krokEl = e.target.closest('[data-krok]');
    const wtracenieEl = !krokEl ? e.target.closest('[data-wtracenie]') : null;
    if (!krokEl && !wtracenieEl) return;
    if (krokEl) {
      const indeks = Number(krokEl.dataset.krok);
      const indeksDo = Number(krokEl.dataset.krokDo ?? indeks);
      ciagniony = { typ: 'krok', indeks, indeksDo };
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
      // Cel wewnatrz przeciaganej grupy nie ma sensu — grupa juz tam jest.
      if (cel < ciagniony.indeks || cel > ciagniony.indeksDo) {
        const powiazania = zapamietajKrokiKotwic();
        const przenoszone = plan.kroki.splice(ciagniony.indeks, ciagniony.indeksDo - ciagniony.indeks + 1);
        plan.kroki.splice(cel, 0, ...przenoszone);
        przelicz();
        odtworzKotwice(powiazania);
        zaznaczony = null;
      }
    } else {
      const listyWtracen = { dochod: plan.dochody, dosylka: plan.zastrzyki, rekrutacja: plan.rekrutacje };
      const listaWtracen = listyWtracen[ciagniony.typ];
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

  // Indeks pierwszego kroku rozpoczynajacego sie w danej dobie (os bez
  // przestojow — ta sama definicja dnia, co naglowki w kolejce i wykres).
  function pierwszyKrokDnia(dzien) {
    const os = osBezPrzestojow(plan);
    for (let i = 0; i < os.length; i++) {
      if (Math.floor(os[i].startS / 86400) === dzien) return i;
    }
    // Doba bez wlasnego startu (dlugi krok przechodzi przez nia) — zaznaczamy
    // ostatni krok, ktory zaczal sie wczesniej.
    let ostatni = null;
    for (let i = 0; i < os.length; i++) {
      if (Math.floor(os[i].startS / 86400) <= dzien) ostatni = i;
    }
    return ostatni;
  }

  function dzienZaznaczenia() {
    if (zaznaczony === null) return null;
    const os = osBezPrzestojow(plan);
    return os[zaznaczony] ? Math.floor(os[zaznaczony].startS / 86400) : null;
  }

  // Tabela kolejki sama dojezdza do zaznaczonego dnia — inaczej klikniecie
  // w slupek wykresu zmienia podswietlenie poza widocznym obszarem listy.
  //
  // Celowo NIE uzywamy scrollIntoView: ono przewija wszystkich przodkow, wiec
  // klikniecie w wykres u gory strony wyrzucalo widok na dol, do kolejki.
  // Zamiast tego przesuwamy sam kontener listy, licząc pozycje wzgledem
  // niego — reszta strony zostaje tam, gdzie jest.
  function przewinDoZaznaczonegoDnia() {
    const d = dzienZaznaczenia();
    if (d === null) return;
    const cel = lista.querySelector(`.naglowek-dnia[data-dzien="${d}"]`);
    if (!cel) return;
    const gora = cel.offsetTop - lista.offsetTop;
    const srodek = gora - (lista.clientHeight - cel.offsetHeight) / 2;
    lista.scrollTo({ top: Math.max(0, srodek), behavior: 'smooth' });
  }

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

  $('dodaj-rekrutacje').addEventListener('click', () => {
    const jednostki = jednostkiSwiata(swiat(plan.swiat));
    const lista = jednostki.map((j, i) => `${i + 1}. ${NAZWY_JEDNOSTEK[j] ?? j}`).join('\n');
    const wybor = prompt(`Którą jednostkę rekrutujemy?\n${lista}`, '1');
    const indeksJednostki = Number(wybor) - 1;
    const jednostka = jednostki[indeksJednostki];
    if (!jednostka) return;
    const ilosc = pytajOLiczbe(`Ile sztuk: ${NAZWY_JEDNOSTEK[jednostka] ?? jednostka}`);
    if (ilosc <= 0) return;
    plan.rekrutacje.push({ kotwica: kotwicaOdZaznaczenia(), jednostka, ilosc });
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
