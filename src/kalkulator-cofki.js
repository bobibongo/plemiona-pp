// src/kalkulator-cofki.js
// Kalkulator klina z cofki: liczy dokladny moment przerwania wyslanej komendy tak,
// zeby wojsko wrocilo o zadanej sekundzie. Przerwana komenda wraca po tylu samo
// sekundach, ile juz szla - wiec moment przerwania to arytmetyczny srodek miedzy
// czasem wyslania a oczekiwanym czasem powrotu.
//
// OS CZASU: wszystko liczymy w "sekundach czasu gry", czyli unix UTC powiekszonym
// o server_utc_diff. Powod: data-starttime/data-endtime to surowy unix UTC, ale
// godziny na ekranie gry (i te, ktore gracz wkleja z karety) sa juz przesuniete
// o strefe serwera. Mieszanie tych dwoch osi przesuwalo wynik o pelne godziny.
//
// Dziala wylacznie na stronie podgladu rozkazu (info_command), skad automatycznie
// czyta czas wyslania - nie ma pola do recznego wpisania startu, zeby nie
// wprowadzac bledu z przepisywania.
import { panelMotywCSS, usunIstniejacyPanel, wstrzyknijStylPanelu, wlaczPrzeciaganiePanelu } from './panel-theme.js';

// Okno na przerwanie rozkazu: 10 minut od wyslania, ale nie dluzej niz sam
// rozkaz leci (krotsze rozkazy mozna przerwac az do momentu przybycia).
export const OKNO_PRZERWANIA_SEKUND = 600;

export function koniecOknaPrzerwania(startSekundy, przybycieSekundy) {
  const limit = startSekundy + OKNO_PRZERWANIA_SEKUND;
  if (!Number.isFinite(przybycieSekundy)) return limit;
  return Math.min(limit, przybycieSekundy);
}

// startSekundy/docelowySekundy: sekundy czasu gry. Zwraca moment przerwania
// (srodek odcinka) oraz informacje o parzystosci - przy nieparzystym odstepie
// idealne trafienie jest niemozliwe, bo przerwanie dziala na pelnych sekundach.
export function obliczPrzerwanie(startSekundy, docelowySekundy) {
  const roznica = docelowySekundy - startSekundy;
  if (roznica <= 0) return null;
  const parzysta = roznica % 2 === 0;
  const przerwanieSekundy = parzysta
    ? startSekundy + roznica / 2
    : startSekundy + Math.floor(roznica / 2);
  return {
    przerwanieSekundy,
    roznicaSekund: roznica,
    parzysta,
    czasDoPrzerwaniaSekund: przerwanieSekundy - startSekundy,
  };
}

// Zamienia GG:MM:SS (milisekundy w tekscie, jesli podane, sa ignorowane - nie
// wplywaja na moment przerwania) na sekundy czasu gry, wybierajac najblizsze
// wystapienie tej godziny po terazSekundy.
export function ustalCelSekundy(tekst, terazSekundy) {
  const dopasowanie = String(tekst).trim().match(/^(\d{1,2}):(\d{2}):(\d{2})(?::\d{1,3})?$/);
  if (!dopasowanie) return null;
  const godzina = Number(dopasowanie[1]);
  const minuta = Number(dopasowanie[2]);
  const sekunda = Number(dopasowanie[3]);
  if (godzina > 23 || minuta > 59 || sekunda > 59) return null;

  const dobaSekund = 24 * 3600;
  const dzienStartu = Math.floor(terazSekundy / dobaSekund) * dobaSekund;
  let kandydat = dzienStartu + godzina * 3600 + minuta * 60 + sekunda;
  if (kandydat <= terazSekundy) kandydat += dobaSekund;
  return kandydat;
}

// sekundy czasu gry -> GG:MM:SS tak, jak pokazuje je zegar w grze.
export function formatZegara(sekundyGry) {
  const data = new Date(sekundyGry * 1000);
  const pad = n => String(n).padStart(2, '0');
  return pad(data.getUTCHours()) + ':' + pad(data.getUTCMinutes()) + ':' + pad(data.getUTCSeconds());
}

