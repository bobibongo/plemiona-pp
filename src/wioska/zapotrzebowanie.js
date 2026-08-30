// src/wioska/zapotrzebowanie.js
// Dwie rodziny liczb odporne na wahania farmienia, obie liczone na osi bez
// przestojow (magazyn i dochod sa ignorowane — to jest tempo, w jakim plan
// CHCIALBY isc, nie przebieg przy konkretnym zaopatrzeniu):
//   - czas netto i wymagany dochod dla calego planu (zapotrzebowanie),
//   - zuzycie w oknie doby od wskazanego momentu (zuzycieNaDobe) — pokazuje
//     zmiane tempa na kolejnych etapach, czego jedna liczba dla calego planu
//     nie widzi.
// Podstawa musi byc harmonogram BEZ przestojow: liczony po realnym (z
// symulacji) bilans zawsze wyszedlby zerowy przy braku surowcow, bo wtedy
// plan zuzywa dokladnie tyle, ile wplywa — miara mierzylaby sama siebie.

import { swiat } from './swiaty.js';
import { kosztPoziomu, ludnoscPoziomu, budynkiSwiata } from './swiat.js';
import { produkcjaGodzinowa, maksLudnosc } from './tabele.js';
import { czasBudowy } from './czas.js';
import { kosztJednostki, populacjaJednostki, budynekJednostki, czasRekrutacji } from './jednostki.js';
import { NAZWY_JEDNOSTEK } from './nazwy.js';
import { kolejnoscPaczek } from './rekrutacja.js';

const SUROWCE_Z = ['drewno', 'glina', 'zelazo'];
const KOPALNIA_SUROWCA = { drewno: 'tartak', glina: 'cegielnia', zelazo: 'huta' };
const DOBA_S = 86400;

export function osBezPrzestojow(plan) {
  const s = swiat(plan.swiat);
  const poziomy = { ...plan.start.poziomy };
  let czas = 0;
  return plan.kroki.map(krok => {
    const koszt = kosztPoziomu(s, krok.budynek, krok.doPoziomu);
    const { sekundy } = czasBudowy(s, krok.budynek, krok.doPoziomu, poziomy.ratusz ?? 1);
    const wiersz = { budynek: krok.budynek, doPoziomu: krok.doPoziomu, startS: czas, trwanieS: sekundy, koszt };
    czas += sekundy;
    poziomy[krok.budynek] = krok.doPoziomu;
    return wiersz;
  });
}

function indeksKotwicyOsi(kotwica, kroki) {
  if (kotwica === null) return -1;
  return kroki.findIndex(k => k.budynek === kotwica.budynek && k.doPoziomu === kotwica.doPoziomu);
}

// Rekrutacja biegnie rownolegle do budowy, wiec nie wchodzi do osBezPrzestojow
// — dostaje wlasna os, zakotwiczona do tych samych krokow budowy co dochod
// i dosylki. Surowce nigdy nie ograniczaja tempa (patrz komentarz w
// symulacja.js o przestojach budowy — tu celowo ich nie ma): rekrutacja ma
// tylko pokazywac zapotrzebowanie w czasie, nie symulowac kolejke z przestojami.
//
// Poziom budynku NIE jest zamrozony na moment kotwicy: dluga partia (7000
// lucznikow to kilkadziesiat dni) przezywa kolejne rozbudowy koszar, a kazda
// z nich skraca czas pozostalych sztuk. Dlatego czas partii liczymy odcinkami
// miedzy kolejnymi ukonczeniami budynku produkujacego dana jednostke.

// Momenty (na osi bez przestojow), w ktorych budynek konczy kolejny poziom.
// Zwraca liste { czasS, poziom } posortowana rosnaco po czasie.
function ukonczeniaBudynku(os, budynek, poziomStartowy) {
  const lista = [{ czasS: 0, poziom: poziomStartowy }];
  for (const w of os) {
    if (w.budynek === budynek) lista.push({ czasS: w.startS + w.trwanieS, poziom: w.doPoziomu });
  }
  return lista;
}

