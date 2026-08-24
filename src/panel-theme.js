// src/panel-theme.js
// Wspolny motyw wizualny dla wszystkich paneli wstrzykiwanych w gre (Zbieractwo,
// Handlarz PP, Kalkulator cofki, kolejne narzedzia). "Sztab dowodzenia" — zimny,
// techniczny HUD (stal/cyjan/bursztyn), scięte narozniki, monospace na liczbach.
// Celowo mocno kontrastuje z pergaminowo-brazowym tlem gry, zeby kazdy panel byl
// natychmiast rozpoznawalny jako osobne narzedzie, nie reskin gry.

export function panelMotywCSS(idPanelu) {
  return `
  #${idPanelu} { position: fixed; z-index: 500; width: 340px;
    background: #12181a; color: #d8e0e0; border: 1px solid #2a3436;
    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
    font-family: 'JetBrains Mono', 'Consolas', ui-monospace, monospace; font-size: 12px;
    box-shadow: 0 0 0 1px #000, 0 20px 40px -10px rgba(0,0,0,.65); }
  #${idPanelu} h3 { margin: 0; padding: 10px 14px;
    background: linear-gradient(90deg, rgba(255,140,26,.14), transparent 65%);
    color: #ff8c1a; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em;
    font-family: 'Rajdhani', 'JetBrains Mono', sans-serif;
    border-bottom: 1px solid #2a3436;
    display: flex; justify-content: space-between; align-items: center;
    cursor: move; user-select: none; }
  #${idPanelu} .pm-body { padding: 14px; }
  #${idPanelu} .pm-sekcja { margin-bottom: 12px; }
  #${idPanelu} .pm-etykieta { display: block; margin-bottom: 4px; font-size: 10px;
    text-transform: uppercase; letter-spacing: .1em; color: #7f9494; }
  #${idPanelu} input[type=number], #${idPanelu} input[type=text] { box-sizing: border-box;
    background: #0c1113; color: #d8e0e0; border: 1px solid #2a3436; border-radius: 2px; padding: 7px;
    font-family: inherit; }
  #${idPanelu} input:focus-visible { outline: 1px solid #3ad6b8; outline-offset: 1px; }
  #${idPanelu} input:disabled { opacity: .4; }
  #${idPanelu} .pm-grupa { display: flex; gap: 6px; }
  #${idPanelu} .pm-grupa button { flex: 1; padding: 8px 6px; font-size: 11px; }
  #${idPanelu} button { border: 1px solid #33403f; border-radius: 2px; cursor: pointer;
    background: #1a2224; color: #d8e0e0; font-family: inherit; font-size: 11px;
    text-transform: uppercase; letter-spacing: .06em; opacity: .88; transition: opacity .1s, background .1s, border-color .1s; }
  #${idPanelu} button:hover { opacity: 1; background: #212b2d; border-color: #445251; }
  #${idPanelu} button:focus-visible { outline: 1px solid #3ad6b8; outline-offset: 1px; }
  #${idPanelu} button.pm-aktywny { opacity: 1; font-weight: 700; background: #ff8c1a; color: #0a0e0f; border-color: #ff8c1a; }
  #${idPanelu} button.pm-ok { background: #16332a; border-color: #2d5a46; color: #7fe0bd; }
  #${idPanelu} button.pm-ok:hover { background: #1c4636; }
  #${idPanelu} button.pm-ok.pm-aktywny { background: #3ad6b8; color: #0a0e0f; border-color: #3ad6b8; }
  #${idPanelu} button.pm-danger { background: #3a1a18; border-color: #5a2e2a; color: #f0a294; }
  #${idPanelu} button.pm-danger:hover { background: #4a221f; }
  #${idPanelu} button.pm-danger.pm-aktywny { background: #d9553f; color: #0a0e0f; border-color: #d9553f; }
  #${idPanelu} .pm-status { margin-top: 10px; font-size: 11px; color: #7f9494; min-height: 14px; line-height: 1.4; }
  #${idPanelu} .pm-x { cursor: pointer; background: transparent; color: #7f9494; border: 1px solid #33403f;
    border-radius: 2px; padding: 1px 7px; opacity: 1; font-weight: 400; }
  #${idPanelu} .pm-x:hover { background: #3a1a18; color: #f0a294; border-color: #5a2e2a; }
  `;
}

export function panelNaglowekHTML(idPanelu, idZamknij, tytul) {
  return '<h3>' + tytul + ' <span class="pm-x" id="' + idZamknij + '">x</span></h3>';
}

export function usunIstniejacyPanel(idPanelu) {
  const istniejacy = document.getElementById(idPanelu);
  if (istniejacy) istniejacy.remove();
}

export function wstrzyknijStylPanelu(idStylu, css) {
  const istniejacy = document.getElementById(idStylu);
  if (istniejacy) istniejacy.remove();
  document.head.insertAdjacentHTML('beforeend', '<style id="' + idStylu + '">' + css + '</style>');
}

// Domyslna pozycja startowa panelu, gdy nic nie zapisano jeszcze w localStorage.
export const POZYCJA_STARTOWA = { top: 120, right: 20 };

export function wlaczPrzeciaganiePanelu(idPanelu, idZamknij, kluczPozycji, storage) {
  const panel = document.getElementById(idPanelu);
  const uchwyt = panel.querySelector('h3');

  panel.style.top = POZYCJA_STARTOWA.top + 'px';
  panel.style.right = POZYCJA_STARTOWA.right + 'px';

  const zapisana = storage.getItem(kluczPozycji);
  if (zapisana) {
    try {
      const pozycja = JSON.parse(zapisana);
      panel.style.top = pozycja.top + 'px';
      panel.style.left = pozycja.left + 'px';
      panel.style.right = 'auto';
    } catch (e) { /* ignorujemy uszkodzony zapis pozycji */ }
  }

  let przeciagane = false;
  let offsetX = 0;
  let offsetY = 0;

  uchwyt.addEventListener('mousedown', function (event) {
    if (event.target.id === idZamknij) return;
    przeciagane = true;
    const prostokat = panel.getBoundingClientRect();
    offsetX = event.clientX - prostokat.left;
    offsetY = event.clientY - prostokat.top;
    panel.style.left = prostokat.left + 'px';
    panel.style.top = prostokat.top + 'px';
    panel.style.right = 'auto';
    event.preventDefault();
  });

  document.addEventListener('mousemove', function (event) {
    if (!przeciagane) return;
    panel.style.left = (event.clientX - offsetX) + 'px';
    panel.style.top = (event.clientY - offsetY) + 'px';
  });

  document.addEventListener('mouseup', function () {
    if (!przeciagane) return;
    przeciagane = false;
    storage.setItem(kluczPozycji, JSON.stringify({
      left: parseInt(panel.style.left, 10),
      top: parseInt(panel.style.top, 10),
    }));
  });
}
