import { pathToFileURL } from 'node:url';
const R='c:/PRO/plemiona/src/wioska/';
const { normalizujPlan, bledyPlanu } = await import(pathToFileURL(R+'plan.js'));
const { symuluj } = await import(pathToFileURL(R+'symulacja.js'));
const { zapotrzebowanie, ostrzezeniaRekrutacji, osRekrutacjiBezPrzestojow } = await import(pathToFileURL(R+'zapotrzebowanie.js'));

// Szablon w pelni samowystarczalny: zero dosylek. Wioska finansuje sie
// wlasnym EKO + zbieractwem, wiec EKO ma bezwzgledny priorytet, a rekrutacja
// startuje wczesnie i w malych porcjach, zeby nie zaglodzic budowy.
export function zbuduj({ offsetHuty=2, pikStart=1300, armia=null, ekoAgresywne=true } = {}) {
  const lvl={ratusz:1,zagroda:1,spichlerz:1}; const kroki=[];
  const doPoz=(b,c)=>{const cur=lvl[b]??0; for(let p=cur+1;p<=c;p++)kroki.push({budynek:b,doPoziomu:p}); if(c>(lvl[b]??0))lvl[b]=c;};
  const przeplot=(pary)=>{let r=true;while(r){r=false;for(const[b,c]of pary)if((lvl[b]??0)<c){doPoz(b,(lvl[b]??0)+1);r=true;}}};
  const zn=()=>kroki.length?{budynek:kroki.at(-1).budynek,doPoziomu:kroki.at(-1).doPoziomu}:null;
  const H=(t)=>Math.max(1,t-offsetHuty);

  // === FAZA 1: EKO przede wszystkim + minimum pod zbieraka ===
  // Bez dosylek kazdy poziom kopalni zwraca sie szybciej niz cokolwiek innego,
  // wiec EKO idzie wyzej niz w wariancie z dosylkami, zanim ruszy rekrutacja.
  przeplot([['tartak',6],['cegielnia',6],['huta',H(6)]]);
  doPoz('ratusz',3); doPoz('spichlerz',6); doPoz('zagroda',4);
  przeplot([['tartak',10],['cegielnia',10],['huta',H(10)]]);
  doPoz('spichlerz',9);
  doPoz('koszary',5);
  doPoz('zagroda',8);
  przeplot([['tartak',13],['cegielnia',13],['huta',H(13)]]);
  doPoz('spichlerz',12);
  doPoz('koszary',10);
  doPoz('zagroda',12);
  const KZB1=zn();              // >>> start pikow na zbieraka

  // === FAZA 2: spichlerz / ratusz / rynek, EKO w tle ===
  doPoz('plac',1); doPoz('piedestal',1);
  doPoz('ratusz',5);
  przeplot([['tartak',16],['cegielnia',16],['huta',H(16)]]);
  doPoz('rynek',3);
  const KZB2=zn();              // zbierak sredni
  doPoz('ratusz',10);
  doPoz('kuznia',5);
  doPoz('stajnia',6);
  przeplot([['ratusz',15],['spichlerz',17],['rynek',9]]);
  const KZB3=zn();              // zbierak pelny
  przeplot([['tartak',20],['cegielnia',20],['huta',H(20)]]);
  przeplot([['ratusz',20],['spichlerz',22],['rynek',15]]);
  przeplot([['spichlerz',26],['rynek',19]]);
  doPoz('zagroda',16);
  przeplot([['spichlerz',30],['rynek',22]]);

  // === FAZA 3: modul wojskowy (kuznia 15 = ostatnia technologia) ===
  przeplot([['koszary',14],['kuznia',10]]);
  doPoz('warsztat',6);
  przeplot([['koszary',18],['stajnia',12],['kuznia',15]]);
  doPoz('zagroda',20);
  const KARMIA=zn();            // >>> start armii docelowej

  // === FAZA 4: EKO do konca + dokanczanie ===
  przeplot([['tartak',24],['cegielnia',24],['huta',H(24)]]);
  doPoz('zagroda',23); doPoz('schowek',5);
  przeplot([['tartak',27],['cegielnia',27],['huta',H(27)]]);
  doPoz('zagroda',25); doPoz('mur',10);
  przeplot([['tartak',30],['cegielnia',30],['huta',26]]);
  doPoz('huta',30);
  doPoz('zagroda',28);
  przeplot([['koszary',25],['stajnia',20],['kuznia',20]]);
  doPoz('warsztat',15); doPoz('rynek',25);
  doPoz('zagroda',30); doPoz('schowek',10); doPoz('mur',20);
  doPoz('palac',1);

  const A = armia ?? { pikinier:3000, miecznik:2500, lucznik:1500, zwiadowca:500, ciezka:100 };
  const doArmii = { ...A };
  doArmii.pikinier = Math.max(0, (A.pikinier ?? 0) - pikStart);

  const plan=normalizujPlan({
    swiat:'pl231', start:{poziomy:{},surowce:{drewno:1000,glina:1000,zelazo:1000}}, kroki,
    dochody:[
      {kotwica:KZB1,sumaD:12000,zrodlo:'zbieractwo'},
      {kotwica:KZB2,sumaD:30000,zrodlo:'zbieractwo'},
      {kotwica:KZB3,sumaD:60000,zrodlo:'zbieractwo'},
    ],
    zastrzyki: [],   // pelna samowystarczalnosc
    rekrutacje:[
      {kotwica:KZB1,jednostka:'pikinier',ilosc:pikStart},
      {kotwica:KZB1,jednostka:'zwiadowca',ilosc:70},
      ...Object.entries(doArmii).filter(([j,n])=>n>0 && !(j==='zwiadowca'))
        .map(([j,n])=>({kotwica:KARMIA,jednostka:j,ilosc:n})),
      ...((A.zwiadowca ?? 0) > 70 ? [{kotwica:KARMIA,jednostka:'zwiadowca',ilosc:(A.zwiadowca-70)}] : []),
    ],
  });
  const b=bledyPlanu(plan); if(b.length) return {blad:b};
  const w=symuluj(plan);
  const czek={drewno:0,glina:0,zelazo:0};
  for(const k of w.kroki) if(k.czekanieS>0&&k.czekanieNa) czek[k.czekanieNa]+=k.czekanieS;
  return {plan,w,czek,zap:zapotrzebowanie(plan),ostrzR:ostrzezeniaRekrutacji(plan),rek:osRekrutacjiBezPrzestojow(plan)};
}