// Ile sekund zajmie `ilosc` sztuk, jesli od `startS` budynek rosnie wg `ukonczenia`.
// Kazdy odcinek o stalym poziomie produkuje z wlasnym tempem; ostatni odcinek
// jest otwarty (poziom juz sie nie zmieni).
function trwaniePartii(s, jednostka, ilosc, startS, ukonczenia) {
  let zostalo = ilosc;
  let czas = startS;
  for (let i = 0; i < ukonczenia.length && zostalo > 0; i++) {
    const poziom = ukonczenia[i].poziom;
    // Poziom obowiazuje od max(startS, jego ukonczenia) do nastepnego ukonczenia.
    const odS = Math.max(startS, ukonczenia[i].czasS);
    const nastepne = ukonczenia[i + 1];
    if (odS > czas) czas = odS;
    const czasSztukiS = czasRekrutacji(s, jednostka, poziom);
    if (!nastepne || nastepne.czasS <= odS) {
      // Ostatni odcinek albo poziom natychmiast zastapiony — jesli to koniec
      // listy, dorabiamy reszte w tym tempie.
      if (!nastepne) { czas += zostalo * czasSztukiS; zostalo = 0; break; }
      continue;
    }
    const oknoS = nastepne.czasS - czas;
    if (oknoS <= 0) continue;
    const zmiesci = Math.floor(oknoS / czasSztukiS);
    if (zmiesci >= zostalo) { czas += zostalo * czasSztukiS; zostalo = 0; break; }
    zostalo -= zmiesci;
    czas += zmiesci * czasSztukiS;
  }
  return Math.max(0, czas - startS);
}

// Harmonogram paczek dla calego planu, z podzialem na kolejki budynkow.
// Kazdy budynek (koszary/stajnia/warsztat) ma WLASNA kolejke — trzy kolejki
// biegna rownolegle, ale wewnatrz jednej jednostki ida po kolei, bo wioska
// ma po jednym takim budynku.
//
// Wpisy rekrutacji o tej samej kotwicy skladaja sie w jeden cel; paczki
// wyrownuja proporcje wzgledem tego, co juz stoi w wiosce (patrz
// rekrutacja.js). Poziom budynku aktualizuje sie w trakcie — dluga partia
// przyspiesza wraz z jego rozbudowa.
export function harmonogramPaczek(plan) {
  const s = swiat(plan.swiat);
  const os = osBezPrzestojow(plan);

  // Grupy wpisow wg momentu startu (indeks kotwicy), w kolejnosci osi.
  const grupy = new Map();
  plan.rekrutacje.forEach((r, indeksWpisu) => {
    const i = indeksKotwicyOsi(r.kotwica, plan.kroki);
    const startS = i < 0 ? 0 : (os[i] ? os[i].startS + os[i].trwanieS : 0);
    const klucz = `${i}`;
    const g = grupy.get(klucz) ?? { startS, cel: {}, wpisy: [] };
    g.cel[r.jednostka] = (g.cel[r.jednostka] ?? 0) + r.ilosc;
    g.wpisy.push({ indeksWpisu, jednostka: r.jednostka, ilosc: r.ilosc });
    grupy.set(klucz, g);
  });

  const kolejneUkonczenia = (budynek) => {
    const lista = [{ czasS: 0, poziom: plan.start.poziomy[budynek] ?? 0 }];
    for (const w of os) {
      if (w.budynek === budynek) lista.push({ czasS: w.startS + w.trwanieS, poziom: w.doPoziomu });
    }
    return lista;
  };
  const poziomNaCzas = (ukonczenia, czasS) => {
    let poziom = ukonczenia[0].poziom;
    for (const u of ukonczenia) { if (u.czasS <= czasS) poziom = u.poziom; else break; }
    return poziom;
  };

  const ukonczeniaBudynkow = {};
  for (const b of ['koszary', 'stajnia', 'warsztat']) ukonczeniaBudynkow[b] = kolejneUkonczenia(b);

  // Zegar kazdej kolejki osobno — to daje rownoleglosc budynkow.
  const zegar = { koszary: 0, stajnia: 0, warsztat: 0 };
  const stan = {};
  const wynik = [];

  const posortowane = [...grupy.values()].sort((a, b) => a.startS - b.startS);
  for (const g of posortowane) {
    for (const b of Object.keys(zegar)) zegar[b] = Math.max(zegar[b], g.startS);
    for (const paczka of kolejnoscPaczek(s, g.cel, stan)) {
      const b = paczka.budynek;
      const ukonczenia = ukonczeniaBudynkow[b] ?? [{ czasS: 0, poziom: 0 }];
      const start = zegar[b];
      const poziom = poziomNaCzas(ukonczenia, start);
      const trwanieS = czasRekrutacji(s, paczka.jednostka, poziom) * paczka.sztuk;
      zegar[b] = start + trwanieS;
      stan[paczka.jednostka] = (stan[paczka.jednostka] ?? 0) + paczka.sztuk;
      wynik.push({
        jednostka: paczka.jednostka, sztuk: paczka.sztuk, budynek: b,
        startS: start, koniecS: zegar[b], poziomBudynku: poziom,
      });
    }
  }
  return wynik;
}

