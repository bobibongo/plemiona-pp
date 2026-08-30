// test/wioska-widoki.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { czasCzytelny } from '../src/wioska/format.js';
import { esc, wierszBudynkuHTML } from '../src/wioska/widok-budynki.js';
import { krokHTML, wtracenieHTML, naglowekDniaHTML, kolejkaHTML } from '../src/wioska/widok-kolejka.js';
import { osBezPrzestojow, osRekrutacjiBezPrzestojow, zapotrzebowanieDzienne } from '../src/wioska/zapotrzebowanie.js';
import { punktyWioski } from '../src/wioska/punkty.js';

const s = swiat('pl231');

test('esc ucieka znaki, ktore zepsulyby HTML', () => {
  assert.equal(esc('<b>&"'), '&lt;b&gt;&amp;&quot;');
});

test('wiersz budynku pokazuje ikone, nazwe i koszt nastepnego poziomu', () => {
  const html = wierszBudynkuHTML(s, 'tartak', { ratusz: 1, tartak: 0 }, 1);
  assert.match(html, /Tartak/);
  assert.match(html, /wood\.svg|data:image/);
  assert.match(html, /50/);
  assert.match(html, />60</);
});

test('wiersz budynku nigdy nie zawiera znaku przyblizenia', () => {
  const html = wierszBudynkuHTML(s, 'tartak', { ratusz: 1, tartak: 4 }, 1);
  assert.doesNotMatch(html, /≈/);
});

test('wiersz budynku z niespelnionym wymaganiem jest zablokowany z powodem', () => {
  const html = wierszBudynkuHTML(s, 'koszary', { ratusz: 1 }, 1);
  assert.match(html, /zablokowany/);
  assert.match(html, /title="Wymaga: Ratusz 3"/);
  assert.doesNotMatch(html, /class="powod"/);
  assert.match(html, /disabled/);
});

test('budynek na maksymalnym poziomie nie ma przycisku rozbudowy', () => {
  const html = wierszBudynkuHTML(s, 'plac', { plac: 1, ratusz: 1 }, 1);
  assert.match(html, /rozbudowany/);
  assert.doesNotMatch(html, /data-dodaj/);
});

test('kafelek kroku pokazuje laczne punkty wioski po tym kroku zamiast numeru', () => {
  const plan = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] });
  const w = symuluj(plan);
  const oczekiwane = punktyWioski(w.kroki[0].poziomyPo);
  const html = krokHTML(w.kroki[0], 0, false);
  assert.match(html, new RegExp(`class="nr"[^>]*>${oczekiwane}<`));
});

test('kafelek kroku niesie indeks, na ktorym opiera sie przeciaganie', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  assert.match(krokHTML(w.kroki[0], 0, false), /data-krok="0"/);
});

test('zaznaczony kafelek dostaje wlasna klase', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] }));
  assert.doesNotMatch(krokHTML(w.kroki[0], 0, false), /zaznaczony/);
  assert.match(krokHTML(w.kroki[0], 0, true), /zaznaczony/);
});

test('kafelek z bledem dostaje klase blad', () => {
  const w = symuluj(normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'koszary', doPoziomu: 1 }] }));
  assert.match(krokHTML(w.kroki[0], 0, false), /class="[^"]*blad/);
});

test('wiersz budynku niesie identyfikator do wpiecia zdarzenia', () => {
  const html = wierszBudynkuHTML(s, 'tartak', { ratusz: 1, tartak: 0 }, 1);
  assert.match(html, /data-dodaj="tartak"/);
});

test('kafelek kroku z przestojem mowi, na ktory surowiec czeka', () => {
  const w = symuluj(normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ kotwica: null, sumaD: 4320, zrodlo: 'farma' }],
  }));
  assert.ok(w.kroki[0].czekanieS > 0, 'krok ma czekac, inaczej test nic nie sprawdza');
  // Czekanie sygnalizuje klasa i podpowiedz, nie osobna ikona.
  const html = krokHTML(w.kroki[0], 0, false);
  assert.ok(html.includes('class="krok czeka"'), 'kafelek ma klase czekania');
  assert.match(html, /title="Czeka na /);
});

