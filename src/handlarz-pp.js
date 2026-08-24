// src/handlarz-pp.js
import { panelMotywCSS, usunIstniejacyPanel, wstrzyknijStylPanelu, wlaczPrzeciaganiePanelu } from './panel-theme.js';

export const SUROWCE_OK = ['wood', 'stone', 'iron'];

export const TRYBY_OK = ['sell', 'buy', 'buyAll'];

export const ZAOKRAGLENIA_OK = [0, 10, 100, 1000];

export function zaokraglijWDol(wartosc, krok) {
  if (!krok || krok <= 1) return Math.floor(wartosc);
  return Math.floor(wartosc / krok) * krok;
}

// procentWypelnienia: prog wyrazony jako % pojemnosci gieldy (np. 98.0 = 98%
// wypelnienia), z dokladnoscia do 0.1%. Prog = pojemnosc * procentWypelnienia/100.
export function obliczProg(pojemnosc, procentWypelnienia) {
  return pojemnosc * (procentWypelnienia / 100);
}

export function obliczIlosc(pojemnosc, stan, procentWypelnienia, tryb) {
  let wynik;
  if (tryb === 'sell') {
    // Sprzedajesz DO gieldy: limit to wolne miejsce do progu.
    wynik = obliczProg(pojemnosc, procentWypelnienia) - stan;
  } else if (tryb === 'buy') {
    // Kupujesz OD gieldy: limit to nadwyzka stanu ponad prog —
    // im blizej pelnej gieldy tym lepszy kurs kupna, ponizej progu juz nie kupujemy.
    wynik = stan - obliczProg(pojemnosc, procentWypelnienia);
  } else {
    // BUY ALL: skupuje caly aktualny stan gieldy, bez progu.
    wynik = stan;
  }
  return wynik > 0 ? wynik : 0;
}

export function polaDlaTrybu(tryb) {
  return tryb === 'sell' ? 'sell' : 'buy';
}

// Ogranicza wyliczona ilosc do tego co faktycznie da sie zrealizowac:
// - SELL: limituje maxTransport kupcow ORAZ stan magazynu wioski (musisz miec surowiec).
// - BUY/BUY ALL: limituje wolne miejsce w spichlerzu wioski (pojemnoscSpichlerza - stanMagazynu).
// Zwraca { wynik, obciete, powod } zeby UI/konsola mogly poinformowac co ograniczylo.
export function ograniczDoDostepnych(wynik, tryb, dane) {
  const { stanMagazynu, maxTransportKupcow, pojemnoscSpichlerza } = dane;
  let limit = wynik;
  let powod = null;

  if (tryb === 'sell') {
    if (Number.isFinite(maxTransportKupcow) && maxTransportKupcow < limit) {
      limit = maxTransportKupcow;
      powod = 'limit transportowy kupców';
    }
    if (Number.isFinite(stanMagazynu) && stanMagazynu < limit) {
      limit = stanMagazynu;
      powod = 'stan magazynu wioski';
    }
  } else {
    const wolneMiejsce = Number.isFinite(pojemnoscSpichlerza) && Number.isFinite(stanMagazynu)
      ? pojemnoscSpichlerza - stanMagazynu
      : NaN;
    if (Number.isFinite(wolneMiejsce) && wolneMiejsce < limit) {
      limit = wolneMiejsce;
      powod = 'pojemność spichlerza';
    }
  }

  limit = limit > 0 ? limit : 0;
  return { wynik: limit, obciete: limit < wynik, powod: limit < wynik ? powod : null };
}

export function walidujDaneGieldy({ pojemnosc, stan, procentWypelnienia }) {
  const bledy = [];
  if (!Number.isFinite(pojemnosc)) bledy.push('Nie udało się odczytać pojemności.');
  if (!Number.isFinite(stan)) bledy.push('Nie udało się odczytać stanu.');
  if (!Number.isFinite(procentWypelnienia) || procentWypelnienia < 0 || procentWypelnienia > 100) {
    bledy.push('Próg wypełnienia musi być liczbą od 0 do 100 (%).');
  }
  return bledy;
}

const KLUCZ_TRYB = 'handlarzPPTryb';

export const PROG_DOMYSLNY = { sell: 96.5, buy: 98.5, buyAll: 98.5 };
export const ZAOKRAGLENIE_DOMYSLNE = { sell: 100, buy: 100, buyAll: 100 };

