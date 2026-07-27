// test/wioska-strona.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujPlan } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { podsumowanieHTML } from '../src/wioska/strona.js';

test('podsumowanie podaje laczny czas i sumy surowcow', () => {
  const w = symuluj(normalizujPlan({
    swiat: 'pl231',
    kroki: [{ budynek: 'tartak', doPoziomu: 1 }, { budynek: 'cegielnia', doPoziomu: 1 }],
  }));
  const html = podsumowanieHTML(w);
  assert.match(html, /Łączny czas/);
  assert.match(html, /115/);
});