// Format G:MM:SS, zawsze z godzina (nawet 0) - tak jak gra pokazuje
// "przerwij (0:08:25)" w podgladzie rozkazu.
export function formatOdliczania(sekundyPozostale) {
  if (sekundyPozostale <= 0) return 'TERAZ!';
  const calkowite = Math.ceil(sekundyPozostale);
  const godziny = Math.floor(calkowite / 3600);
  const minuty = Math.floor((calkowite % 3600) / 60);
  const sek = calkowite % 60;
  const pad = n => String(n).padStart(2, '0');
  return godziny + ':' + pad(minuty) + ':' + pad(sek);
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  (function () {
    const STYL_WLASNY = `
    #cofkaPanel .pm-pole { width: 100%; box-sizing: border-box; text-align: center; font-size: 16px; letter-spacing: .05em; }
    #cofkaPanel .info-start { text-align: center; font-size: 12px; color: #d8e0e0; margin-bottom: 8px; line-height: 1.5; }
    #cofkaPanel .info-start .brak { color: #d9553f; }
    #cofkaPanel .info-start b { color: #3ad6b8; font-weight: 700; }
    #cofkaPanel .wynik { text-align: center; margin-top: 4px; }
    #cofkaPanel .wynik-czas { font-size: 26px; font-weight: bold; color: #3ad6b8; letter-spacing: .04em;
      text-shadow: 0 0 12px rgba(58,214,184,.35); }
    #cofkaPanel .wynik-odliczanie { font-size: 20px; font-weight: bold; color: #d8e0e0; margin-top: 4px; }
    #cofkaPanel .wynik-odliczanie.teraz { color: #d9553f; animation: cofkaMignij 1s infinite; }
    @keyframes cofkaMignij { 50% { opacity: .3; } }
    #cofkaPanel .info-wiersz { display: flex; justify-content: space-between; font-size: 11px; color: #7f9494; margin-top: 4px; }
    #cofkaPanel .ostrzezenie { color: #ff8c1a; font-size: 11px; margin-top: 6px; text-align: center; line-height: 1.5; }
    `;

    usunIstniejacyPanel('cofkaPanel');
    wstrzyknijStylPanelu('cofkaStyle', panelMotywCSS('cofkaPanel') + STYL_WLASNY);

    // Przesuniecie strefy serwera. Gra trzyma je w globalnej zmiennej
    // server_utc_diff; gdyby jej zabraklo, zostajemy na czystym UTC.
    const przesuniecieStrefy = Number.isFinite(Number(window.server_utc_diff))
      ? Number(window.server_utc_diff)
      : 0;

    function znajdzPasek() {
      return document.querySelector('.command-progress-bar[data-starttime]');
    }

    function czasZAtrybutu(pasek, nazwa) {
      if (!pasek) return null;
      const wartosc = Number(pasek.getAttribute(nazwa));
      return Number.isFinite(wartosc) ? wartosc + przesuniecieStrefy : null;
    }

    const pasek = znajdzPasek();
    const startSekundy = czasZAtrybutu(pasek, 'data-starttime');
    const przybycieSekundy = czasZAtrybutu(pasek, 'data-endtime');

    // Zegar systemowy potrafi odstawac od serwera o kilka sekund (Windows
    // synchronizuje czas rzadko), a gra odlicza wzgledem serwera - stad staly
    // blad przy trafianiu w sekunde. Mierzymy ten dryf raz, porownujac zegar gry
    // (#serverTime, ta sama os co data-starttime) z zegarem przegladarki.
    // #serverTime tyka co sekunde, wiec celujemy w srodek biezacej sekundy,
    // zeby samemu nie dolozyc bledu +-1s.
    function zmierzDryfZegara() {
      const czasEl = document.getElementById('serverTime');
      const dataEl = document.getElementById('serverDate');
      if (!czasEl || !dataEl) return 0;
      const czas = czasEl.textContent.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})/);
      const data = dataEl.textContent.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!czas || !data) return 0;
      const gra = Date.UTC(
        Number(data[3]), Number(data[2]) - 1, Number(data[1]),
        Number(czas[1]), Number(czas[2]), Number(czas[3])
      ) / 1000 + 0.5;
      const lokalny = Date.now() / 1000 + przesuniecieStrefy;
      const dryf = gra - lokalny;
      // Powyzej doby to nie dryf tylko zla data - wtedy lepiej nie korygowac nic.
      return Math.abs(dryf) < 24 * 3600 ? dryf : 0;
    }

    // Mierzymy przy otwarciu, a potem jeszcze raz przy kazdym liczeniu - panel
    // bywa otwarty dlugo, a #serverTime tyka przez caly czas.
    let dryfZegara = zmierzDryfZegara();

    function terazSekundyGry() {
      return Date.now() / 1000 + przesuniecieStrefy + dryfZegara;
    }

    const html = `
    <div id="cofkaPanel">
      <h3>Kalkulator cofki <span class="pm-x" id="cofkaClose">x</span></h3>
      <div class="pm-body">
        <div class="info-start" id="cofkaInfoStart"></div>
        <div class="pm-sekcja">
          <span class="pm-etykieta">Docelowy czas powrotu</span>
          <input type="text" id="cofkaCel" class="pm-pole" placeholder="GG:MM:SS:mmm">
        </div>
        <button id="cofkaPolicz" class="pm-ok">Policz</button>
        <div class="wynik" id="cofkaWynikBlok" style="display:none">
          <div class="wynik-czas" id="cofkaWynikCzas"></div>
          <div class="wynik-odliczanie" id="cofkaOdliczanie"></div>
          <div class="info-wiersz"><span>Licznik „przerwij” pokaże</span><span id="cofkaTrwanie"></span></div>
        </div>
        <div class="ostrzezenie" id="cofkaOstrzezenie"></div>
        <div class="pm-status" id="cofkaStatus"></div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('cofkaClose').addEventListener('click', function () {
      clearInterval(licznik);
      document.getElementById('cofkaPanel').remove();
    });

    wlaczPrzeciaganiePanelu('cofkaPanel', 'cofkaClose', 'cofkaPozycja', window.localStorage);

    function ustawStatus(tekst) {
      document.getElementById('cofkaStatus').textContent = tekst;
    }

    const infoStartEl = document.getElementById('cofkaInfoStart');
    const przyciskPolicz = document.getElementById('cofkaPolicz');
    const koniecOkna = startSekundy != null ? koniecOknaPrzerwania(startSekundy, przybycieSekundy) : null;

    if (startSekundy == null) {
      infoStartEl.innerHTML = '<span class="brak">Rozkazu nie można cofnąć</span>';
      przyciskPolicz.disabled = true;
    } else if (koniecOkna <= terazSekundyGry()) {
      infoStartEl.innerHTML = '<span class="brak">Okno na przerwanie już minęło</span>';
      przyciskPolicz.disabled = true;
    } else {
      infoStartEl.innerHTML = 'Wysłano o <b>' + formatZegara(startSekundy) + '</b><br>'
        + 'Przerwać można do <b>' + formatZegara(koniecOkna) + '</b>';
    }

    let przerwanieSekundy = null;
    let licznik = null;

    function odswiezOdliczanie() {
      const el = document.getElementById('cofkaOdliczanie');
      if (przerwanieSekundy == null) return;
      const pozostale = przerwanieSekundy - terazSekundyGry();
      el.textContent = formatOdliczania(pozostale);
      el.classList.toggle('teraz', pozostale <= 0);
    }

    przyciskPolicz.addEventListener('click', function () {
      if (startSekundy == null) return;
      dryfZegara = zmierzDryfZegara();
      const celTekst = document.getElementById('cofkaCel').value;

      const celSekundy = ustalCelSekundy(celTekst, terazSekundyGry());
      if (celSekundy == null) {
        ustawStatus('Podaj docelowy czas w formacie GG:MM:SS lub GG:MM:SS:mmm.');
        return;
      }

      const wynik = obliczPrzerwanie(startSekundy, celSekundy);
      if (!wynik) {
        ustawStatus('Docelowy czas powrotu musi być późniejszy niż czas wysłania.');
        document.getElementById('cofkaWynikBlok').style.display = 'none';
        return;
      }

      przerwanieSekundy = wynik.przerwanieSekundy;
      document.getElementById('cofkaWynikCzas').textContent = formatZegara(przerwanieSekundy);
      // Gra przy linku "przerwij" odlicza czas do zamkniecia okna anulowania, a
      // nie czas od wyslania - pokazujemy dokladnie te wartosc, zeby dalo sie
      // kliknac na dopasowanie licznikow, bez przeliczania w glowie.
      document.getElementById('cofkaTrwanie').textContent = formatOdliczania(koniecOkna - przerwanieSekundy);
      document.getElementById('cofkaWynikBlok').style.display = 'block';

      const komunikaty = [];
      if (!wynik.parzysta) {
        komunikaty.push('Odstęp ' + wynik.roznicaSekund + 's jest nieparzysty — trafienie co do sekundy niemożliwe, wynik skrócony o 1s.');
      }
      if (przerwanieSekundy > koniecOkna) {
        komunikaty.push('Ten moment wypada po zamknięciu okna przerwania (' + formatZegara(koniecOkna) + ') — tego powrotu nie da się ustawić.');
      } else if (przerwanieSekundy <= terazSekundyGry()) {
        komunikaty.push('Ten moment już minął — wpisz późniejszy czas powrotu.');
      }
      document.getElementById('cofkaOstrzezenie').textContent = komunikaty.join(' ');

      ustawStatus('Policzono.');
      odswiezOdliczanie();
      if (licznik) clearInterval(licznik);
      licznik = setInterval(odswiezOdliczanie, 250);
    });
  })();
}
