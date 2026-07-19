// test/build.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboard, buildBookmarklet } from '../build.js';

test('dashboard nie zawiera markerów ani importów', () => {
  const html = buildDashboard();
  assert.doesNotMatch(html, /INJECT:/);
  assert.doesNotMatch(html, /^\s*import\s/m);
  assert.doesNotMatch(html, /^\s*export\s/m);
  assert.match(html, /barChartSVG/); // logika obecna
});

test('bookmarklet jest jedną linią javascript:', () => {
  const bm = buildBookmarklet();
  assert.match(bm, /^javascript:/);
  assert.doesNotMatch(bm, /\bimport\b/);
  assert.doesNotMatch(bm, /\n/);
});