// Ile sztuk kazdej jednostki jest gotowych na dany moment.
export function wojskoNaCzas(plan, czasS) {
  const stan = {};
  for (const p of harmonogramPaczek(plan)) {
    if (p.koniecS <= czasS) {
      stan[p.jednostka] = (stan[p.jednostka] ?? 0) + p.sztuk;
    } else if (p.startS < czasS && p.koniecS > p.startS) {
      const udzial = (czasS - p.startS) / (p.koniecS - p.startS);
      stan[p.jednostka] = (stan[p.jednostka] ?? 0) + Math.floor(p.sztuk * udzial);
    }
  }
  return stan;
}

// Widok "jeden wiersz na wpis planu", zlozony z paczek tego wpisu. Zachowuje
// ksztalt uzywany przez reszte kodu (koszty, populacja, ostrzezenia).
export function osRekrutacjiBezPrzestojow(plan) {
  const s = swiat(plan.swiat);
  const paczki = harmonogramPaczek(plan);

  // Paczki nie niosa indeksu wpisu (jeden cel moze pochodzic z kilku wpisow),
  // wiec rozdzielamy je miedzy wpisy tej samej jednostki wg kolejnosci.
  const pozostalo = plan.rekrutacje.map(r => r.ilosc);
  const zebrane = plan.rekrutacje.map(() => ({ sztuk: 0, startS: Infinity, koniecS: 0, poziom: 0 }));

  for (const p of paczki) {
    let doRozdania = p.sztuk;
    for (let i = 0; i < plan.rekrutacje.length && doRozdania > 0; i++) {
      if (plan.rekrutacje[i].jednostka !== p.jednostka || pozostalo[i] <= 0) continue;
      const ile = Math.min(pozostalo[i], doRozdania);
      pozostalo[i] -= ile;
      doRozdania -= ile;
      const z = zebrane[i];
      z.sztuk += ile;
      z.startS = Math.min(z.startS, p.startS);
      z.koniecS = Math.max(z.koniecS, p.koniecS);
      z.poziom = z.poziom || p.poziomBudynku;
    }
  }

  return plan.rekrutacje.map((r, i) => {
    const z = zebrane[i];
    const budynek = budynekJednostki(s, r.jednostka);
    const startS = z.startS === Infinity ? 0 : z.startS;
    const koszt = kosztJednostki(s, r.jednostka);
    return {
      jednostka: r.jednostka, ilosc: r.ilosc, budynek,
      poziomBudynku: z.poziom || (plan.start.poziomy[budynek] ?? 0),
      startS, trwanieS: Math.max(0, z.koniecS - startS), koniecS: z.koniecS || startS,
      kosztSztuki: koszt,
      kosztCalkowity: { drewno: koszt.drewno * r.ilosc, glina: koszt.glina * r.ilosc, zelazo: koszt.zelazo * r.ilosc },
      populacjaCalkowita: populacjaJednostki(s, r.jednostka) * r.ilosc,
    };
  });
}

// Czesc kosztu wpisu rekrutacji, ktora przypada w oknie czasu [od, do) —
// zaklada rownomierne (liniowe) tempo produkcji sztuk w trakcie trwania.
function udzialWOknie(wiersz, od, doC) {
  const nakladanie = Math.min(wiersz.koniecS, doC) - Math.max(wiersz.startS, od);
  if (nakladanie <= 0 || wiersz.trwanieS <= 0) return 0;
  return nakladanie / wiersz.trwanieS;
}