test('wtracenie dochodu pokazuje sume dobowa i zrodlo', () => {
  const html = wtracenieHTML('dochod', { kotwica: null, sumaD: 15000, zrodlo: 'zbieractwo' }, null);
  assert.match(html, /15000/);
  assert.match(html, /zbieractwo/);
  assert.match(html, /dobę/);
});

test('wtracenie dochodu z farmy oznacza zrodlo', () => {
  const html = wtracenieHTML('dochod', { kotwica: null, sumaD: 5000, zrodlo: 'farma' }, null);
  assert.match(html, /farm[ay]/);
});

test('wtracenie dosylki podaje ilosci', () => {
  const html = wtracenieHTML('dosylka', { kotwica: null, drewno: 5000, glina: 5000, zelazo: 5000 });
  assert.match(html, /5000/);
});
test('wtracenie w srodku kolejki niesie indeks kroku, przed ktorym stoi', () => {
  const html = wtracenieHTML('dosylka', { kotwica: null, drewno: 5000, glina: 5000, zelazo: 5000 }, 3);
  assert.match(html, /data-przed-krokiem="3"/);
});

test('wtracenie na koncu kolejki nie niesie indeksu, bo koniec listy jest poprawnym celem', () => {
  const html = wtracenieHTML('dochod', { kotwica: null, sumaD: 3, zrodlo: 'farma' });
  assert.doesNotMatch(html, /data-przed-krokiem/);
});

test('wtracenie z indeksem w tablicy jest przeciagalne i niesie swoj indeks i rodzaj', () => {
  const html = wtracenieHTML('dosylka', { kotwica: null, drewno: 1, glina: 0, zelazo: 0 }, null, 2);
  assert.match(html, /draggable="true"/);
  assert.match(html, /data-wtracenie="2"/);
  assert.match(html, /data-wtracenie-rodzaj="dosylka"/);
});

test('wtracenie bez indeksu w tablicy nie jest przeciagalne', () => {
  const html = wtracenieHTML('dosylka', { kotwica: null, drewno: 1, glina: 0, zelazo: 0 });
  assert.doesNotMatch(html, /draggable/);
});

test('naglowek dnia pokazuje numer od jednego, sume surowcow i liczbe krokow', () => {
  const html = naglowekDniaHTML({ dzien: 2, drewno: 12000, glina: 8000, zelazo: 5000, liczbaKrokow: 4 });
  assert.match(html, /Dzień 3/);
  assert.match(html, /12\s?000/);
  assert.match(html, /8\s?000/);
  assert.match(html, /5\s?000/);
  assert.match(html, /4/);
});

test('naglowek pustego dnia pokazuje zera i nie wyglada jak krok', () => {
  const html = naglowekDniaHTML({ dzien: 3, drewno: 0, glina: 0, zelazo: 0, liczbaKrokow: 0 });
  assert.match(html, /Dzień 4/);
  assert.match(html, /class="naglowek-dnia"/);
  assert.doesNotMatch(html, /data-krok=/);
});

test('kolejka bez wielu dni ma jeden naglowek dnia na starcie', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }] });
  const w = symuluj(p);
  const html = kolejkaHTML(p, w, null);
  const dopasowania = html.match(/naglowek-dnia/g) ?? [];
  assert.equal(dopasowania.length, 1);
  assert.match(html, /Dzień 1/);
});

test('kolejka wstawia naglowek przy kazdej zmianie dnia', () => {
  const kroki = [];
  for (let i = 1; i <= 20; i++) kroki.push({ budynek: 'ratusz', doPoziomu: i });
  const p = normalizujPlan({ swiat: 'pl231', kroki });
  const w = symuluj(p);
  const dni = zapotrzebowanieDzienne(p);
  const html = kolejkaHTML(p, w, null);
  const dopasowania = html.match(/naglowek-dnia/g) ?? [];
  assert.equal(dopasowania.length, dni.length);
  for (let d = 0; d < dni.length; d++) assert.match(html, new RegExp(`Dzień ${d + 1}\\b`));
});

