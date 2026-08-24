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
    // Hierarchia: godzina przerwania jest najwazniejsza, zaraz pod nia licznik
    // "przerwij" do dopasowania z gra. Odliczanie i dane rozkazu sa pomocnicze.
    const STYL_WLASNY = `
    #cofkaPanel .pm-pole { width: 100%; box-sizing: border-box; text-align: center; font-size: 16px; letter-spacing: .05em; }

    #cofkaPanel .rozkaz { display: flex; justify-content: space-between; gap: 8px;
      padding: 7px 9px; margin-bottom: 12px; background: #0c1113; border: 1px solid #2a3436; border-radius: 2px;
      font-size: 11px; color: #7f9494; }
    #cofkaPanel .rozkaz div { display: flex; flex-direction: column; gap: 2px; }
    #cofkaPanel .rozkaz .etykieta { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: #5f7272; }
    #cofkaPanel .rozkaz .wartosc { color: #d8e0e0; font-weight: 700; font-size: 12px; }
    #cofkaPanel .rozkaz.brak { color: #d9553f; justify-content: center; border-color: #5a2e2a; background: #23100e; }

    #cofkaPanel .karta-wyniku { margin-top: 12px; border: 1px solid #2d5a46; border-radius: 2px;
      background: linear-gradient(#0f1a17, #0c1113); overflow: hidden; }
    #cofkaPanel .glowny { padding: 12px 10px 14px; text-align: center;
      border-bottom: 1px dashed #24403a; }
    #cofkaPanel .glowny .etykieta { display: block; font-size: 10px; text-transform: uppercase;
      letter-spacing: .12em; color: #7f9494; margin-bottom: 6px; }
    #cofkaPanel .glowny .godzina { font-size: 38px; line-height: 1; font-weight: 700; color: #3ad6b8;
      letter-spacing: .02em; text-shadow: 0 0 18px rgba(58,214,184,.4); }

    #cofkaPanel .moment { padding: 11px 10px 12px; text-align: center; }
    #cofkaPanel .moment .etykieta { display: block; font-size: 10px; text-transform: uppercase;
      letter-spacing: .12em; color: #7f9494; margin-bottom: 5px; }
    #cofkaPanel .moment .licznik { font-size: 22px; font-weight: 700; color: #ff8c1a;
      letter-spacing: .02em; }

    #cofkaPanel .pozostalo { display: flex; justify-content: space-between; align-items: baseline;
      margin-top: 10px; font-size: 11px; color: #7f9494; }
    #cofkaPanel .pozostalo .odliczanie { font-size: 14px; font-weight: 700; color: #d8e0e0; }
    #cofkaPanel .pozostalo .odliczanie.teraz { color: #d9553f; animation: cofkaMignij 1s infinite; }
    @keyframes cofkaMignij { 50% { opacity: .3; } }

    #cofkaPanel .ostrzezenie { color: #ff8c1a; font-size: 11px; margin-top: 8px; text-align: center; line-height: 1.5; }
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
    // blad przy trafianiu w sekunde.
    //
    // #serverTime pokazuje pelne sekundy, wiec sam odczyt nie mowi, w ktorym
    // miejscu sekundy jestesmy - to daje +-1s niepewnosci. Zamiast zgadywac,
    // obserwujemy MOMENT PRZESKOKU tego elementu: gdy gra zmieni tekst, wiemy,
    // ze wlasnie zaczela sie ta sekunda serwera, i mozemy zgrac zegary co do
    // milisekund. Do pierwszego przeskoku dzialamy na zgrubnym oszacowaniu.
    function odczytajCzasSerwera() {
      const czasEl = document.getElementById('serverTime');
      const dataEl = document.getElementById('serverDate');
      if (!czasEl || !dataEl) return null;
      const czas = czasEl.textContent.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})/);
      const data = dataEl.textContent.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!czas || !data) return null;
      return Date.UTC(
        Number(data[3]), Number(data[2]) - 1, Number(data[1]),
        Number(czas[1]), Number(czas[2]), Number(czas[3])
      ) / 1000;
    }

    function ustawDryf(sekundySerwera, momentOdczytu) {
      const lokalny = momentOdczytu / 1000 + przesuniecieStrefy;
      const nowy = sekundySerwera - lokalny;
      // Powyzej doby to nie dryf tylko zla data - wtedy lepiej nie korygowac nic.
      if (Math.abs(nowy) >= 24 * 3600) return;
      // Dryf zegara zmienia sie powoli, wiec nagly skok o sekundy to nie realna
      // korekta tylko zly odczyt (gra potrafi chwilowo przerysowac #serverTime
      // stara wartoscia). Pierwszy pomiar przyjmujemy bez zastrzezen.
      if (dryfZgranyNaPrzeskoku && Math.abs(nowy - dryfZegara) > 2) return;
      dryfZegara = nowy;
    }

    let dryfZegara = 0;
    let dryfZgranyNaPrzeskoku = false;

    // Zgrubny start: zakladamy srodek biezacej sekundy (blad do +-0.5 s).
    const czasPoczatkowy = odczytajCzasSerwera();
    if (czasPoczatkowy != null) ustawDryf(czasPoczatkowy + 0.5, Date.now());

    function terazSekundyGry() {
      return Date.now() / 1000 + przesuniecieStrefy + dryfZegara;
    }

    const html = `
    <div id="cofkaPanel">
      <h3>Kalkulator cofki <span class="pm-x" id="cofkaClose">x</span></h3>
      <div class="pm-body">
        <div class="rozkaz" id="cofkaRozkaz"></div>
        <div class="pm-sekcja">
          <span class="pm-etykieta">Docelowy czas powrotu</span>
          <input type="text" id="cofkaCel" class="pm-pole" placeholder="GG:MM:SS:mmm">
        </div>
        <button id="cofkaPolicz" class="pm-ok">Policz</button>
        <div class="karta-wyniku" id="cofkaWynikBlok" style="display:none">
          <div class="glowny">
            <span class="etykieta">Przerwij atak o czasie</span>
            <span class="godzina" id="cofkaWynikCzas"></span>
          </div>
          <div class="moment">
            <span class="etykieta">w momencie gdy zobaczysz</span>
            <span class="licznik" id="cofkaTrwanie"></span>
          </div>
        </div>
        <div class="pozostalo" id="cofkaPozostalo" style="display:none">
          <span>Do cofnięcia pozostało</span>
          <span class="odliczanie" id="cofkaOdliczanie"></span>
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

    const rozkazEl = document.getElementById('cofkaRozkaz');
    const przyciskPolicz = document.getElementById('cofkaPolicz');
    const koniecOkna = startSekundy != null ? koniecOknaPrzerwania(startSekundy, przybycieSekundy) : null;

    function polePodsumowania(etykieta, wartosc) {
      return '<div><span class="etykieta">' + etykieta + '</span>'
        + '<span class="wartosc">' + wartosc + '</span></div>';
    }

    if (startSekundy == null) {
      rozkazEl.className = 'rozkaz brak';
      rozkazEl.textContent = 'Rozkazu nie można cofnąć';
      przyciskPolicz.disabled = true;
    } else if (koniecOkna <= terazSekundyGry()) {
      rozkazEl.className = 'rozkaz brak';
      rozkazEl.textContent = 'Okno na przerwanie już minęło';
      przyciskPolicz.disabled = true;
    } else {
      rozkazEl.innerHTML = polePodsumowania('Wysłano o', formatZegara(startSekundy))
        + polePodsumowania('Przerwać do', formatZegara(koniecOkna));
    }

    let przerwanieSekundy = null;
    let licznik = null;

    function odswiezOdliczanie() {
      if (przerwanieSekundy == null) return;
      const el = document.getElementById('cofkaOdliczanie');
      if (!el) return;
      const pozostale = przerwanieSekundy - terazSekundyGry();
      el.textContent = formatOdliczania(pozostale);
      el.classList.toggle('teraz', pozostale <= 0);
    }

    // Dokladne zgranie zegara na pierwszym przeskoku #serverTime. Tworzymy
    // obserwator dopiero tutaj, bo w callbacku odswiezamy juz gotowy panel.
    const czasSerweraEl = document.getElementById('serverTime');
    if (czasSerweraEl && typeof window.MutationObserver === 'function') {
      const obserwator = new window.MutationObserver(function () {
        const sekundy = odczytajCzasSerwera();
        if (sekundy == null) return;
        // Tekst wlasnie sie zmienil, czyli ta sekunda serwera zaczyna sie teraz.
        ustawDryf(sekundy, Date.now());
        dryfZgranyNaPrzeskoku = true;
        odswiezOdliczanie();
      });
      obserwator.observe(czasSerweraEl, { childList: true, characterData: true, subtree: true });
    }

    przyciskPolicz.addEventListener('click', function () {
      if (startSekundy == null) return;
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
      document.getElementById('cofkaTrwanie').textContent = 'przerwij (' + formatOdliczania(koniecOkna - przerwanieSekundy) + ')';
      document.getElementById('cofkaWynikBlok').style.display = 'block';
      document.getElementById('cofkaPozostalo').style.display = 'flex';

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

      ustawStatus(dryfZgranyNaPrzeskoku
        ? 'Zegar zgrany z serwerem.'
        : 'Zegar zgrywa się z serwerem — dokładność ±1s do pierwszego tyknięcia.');
      odswiezOdliczanie();
      if (licznik) clearInterval(licznik);
      licznik = setInterval(odswiezOdliczanie, 250);
    });
  })();
}
