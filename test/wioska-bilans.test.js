// test/wioska-bilans.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swiat } from '../src/wioska/swiaty.js';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { zapotrzebowanie, osBezPrzestojow, zapotrzebowanieDzienne } from '../src/wioska/zapotrzebowanie.js';
import { bilansHTML, przeniesDosylki, bilansDzienny } from '../src/wioska/widok-bilans.js';

const s = swiat('pl231');

test('bilans pokazuje eko, farme i zbieractwo osobno', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { tartak: 5, cegielnia: 5, huta: 5 } },
    kroki: [{ budynek: 'ratusz', doPoziomu: 2 }],
    dochody: [
      { kotwica: null, sumaD: 9000, zrodlo: 'farma' },
      { kotwica: null, sumaD: 3000, zrodlo: 'zbieractwo' },
    ],
  });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.match(html, /EKO/);
  assert.match(html, /Farma/);
  assert.match(html, /Zbieractwo/);
});

test('bilans pokazuje ujemna roznice, gdy zuzycie przewyzsza dochod', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'ratusz', doPoziomu: i });
  const p = normalizujPlan({ swiat: 'pl231', kroki });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), 0);
  assert.match(html, /-\d/);
});

test('dosylka pojawia sie w dochodzie w dniu, w ktorym wpada', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
    zastrzyki: [
      { kotwica: null, drewno: 100, glina: 0, zelazo: 0 },
      { kotwica: { budynek: 'cegielnia', doPoziomu: 1 }, drewno: 200, glina: 0, zelazo: 0 },
    ],
  });
  const w = symuluj(p);
  const z = zapotrzebowanie(p);
  const html = bilansHTML(s, p, w, z, 0);
  assert.match(html, /<b>Dosyłka<\/b>/, 'dosylka z doby 1 jest widoczna');
});

test('sekcja dochodu milczy o dosylce w dniu, w ktorym jej nie ma', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ kotwica: null, sumaD: 90000, zrodlo: 'farma' }],
  });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), 0);
  assert.doesNotMatch(html, /<b>Dosyłka<\/b>/);
  assert.doesNotMatch(html, /Surowce z dosyłki/);
  assert.doesNotMatch(html, /Zapas dosyłek/, 'sekcja zapasu zostala usunieta');
});

test('bilans dla planu bez wtracen pokazuje zera, nie wywraca sie', () => {
  const p = normalizujPlan({ swiat: 'pl231', kroki: [{ budynek: 'tartak', doPoziomu: 1 }] });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.ok(html.length > 0);
});

test('bilans nie zawiera wymaganego dochodu na dobe — to zostalo w eksporcie tekstowym', () => {
  const kroki = [];
  for (let i = 1; i <= 10; i++) kroki.push({ budynek: 'tartak', doPoziomu: i });
  const p = normalizujPlan({ swiat: 'pl231', kroki });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), null);
  assert.doesNotMatch(html, /[Ww]ymagany/);
});

test('bilans dzienny: dosylka pokrywa deficyt i przechodzi na kolejne dni', () => {
  const dni = [
    { dzien: 0, bilansSurowy: { drewno: -10000, glina: -10000, zelazo: -10000 }, dosylka: { drewno: 40000, glina: 40000, zelazo: 40000 } },
    { dzien: 1, bilansSurowy: { drewno: -10000, glina: -10000, zelazo: -10000 }, dosylka: null },
    { dzien: 2, bilansSurowy: { drewno: -10000, glina: -10000, zelazo: -10000 }, dosylka: null },
    { dzien: 3, bilansSurowy: { drewno: 0, glina: 0, zelazo: 0 }, dosylka: null },
  ];
  const wynik = przeniesDosylki(dni);
  assert.deepEqual(wynik[0].zapasPo, { drewno: 30000, glina: 30000, zelazo: 30000 });
  assert.deepEqual(wynik[1].zapasPo, { drewno: 20000, glina: 20000, zelazo: 20000 });
  assert.deepEqual(wynik[2].zapasPo, { drewno: 10000, glina: 10000, zelazo: 10000 });
  assert.deepEqual(wynik[3].zapasPo, { drewno: 10000, glina: 10000, zelazo: 10000 });
  for (const d of wynik) assert.equal(d.brakujeSurowca, false, `dzien ${d.dzien}`);
});

test('bilans dzienny: bez dosylki deficyt zostaje deficytem', () => {
  const wynik = przeniesDosylki([
    { dzien: 0, bilansSurowy: { drewno: -5000, glina: 0, zelazo: 0 }, dosylka: null },
  ]);
  assert.equal(wynik[0].brakujeSurowca, true);
  assert.equal(wynik[0].zapasPo.drewno, 0);
  assert.equal(wynik[0].niedobor.drewno, 5000);
});

test('bilans dzienny: dodatni bilans NIE powieksza zapasu z dosylek', () => {
  const wynik = przeniesDosylki([
    { dzien: 0, bilansSurowy: { drewno: 3000, glina: 0, zelazo: 0 }, dosylka: null },
    { dzien: 1, bilansSurowy: { drewno: 2000, glina: 0, zelazo: 0 }, dosylka: null },
  ]);
  assert.equal(wynik[1].zapasPo.drewno, 0, 'nadwyzka produkcji nie tworzy zapasu');
});

test('bilans dzienny: zapas pokrywa deficyt tylko do wysokosci dosylki', () => {
  const wynik = przeniesDosylki([
    { dzien: 0, bilansSurowy: { drewno: -8000, glina: 0, zelazo: 0 }, dosylka: { drewno: 5000, glina: 0, zelazo: 0 } },
  ]);
  assert.equal(wynik[0].uzyte.drewno, 5000, 'zuzyto cala dosylke');
  assert.equal(wynik[0].niedobor.drewno, 3000, 'reszta zostaje niedoborem');
  assert.equal(wynik[0].zapasPo.drewno, 0);
});