// Populacja zajeta przez jednostki juz "gotowe" na dany moment — narastajaco,
// liniowo w trakcie trwania partii, tak samo jak jej koszt. Uzywane w bilansie
// ludnosci obok tej zajetej przez budynki (limit Zagrody dotyczy obu razem).
export function ludnoscRekrutacjiDoCzasu(plan, czasS) {
  const rekrutacje = osRekrutacjiBezPrzestojow(plan);
  return rekrutacje.reduce((suma, r) => {
    if (czasS <= r.startS || r.trwanieS <= 0) return suma;
    const udzial = Math.min(1, (czasS - r.startS) / r.trwanieS);
    return suma + r.populacjaCalkowita * udzial;
  }, 0);
}

export function zapotrzebowanie(plan) {
  const s = swiat(plan.swiat);
  const os = osBezPrzestojow(plan);
  const skumulowany = { drewno: 0, glina: 0, zelazo: 0 };
  const wyprodukowane = { drewno: 0, glina: 0, zelazo: 0 };
  const wymagany = { drewno: 0, glina: 0, zelazo: 0 };
  let waskieGardlo = null;
  let szczyt = 0;
  let brakNaStart = false;
  const poziomy = { ...plan.start.poziomy };

  os.forEach((wiersz, indeks) => {
    for (const r of SUROWCE_Z) skumulowany[r] += wiersz.koszt[r];

    for (const r of SUROWCE_Z) {
      const deficyt = skumulowany[r] - plan.start.surowce[r] - wyprodukowane[r];
      if (deficyt <= 0) continue;
      if (wiersz.startS <= 0) {
        brakNaStart = true;
        continue;
      }
      const naDobe = deficyt / (wiersz.startS / DOBA_S);
      if (naDobe > wymagany[r]) wymagany[r] = naDobe;
      if (naDobe > szczyt) {
        szczyt = naDobe;
        waskieGardlo = { indeks, budynek: wiersz.budynek, doPoziomu: wiersz.doPoziomu, surowiec: r, czasS: Math.round(wiersz.startS) };
      }
    }

    for (const r of SUROWCE_Z) {
      wyprodukowane[r] += produkcjaGodzinowa(s, poziomy[KOPALNIA_SUROWCA[r]] ?? 0) * wiersz.trwanieS / 3600;
    }
    poziomy[wiersz.budynek] = wiersz.doPoziomu;
  });

  const czasNettoS = os.length ? os[os.length - 1].startS + os[os.length - 1].trwanieS : 0;

  return {
    czasNettoS: Math.round(czasNettoS),
    wymaganyDobowo: {
      drewno: Math.ceil(wymagany.drewno),
      glina: Math.ceil(wymagany.glina),
      zelazo: Math.ceil(wymagany.zelazo),
    },
    waskieGardlo,
    brakNaStart,
  };
}

export function zuzycieNaDobe(plan, indeksKrokuLubNull) {
  const os = osBezPrzestojow(plan);
  const rekrutacje = osRekrutacjiBezPrzestojow(plan);
  const suma = { drewno: 0, glina: 0, zelazo: 0 };
  if (os.length === 0 && rekrutacje.length === 0) return { suma, doKonca: true };

  const koniecBudowyS = os.length ? os[os.length - 1].startS + os[os.length - 1].trwanieS : 0;
  const koniecRekrutacjiS = rekrutacje.reduce((maks, r) => Math.max(maks, r.koniecS), 0);
  const koniecOsi = Math.max(koniecBudowyS, koniecRekrutacjiS);

  if (indeksKrokuLubNull !== null && !os[indeksKrokuLubNull]) return { suma, doKonca: true };
  // Przy null odnosimy sie do startu ostatniego kroku budowy (tak jak wczesniej,
  // bez rekrutacji) — gdy planu budowy nie ma wcale, jedynym punktem
  // odniesienia jest poczatek osi.
  const T = indeksKrokuLubNull === null
    ? (os.length ? os[os.length - 1].startS : 0)
    : os[indeksKrokuLubNull].startS;

  const doKonca = T + DOBA_S >= koniecOsi;
  const gorna = doKonca ? koniecOsi : T + DOBA_S;

  for (const w of os) {
    if (w.startS >= T && w.startS < gorna) {
      for (const r of SUROWCE_Z) suma[r] += w.koszt[r];
    }
  }
  for (const r of rekrutacje) {
    const udzial = udzialWOknie(r, T, gorna);
    if (udzial <= 0) continue;
    for (const su of SUROWCE_Z) suma[su] += r.kosztCalkowity[su] * udzial;
  }
  return { suma, doKonca };
}

