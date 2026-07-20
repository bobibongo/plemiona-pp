// test/charts.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barChartSVG, lineChartSVG } from '../src/charts.js';

test('barChartSVG zwraca svg ze słupkami i osią (etykiety tekstowe)', () => {
  const svg = barChartSVG([{ label: '2026-07-18', value: 10 }, { label: '2026-07-19', value: -5 }]);
  assert.match(svg, /^<svg/);
  assert.match(svg, /<\/svg>$/);
  assert.ok((svg.match(/<rect/g) || []).length >= 2);
  assert.match(svg, /<text/);            // etykiety osi
});

test('barChartSVG słupki mają dane do dymka', () => {
  const svg = barChartSVG([{ label: '2026-07-18', value: 10 }]);
  assert.match(svg, /data-label="2026-07-18"/);
  assert.match(svg, /data-value="10"/);
});

test('barChartSVG pusty = komunikat', () => {
  assert.match(barChartSVG([]), /brak danych/);
});

test('lineChartSVG rysuje polyline i punkty z danymi', () => {
  const svg = lineChartSVG([{ x: '2026-07-18', y: 1 }, { x: '2026-07-19', y: 3 }]);
  assert.match(svg, /<(polyline|path)/);
  assert.match(svg, /<circle/);
  assert.match(svg, /data-value="3"/);
  assert.match(svg, /<text/);            // osie
});

test('lineChartSVG pusty = komunikat', () => {
  assert.match(lineChartSVG([]), /brak danych/);
});
