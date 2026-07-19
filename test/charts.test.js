// test/charts.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barChartSVG, lineChartSVG } from '../src/charts.js';

test('barChartSVG zwraca svg z tyloma słupkami ile pozycji', () => {
  const svg = barChartSVG([{ label: 'a', value: 10 }, { label: 'b', value: -5 }]);
  assert.match(svg, /^<svg/);
  assert.match(svg, /<\/svg>$/);
  assert.equal((svg.match(/<rect/g) || []).length >= 2, true);
});

test('barChartSVG pusty = komunikat', () => {
  assert.match(barChartSVG([]), /brak danych/);
});

test('lineChartSVG rysuje polyline dla >=2 punktów', () => {
  const svg = lineChartSVG([{ x: '2026-07-18', y: 1 }, { x: '2026-07-19', y: 3 }]);
  assert.match(svg, /<(polyline|path)/);
});