function kluczProgu(tryb) {
  return 'handlarzPPProg_' + tryb;
}

export function zaokraglijProcent(wartosc) {
  return Math.round(wartosc * 10) / 10;
}

export function wczytajZapisanyProg(storage, tryb, domyslny) {
  const surowe = storage.getItem(kluczProgu(tryb));
  if (surowe === null) return domyslny;
  const wartosc = Number(surowe);
  return Number.isFinite(wartosc) ? wartosc : domyslny;
}

export function zapiszProg(storage, tryb, procentWypelnienia) {
  storage.setItem(kluczProgu(tryb), String(procentWypelnienia));
}

export function wczytajZapisanyTryb(storage, domyslny) {
  const surowy = storage.getItem(KLUCZ_TRYB);
  return TRYBY_OK.includes(surowy) ? surowy : domyslny;
}

export function zapiszTryb(storage, tryb) {
  storage.setItem(KLUCZ_TRYB, tryb);
}

function kluczZaokraglenia(tryb) {
  return 'handlarzPPZaokraglenie_' + tryb;
}

export function wczytajZapisaneZaokraglenie(storage, tryb, domyslne) {
  const surowe = storage.getItem(kluczZaokraglenia(tryb));
  const wartosc = Number(surowe);
  return ZAOKRAGLENIA_OK.includes(wartosc) ? wartosc : domyslne;
}