test('kolejka pokazuje naglowek dla dnia bez zadnego startujacego kroku', () => {
  // Ratusz do poziomu 30 trwa ok. 55h (ponad dwie doby) — dzien 1 nie ma
  // zadnego startu, ale ma sie pojawic jego naglowek z zerami.
  const p = normalizujPlan({ swiat: 'pl231', start: { poziomy: { ratusz: 1 } }, kroki: [{ budynek: 'ratusz', doPoziomu: 30 }, { budynek: 'tartak', doPoziomu: 1 }] });
  const os = osBezPrzestojow(p);
  assert.ok(os[0].trwanieS > 86400, 'test zaklada krok dluzszy niz doba — dostosuj plan, jesli tabele swiata sie zmienily');
  const w = symuluj(p);
  const html = kolejkaHTML(p, w, null);
  // Naglowek dnia niesie sam licznik krokow; surowce przenioslismy do paska
  // budowy, ktory w dniu bez zadnego kroku celowo milczy.
  assert.match(html, /Dzień 2 · 0 kroki/);
});

test('kolejka zachowuje kolejnosc: wtracenie na koncu dnia przed naglowkiem kolejnego', () => {
  const kroki = [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }];
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki,
    zastrzyki: [{ kotwica: { budynek: 'tartak', doPoziomu: 1 }, drewno: 100, glina: 0, zelazo: 0 }],
  });
  const os = osBezPrzestojow(p);
  const w = symuluj(p);
  const html = kolejkaHTML(p, w, null);
  const pozycjaWtracenia = html.indexOf('wtracenie');
  const pozycjaDrugiegoNaglowka = html.indexOf('naglowek-dnia', html.indexOf('naglowek-dnia') + 1);
  if (os[1].startS - os[0].startS >= 0 && Math.floor(os[1].startS / 86400) > Math.floor(os[0].startS / 86400)) {
    assert.ok(pozycjaWtracenia !== -1 && pozycjaDrugiegoNaglowka !== -1 && pozycjaWtracenia < pozycjaDrugiegoNaglowka,
      'wtracenie konczace dzien ma stac przed naglowkiem kolejnego dnia');
  } else {
    assert.equal(pozycjaDrugiegoNaglowka, -1, 'test zaklada dwa dni — dostosuj plan, jesli tabele swiata sie zmienily');
  }
});

test('kolejka pustego planu nie ma zadnego naglowka dnia', () => {
  const p = normalizujPlan({ swiat: 'pl231' });
  const w = symuluj(p);
  assert.equal(kolejkaHTML(p, w, null), '');
});

test('kolejka laczy sasiadujace kroki tego samego budynku w jeden kafelek z przyrostem', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [
      { budynek: 'tartak', doPoziomu: 1 },
      { budynek: 'tartak', doPoziomu: 2 },
      { budynek: 'tartak', doPoziomu: 3 },
    ],
  });
  const w = symuluj(p);
  const html = kolejkaHTML(p, w, null);
  const dopasowania = html.match(/class="krok/g) ?? [];
  assert.equal(dopasowania.length, 1);
  assert.match(html, /Tartak → 3 \(\+3\)/);
  assert.match(html, /data-krok="0"/);
  assert.match(html, /data-krok-do="2"/);
  assert.match(html, /data-usun="0"/);
  assert.match(html, /data-usun-do="2"/);
});

test('kolejka nie laczy krokow z roznych budynkow', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
  });
  const w = symuluj(p);
  const html = kolejkaHTML(p, w, null);
  const dopasowania = html.match(/class="krok/g) ?? [];
  assert.equal(dopasowania.length, 2);
});