test('bilans dzienny planu wiaze dosylke z dniem, w ktorym wypada jej kotwica', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 2 }],
    zastrzyki: [{ kotwica: { budynek: 'tartak', doPoziomu: 1 }, drewno: 5000, glina: 0, zelazo: 0 }],
  });
  const dni = bilansDzienny(p, symuluj(p));
  assert.ok(dni.length > 0, 'sa dni');
  const zDosylka = dni.filter(d => d.dosylka && d.dosylka.drewno === 5000);
  assert.equal(zDosylka.length, 1, 'dosylka trafia dokladnie w jeden dzien');
  // Zapas z dosylki musi byc widoczny takze w kolejnych dniach.
  const i = dni.indexOf(zDosylka[0]);
  if (dni[i + 1]) assert.ok(dni[i + 1].zapasPo.drewno >= 0);
});

test('w sekcji Zuzycie budowa i rekrutacja sumuja sie do wiersza Razem', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [
      { budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 2 },
      { budynek: 'cegielnia', doPoziomu: 1 },
    ],
    rekrutacje: [{ kotwica: null, jednostka: 'pikinier', ilosc: 40 }],
  });
  const w = symuluj(p);
  const html = bilansHTML(s, p, w, zapotrzebowanie(p), 0);
  // Wytnij sama sekcje Zuzycie, zeby nie zlapac wierszy z innych sekcji.
  const sekcja = html.slice(html.indexOf('Zużycie'), html.indexOf('Bilans'));
  const liczby = (etykieta) => {
    const m = sekcja.match(new RegExp('<b>' + etykieta + '</b>([^]*?)</div>'));
    assert.ok(m, `wiersz "${etykieta}" istnieje`);
    // Liczba stoi tuz przed </span> kazdej komorki .sur.
    return (m[1].match(/([\d\u00a0\s]+)<\/span>/g) || [])
      .map(x => Number(x.replace(/[^\d]/g, '')));
  };
  const budowa = liczby('Budowa');
  const rekrutacja = liczby('Rekrutacja');
  const razem = liczby('Razem');
  assert.equal(budowa.length, 3, 'trzy surowce w wierszu Budowa');
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(budowa[i] + rekrutacja[i] - razem[i]) <= 1,
      `pozycja ${i}: ${budowa[i]} + ${rekrutacja[i]} != ${razem[i]}`);
  }
});

test('sekcja doby liczy dokladnie te dobe, a nie 24h od startu kroku', () => {
  // Krok pod koniec doby 1: okno "24h od startu kroku" siegaloby w dobe 2
  // i doliczyloby rekrutacje, ktora zaczyna sie dopiero wtedy. Panel ma
  // pokazywac dobe kalendarzowa, zgodnie z etykieta "doba: 1".
  const kroki = [];
  for (let p = 1; p <= 30; p++) kroki.push({ budynek: 'tartak', doPoziomu: p });
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki,
    dochody: [{ kotwica: null, sumaD: 300000, zrodlo: 'farma' }],
    rekrutacje: [{ kotwica: { budynek: 'tartak', doPoziomu: 30 }, jednostka: 'pikinier', ilosc: 500 }],
  });
  const w = symuluj(p);
  const os = osBezPrzestojow(p);
  const dni = zapotrzebowanieDzienne(p);
  // Znajdz ostatni krok doby 0.
  let idx = 0;
  for (let i = 0; i < os.length; i++) if (Math.floor(os[i].startS / 86400) === 0) idx = i;
  const html = bilansHTML(s, p, w, zapotrzebowanie(p), idx);
  const sekcja = html.slice(html.indexOf('ZUŻYCIE') >= 0 ? html.indexOf('ZUŻYCIE') : html.indexOf('Zużycie'), html.indexOf('Bilans'));
  const razem = (sekcja.match(new RegExp('<b>Razem</b>([^]*?)</div>'))[1].match(/([\d\u00a0\s]+)<\/span>/g) || [])
    .map(x => Number(x.replace(/[^\d]/g, '')));
  assert.equal(razem[0], Math.round(dni[0].drewno),
    'zuzycie doby 1 musi byc rowne zapotrzebowaniu doby 1');
});

test('dosylka wpadajaca tego samego dnia nie jest liczona dwa razy w sumie dochodu', () => {
  const p = normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'tartak', doPoziomu: 2 }],
    zastrzyki: [{ kotwica: null, drewno: 3000, glina: 3000, zelazo: 2000 }],
  });
  const html = bilansHTML(s, p, symuluj(p), zapotrzebowanie(p), 0);
  const sekcja = html.slice(html.indexOf('Dochód'), html.indexOf('Zużycie'));
  const liczby = (etykieta) => {
    const m = sekcja.match(new RegExp('<b>' + etykieta + '</b>([^]*?)</div>'));
    return (m[1].match(/([\d\u00a0\s]+)<\/span>/g) || []).map(x => Number(x.replace(/[^\d]/g, '')));
  };
  const zDosylki = liczby('Surowce z dosyłki');
  const razem = liczby('Razem');
  // Razem nie moze przekroczyc sumy skladnikow bez podwojonej paczki.
  assert.ok(razem[0] <= zDosylki[0] + 1, `razem ${razem[0]} nie moze podwajac dosylki ${zDosylki[0]}`);
});
