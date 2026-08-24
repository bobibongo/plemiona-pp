// src/scav_legal.js
//
// Zbieractwo — wersja "legal". W przeciwienstwie do src/scav.js ten skrypt
// NIGDY nie klika niczego w grze: nie wywoluje .click(), nie submituje
// formularza i nie wysyla zadnych zadan. Robi wylacznie dwie rzeczy:
//   1. czyta stan strony,
//   2. wpisuje liczby do pol jednostek.
// Przycisk "Wyslij" zawsze klika czlowiek. Skrypt jedynie wykrywa, ze wysylka
// nastapila, i przygotowuje kolejny krok sekwencji.
//
// Logika obliczeniowa (czasy, walidacja, kroki) mieszka w scav-logika.js i jest
// wspoldzielona z panelem automatycznym. Importujemy ja stamtad, a NIE ze
// scav.js — inaczej build wciagnalby tu tez warstwe UI tamtego panelu razem
// z jej wywolaniami .click().
import { panelMotywCSS, usunIstniejacyPanel, wstrzyknijStylPanelu, wlaczPrzeciaganiePanelu } from './panel-theme.js';
import {
  POZIOMY, JEDNOSTKI_OK, walidujKroki,
  sparsujParametrySwiata, czasKrokuSekundy, formatCzas,
  wczytajZapisaneKroki, zapiszKroki,
} from './scav-logika.js';

export const NAZWY_JEDNOSTEK = {
  spear: 'Pikinier', sword: 'Miecznik', axe: 'Topornik', archer: 'Łucznik',
  light: 'Lekka kaw.', marcher: 'Łucznik konny', heavy: 'Ciężka kaw.', knight: 'Rycerz',
};

const PREFIKS_POSTEPU = 'scavLegalPostep_';

// Postep trzymamy osobno dla kazdej wioski — inaczej sekwencja rozpoczeta
// w jednej wiosce "przeskakiwalaby" kroki po przejsciu do nastepnej.
export function kluczPostepu(idWioski) {
  return PREFIKS_POSTEPU + (idWioski == null ? 'brak' : String(idWioski));
}

export function wczytajPostep(storage, idWioski) {
  const surowe = storage.getItem(kluczPostepu(idWioski));
  const wartosc = Number(surowe);
  if (!Number.isInteger(wartosc) || wartosc < 0) return 0;
  return wartosc;
}

export function zapiszPostep(storage, idWioski, indeks) {
  storage.setItem(kluczPostepu(idWioski), String(indeks));
}

export function wyczyscPostep(storage, idWioski) {
  storage.removeItem(kluczPostepu(idWioski));
}

export function nastepnyIndeks(indeks, kroki) {
  return indeks >= kroki.length ? kroki.length : indeks + 1;
}

export function poprzedniIndeks(indeks) {
  return indeks <= 0 ? 0 : indeks - 1;
}

// Opisuje, na czym stoi sekwencja: ktory krok jest "do wyslania" teraz.
export function stanSekwencji(indeks, kroki) {
  const zakonczona = indeks >= kroki.length;
  return {
    zakonczona,
    krok: zakonczona ? null : kroki[indeks],
    numer: indeks + 1,
    wszystkich: kroki.length,
  };
}

// Przy kazdym kroku zostawiamy wypelnione tylko pole jednostki z tego kroku;
// reszte czyscimy, zeby przypadkiem nie wyslac wojska z poprzedniej grupy.
export function polaDoWyczyszczenia(jednostkaAktywna) {
  return JEDNOSTKI_OK.filter(j => j !== jednostkaAktywna);
}

// Ekran zbieractwa masowego listuje wiele wiosek, wiec dla jednego poziomu
// istnieje wiele checkboxow z tym samym data-option. Zwracamy wszystkie
// dostepne (pomijajac zablokowane) — zaznaczenie tylko jednego wyslaloby
// zbieractwo z czesci wiosek.
export function checkboxyPoziomu(checkboxy, poziom, odczytajPoziom, czyZablokowany) {
  return Array.from(checkboxy).filter(function (checkbox) {
    if (czyZablokowany(checkbox)) return false;
    return odczytajPoziom(checkbox) === String(poziom);
  });
}

