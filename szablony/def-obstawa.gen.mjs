import { pathToFileURL } from 'node:url';
const R='c:/PRO/plemiona/src/wioska/';
const { normalizujPlan, bledyPlanu } = await import(pathToFileURL(R+'plan.js'));
const { symuluj } = await import(pathToFileURL(R+'symulacja.js'));
const { zapotrzebowanie, ostrzezeniaRekrutacji, osRekrutacjiBezPrzestojow } = await import(pathToFileURL(R+'zapotrzebowanie.js'));

export function zbuduj({ offsetHuty=2, dosylki=true, pikStart=1300, koszaryStart=10, stajniaStart=6 } = {}) {
  const lvl={ratusz:1,zagroda:1,spichlerz:1}; const kroki=[];
  const doPoz=(b,c)=>{const cur=lvl[b]??0; for(let p=cur+1;p<=c;p++)kroki.push({budynek:b,doPoziomu:p}); if(c>(lvl[b]??0))lvl[b]=c;};
  const przeplot=(pary)=>{let r=true;while(r){r=false;for(const[b,c]of pary)if((lvl[b]??0)<c){doPoz(b,(lvl[b]??0)+1);r=true;}}};
  const zn=()=>kroki.length?{budynek:kroki.at(-1).budynek,doPoziomu:kroki.at(-1).doPoziomu}:null;
  const H=(t)=>Math.max(1,t-offsetHuty);

  // === TYDZIEN 1: minimum pod rekrutacje — koszary i stajnia jak najszybciej ===
  // EKO tylko tyle, zeby uciagnac budowe; reszta czeka do tygodnia 2.
  przeplot([['tartak',5],['cegielnia',5],['huta',H(5)]]);
  doPoz('ratusz',3);
  doPoz('spichlerz',5);
  doPoz('zagroda',4);
  przeplot([['tartak',8],['cegielnia',8],['huta',H(8)]]);
  doPoz('koszary',5);           // koszary od razu — one sa waskim gardlem
  doPoz('spichlerz',8);
  doPoz('ratusz',5);
  doPoz('kuznia',5);            // wymog stajni
  doPoz('ratusz',10);           // wymog stajni
  doPoz('koszary',koszaryStart);
  doPoz('zagroda',9);
  doPoz('stajnia',stajniaStart);
  doPoz('zagroda',12);
  const D1=zn();
  const KZBIERAK=zn();          // >>> start 1300 pik + 70 zwiad

  // === TYDZIEN 2: ratusz / spichlerz / rynek ===
  doPoz('plac',1); doPoz('piedestal',1);
  doPoz('rynek',3);
  const KZB_SREDNI=zn();        // ~500 pik juz zbiera
  przeplot([['tartak',12],['cegielnia',12],['huta',H(12)]]);
  doPoz('spichlerz',12);
  const D2=zn();
  przeplot([['ratusz',15],['spichlerz',16],['rynek',8]]);
  const KPELNY=zn();            // zbierak na pelnych obrotach
  przeplot([['ratusz',20],['spichlerz',20],['rynek',13]]);
  const D3=zn();
  przeplot([['tartak',16],['cegielnia',16],['huta',H(16)]]);
  przeplot([['spichlerz',25],['rynek',18]]);
  doPoz('zagroda',16);
  przeplot([['spichlerz',30],['rynek',22]]);
  const D4=zn();

  // === modul wojskowy do celu ===
  przeplot([['koszary',15],['kuznia',10]]);
  doPoz('warsztat',6);
  przeplot([['koszary',18],['stajnia',12],['kuznia',15]]);
  doPoz('zagroda',21);
  const KARMIA=zn();

  // === ekonomia + dokanczanie ===
  przeplot([['tartak',20],['cegielnia',20],['huta',H(20)]]);
  doPoz('zagroda',24);
  przeplot([['tartak',24],['cegielnia',24],['huta',H(24)]]);
  doPoz('zagroda',26); doPoz('schowek',5);
  przeplot([['tartak',27],['cegielnia',27],['huta',H(27)]]);
  doPoz('zagroda',28); doPoz('mur',10);
  przeplot([['tartak',30],['cegielnia',30],['huta',26]]);
  doPoz('huta',30); doPoz('zagroda',30);
  przeplot([['koszary',25],['stajnia',20],['kuznia',20]]);
  doPoz('warsztat',15); doPoz('rynek',25);
  doPoz('schowek',10); doPoz('mur',20); doPoz('palac',1);

  const ARMIA=[
    ['pikinier',Math.max(0,6476-pikStart)], ['miecznik',4444], ['lucznik',2222],
    ['zwiadowca',1041], ['lekka',390], ['ciezka',333], ['taran',10], ['katapulta',150],
  ];
  const plan=normalizujPlan({
    swiat:'pl231', start:{poziomy:{},surowce:{drewno:1000,glina:1000,zelazo:1000}}, kroki,
    dochody:[
      {kotwica:KZBIERAK,sumaD:12000,zrodlo:'zbieractwo'},
      {kotwica:KZB_SREDNI,sumaD:30000,zrodlo:'zbieractwo'},
      {kotwica:KPELNY,sumaD:60000,zrodlo:'zbieractwo'},
      {kotwica:KARMIA,sumaD:60000,zrodlo:'zbieractwo'},
    ],
    zastrzyki: dosylki?[
      {kotwica:D1,drewno:6000,glina:5000,zelazo:3000},
      {kotwica:D2,drewno:12000,glina:10000,zelazo:6000},
      {kotwica:D3,drewno:60000,glina:60000,zelazo:40000},
      {kotwica:D4,drewno:150000,glina:150000,zelazo:100000},
    ]:[],
    rekrutacje:[
      {kotwica:KZBIERAK,jednostka:'pikinier',ilosc:pikStart},
      {kotwica:KZBIERAK,jednostka:'zwiadowca',ilosc:70},
      ...ARMIA.filter(([,n])=>n>0).map(([j,n])=>({kotwica:KARMIA,jednostka:j,ilosc:n})),
    ],
  });
  const b=bledyPlanu(plan); if(b.length) return {blad:b};
  const w=symuluj(plan);
  return {plan,w,zap:zapotrzebowanie(plan),ostrzR:ostrzezeniaRekrutacji(plan),rek:osRekrutacjiBezPrzestojow(plan)};
}
