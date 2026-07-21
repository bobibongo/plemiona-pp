// test/rates-panel.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panelHTML, PANEL_ID, PANEL_CSS } from '../src/rates-panel.js';

const r = (continent, wood, stone, iron, at = '2026-07-21T14:30:00') =>
  ({ continent, x: 1, y: 2, wood, stone, iron, at });

test('panelHTML pokazuje wiersz na kontynent z trzema kursami', () => {
  const html = panelHTML({ readings: [r('K64', 378, 372, 406)] });
  assert.match(html, /K64/);
  assert.match(html, /378/);
  assert.match(html, /372/);
  assert.match(html, /406/);
});

test('panelHTML ma nagłówki kolumn surowców', () => {
  const html = panelHTML({ readings: [] });
  assert.match(html, /Drewno/);
  assert.match(html, /Glina/);
  assert.match(html, /Żelazo/);
});

test('panelHTML podświetla wiersz właśnie zaktualizowany', () => {
  const html = panelHTML({ readings: [r('K64', 1, 2, 3), r('K45', 4, 5, 6)], justUpdated: 'K45' });
  const wiersze = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g);
  const k45 = wiersze.find(w => w.includes('K45'));
  const k64 = wiersze.find(w => w.includes('K64'));
  assert.match(k45, /kp-hit/);
  assert.doesNotMatch(k64, /kp-hit/);
});

test('panelHTML blokuje eksport przy pustej pamięci', () => {
  assert.match(panelHTML({ readings: [] }), /data-act="export"[^>]*disabled/);
  assert.doesNotMatch(panelHTML({ readings: [r('K64', 1, 2, 3)] }), /data-act="export"[^>]*disabled/);
});

test('panelHTML pokazuje ostrzeżenie, gdy jest', () => {
  const html = panelHTML({ readings: [], warning: 'Nie rozpoznano kontynentu' });
  assert.match(html, /Nie rozpoznano kontynentu/);
});

test('panelHTML zwinięty pokazuje sam pasek, bez tabeli', () => {
  const html = panelHTML({ readings: [r('K64', 378, 372, 406)], collapsed: true });
  assert.doesNotMatch(html, /<table/);
  assert.match(html, /Kursy giełdy/);
});

test('panelHTML odmienia liczbę kontynentów po polsku', () => {
  assert.match(panelHTML({ readings: [r('K1', 1, 2, 3)] }), /1 kontynent\b/);
  assert.match(panelHTML({ readings: [r('K1', 1, 2, 3), r('K2', 1, 2, 3)] }), /2 kontynenty\b/);
  const piec = ['K1', 'K2', 'K3', 'K4', 'K5'].map(c => r(c, 1, 2, 3));
  assert.match(panelHTML({ readings: piec }), /5 kontynentów\b/);
});

test('panelHTML nie wpuszcza surowego HTML z odczytu', () => {
  const html = panelHTML({ readings: [r('<img src=x>', 1, 2, 3)] });
  assert.doesNotMatch(html, /<img src=x>/);
  assert.match(html, /&lt;img/);
});

test('panelHTML pokazuje pole do ręcznego skopiowania, gdy schowek zawiódł', () => {
  const html = panelHTML({ readings: [r('K64', 1, 2, 3)], manual: '{"world":"pl231"}' });
  assert.match(html, /<textarea/);
  assert.match(html, /pl231/);
  assert.match(html, /Ctrl\+C/);
});

test('panelHTML bez awarii schowka nie pokazuje pola tekstowego', () => {
  assert.doesNotMatch(panelHTML({ readings: [r('K64', 1, 2, 3)] }), /<textarea/);
});

test('panel ma własne style i stały identyfikator', () => {
  assert.equal(typeof PANEL_ID, 'string');
  assert.match(PANEL_CSS, new RegExp('#' + PANEL_ID));
});