export function opisKroku(krok) {
  if (!krok) return '—';
  return NAZWY_JEDNOSTEK[krok.jednostka] + ' ×' + krok.liczba + ' — poziom ' + krok.poziom;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  (function () {
    const STYL_WLASNY = `
    #scavLegalPanel table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    #scavLegalPanel th, #scavLegalPanel td { padding: 5px 4px; text-align: center; font-size: 11px; }
    #scavLegalPanel thead { border-bottom: 1px solid #5a4a35; }
    #scavLegalPanel th { background: #1a1209; color: #b39a6e; font-weight: 700;
      text-transform: uppercase; font-size: 10px; letter-spacing: .08em; }
    #scavLegalPanel tbody tr { background: #17110a; }
    #scavLegalPanel tbody tr.aktywny { background: #3a2a18; color: #ffe6b0; font-weight: bold; }
    #scavLegalPanel tbody tr.zrobiony { opacity: .45; }
    #scavLegalPanel select { width: 100%; box-sizing: border-box; font-family: inherit;
      background: #17110a; color: #f0e4cc; border: 1px solid #5a4a35; border-radius: 4px; padding: 6px; }
    #scavLegalPanel .czas-kol { color: #e8c77a; white-space: nowrap; }
    #scavLegalPanel .usun { cursor: pointer; color: #f0a294; font-weight: bold; }
    #scavLegalPanel .dodaj-rzad { display: flex; gap: 4px; margin-bottom: 10px; }
    #scavLegalPanel .dodaj-rzad > * { flex: 1; min-width: 0; }
    #scavLegalPanel .teraz { background: #17110a; border: 1px solid #5a4a35; border-left: 3px solid #e8c77a;
      border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; }
    #scavLegalPanel .teraz-etykieta { font-size: 10px; text-transform: uppercase;
      letter-spacing: .08em; color: #b39a6e; }
    #scavLegalPanel .teraz-krok { font-size: 14px; font-weight: bold; color: #ffe6b0; margin-top: 2px; }
    #scavLegalPanel .teraz-akcja { font-size: 11px; color: #9fd8a8; margin-top: 4px; }
    #scavLegalPanel .teraz-uwaga { font-size: 11px; color: #f0a294; margin-top: 4px; }
    #scavLegalPanel .pm-grupa.nawigacja button { padding: 6px 4px; font-size: 11px; }
    `;

    usunIstniejacyPanel('scavLegalPanel');
    wstrzyknijStylPanelu('scavLegalStyle', panelMotywCSS('scavLegalPanel') + STYL_WLASNY);

    function idWioski() {
      const zUrl = new URLSearchParams(window.location.search).get('village');
      return zUrl || (window.game_data && window.game_data.village && window.game_data.village.id) || null;
    }

    const WIOSKA = idWioski();

    let parametrySwiata = null;
    const skrypty = document.querySelectorAll('script');
    for (const skrypt of skrypty) {
      if (skrypt.textContent && skrypt.textContent.indexOf('ScavengeMassScreen') !== -1) {
        parametrySwiata = sparsujParametrySwiata(skrypt.textContent);
        break;
      }
    }

    let kroki = wczytajZapisaneKroki(window.localStorage);
    let indeks = wczytajPostep(window.localStorage, WIOSKA);

    function opcjeJednostek(wybrana) {
      return JEDNOSTKI_OK.map(j =>
        '<option value="' + j + '"' + (j === wybrana ? ' selected' : '') + '>' + NAZWY_JEDNOSTEK[j] + '</option>'
      ).join('');
    }

    function opcjePoziomow(wybrany) {
      return POZIOMY.map(p =>
        '<option value="' + p + '"' + (Number(p) === Number(wybrany) ? ' selected' : '') + '>' + p + '</option>'
      ).join('');
    }

    const html = `
    <div id="scavLegalPanel">
      <h3>Zbieractwo (legal) <span class="pm-x" id="scavLegalClose">x</span></h3>
      <div class="pm-body">
        <div class="teraz">
          <div class="teraz-etykieta" id="scavLegalTerazEtykieta">Krok —</div>
          <div class="teraz-krok" id="scavLegalTerazKrok">—</div>
          <div class="teraz-akcja" id="scavLegalTerazAkcja"></div>
          <div class="teraz-uwaga" id="scavLegalTerazUwaga"></div>
        </div>
        <div class="pm-grupa nawigacja">
          <button id="scavLegalCofnij">◂ Cofnij</button>
          <button id="scavLegalNastepny" class="pm-ok">Następny ▸</button>
          <button id="scavLegalReset" class="pm-danger">Reset</button>
        </div>
        <table>
          <thead><tr><th>Jednostka</th><th>Poz.</th><th>Ilość</th><th>Czas</th><th></th></tr></thead>
          <tbody id="scavLegalTbody"></tbody>
        </table>
        <div class="dodaj-rzad">
          <select id="scavLegalNowaJednostka">${opcjeJednostek('light')}</select>
          <select id="scavLegalNowyPoziom">${opcjePoziomow(4)}</select>
          <input type="number" min="1" id="scavLegalNowaLiczba" value="30">
          <button id="scavLegalDodaj">+</button>
        </div>
        <div class="pm-grupa">
          <button id="scavLegalZapisz">Zapisz domyślne</button>
        </div>
        <div class="pm-status" id="scavLegalStatus"></div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('scavLegalClose').addEventListener('click', function () {
      if (obserwator) obserwator.disconnect();
      document.getElementById('scavLegalPanel').remove();
    });

    wlaczPrzeciaganiePanelu('scavLegalPanel', 'scavLegalClose', 'scavLegalPozycja', window.localStorage);

    function ustawStatus(tekst) {
      document.getElementById('scavLegalStatus').textContent = tekst;
    }

    // Ustawienie value przez natywny setter + zdarzenia input/change. To ta sama
    // technika co w Handlarzu PP: efekt jest taki, jakbys wpisal liczbe recznie.
    function ustawWartoscInputa(input, wartosc) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, String(wartosc));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function znajdzInputJednostki(jednostka) {
      return document.querySelector('input.unitsInput[name="' + jednostka + '"]');
    }

    function znajdzPrzyciskWyslij() {
      return document.querySelector('a.btn-send');
    }

    // Zaznaczamy checkbox poziomu bez .click() — ustawiamy .checked i emitujemy
    // change. Jesli gra nasluchuje wylacznie na click, zaznaczenie sie nie
    // przyjmie; wtedy zwracamy false i prosimy uzytkownika o reczny klik.
    function zaznaczPoziom(poziom) {
      const wszystkie = document.querySelectorAll('input.select-all-col[data-option]');
      const docelowe = checkboxyPoziomu(
        wszystkie, poziom,
        c => c.getAttribute('data-option'),
        c => c.disabled,
      );
      if (!docelowe.length) return false;
      // Najpierw odznaczamy poziomy z poprzedniego kroku — inaczej zostalyby
      // zaznaczone razem z biezacym.
      wszystkie.forEach(function (checkbox) {
        if (checkbox.disabled || docelowe.includes(checkbox)) return;
        if (checkbox.checked) {
          checkbox.checked = false;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      docelowe.forEach(function (checkbox) {
        if (!checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      return docelowe.every(c => c.checked === true);
    }

    function wyczyscPolaPozaAktywnym(jednostkaAktywna) {
      polaDoWyczyszczenia(jednostkaAktywna).forEach(function (jednostka) {
        const pole = znajdzInputJednostki(jednostka);
        if (pole && pole.value !== '' && pole.value !== '0') ustawWartoscInputa(pole, '');
      });
    }

    // Wpisuje krok o podanym indeksie. Nic nie wysyla — po tym wywolaniu
    // uzytkownik sam klika "Wyslij" w grze.
    function wpiszKrok() {
      const stan = stanSekwencji(indeks, kroki);
      odswiezWidok();
      if (stan.zakonczona) return;

      const input = znajdzInputJednostki(stan.krok.jednostka);
      if (!input) {
        ustawStatus('Nie znaleziono pola jednostki ' + NAZWY_JEDNOSTEK[stan.krok.jednostka] + '.');
        return;
      }
      wyczyscPolaPozaAktywnym(stan.krok.jednostka);
      ustawWartoscInputa(input, stan.krok.liczba);

      const poziomOk = zaznaczPoziom(stan.krok.poziom);
      const uwaga = document.getElementById('scavLegalTerazUwaga');
      uwaga.textContent = poziomOk ? '' : 'Zaznacz poziom ' + stan.krok.poziom + ' ręcznie — nie udało się ustawić.';
      ustawStatus('Wpisano: ' + opisKroku(stan.krok) + '. Kliknij „Wyślij” w grze.');
    }

    function przejdzDo(nowyIndeks) {
      indeks = nowyIndeks;
      zapiszPostep(window.localStorage, WIOSKA, indeks);
      wpiszKrok();
    }

    function odswiezWidok() {
      const stan = stanSekwencji(indeks, kroki);
      const etykieta = document.getElementById('scavLegalTerazEtykieta');
      const krokEl = document.getElementById('scavLegalTerazKrok');
      const akcja = document.getElementById('scavLegalTerazAkcja');

      if (stan.zakonczona) {
        etykieta.textContent = 'Sekwencja zakończona';
        krokEl.textContent = stan.wszystkich ? 'Wysłano wszystkie ' + stan.wszystkich + ' grup' : 'Brak kroków';
        akcja.textContent = 'Kliknij „Reset”, aby zacząć od nowa.';
        document.getElementById('scavLegalTerazUwaga').textContent = '';
      } else {
        etykieta.textContent = 'Krok ' + stan.numer + ' z ' + stan.wszystkich;
        krokEl.textContent = opisKroku(stan.krok);
        akcja.textContent = '▸ Teraz kliknij „Wyślij” w grze.';
      }

      const tbody = document.getElementById('scavLegalTbody');
      tbody.innerHTML = kroki.map(function (krok, i) {
        const klasa = i < indeks ? 'zrobiony' : (i === indeks ? 'aktywny' : '');
        return '<tr class="' + klasa + '">'
          + '<td>' + NAZWY_JEDNOSTEK[krok.jednostka] + '</td>'
          + '<td>' + krok.poziom + '</td>'
          + '<td>' + krok.liczba + '</td>'
          + '<td class="czas-kol">' + formatCzas(czasKrokuSekundy(krok, parametrySwiata)) + '</td>'
          + '<td class="usun" data-usun="' + i + '">✕</td>'
          + '</tr>';
      }).join('');

      tbody.querySelectorAll('[data-usun]').forEach(function (el) {
        el.addEventListener('click', function () {
          kroki.splice(Number(el.getAttribute('data-usun')), 1);
          if (indeks > kroki.length) indeks = kroki.length;
          odswiezWidok();
        });
      });
    }

    // --- Auto-detekcja wysylki ---
    //
    // Nie pollujemy w petli (zadnego setInterval): MutationObserver budzi sie
    // tylko wtedy, gdy gra faktycznie przerysuje panel. Uznajemy, ze wysylka
    // nastapila, gdy JEDNOCZESNIE pole aktywnej jednostki zostalo wyczyszczone
    // przez gre I przycisk "Wyslij" wrocil do stanu disabled.
    let czekaNaWyslanie = false;
    let obserwator = null;

    function przyciskZablokowany(przycisk) {
      return !przycisk || przycisk.classList.contains('disabled') || przycisk.getAttribute('disabled') !== null;
    }

    function czyWyslano() {
      const stan = stanSekwencji(indeks, kroki);
      if (stan.zakonczona) return false;
      const input = znajdzInputJednostki(stan.krok.jednostka);
      if (!input) return false;
      const poleWyczyszczone = input.value === '' || input.value === '0';
      return poleWyczyszczone && przyciskZablokowany(znajdzPrzyciskWyslij());
    }

    function uruchomObserwatora() {
      const cel = document.querySelector('.villages-container') || document.body;
      obserwator = new MutationObserver(function () {
        if (!czekaNaWyslanie) return;
        if (!czyWyslano()) return;
        czekaNaWyslanie = false;
        przejdzDo(nastepnyIndeks(indeks, kroki));
        czekaNaWyslanie = true;
      });
      obserwator.observe(cel, { attributes: true, childList: true, subtree: true });
      czekaNaWyslanie = true;
    }

    document.getElementById('scavLegalNastepny').addEventListener('click', function () {
      przejdzDo(nastepnyIndeks(indeks, kroki));
    });

    document.getElementById('scavLegalCofnij').addEventListener('click', function () {
      przejdzDo(poprzedniIndeks(indeks));
    });

    document.getElementById('scavLegalReset').addEventListener('click', function () {
      wyczyscPostep(window.localStorage, WIOSKA);
      przejdzDo(0);
    });

    document.getElementById('scavLegalDodaj').addEventListener('click', function () {
      kroki.push({
        jednostka: document.getElementById('scavLegalNowaJednostka').value,
        poziom: Number(document.getElementById('scavLegalNowyPoziom').value),
        liczba: Number(document.getElementById('scavLegalNowaLiczba').value),
      });
      const bledy = walidujKroki(kroki);
      if (bledy.length) {
        kroki.pop();
        ustawStatus(bledy.join(' '));
        return;
      }
      odswiezWidok();
    });

    document.getElementById('scavLegalZapisz').addEventListener('click', function () {
      zapiszKroki(window.localStorage, kroki);
      ustawStatus('Zapisano sekwencję (' + kroki.length + ' kroków).');
    });

    wpiszKrok();
    uruchomObserwatora();
  })();
}
