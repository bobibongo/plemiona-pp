// test/scav.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POZIOMY, NOSNOSC_JEDNOSTKI, walidujKrok, walidujKroki,
  sparsujParametrySwiata, czasZbieractwaSekundy, czasKrokuSekundy, formatCzas,
  losowyOdstep, DOMYSLNE_KROKI, wczytajZapisaneKroki, zapiszKroki,
} from '../src/scav.js';

test('POZIOMY jest zdefiniowana malejaco od 4 do 1', () => {
  assert.deepEqual(POZIOMY, [4, 3, 2, 1]);
});

test('walidujKrok akceptuje poprawny krok', () => {
  assert.deepEqual(walidujKrok({ jednostka: 'light', poziom: 4, liczba: 30 }), []);
});

test('walidujKrok odrzuca nieznana jednostke', () => {
  const bledy = walidujKrok({ jednostka: 'ram', poziom: 4, liczba: 30 });
  assert.ok(bledy.some(b => b.includes('Nieznany typ jednostki')));
});

test('walidujKrok odrzuca nieznany poziom', () => {
  const bledy = walidujKrok({ jednostka: 'light', poziom: 5, liczba: 30 });
  assert.ok(bledy.some(b => b.includes('Nieznany poziom')));
});

test('walidujKrok odrzuca liczbe zero lub ujemna', () => {
  assert.ok(walidujKrok({ jednostka: 'light', poziom: 4, liczba: 0 }).length > 0);
  assert.ok(walidujKrok({ jednostka: 'light', poziom: 4, liczba: -5 }).length > 0);
});

test('walidujKroki wymaga co najmniej jednego kroku', () => {
  assert.ok(walidujKroki([]).length > 0);
});

test('walidujKroki zbiera bledy ze wszystkich krokow', () => {
  const bledy = walidujKroki([
    { jednostka: 'light', poziom: 4, liczba: 30 },
    { jednostka: 'ram', poziom: 4, liczba: 30 },
  ]);
  assert.equal(bledy.length, 1);
});

test('losowyOdstep miesci sie w przedziale [baza, baza+losowosc]', () => {
  for (let i = 0; i < 200; i++) {
    const v = losowyOdstep(1000, 500);
    assert.ok(v >= 1000 && v <= 1500, `wartosc ${v} poza zakresem`);
  }
});

const PRZYKLADOWY_TEKST_SKRYPTU = `
  var screen = new ScavengeMassScreen(
    {"1":{"id":1,"name":"Ambitni amatorzy","loot_factor":0.1,"unlock_cost":{"wood":25,"stone":30,"iron":25},"unlock_duration_seconds":30,"duration_exponent":0.45,"duration_initial_seconds":1800,"duration_factor":1,"premium_cost_exponent":0.44,"prerequisite_option_ids":[],"premium_boost":{"feature":"ScavengingSquadLoot","enabled":true,"loot_factor":1.2,"cost_exponent":0.44}},"2":{"id":2,"name":"Cierpliwi ciulacze","loot_factor":0.25,"unlock_cost":{"wood":250,"stone":300,"iron":250},"unlock_duration_seconds":3600,"duration_exponent":0.45,"duration_initial_seconds":1800,"duration_factor":1,"premium_cost_exponent":0.44,"prerequisite_option_ids":[1],"premium_boost":{"feature":"ScavengingSquadLoot","enabled":true,"loot_factor":1.2,"cost_exponent":0.44}},"3":{"id":3,"name":"Zawodowi zbieracze","loot_factor":0.5,"unlock_cost":{"wood":1000,"stone":1200,"iron":1000},"unlock_duration_seconds":10800,"duration_exponent":0.45,"duration_initial_seconds":1800,"duration_factor":1,"premium_cost_exponent":0.44,"prerequisite_option_ids":[2],"premium_boost":{"feature":"ScavengingSquadLoot","enabled":true,"loot_factor":1.2,"cost_exponent":0.44}},"4":{"id":4,"name":"Specjalisci surowcowi","loot_factor":0.75,"unlock_cost":{"wood":10000,"stone":12000,"iron":10000},"unlock_duration_seconds":21600,"duration_exponent":0.45,"duration_initial_seconds":1800,"duration_factor":1,"premium_cost_exponent":0.44,"prerequisite_option_ids":[3],"premium_boost":{"feature":"ScavengingSquadLoot","enabled":true,"loot_factor":1.2,"cost_exponent":0.44}}},
    []);
`;