test('zaznaczenie kroku w srodku pasma rozbija grupe, zeby dalo sie go zaznaczyc osobno', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [
      { budynek: 'tartak', doPoziomu: 1 },
      { budynek: 'tartak', doPoziomu: 2 },
      { budynek: 'tartak', doPoziomu: 3 },
    ],
  });
  const w = symuluj(p);
  const html = kolejkaHTML(p, w, 1);
  const dopasowania = html.match(/class="krok/g) ?? [];
  assert.equal(dopasowania.length, 3, 'zaznaczony krok w srodku pasma ma stac osobno od sasiadow');
  // Kafelek moze niesc dodatkowe klasy (np. przynaleznosc do doby), wiec
  // sprawdzamy obecnosc "zaznaczony" wsrod nich, nie dokladny ciag klas.
  assert.match(html, /class="krok[^"]*\bzaznaczony\b[^"]*"[^>]*data-krok="1"[^>]*data-krok-do="1"/);
});

test('wtracenie zakotwiczone w srodku pasma przerywa grupowanie w tym miejscu', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [
      { budynek: 'tartak', doPoziomu: 1 },
      { budynek: 'tartak', doPoziomu: 2 },
      { budynek: 'tartak', doPoziomu: 3 },
    ],
    zastrzyki: [{ kotwica: { budynek: 'tartak', doPoziomu: 1 }, drewno: 100, glina: 0, zelazo: 0 }],
  });
  const w = symuluj(p);
  const html = kolejkaHTML(p, w, null);
  const dopasowania = html.match(/class="krok/g) ?? [];
  assert.equal(dopasowania.length, 2, 'wtracenie musi wypasc miedzy krokiem 0 a 1, wiec nie moga byc w jednej grupie');
  const pozycjaWtracenia = html.indexOf('wtracenie');
  const pozycjaDrugiegoKroku = html.indexOf('data-krok="1"');
  assert.ok(pozycjaWtracenia !== -1 && pozycjaWtracenia < pozycjaDrugiegoKroku);
});

test('grupa dziedziczy stan czekania, jesli ktorykolwiek krok w niej czekal', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 2 }],
    dochody: [{ kotwica: null, sumaD: 4320, zrodlo: 'farma' }],
  });
  const w = symuluj(p);
  assert.ok(w.kroki.some(k => k.czekanieS > 0), 'test zaklada przynajmniej jeden krok z czekaniem');
  const html = kolejkaHTML(p, w, null);
  assert.match(html, /class="[^"]*\bczeka\b[^"]*"/);
});

test('wtracenie rekrutacji pokazuje ilosc, jednostke, budynek i czas trwania', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    rekrutacje: [{ kotwica: null, jednostka: 'topornik', ilosc: 50 }],
  });
  const os = osRekrutacjiBezPrzestojow(p);
  const html = wtracenieHTML('rekrutacja', { ...p.rekrutacje[0], ...os[0] }, null, 0);
  assert.match(html, /50×/);
  assert.match(html, /Topornik/);
  assert.match(html, /Koszary/);
});

test('kolejka pokazuje rekrutacje jako wtracenie w miejscu jej kotwicy', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'koszary', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 1 }],
    rekrutacje: [{ kotwica: { budynek: 'koszary', doPoziomu: 1 }, jednostka: 'topornik', ilosc: 10 }],
  });
  const w = symuluj(p);
  const html = kolejkaHTML(p, w, null);
  assert.match(html, /class="wtracenie rekrutacja"/);
  const pozycjaRekrutacji = html.indexOf('rekrutacja');
  const pozycjaTartaku = html.indexOf('Tartak');
  assert.ok(pozycjaRekrutacji !== -1 && pozycjaRekrutacji < pozycjaTartaku,
    'rekrutacja zakotwiczona do koszar ma stac przed kolejnym krokiem (tartak)');
});

test('kolejka planu z sama dluga rekrutacja (bez zadnej budowy) nadal pokazuje naglowki dni', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    rekrutacje: [{ kotwica: null, jednostka: 'topornik', ilosc: 300 }],
  });
  const w = symuluj(p);
  const dni = zapotrzebowanieDzienne(p);
  assert.ok(dni.length >= 3, 'test zaklada partie rozciagnieta na wiele dni');
  const html = kolejkaHTML(p, w, null);
  const dopasowania = html.match(/naglowek-dnia/g) ?? [];
  assert.equal(dopasowania.length, dni.length);
  assert.match(html, new RegExp(`Dzień ${dni.length}\\b`));
});

