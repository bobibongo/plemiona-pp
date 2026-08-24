// src/scav-logika.js
//
// Czysta logika zbieractwa: stale, walidacja, parsowanie parametrow swiata,
// liczenie czasow i przechowywanie sekwencji krokow. Zaden kod w tym pliku nie
// dotyka DOM ani niczego nie klika — dzieki temu moga go bezpiecznie
// importowac zarowno panel automatyczny (scav.js), jak i wersja legal
// (scav_legal.js), bez wciagania warstwy UI tego drugiego.

export const POZIOMY = [4, 3, 2, 1];

export const JEDNOSTKI_OK = ['spear', 'sword', 'axe', 'archer', 'light', 'marcher', 'heavy', 'knight'];

export const NOSNOSC_JEDNOSTKI = {
  spear: 25,
  sword: 15,
  axe: 10,
  archer: 10,
  light: 80,
  marcher: 50,
  heavy: 50,
  knight: 100,
};

export function walidujKrok(krok) {
  const bledy = [];
  if (!JEDNOSTKI_OK.includes(krok.jednostka)) bledy.push('Nieznany typ jednostki: ' + krok.jednostka);
  if (!POZIOMY.includes(Number(krok.poziom))) bledy.push('Nieznany poziom: ' + krok.poziom);
  const liczba = Number(krok.liczba);
  if (!Number.isFinite(liczba) || liczba <= 0) bledy.push('Liczba jednostek musi być większa od zera.');
  return bledy;
}

export function walidujKroki(kroki) {
  if (!kroki.length) return ['Dodaj co najmniej jeden krok.'];
  const bledy = [];
  for (const krok of kroki) bledy.push(...walidujKrok(krok));
  return bledy;
}

export function sparsujParametrySwiata(tekstSkryptu) {
  const dopasowanie = tekstSkryptu.match(/\{"1":\{[\s\S]*?"premium_boost":\{[^}]*\}\}\}/);
  if (!dopasowanie) return null;
  const dane = JSON.parse(dopasowanie[0]);
  const wynik = {};
  for (const poziom of POZIOMY) {
    const opcja = dane[String(poziom)];
    if (!opcja) continue;
    wynik[poziom] = {
      lootFactor: opcja.loot_factor,
      durationExponent: opcja.duration_exponent,
      durationInitialSeconds: opcja.duration_initial_seconds,
      durationFactor: opcja.duration_factor,
    };
  }
  return wynik;
}

export function czasZbieractwaSekundy(carry, parametryPoziomu) {
  const { lootFactor, durationExponent, durationInitialSeconds, durationFactor } = parametryPoziomu;
  const x = 100 * lootFactor * lootFactor * carry * carry;
  return (Math.pow(x, durationExponent) + durationInitialSeconds) * durationFactor;
}

export function czasKrokuSekundy(krok, parametrySwiata) {
  const parametryPoziomu = parametrySwiata && parametrySwiata[krok.poziom];
  if (!parametryPoziomu) return null;
  const carry = NOSNOSC_JEDNOSTKI[krok.jednostka] * Number(krok.liczba);
  return czasZbieractwaSekundy(carry, parametryPoziomu);
}

export function formatCzas(sekundy) {
  if (sekundy == null || !Number.isFinite(sekundy)) return '—';
  const calkowite = Math.round(sekundy);
  const godziny = Math.floor(calkowite / 3600);
  const minuty = Math.floor((calkowite % 3600) / 60);
  const sek = calkowite % 60;
  const pad = n => String(n).padStart(2, '0');
  if (godziny > 0) return godziny + ':' + pad(minuty) + ':' + pad(sek);
  return minuty + ':' + pad(sek);
}

export function losowyOdstep(bazaMs, losowoscMs) {
  return bazaMs + Math.random() * losowoscMs;
}

export const DOMYSLNE_KROKI = [
  { jednostka: 'light', poziom: 4, liczba: 30 },
  { jednostka: 'light', poziom: 3, liczba: 45 },
  { jednostka: 'light', poziom: 2, liczba: 90 },
  { jednostka: 'light', poziom: 1, liczba: 225 },
];

const KLUCZ_LOCALSTORAGE = 'scavCustomKroki';

export function wczytajZapisaneKroki(storage) {
  const surowe = storage.getItem(KLUCZ_LOCALSTORAGE);
  if (!surowe) return DOMYSLNE_KROKI.slice();
  try {
    const kroki = JSON.parse(surowe);
    if (Array.isArray(kroki) && kroki.length) return kroki;
  } catch (e) { /* ignorujemy błąd parsowania, wracamy do domyślnych */ }
  return DOMYSLNE_KROKI.slice();
}

export function zapiszKroki(storage, kroki) {
  storage.setItem(KLUCZ_LOCALSTORAGE, JSON.stringify(kroki));
}
