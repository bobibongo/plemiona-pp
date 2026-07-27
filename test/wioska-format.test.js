// test/wioska-format.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { czasCzytelny, planJSON, planTekst, osCzasuTekst } from '../src/wioska/format.js';

const p = normalizujPlan({
  swiat: 'pl231',
  kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
});
const w = symuluj(p);

test('czasCzytelny rozbija sekundy na dni, godziny i minuty', () => {
  assert.equal(czasCzytelny(0), '0 min');
  assert.equal(czasCzytelny(90), '1 min');
  assert.equal(czasCzytelny(3600), '1 h 00 min');
  assert.equal(czasCzytelny(90000), '1 d 01 h 00 min');
});

test('planJSON daje sie wczytac z powrotem bez straty', () => {
  const znowu = normalizujPlan(JSON.parse(planJSON(p)));
  assert.deepEqual(znowu, p);
});

test('planTekst wymienia kroki po nazwach widocznych dla gracza', () => {
  const t = planTekst(p, w);
  assert.match(t, /Tartak → 1/);
  assert.match(t, /Cegielnia → 1/);
});

test('planTekst podaje sumy surowcow i laczny czas', () => {
  const t = planTekst(p, w);
  assert.match(t, /115/);              // 50 drewna + 65 drewna
  assert.match(t, /Łączny czas/);
});

test('osCzasuTekst pokazuje przestoj i surowiec, na ktory czekano', () => {
  const wolny = symuluj(normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { spichlerz: 10 }, surowce: { drewno: 0, glina: 0, zelazo: 0 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }],
    dochody: [{ czasS: 0, drewnoH: 60, glinaH: 60, zelazoH: 60 }],
  }));
  assert.match(osCzasuTekst(wolny), /czeka/);
});

test('osCzasuTekst oznacza kroki z poziomow bez pomiaru', () => {
  const niepewny = symuluj(normalizujPlan({
    swiat: 'pl231',
    start: { poziomy: { tartak: 4 }, surowce: { drewno: 999999, glina: 999999, zelazo: 999999 } },
    kroki: [{ budynek: 'tartak', doPoziomu: 5 }],
  }));
  assert.match(osCzasuTekst(niepewny), /≈/);
});
