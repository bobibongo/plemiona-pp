// src/wioska/odczyt-ratusza.js
// Odczyt zapisanej strony Ratusza. Sluzy wylacznie kalibracji tabeli G
// i testom — strona symulatora go nie uzywa.

const KODY = {
  main: 'ratusz', barracks: 'koszary', stable: 'stajnia', garage: 'warsztat',
  smith: 'kuznia', snob: 'palac', place: 'plac', statue: 'piedestal',
  market: 'rynek', wood: 'tartak', stone: 'cegielnia', iron: 'huta',
  farm: 'zagroda', storage: 'spichlerz', hide: 'schowek', wall: 'mur',
  watchtower: 'wieza',
};

function sekundy(tekst) {
  const cz = tekst.split(':').map(Number);
  return cz[0] * 3600 + cz[1] * 60 + cz[2];
}

export function poziomRatuszaZeStrony(html) {
  const m = html.match(/Ratusz \(Poziom (\d+)\)/);
  if (!m) throw new Error('Nie znaleziono poziomu Ratusza — czy to na pewno ekran Ratusza?');
  return Number(m[1]);
}

export function kolejkaZeStrony(html) {
  const tabela = html.match(/<table id="build_queue"[\s\S]*?<\/table>/);
  if (!tabela) return [];
  const out = [];
  for (const m of tabela[0].matchAll(/<tr class="[^"]*buildorder_(\w+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const budynek = KODY[m[1]];
    const poziom = m[2].match(/Poziom (\d+)/);
    if (budynek && poziom) out.push({ budynek, poziom: Number(poziom[1]) });
  }
  return out;
}

export function pomiaryZeStrony(html) {
  const poziomRatusza = poziomRatuszaZeStrony(html);
  // Kolejka podnosi poziom docelowy: budynek z dwoma wpisami w kolejce
  // pokazuje w tabeli koszt i czas o dwa poziomy wyzej niz stan obecny.
  const wKolejce = {};
  for (const { budynek } of kolejkaZeStrony(html)) {
    wKolejce[budynek] = (wKolejce[budynek] ?? 0) + 1;
  }
  const tabela = html.match(/<table[^>]*id="buildings"[^>]*>([\s\S]*?)<\/table>/);
  if (!tabela) throw new Error('Nie znaleziono tabeli budynków');
  const out = [];
  for (const m of tabela[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const wiersz = m[1];
    const kod = wiersz.match(/data-building="(\w+)"/);
    const czas = wiersz.match(/icon header time"><\/span>([\d:]+)/);
    if (!kod || !czas) continue;              // naglowek albo budynek w pelni rozbudowany
    const budynek = KODY[kod[1]];
    if (!budynek) continue;
    const obecny = wiersz.match(/Poziom (\d+)/);
    const poziomObecny = obecny ? Number(obecny[1]) : 0;
    out.push({
      budynek,
      poziom: poziomObecny + (wKolejce[budynek] ?? 0) + 1,
      sekundy: sekundy(czas[1]),
      poziomRatusza,
    });
  }
  return out;
}
