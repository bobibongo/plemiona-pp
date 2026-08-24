// src/scav.js
import { panelMotywCSS, usunIstniejacyPanel, wstrzyknijStylPanelu, wlaczPrzeciaganiePanelu } from './panel-theme.js';

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

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  (function () {
    const NAZWY_JEDNOSTEK = {
      spear: 'Pikinier', sword: 'Miecznik', axe: 'Topornik', archer: 'Łucznik',
      light: 'Lekka kaw.', marcher: 'Łucznik konny', heavy: 'Ciężka kaw.', knight: 'Rycerz',
    };

    const STYL_WLASNY = `
    #scavCustomPanel table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    #scavCustomPanel th, #scavCustomPanel td { padding: 5px 4px; text-align: center; font-size: 11px; }
    #scavCustomPanel thead { border-bottom: 1px solid #2a3436; }
    #scavCustomPanel th { background: #1a2224; color: #9fb0b0; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: .08em; }
    #scavCustomPanel tbody tr { background: #0e1416; }
    #scavCustomPanel tbody tr:nth-child(even) { background: #12181a; }
    #scavCustomPanel select { width: 100%; box-sizing: border-box; font-family: inherit;
      background: #0c1113; color: #d8e0e0; border: 1px solid #2a3436; border-radius: 2px; padding: 6px; }
    #scavCustomPanel .czas-kol { color: #3ad6b8; white-space: nowrap; font-weight: 700; }
    #scavCustomPanel .usun { cursor: pointer; color: #f0a294; font-weight: bold; }
    #scavCustomPanel .dodaj-rzad { display: flex; gap: 4px; margin-bottom: 10px; }
    #scavCustomPanel .dodaj-rzad > * { flex: 1; }
    #scavCustomPanel .pm-przyciski button:disabled { opacity: .4; cursor: default; }
    #scavCustomPanel .suma-czas { margin: 2px 0 10px; font-size: 11px; color: #7f9494; }
    `;

    usunIstniejacyPanel('scavCustomPanel');
    wstrzyknijStylPanelu('scavCustomStyle', panelMotywCSS('scavCustomPanel') + STYL_WLASNY);

    function opcjeJednostek(wybrana) {
      return JEDNOSTKI_OK.map(function (j) {
        return '<option value="' + j + '"' + (j === wybrana ? ' selected' : '') + '>' + NAZWY_JEDNOSTEK[j] + '</option>';
      }).join('');
    }

    function opcjePoziomow(wybrany) {
      return POZIOMY.map(function (p) {
        return '<option value="' + p + '"' + (Number(p) === Number(wybrany) ? ' selected' : '') + '>' + p + '</option>';
      }).join('');
    }

    const html = `
    <div id="scavCustomPanel">
      <h3>Zbieractwo — sekwencja <span class="pm-x" id="scavCustomClose">x</span></h3>
      <div class="pm-body">
        <table id="scavCustomTabela">
          <thead><tr><th>Jednostka</th><th>Poz.</th><th>Ilość</th><th>Czas</th><th></th></tr></thead>
          <tbody id="scavCustomTbody"></tbody>
        </table>
        <div class="dodaj-rzad">
          <select id="scavNowaJednostka">${opcjeJednostek('light')}</select>
          <select id="scavNowyPoziom">${opcjePoziomow(4)}</select>
          <input type="number" min="1" id="scavNowaLiczba" value="30">
          <button id="scavCustomDodaj">+ Dodaj</button>
        </div>
        <div class="suma-czas" id="scavCustomSuma"></div>
        <div class="pm-grupa pm-przyciski">
          <button id="scavCustomZapisz">Zapisz domyślne</button>
          <button id="scavCustomStart" class="pm-ok">Start</button>
        </div>
        <div class="pm-status" id="scavCustomStatus"></div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('scavCustomClose').addEventListener('click', function () {
      document.getElementById('scavCustomPanel').remove();
    });

    wlaczPrzeciaganiePanelu('scavCustomPanel', 'scavCustomClose', 'scavCustomPozycja', window.localStorage);

    function znajdzTekstScavengeMassScreen() {
      const skrypty = document.querySelectorAll('script');
      for (const skrypt of skrypty) {
        if (skrypt.textContent && skrypt.textContent.indexOf('ScavengeMassScreen') !== -1) return skrypt.textContent;
      }
      return null;
    }

    let parametrySwiata = null;
    const tekstSkryptu = znajdzTekstScavengeMassScreen();
    if (tekstSkryptu) parametrySwiata = sparsujParametrySwiata(tekstSkryptu);

    let kroki = wczytajZapisaneKroki(window.localStorage);

    function ustawStatus(tekst) {
      document.getElementById('scavCustomStatus').textContent = tekst;
    }

    function sleep(ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function odswiezTabele() {
      const tbody = document.getElementById('scavCustomTbody');
      tbody.innerHTML = kroki.map(function (krok, indeks) {
        const czasS = czasKrokuSekundy(krok, parametrySwiata);
        return '<tr data-indeks="' + indeks + '">'
          + '<td>' + NAZWY_JEDNOSTEK[krok.jednostka] + '</td>'
          + '<td>' + krok.poziom + '</td>'
          + '<td>' + krok.liczba + '</td>'
          + '<td class="czas-kol">' + formatCzas(czasS) + '</td>'
          + '<td class="usun" data-usun="' + indeks + '">✕</td>'
          + '</tr>';
      }).join('');

      tbody.querySelectorAll('[data-usun]').forEach(function (el) {
        el.addEventListener('click', function () {
          const i = Number(el.getAttribute('data-usun'));
          kroki.splice(i, 1);
          odswiezTabele();
        });
      });

      const sumaEl = document.getElementById('scavCustomSuma');
      if (!parametrySwiata) {
        sumaEl.textContent = 'Nie udało się odczytać parametrów świata — czas niedostępny.';
      } else if (!kroki.length) {
        sumaEl.textContent = '';
      } else {
        const czasy = kroki.map(function (k) { return czasKrokuSekundy(k, parametrySwiata) || 0; });
        sumaEl.textContent = 'Najdłuższa grupa wróci po: ' + formatCzas(Math.max.apply(null, czasy));
      }
    }

    document.getElementById('scavCustomDodaj').addEventListener('click', function () {
      const nowyKrok = {
        jednostka: document.getElementById('scavNowaJednostka').value,
        poziom: Number(document.getElementById('scavNowyPoziom').value),
        liczba: Number(document.getElementById('scavNowaLiczba').value),
      };
      const bledy = walidujKrok(nowyKrok);
      if (bledy.length) {
        ustawStatus(bledy.join(' '));
        return;
      }
      kroki.push(nowyKrok);
      odswiezTabele();
    });

    document.getElementById('scavCustomZapisz').addEventListener('click', function () {
      zapiszKroki(window.localStorage, kroki);
      ustawStatus('Zapisano jako domyślną sekwencję (' + kroki.length + ' kroków).');
    });

    function ustawWartoscInputa(input, wartosc) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, String(wartosc));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function zaznaczTylkoKolumne(poziom) {
      const wszystkie = document.querySelectorAll('input.select-all-col[data-option]');
      let zaznaczonoCos = false;
      wszystkie.forEach(function (checkbox) {
        const jegoPoziom = checkbox.getAttribute('data-option');
        const maBycZaznaczony = jegoPoziom === String(poziom);
        if (checkbox.disabled) return;
        if (checkbox.checked !== maBycZaznaczony) checkbox.click();
        if (maBycZaznaczony) zaznaczonoCos = true;
      });
      return zaznaczonoCos;
    }

    function znajdzInputJednostki(jednostka) {
      return document.querySelector('input.unitsInput[name="' + jednostka + '"]');
    }

    function znajdzPrzyciskWyslij() {
      return document.querySelector('a.btn-send');
    }

    function przyciskZablokowany(przycisk) {
      return przycisk.classList.contains('disabled') || przycisk.getAttribute('disabled') !== null;
    }

    const POMINIETO = 'pominieto';
    const WYSLANO = 'wyslano';

    function wyczyscInnePolaJednostek(jednostkaAktywna) {
      const wszystkie = document.querySelectorAll('input.unitsInput');
      wszystkie.forEach(function (pole) {
        if (pole.name === jednostkaAktywna) return;
        if (pole.value !== '' && pole.value !== '0') ustawWartoscInputa(pole, '');
      });
    }

    async function wykonajKrok(krok) {
      const input = znajdzInputJednostki(krok.jednostka);
      if (!input) throw new Error('Nie znaleziono pola jednostki ' + krok.jednostka);
      wyczyscInnePolaJednostek(krok.jednostka);
      ustawWartoscInputa(input, krok.liczba);
      const kolumnaDostepna = zaznaczTylkoKolumne(krok.poziom);
      if (!kolumnaDostepna) return POMINIETO;
      await sleep(losowyOdstep(150, 250));
      const przycisk = znajdzPrzyciskWyslij();
      if (!przycisk) throw new Error('Nie znaleziono przycisku Wyślij');
      if (przyciskZablokowany(przycisk)) return POMINIETO;
      przycisk.click();
      return WYSLANO;
    }

    async function uruchomSekwencje() {
      const przyciskStart = document.getElementById('scavCustomStart');
      przyciskStart.disabled = true;
      let wyslanych = 0;
      let pominietych = 0;
      for (let i = 0; i < kroki.length; i++) {
        const krok = kroki[i];
        ustawStatus('Wysyłam poziom ' + krok.poziom + ' (' + NAZWY_JEDNOSTEK[krok.jednostka] + ' x' + krok.liczba + ')…');
        let wynik;
        try {
          wynik = await wykonajKrok(krok);
        } catch (e) {
          ustawStatus('Błąd: ' + e.message);
          przyciskStart.disabled = false;
          return;
        }
        if (wynik === POMINIETO) pominietych++;
        else wyslanych++;
        if (i < kroki.length - 1) {
          const odstep = losowyOdstep(1000, 1000);
          await sleep(odstep);
        }
      }
      ustawStatus('Gotowe — wysłano ' + wyslanych + ' grup, pominięto ' + pominietych + ' (poziom niedostępny).');
      przyciskStart.disabled = false;
    }

    document.getElementById('scavCustomStart').addEventListener('click', function () {
      const bledy = walidujKroki(kroki);
      if (bledy.length) {
        ustawStatus(bledy.join(' '));
        return;
      }
      uruchomSekwencje();
    });

    odswiezTabele();
  })();
}