export function zapotrzebowanieDzienne(plan) {
  const os = osBezPrzestojow(plan);
  const rekrutacje = osRekrutacjiBezPrzestojow(plan);
  if (os.length === 0 && rekrutacje.length === 0) return [];

  const koniecBudowyS = os.length ? os[os.length - 1].startS + os[os.length - 1].trwanieS : 0;
  const koniecRekrutacjiS = rekrutacje.reduce((maks, r) => Math.max(maks, r.koniecS), 0);
  const czasNettoS = Math.max(koniecBudowyS, koniecRekrutacjiS);
  const liczbaDni = Math.max(1, Math.ceil(czasNettoS / DOBA_S));

  const dni = [];
  for (let i = 0; i < liczbaDni; i++) {
    dni.push({ dzien: i, drewno: 0, glina: 0, zelazo: 0, liczbaKrokow: 0, rekrutacje: [] });
  }

  for (const wiersz of os) {
    const indeksDnia = Math.floor(wiersz.startS / DOBA_S);
    const cel = dni[indeksDnia];
    cel.liczbaKrokow += 1;
    for (const r of SUROWCE_Z) cel[r] += wiersz.koszt[r];
  }

  // Rekrutacja moze rozciagac sie na wiele dni naraz — kazdy dzien dostaje
  // proporcjonalny wycinek jej kosztu wg czasu, ktory w nim faktycznie splynal.
  rekrutacje.forEach((r, idx) => {
    const pierwszyDzien = Math.max(0, Math.floor(r.startS / DOBA_S));
    const ostatniDzien = Math.min(dni.length - 1, Math.floor(Math.max(r.startS, r.koniecS - 1) / DOBA_S));
    for (let d = pierwszyDzien; d <= ostatniDzien; d++) {
      const udzial = udzialWOknie(r, d * DOBA_S, (d + 1) * DOBA_S);
      if (udzial <= 0) continue;
      const cel = dni[d];
      for (const su of SUROWCE_Z) cel[su] += r.kosztCalkowity[su] * udzial;
      cel.rekrutacje.push({ indeks: idx, jednostka: r.jednostka, sztuk: Math.round(r.ilosc * udzial) });
    }
  });

  return dni;
}

// Koszty poniesione do konca wskazanego kroku, rozbite na budowe i rekrutacje.
// Budowa liczy sie po krokach (koszt jest punktowy, w momencie startu kroku),
// rekrutacja — liniowo po czasie, tym samym modelem co zuzycieNaDobe.
// indeksKroku === null oznacza koniec calego planu.
export function kosztyDoMomentu(plan, indeksKroku) {
  const os = osBezPrzestojow(plan);
  const rekrutacje = osRekrutacjiBezPrzestojow(plan);
  const budowa = { drewno: 0, glina: 0, zelazo: 0 };
  const rekrutacja = { drewno: 0, glina: 0, zelazo: 0 };

  const doIndeksu = indeksKroku === null ? os.length - 1 : indeksKroku;
  for (let i = 0; i <= doIndeksu && i < os.length; i++) {
    for (const r of SUROWCE_Z) budowa[r] += os[i].koszt[r];
  }

  const koniecBudowyS = os.length ? os.at(-1).startS + os.at(-1).trwanieS : 0;
  const koniecRekrutacjiS = rekrutacje.reduce((maks, r) => Math.max(maks, r.koniecS), 0);
  const doCzasuS = indeksKroku === null || !os[indeksKroku]
    ? Math.max(koniecBudowyS, koniecRekrutacjiS)
    : os[indeksKroku].startS + os[indeksKroku].trwanieS;

  for (const r of rekrutacje) {
    if (r.trwanieS <= 0 || doCzasuS <= r.startS) continue;
    const udzial = Math.min(1, (doCzasuS - r.startS) / r.trwanieS);
    for (const su of SUROWCE_Z) rekrutacja[su] += r.kosztCalkowity[su] * udzial;
  }

  const razem = {};
  for (const r of SUROWCE_Z) razem[r] = budowa[r] + rekrutacja[r];
  return { budowa, rekrutacja, razem };
}

