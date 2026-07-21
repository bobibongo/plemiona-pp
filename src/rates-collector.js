// src/rates-collector.js
// Punkt wejścia userscriptu. Budzi się przy każdym wejściu na ekran giełdy
// premium, czyta to, co strona już wyświetliła, i odświeża panel.
//
// Ten plik nie wysyła i nie może wysyłać żadnego zapytania — patrz test
// „userscript nie wykonuje żadnych zapytań sieciowych" w test/build.test.js.

import { readReading } from './rates-parse.js';
import { worldFromHost, storageKey, mergeReading } from './rates-store.js';
import { mountPanel } from './rates-panel.js';

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  (function () {
    const reading = readReading(document);
    if (!reading) return;              // inny ekran — panelu nie pokazujemy

    const world = worldFromHost(location.hostname);
    const key = storageKey(world);

    let readings = [];
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(raw)) readings = raw;
    } catch { readings = []; }         // popsuty magazyn zaczynamy od zera

    // mergeReading sam odrzuci odczyt bez kontynentu, żeby nie nadpisał
    // niewłaściwego wiersza. Gracz dowiaduje się o tym z panelu.
    const warning = reading.continent
      ? null
      : 'Nie rozpoznano kontynentu — tego odczytu nie zapisano.';

    readings = mergeReading(readings, reading);
    try { localStorage.setItem(key, JSON.stringify(readings)); } catch { /* pełny magazyn */ }

    mountPanel({ readings, justUpdated: reading.continent, warning, world, key });
  })();
}
