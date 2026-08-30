// src/wioska/nazwy.js
// Nazwy widoczne dla gracza — wspolne dla komunikatow silnika i interfejsu,
// zeby nie rozjechaly sie miedzy jednym a drugim.

export const NAZWY = {
  ratusz: 'Ratusz', koszary: 'Koszary', stajnia: 'Stajnia', warsztat: 'Warsztat',
  kuznia: 'Kuźnia', palac: 'Pałac', plac: 'Plac', piedestal: 'Piedestał',
  rynek: 'Rynek', tartak: 'Tartak', cegielnia: 'Cegielnia', huta: 'Huta żelaza',
  zagroda: 'Zagroda', spichlerz: 'Spichlerz', schowek: 'Schowek', mur: 'Mur obronny',
  wieza: 'Wieża strażnicza', kosciol: 'Kościół',
};

// Formy uzywane wylacznie po przyimku "na", stad biernik.
export const NAZWY_SUROWCOW = { drewno: 'drewno', glina: 'glinę', zelazo: 'żelazo' };

export const NAZWY_JEDNOSTEK = {
  pikinier: 'Pikinier', miecznik: 'Miecznik', topornik: 'Topornik', lucznik: 'Łucznik',
  zwiadowca: 'Zwiadowca', lekka: 'Lekka kawaleria', lucznikNaKoniu: 'Łucznik na koniu',
  ciezka: 'Ciężka kawaleria', taran: 'Taran', katapulta: 'Katapulta',
};

// Skroty do ciasnych miejsc (pasek wojska): ikona bywa nieczytelna w 20 px,
// wiec obok niej stoi skrot uzywany w grze przez graczy.
export const SKROTY_JEDNOSTEK = {
  pikinier: 'PIK', miecznik: 'MIECZ', topornik: 'TOP', lucznik: 'ŁUK',
  zwiadowca: 'ZWIAD', lekka: 'LK', lucznikNaKoniu: 'LŁ',
  ciezka: 'CK', taran: 'TAR', katapulta: 'KAT',
};
