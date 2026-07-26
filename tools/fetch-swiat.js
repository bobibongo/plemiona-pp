// tools/fetch-swiat.js
// Generuje wpis w src/wioska/swiaty.js dla wskazanego swiata.
// Uzycie: node tools/fetch-swiat.js pl231
// Endpointy interface.php sa publiczne — nie wymagaja logowania.

const MAPA = {
  main: 'ratusz', barracks: 'koszary', stable: 'stajnia', garage: 'warsztat',
  smith: 'kuznia', snob: 'palac', place: 'plac', statue: 'piedestal',
  market: 'rynek', wood: 'tartak', stone: 'cegielnia', iron: 'huta',
  farm: 'zagroda', storage: 'spichlerz', hide: 'schowek', wall: 'mur',
  watchtower: 'wieza', church: 'kosciol', church_f: 'pierwszy_kosciol',
};

// Prosty odczyt XML — endpointy zwracaja plaskie drzewo dwoch poziomow,
// wiec nie ma po co ciagnac parsera.
function pole(xml, nazwa) {
  const m = xml.match(new RegExp(`<${nazwa}>([^<]*)</${nazwa}>`));
  return m ? m[1] : null;
}

function sekcje(xml) {
  const out = {};
  for (const m of xml.matchAll(/<(\w+)>\s*(<(?:max_level|min_level)[\s\S]*?)<\/\1>/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

async function pobierz(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.text();
}

const kod = process.argv[2];
if (!kod) {
  console.error('Użycie: node tools/fetch-swiat.js pl231');
  process.exit(1);
}

const baza = `https://${kod}.plemiona.pl/interface.php`;
const config = await pobierz(`${baza}?func=get_config`);
const budynkiXml = await pobierz(`${baza}?func=get_building_info`);

const budynki = {};
for (const [kodEn, xml] of Object.entries(sekcje(budynkiXml))) {
  const nazwa = MAPA[kodEn];
  if (!nazwa) { console.error(`Pomijam nieznany budynek: ${kodEn}`); continue; }
  budynki[nazwa] = {
    kod: kodEn,
    maks: Number(pole(xml, 'max_level')),
    min: Number(pole(xml, 'min_level')),
    drewno: Number(pole(xml, 'wood')),
    glina: Number(pole(xml, 'stone')),
    zelazo: Number(pole(xml, 'iron')),
    pop: Number(pole(xml, 'pop')),
    fDrewno: Number(pole(xml, 'wood_factor')),
    fGlina: Number(pole(xml, 'stone_factor')),
    fZelazo: Number(pole(xml, 'iron_factor')),
    fPop: Number(pole(xml, 'pop_factor')),
    czas: Number(pole(xml, 'build_time')),
  };
}

const wpis = {
  kod,
  nazwa: `Świat ${kod.replace(/\D/g, '')}`,
  predkosc: Number(pole(config, 'speed')),
  predkoscJednostek: Number(pole(config, 'unit_speed')),
  produkcjaBazowa: Number(pole(config, 'base_production')),
  wzorCzasu: Number(pole(config, 'buildtime_formula')),
  budynki,
};

console.log(`  ${kod}: ${JSON.stringify(wpis, null, 2).replace(/\n/g, '\n  ')},`);
console.error(`\nWklej powyższy blok do SWIATY w src/wioska/swiaty.js (${Object.keys(budynki).length} budynków).`);
