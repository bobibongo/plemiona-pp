import { pathToFileURL } from 'node:url';
const R = 'c:/PRO/plemiona/src/wioska/';
const { normalizujPlan, bledyPlanu } = await import(pathToFileURL(R+'plan.js'));
const { symuluj } = await import(pathToFileURL(R+'symulacja.js'));
const { zapotrzebowanie, zapotrzebowanieDzienne, osRekrutacjiBezPrzestojow, ostrzezeniaRekrutacji } = await import(pathToFileURL(R+'zapotrzebowanie.js'));
const { czasCzytelny } = await import(pathToFileURL(R+'format.js'));

const lvl = { ratusz:1, zagroda:1, spichlerz:1 };
const kroki = [];
function doPoz(budynek, cel) {
  const cur = lvl[budynek] ?? 0;
  for (let p = cur+1; p <= cel; p++) { kroki.push({ budynek, doPoziomu: p }); }
  if (cel > (lvl[budynek] ?? 0)) lvl[budynek] = cel;
}
function przeplot(pary) {
  let ruch = true;
  while (ruch) { ruch = false;
    for (const [b, cel] of pary) if ((lvl[b] ?? 0) < cel) { doPoz(b, (lvl[b]??0)+1); ruch = true; }
  }
}
const znacznik = () => kroki.length ? { budynek: kroki[kroki.length-1].budynek, doPoziomu: kroki[kroki.length-1].doPoziomu } : null;

// ---------- FAZA 0: fundament (EKO + zagroda/spichlerz + ratusz pod koszary) ----------
przeplot([['tartak',5],['cegielnia',5],['huta',3]]);
doPoz('ratusz',3);
doPoz('spichlerz',4);
doPoz('zagroda',3);
przeplot([['tartak',10],['cegielnia',10],['huta',6]]);
doPoz('spichlerz',7);
doPoz('zagroda',5);

// ---------- FAZA 1: koszary + stajnia (wymaga ratusz10, koszary5, kuznia5) ----------
const KOTWICA_DOSYLKA_1 = znacznik();
doPoz('koszary',3);
doPoz('ratusz',5);
doPoz('spichlerz',9);
przeplot([['tartak',13],['cegielnia',13],['huta',9]]);
const KOTWICA_DOSYLKA_2 = znacznik();
doPoz('koszary',5);
doPoz('kuznia',5);
doPoz('ratusz',10);
doPoz('zagroda',8);
doPoz('spichlerz',12);
doPoz('stajnia',3);
doPoz('zagroda',12);
const KOTWICA_ZBIERAK_START = znacznik();   // tu ruszamy rekrutacje pikinierow

// ---------- FAZA 2: 550 pik + 70 zwiadu; tartak wyprzedza (pik = 50 drewna) ----------
przeplot([['tartak',17],['cegielnia',17],['huta',13]]);
doPoz('spichlerz',15);
const KOTWICA_ZBIERAK_PELNY = znacznik();   // po 550 pik zbieractwo na 45k/d

// ---------- FAZA 3: Ratusz 20, Spichlerz 30, Rynek 21 (naprzemiennie) ----------
doPoz('rynek',5);
przeplot([['ratusz',15],['spichlerz',18]]);
przeplot([['rynek',12],['spichlerz',21]]);
const KOTWICA_DOSYLKA_3 = znacznik();
przeplot([['ratusz',20],['spichlerz',24],['rynek',16]]);
przeplot([['tartak',21],['cegielnia',21],['huta',17]]);
przeplot([['spichlerz',27],['rynek',21]]);
doPoz('zagroda',15);

// ---------- FAZA 4: wojskowe pod CK: koszary 18 / stajnia 12 / kuznia 15 ----------
const KOTWICA_DOSYLKA_4 = znacznik();
przeplot([['koszary',12],['kuznia',10]]);
doPoz('warsztat',2);
przeplot([['koszary',18],['stajnia',12],['kuznia',15]]);
doPoz('zagroda',20);
doPoz('spichlerz',30);
const KOTWICA_ARMIA = znacznik();           // start wielkiej rekrutacji