// Stan wojska na koniec kazdej doby planu — narastajaco, tym samym liniowym
// modelem tempa, co koszt i populacja rekrutacji. Sluzy paskowi "ile wojska
// mam teraz" pod zapotrzebowaniem dziennym.
export function wojskoNaKoniecDnia(plan) {
  const s = swiat(plan.swiat);
  const os = osBezPrzestojow(plan);
  const rekrutacje = osRekrutacjiBezPrzestojow(plan);

  const koniecBudowyS = os.length ? os.at(-1).startS + os.at(-1).trwanieS : 0;
  const koniecRekrutacjiS = rekrutacje.reduce((maks, r) => Math.max(maks, r.koniecS), 0);
  const czasNettoS = Math.max(koniecBudowyS, koniecRekrutacjiS);
  const liczbaDni = Math.max(1, Math.ceil(czasNettoS / DOBA_S));

  const dni = [];
  for (let i = 0; i < liczbaDni; i++) {
    // Ostatnia doba konczy sie na realnym koncu osi, zeby domknac partie,
    // ktorej ostatnie sztuki wypadaja w srodku doby.
    const doC = Math.min((i + 1) * DOBA_S, czasNettoS);
    const jednostki = {};
    let populacja = 0;
    for (const r of rekrutacje) {
      if (r.trwanieS <= 0 || doC <= r.startS) continue;
      const udzial = Math.min(1, (doC - r.startS) / r.trwanieS);
      const sztuk = Math.floor(r.ilosc * udzial);
      if (sztuk <= 0) continue;
      jednostki[r.jednostka] = (jednostki[r.jednostka] ?? 0) + sztuk;
      populacja += populacjaJednostki(s, r.jednostka) * sztuk;
    }
    dni.push({ dzien: i, jednostki, populacja });
  }
  return dni;
}

// Ludnosc zajeta przez budynki na dany moment osi bez przestojow — poziomy
// najnowszego kroku budowy, ktorego start juz minal.
function poziomyNaCzas(os, poziomyStart, czasS) {
  const poziomy = { ...poziomyStart };
  for (const w of os) {
    if (w.startS > czasS) break;
    poziomy[w.budynek] = w.doPoziomu;
  }
  return poziomy;
}

// Rekrutacja nie ma przestojow (patrz naglowek pliku), wiec jej jedyny
// mozliwy problem z populacja to przekroczenie limitu Zagrody. Populacja
// rosnie monotonicznie, wiec wystarczy sprawdzic szczyt na koncu kazdego
// wpisu rekrutacji — wczesniej w jego trakcie zajete miejsce jest mniejsze.
export function ostrzezeniaRekrutacji(plan) {
  const s = swiat(plan.swiat);
  const os = osBezPrzestojow(plan);
  const rekrutacje = osRekrutacjiBezPrzestojow(plan);
  const budynki = budynkiSwiata(s);
  const ostrzezenia = [];

  rekrutacje.forEach((r, idx) => {
    const poziomy = poziomyNaCzas(os, plan.start.poziomy, r.koniecS);
    const ludnoscBudynkow = budynki.reduce((suma, b) => suma + ludnoscPoziomu(s, b, poziomy[b] ?? 0), 0);
    const ludnoscCalkowita = ludnoscBudynkow + ludnoscRekrutacjiDoCzasu(plan, r.koniecS);
    const limit = maksLudnosc(poziomy.zagroda ?? 1);
    if (ludnoscCalkowita > limit) {
      ostrzezenia.push({
        typ: 'rekrutacja-ponad-zagrode', rekrutacja: idx,
        tekst: `Rekrutacja ${idx + 1}: ${r.ilosc}× ${NAZWY_JEDNOSTEK[r.jednostka] ?? r.jednostka} wymaga `
          + `${Math.round(ludnoscCalkowita)} ludności łącznie, a Zagroda ${poziomy.zagroda ?? 1} daje ${limit}.`,
      });
    }
  });

  return ostrzezenia;
}