export function zapiszZaokraglenie(storage, tryb, zaokraglenie) {
  storage.setItem(kluczZaokraglenia(tryb), String(zaokraglenie));
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  (function () {
    const NAZWY_SUROWCOW = { wood: 'Drewno', stone: 'Glina', iron: 'Żelazo' };
    const NAZWY_TRYBOW = { sell: 'SELL', buy: 'BUY', buyAll: 'BUY ALL' };

    const STYL_WLASNY = `
    #handlarzPPPanel { border-top: none; }
    #handlarzPPPanel .karty-trybow { display: flex; gap: 3px; padding: 8px 8px 0;
      background: #0c1113; border-bottom: 1px solid #2a3436; }
    #handlarzPPPanel .karta-trybu { flex: 1; padding: 8px 6px; font-size: 11px; font-weight: 700;
      border: 1px solid #2a3436; border-bottom: none; border-radius: 2px 2px 0 0; cursor: pointer; opacity: .55;
      background: #14191b; color: #7f9494; position: relative; top: 1px; transition: opacity .12s;
      text-transform: uppercase; letter-spacing: .06em; font-family: inherit; }
    #handlarzPPPanel .karta-trybu:hover { opacity: .8; }
    #handlarzPPPanel .karta-trybu.pm-aktywny { opacity: 1; }
    #handlarzPPPanel .karta-trybu.tab-sell.pm-aktywny { background: #3a1a18; color: #f0a294; box-shadow: 0 -2px 0 #d9553f inset; border-color: #5a2e2a; }
    #handlarzPPPanel .karta-trybu.tab-buy.pm-aktywny, #handlarzPPPanel .karta-trybu.tab-buyAll.pm-aktywny {
      background: #16332a; color: #7fe0bd; box-shadow: 0 -2px 0 #3ad6b8 inset; border-color: #2d5a46; }
    #handlarzPPPanel .pm-przyciski-surowce { margin-top: 2px; }
    #handlarzPPPanel #handlarzPPZaokraglenia button { flex: 1; padding: 4px; font-size: 11px; }
    #handlarzPPPanel .pm-przyciski-surowce button { flex: 1; padding: 14px 6px; font-size: 14px; }
    #handlarzPPPanel .prog-rzad { display: flex; align-items: stretch; gap: 4px; }
    #handlarzPPPanel .prog-rzad input[type=number] { flex: 1; min-width: 0; text-align: center; font-size: 15px; font-weight: bold; }
    #handlarzPPPanel .prog-krok { padding: 0 8px; font-size: 12px; }
    `;

    usunIstniejacyPanel('handlarzPPPanel');
    wstrzyknijStylPanelu('handlarzPPStyle', panelMotywCSS('handlarzPPPanel') + STYL_WLASNY);

    let tryb = wczytajZapisanyTryb(window.localStorage, 'sell');
    let zaokraglenie = wczytajZapisaneZaokraglenie(window.localStorage, tryb, ZAOKRAGLENIE_DOMYSLNE[tryb]);

    function kartyTrybowHTML() {
      return TRYBY_OK.map(function (t) {
        const klasy = ['karta-trybu', 'tab-' + t];
        if (t === tryb) klasy.push('pm-aktywny');
        return '<button data-tryb="' + t + '" class="' + klasy.join(' ') + '">' + NAZWY_TRYBOW[t] + '</button>';
      }).join('');
    }

    function przyciskiZaokraglenHTML() {
      return ZAOKRAGLENIA_OK.map(function (z) {
        const etykieta = z === 0 ? 'brak' : String(z);
        return '<button data-zaokr="' + z + '" class="btn-zaokr' + (z === zaokraglenie ? ' pm-aktywny' : '') + '">' + etykieta + '</button>';
      }).join('');
    }

    const html = `
    <div id="handlarzPPPanel">
      <h3>Handlarz PP <span class="pm-x" id="handlarzPPClose">x</span></h3>
      <div class="karty-trybow" id="handlarzPPTryby">${kartyTrybowHTML()}</div>
      <div class="pm-body">
        <div class="pm-sekcja">
          <span class="pm-etykieta">Próg wypełnienia giełdy</span>
          <div class="prog-rzad">
            <button class="prog-krok" data-krok="-1">−1</button>
            <button class="prog-krok" data-krok="-0.1">−0,1</button>
            <input type="number" min="0" max="100" step="0.1" id="handlarzPPProg" value="${wczytajZapisanyProg(window.localStorage, tryb, PROG_DOMYSLNY[tryb])}">
            <button class="prog-krok" data-krok="0.1">+0,1</button>
            <button class="prog-krok" data-krok="1">+1</button>
          </div>
        </div>
        <div class="pm-sekcja">
          <span class="pm-etykieta">Zaokrąglenie w dół do</span>
          <div class="pm-grupa" id="handlarzPPZaokraglenia">${przyciskiZaokraglenHTML()}</div>
        </div>
        <div class="pm-sekcja pm-przyciski-surowce pm-grupa">
          <button id="handlarzPPLiczWood" data-surowiec="wood">Drewno</button>
          <button id="handlarzPPLiczStone" data-surowiec="stone">Glina</button>
          <button id="handlarzPPLiczIron" data-surowiec="iron">Żelazo</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('handlarzPPClose').addEventListener('click', function () {
      document.getElementById('handlarzPPPanel').remove();
    });

    wlaczPrzeciaganiePanelu('handlarzPPPanel', 'handlarzPPClose', 'handlarzPPPozycja', window.localStorage);

    function ustawStatus(tekst) {
      console.log('[Handlarz PP]', tekst);
    }

    function odczytajLiczbe(id) {
      const el = document.getElementById(id);
      if (!el) return NaN;
      return Number(el.textContent.replace(/[^\d-]/g, ''));
    }

    function ustawWartoscInputa(input, wartosc) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, String(wartosc));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function sleep(ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function odswiezPrzyciskiTrybow() {
      document.querySelectorAll('#handlarzPPTryby button').forEach(function (przycisk) {
        przycisk.classList.toggle('pm-aktywny', przycisk.getAttribute('data-tryb') === tryb);
      });
      const poleProg = document.getElementById('handlarzPPProg');
      poleProg.disabled = tryb === 'buyAll';
      poleProg.value = wczytajZapisanyProg(window.localStorage, tryb, PROG_DOMYSLNY[tryb]);

      zaokraglenie = wczytajZapisaneZaokraglenie(window.localStorage, tryb, ZAOKRAGLENIE_DOMYSLNE[tryb]);
      odswiezPrzyciskiZaokraglen();
    }

    function odswiezPrzyciskiZaokraglen() {
      document.querySelectorAll('#handlarzPPZaokraglenia button').forEach(function (przycisk) {
        przycisk.classList.toggle('pm-aktywny', Number(przycisk.getAttribute('data-zaokr')) === zaokraglenie);
      });
    }

    document.querySelectorAll('#handlarzPPTryby button').forEach(function (przycisk) {
      przycisk.addEventListener('click', function () {
        tryb = przycisk.getAttribute('data-tryb');
        zapiszTryb(window.localStorage, tryb);
        odswiezPrzyciskiTrybow();
      });
    });

    document.querySelectorAll('#handlarzPPZaokraglenia button').forEach(function (przycisk) {
      przycisk.addEventListener('click', function () {
        zaokraglenie = Number(przycisk.getAttribute('data-zaokr'));
        zapiszZaokraglenie(window.localStorage, tryb, zaokraglenie);
        odswiezPrzyciskiZaokraglen();
      });
    });

    document.querySelectorAll('.prog-krok').forEach(function (przycisk) {
      przycisk.addEventListener('click', function () {
        if (tryb === 'buyAll') return;
        const poleProg = document.getElementById('handlarzPPProg');
        const krok = Number(przycisk.getAttribute('data-krok'));
        let nowyProg = zaokraglijProcent(Number(poleProg.value) + krok);
        if (nowyProg < 0) nowyProg = 0;
        if (nowyProg > 100) nowyProg = 100;
        poleProg.value = nowyProg;
        zapiszProg(window.localStorage, tryb, nowyProg);
      });
    });

    odswiezPrzyciskiTrybow();
    odswiezPrzyciskiZaokraglen();

    function wyczyscInnePola(prefiksAktywny, surowiecAktywny) {
      let wyczyszczonoCos = false;
      ['sell', 'buy'].forEach(function (prefiks) {
        SUROWCE_OK.forEach(function (surowiec) {
          if (prefiks === prefiksAktywny && surowiec === surowiecAktywny) return;
          const pole = document.querySelector('input[name="' + prefiks + '_' + surowiec + '"]');
          if (pole && pole.value !== '') {
            ustawWartoscInputa(pole, '');
            wyczyszczonoCos = true;
          }
        });
      });
      return wyczyszczonoCos;
    }

    async function policz(surowiec) {
      const progWpisany = zaokraglijProcent(Number(document.getElementById('handlarzPPProg').value));

      const pojemnosc = odczytajLiczbe('premium_exchange_capacity_' + surowiec);
      const stan = odczytajLiczbe('premium_exchange_stock_' + surowiec);

      const bledy = walidujDaneGieldy({ pojemnosc, stan, procentWypelnienia: progWpisany });
      if (bledy.length) {
        ustawStatus(bledy.join(' '));
        return;
      }

      const prefiks = polaDlaTrybu(tryb);
      const wyczyszczonoCos = wyczyscInnePola(prefiks, surowiec);
      if (wyczyszczonoCos) await sleep(150);

      const inputDocelowy = document.querySelector('input[name="' + prefiks + '_' + surowiec + '"]');
      if (!inputDocelowy) {
        ustawStatus('Nie znaleziono pola ' + prefiks + ' dla ' + NAZWY_SUROWCOW[surowiec] + '.');
        return;
      }
      if (inputDocelowy.disabled) {
        ustawStatus(NAZWY_SUROWCOW[surowiec] + ' — pole zablokowane (limit dzienny albo inny surowiec w trakcie edycji).');
        return;
      }

      const wynikSurowy = obliczIlosc(pojemnosc, stan, progWpisany, tryb);
      const wynikZaokraglony = zaokraglijWDol(wynikSurowy, zaokraglenie);

      const stanMagazynu = odczytajLiczbe(surowiec);
      const maxTransportKupcow = odczytajLiczbe('market_merchant_max_transport');
      const pojemnoscSpichlerza = odczytajLiczbe('storage');
      const ograniczenie = ograniczDoDostepnych(wynikZaokraglony, tryb, {
        stanMagazynu, maxTransportKupcow, pojemnoscSpichlerza,
      });
      const wynik = ograniczenie.obciete ? zaokraglijWDol(ograniczenie.wynik, zaokraglenie) : wynikZaokraglony;

      ustawWartoscInputa(inputDocelowy, wynik);
      if (tryb !== 'buyAll') zapiszProg(window.localStorage, tryb, progWpisany);
      ustawStatus(NAZWY_TRYBOW[tryb] + ' ' + NAZWY_SUROWCOW[surowiec] + ': pojemność ' + pojemnosc + ' − stan ' + stan
        + (tryb === 'buyAll' ? '' : ' − próg ' + progWpisany + '%')
        + ' = ' + wynikSurowy + (zaokraglenie ? ' → zaokrąglone do ' + wynikZaokraglony : '')
        + (ograniczenie.obciete ? ' → obcięte do ' + wynik + ' (' + ograniczenie.powod + ')' : ''));
    }

    document.querySelectorAll('.pm-przyciski-surowce button').forEach(function (przycisk) {
      przycisk.addEventListener('click', function () {
        policz(przycisk.getAttribute('data-surowiec'));
      });
    });
  })();
}