// ---------- FAZA 5-6: wykanczanie + EKO 30 ----------
przeplot([['tartak',25],['cegielnia',25],['huta',21]]);
doPoz('zagroda',25);
przeplot([['koszary',22],['stajnia',16],['kuznia',18]]);
doPoz('warsztat',10);
przeplot([['tartak',30],['cegielnia',30],['huta',26]]);
doPoz('huta',30);
doPoz('zagroda',27);
przeplot([['rynek',25],['koszary',25],['stajnia',20],['kuznia',20]]);
doPoz('warsztat',15);
doPoz('zagroda',30);
doPoz('schowek',10);
doPoz('mur',20);
doPoz('plac',1);
doPoz('piedestal',1);
doPoz('palac',1);

const plan = normalizujPlan({
  swiat: 'pl231',
  start: { poziomy: {}, surowce: { drewno:1000, glina:1000, zelazo:1000 } },
  kroki,
  dochody: [
    { kotwica: KOTWICA_ZBIERAK_START, sumaD: 20000, zrodlo: 'zbieractwo' },
    { kotwica: KOTWICA_ZBIERAK_PELNY, sumaD: 45000, zrodlo: 'zbieractwo' },
    { kotwica: KOTWICA_ARMIA, sumaD: 60000, zrodlo: 'zbieractwo' },
  ],
  zastrzyki: [
    { kotwica: KOTWICA_DOSYLKA_1, drewno: 3000,   glina: 3000,   zelazo: 2000 },
    { kotwica: KOTWICA_DOSYLKA_2, drewno: 5000,   glina: 5000,   zelazo: 3000 },
    { kotwica: KOTWICA_DOSYLKA_3, drewno: 55000,  glina: 55000,  zelazo: 35000 },
    { kotwica: KOTWICA_DOSYLKA_4, drewno: 120000, glina: 120000, zelazo: 60000 },
  ],
  rekrutacje: [
    { kotwica: KOTWICA_ZBIERAK_START, jednostka: 'pikinier', ilosc: 550 },
    { kotwica: KOTWICA_ZBIERAK_START, jednostka: 'zwiadowca', ilosc: 70 },
    { kotwica: KOTWICA_ARMIA, jednostka: 'pikinier', ilosc: 6450 },
    { kotwica: KOTWICA_ARMIA, jednostka: 'lucznik', ilosc: 7000 },
    { kotwica: KOTWICA_ARMIA, jednostka: 'zwiadowca', ilosc: 930 },
    { kotwica: KOTWICA_ARMIA, jednostka: 'ciezka', ilosc: 333 },
    { kotwica: KOTWICA_ARMIA, jednostka: 'katapulta', ilosc: 100 },
  ],
});

const bledy = bledyPlanu(plan);
if (bledy.length) { console.error('BLEDY:'); bledy.forEach(b=>console.error(' ',b)); process.exit(1); }
const wynik = symuluj(plan);
const zap = zapotrzebowanie(plan);
console.log('kroki:', plan.kroki.length);
console.log('czas laczny:', czasCzytelny(wynik.podsumowanie.czasS));
console.log('czas netto :', czasCzytelny(zap.czasNettoS));
console.log('koszt:', wynik.podsumowanie.koszt);
console.log('zmarnowane:', wynik.podsumowanie.zmarnowane);
console.log('ostrzezenia budowy:');
for (const o of wynik.ostrzezenia) console.log('  -', o.typ, '|', o.tekst);
console.log('ostrzezenia rekrutacji:');
for (const o of ostrzezeniaRekrutacji(plan)) console.log('  -', o.tekst);
const os = osRekrutacjiBezPrzestojow(plan);
os.forEach(r=>console.log(`  rekr ${r.ilosc}x ${r.jednostka} start ${czasCzytelny(r.startS)} trwa ${czasCzytelny(r.trwanieS)} (koszary/stajnia lvl ${r.poziomBudynku})`));
globalThis.__plan = plan;
export { plan, wynik, zap };