test('sparsujParametrySwiata wyciaga loot_factor i parametry duration dla kazdego poziomu', () => {
  const parametry = sparsujParametrySwiata(PRZYKLADOWY_TEKST_SKRYPTU);
  assert.equal(parametry[4].lootFactor, 0.75);
  assert.equal(parametry[1].lootFactor, 0.1);
  assert.equal(parametry[3].durationExponent, 0.45);
  assert.equal(parametry[2].durationInitialSeconds, 1800);
  assert.equal(parametry[1].durationFactor, 1);
});

test('sparsujParametrySwiata zwraca null gdy dane sie nie znajduja', () => {
  assert.equal(sparsujParametrySwiata('brak danych tutaj'), null);
});

test('czasZbieractwaSekundy rosnie wraz z carry', () => {
  const parametryPoziomu = { lootFactor: 0.75, durationExponent: 0.45, durationInitialSeconds: 1800, durationFactor: 1 };
  const t1 = czasZbieractwaSekundy(100, parametryPoziomu);
  const t2 = czasZbieractwaSekundy(1000, parametryPoziomu);
  assert.ok(t2 > t1);
});

test('czasZbieractwaSekundy dla wyzszego poziomu (wiekszy loot_factor) daje dluzszy czas przy tym samym carry', () => {
  // Wyzszy poziom zbiera wiecej surowca na jednostke nosnosci, wiec przy tej
  // samej liczbie jednostek potrzebuje wiecej czasu niz nizszy poziom.
  const carry = 5000;
  const poziom4 = { lootFactor: 0.75, durationExponent: 0.45, durationInitialSeconds: 1800, durationFactor: 1 };
  const poziom1 = { lootFactor: 0.1, durationExponent: 0.45, durationInitialSeconds: 1800, durationFactor: 1 };
  assert.ok(czasZbieractwaSekundy(carry, poziom4) > czasZbieractwaSekundy(carry, poziom1));
});

test('czasKrokuSekundy liczy carry z liczby jednostek i ich nosnosci', () => {
  const parametrySwiata = sparsujParametrySwiata(PRZYKLADOWY_TEKST_SKRYPTU);
  const krok = { jednostka: 'light', poziom: 4, liczba: 30 };
  const oczekiwane = czasZbieractwaSekundy(NOSNOSC_JEDNOSTKI.light * 30, parametrySwiata[4]);
  assert.equal(czasKrokuSekundy(krok, parametrySwiata), oczekiwane);
});

test('czasKrokuSekundy zwraca null gdy brak parametrow swiata dla poziomu', () => {
  assert.equal(czasKrokuSekundy({ jednostka: 'light', poziom: 4, liczba: 30 }, null), null);
  assert.equal(czasKrokuSekundy({ jednostka: 'light', poziom: 4, liczba: 30 }, {}), null);
});

test('formatCzas pokazuje godziny:minuty:sekundy gdy jest co najmniej godzina', () => {
  assert.equal(formatCzas(3661), '1:01:01');
});

test('formatCzas pokazuje minuty:sekundy ponizej godziny', () => {
  assert.equal(formatCzas(90), '1:30');
});

test('formatCzas zwraca kreske dla null/NaN', () => {
  assert.equal(formatCzas(null), '—');
  assert.equal(formatCzas(NaN), '—');
});

function fakeStorage() {
  const dane = {};
  return {
    getItem: k => (k in dane ? dane[k] : null),
    setItem: (k, v) => { dane[k] = v; },
  };
}

test('wczytajZapisaneKroki zwraca domyslne kroki gdy nic nie zapisano', () => {
  const kroki = wczytajZapisaneKroki(fakeStorage());
  assert.deepEqual(kroki, DOMYSLNE_KROKI);
});

test('zapiszKroki i wczytajZapisaneKroki dzialaja w parze', () => {
  const storage = fakeStorage();
  const wlasne = [{ jednostka: 'spear', poziom: 1, liczba: 750 }];
  zapiszKroki(storage, wlasne);
  assert.deepEqual(wczytajZapisaneKroki(storage), wlasne);
});

test('wczytajZapisaneKroki wraca do domyslnych gdy zapisane dane sa uszkodzone', () => {
  const storage = fakeStorage();
  storage.setItem('scavCustomKroki', 'nie-json');
  assert.deepEqual(wczytajZapisaneKroki(storage), DOMYSLNE_KROKI);
});
