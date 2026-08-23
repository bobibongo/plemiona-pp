// src/wioska/jednostki.js
// Koszt i czas rekrutacji jednostek, wyprowadzone z danych swiata — ten sam
// wzorzec co swiat.js dla budynkow. Rekrutacja przyspiesza z poziomem
// budynku, ktory ja produkuje (inny wzor niz budowa — nie zalezy od Ratusza).

function danejJednostki(s, jednostka) {
  const d = s.jednostki?.[jednostka];
  if (!d) throw new Error(`Jednostka ${jednostka} nie istnieje na świecie ${s.kod}`);
  return d;
}

export function budynekJednostki(s, jednostka) {
  return danejJednostki(s, jednostka).budynek;
}

export function kosztJednostki(s, jednostka) {
  const d = danejJednostki(s, jednostka);
  return { drewno: d.drewno, glina: d.glina, zelazo: d.zelazo };
}

export function populacjaJednostki(s, jednostka) {
  return danejJednostki(s, jednostka).pop;
}

// czas = build_time / (1 + poziom_budynku * 0.05), bez wplywu Ratusza ani
// predkosci swiata jednostek (mnozniki inne niz przy budynkach — patrz
// _share/jednostki.json: "wzor_czas_rekrutacji").
export function czasRekrutacji(s, jednostka, poziomBudynku) {
  const d = danejJednostki(s, jednostka);
  const surowy = d.czas / (1 + (poziomBudynku ?? 0) * 0.05) / s.predkoscJednostek;
  return Math.max(1, Math.round(surowy));
}

export function jednostkiSwiata(s) {
  return Object.keys(s.jednostki ?? {});
}