test('kolejka z rekrutacja dluzsza niz budowa dorenderowuje naglowki po ostatnim kroku', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    rekrutacje: [{ kotwica: null, jednostka: 'topornik', ilosc: 300 }],
  });
  const w = symuluj(p);
  const dni = zapotrzebowanieDzienne(p);
  assert.ok(dni.length >= 3, 'test zaklada rekrutacje rozciagnieta poza dzien budowy');
  const html = kolejkaHTML(p, w, null);
  const dopasowania = html.match(/naglowek-dnia/g) ?? [];
  assert.equal(dopasowania.length, dni.length);
});
test('pasek wojska pokazuje skrot jednostki obok ikony', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    rekrutacje: [{ kotwica: null, jednostka: 'ciezka', ilosc: 50 }],
  });
  const html = kolejkaHTML(p, symuluj(p), null);
  assert.match(html, /wojsko-skrot">CK</, 'ciezka kawaleria ma skrot CK');
});

test('dzien ma osobny pasek budowy z kosztem surowcow', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
  });
  const html = kolejkaHTML(p, symuluj(p), null);
  assert.match(html, /class="pasek-budowy[^"]*"/, 'pasek budowy istnieje');
  assert.match(html, /budowa-skrot">D</, 'ma skrot drewna');
  assert.match(html, /budowa-suma">/, 'ma sume dnia');
});

test('zaznaczenie kroku podswietla caly jego dzien, nie tylko krok', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
  });
  const html = kolejkaHTML(p, symuluj(p), 0);
  assert.match(html, /class="naglowek-dnia aktywny" data-dzien="0"/, 'naglowek dnia 0 jest aktywny');
  assert.match(html, /class="pasek-budowy aktywny[^"]*"/, 'pasek budowy tez');
});

test('elementy dnia niosa data-dzien do klikania', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] });
  const html = kolejkaHTML(p, symuluj(p), null);
  assert.match(html, /class="naglowek-dnia" data-dzien="0"/);
});

test('pasek budowy domyka blok dnia, gdy nie ma jeszcze wojska', () => {
  // Plan bez rekrutacji: kazdy dzien konczy sie paskiem budowy, wiec to on
  // musi niesc klase domykajaca ramke bloku.
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] });
  const html = kolejkaHTML(p, symuluj(p), null);
  assert.match(html, /class="pasek-budowy domyka"/);
  assert.ok(!html.includes('pasek-wojska'), 'bez rekrutacji nie ma paska wojska');
});

test('pasek budowy nie domyka bloku, gdy pod nim stoi wojsko', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    rekrutacje: [{ kotwica: null, jednostka: 'pikinier', ilosc: 20 }],
  });
  const html = kolejkaHTML(p, symuluj(p), null);
  assert.ok(!html.includes('pasek-budowy domyka'), 'budowa nie domyka, bo jest wojsko');
  assert.match(html, /class="pasek-wojska"/);
});

test('kafelek kroku pokazuje czas budowy', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] });
  const w = symuluj(p);
  const html = kolejkaHTML(p, w, null);
  assert.match(html, /class="czas-budowy"/, 'kafelek ma pole czasu');
  assert.ok(html.includes(czasCzytelny(w.kroki[0].trwanieS)),
    `kafelek powinien zawierac "${czasCzytelny(w.kroki[0].trwanieS)}"`);
});

test('zgrupowany kafelek sumuje czas calego pasma', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 2 }],
  });
  const w = symuluj(p);
  const suma = w.kroki[0].trwanieS + w.kroki[1].trwanieS;
  const html = kolejkaHTML(p, w, null);
  assert.ok(html.includes(czasCzytelny(suma)),
    `zgrupowany kafelek powinien pokazac sume ${czasCzytelny(suma)}`);
});
