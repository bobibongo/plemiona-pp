// test/rates-chart.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratesChartSVG, colorMap, SERIES_COLORS, OTHER_COLOR, escXml } from '../src/rates-chart.js';

const T = (dzien) => Date.parse(`2026-07-${String(dzien).padStart(2, '0')}T10:00:00.000Z`);
const seria = (continent, color, wartosci) =>
  ({ continent, color, points: wartosci.map((y, i) => ({ t: T(20 + i), y })) });

test('colorMap przypisuje kolory w stałej kolejności', () => {
  const m = colorMap(['K45', 'K55', 'K64']);
  assert.equal(m.get('K45'), SERIES_COLORS[0]);
  assert.equal(m.get('K55'), SERIES_COLORS[1]);
  assert.equal(m.get('K64'), SERIES_COLORS[2]);
});

test('colorMap nie generuje nowych barw powyżej palety', () => {
  const duzo = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8'];
  const m = colorMap(duzo);
  assert.equal(m.get('K7'), OTHER_COLOR);
  assert.equal(m.get('K8'), OTHER_COLOR);
});

test('escXml zabezpiecza znaki składni', () => {
  assert.equal(escXml('<a & "b">'), '&lt;a &amp; &quot;b&quot;&gt;');
});

test('rysuje jedną linię na serię', () => {
  const svg = ratesChartSVG([
    seria('K45', '#c0392b', [320, 330, 340]),
    seria('K55', '#1b6cc4', [400, 390, 380]),
  ], { thresholds: { high: 410, low: 300 } });
  assert.equal((svg.match(/<polyline/g) || []).length, 2);
  assert.match(svg, /#c0392b/);
  assert.match(svg, /#1b6cc4/);
});

test('legenda jest zawsze obecna przy wielu seriach — tożsamość nie zależy od koloru', () => {
  const svg = ratesChartSVG([
    seria('K45', '#c0392b', [320, 330]),
    seria('K55', '#1b6cc4', [400, 390]),
  ], { thresholds: { high: 410, low: 300 } });
  assert.match(svg, /K45/);
  assert.match(svg, /K55/);
});

test('linie progów są rysowane przerywaną kreską', () => {
  const svg = ratesChartSVG([seria('K45', '#c0392b', [350, 360])],
    { thresholds: { high: 400, low: 320 } });
  assert.match(svg, /stroke-dasharray/);
  assert.match(svg, /400/);
  assert.match(svg, /320/);
});

test('skala pionowa obejmuje progi, nawet gdy leżą poza danymi', () => {
  const svg = ratesChartSVG([seria('K45', '#c0392b', [350, 355])],
    { thresholds: { high: 900, low: 100 } });
  assert.match(svg, /900/);
  assert.match(svg, /100/);
});

test('brak progów nie wywraca wykresu', () => {
  const svg = ratesChartSVG([seria('K45', '#c0392b', [350, 360])],
    { thresholds: { high: null, low: null } });
  assert.match(svg, /<polyline/);
  assert.doesNotMatch(svg, /stroke-dasharray/);
});

test('pusta historia daje czytelny komunikat zamiast pustych osi', () => {
  assert.match(ratesChartSVG([], { thresholds: {} }), /brak danych/);
  assert.match(ratesChartSVG([{ continent: 'K45', color: '#c0392b', points: [] }], { thresholds: {} }), /brak danych/);
});

test('podpowiedź przywraca rozbicie na surowce, które chowa średnia', () => {
  const rec = { wood: 378, stone: 372, iron: 406 };
  const svg = ratesChartSVG([{ continent: 'K64', color: '#c0392b', points: [{ t: T(20), y: 385, rec }] }],
    { thresholds: {} });
  assert.match(svg, /<title>[^<]*378[^<]*372[^<]*406[^<]*<\/title>/);
  assert.match(svg, /<title>[^<]*K64/);
});

test('podpowiedź działa też bez rozbicia w punkcie', () => {
  const svg = ratesChartSVG([{ continent: 'K64', color: '#c0392b', points: [{ t: T(20), y: 385 }] }],
    { thresholds: {} });
  assert.match(svg, /<title>[^<]*385[^<]*<\/title>/);
});

test('pojedynczy punkt w czasie nie dzieli przez zero', () => {
  const svg = ratesChartSVG([{ continent: 'K45', color: '#c0392b', points: [{ t: T(20), y: 350 }] }],
    { thresholds: {} });
  assert.doesNotMatch(svg, /NaN/);
});
