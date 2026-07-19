// test/merge.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeMerge } from '../src/merge.js';

const mk = (ts, info, change = -10, world = 'Świat 231') =>
  ({ ts, world, change, info, category: 'usluga' });

test('scala i usuwa duplikaty po kluczu', () => {
  const a = [mk('2026-07-19T11:13:00.000Z', 'X'), mk('2026-07-18T10:00:00.000Z', 'Y')];
  const b = [mk('2026-07-19T11:13:00.000Z', 'X'), mk('2026-07-20T09:00:00.000Z', 'Z')];
  const out = dedupeMerge(a, b);
  assert.equal(out.length, 3);
});

test('sortuje malejąco po ts', () => {
  const out = dedupeMerge([mk('2026-07-18T10:00:00.000Z', 'Y')],
                          [mk('2026-07-20T09:00:00.000Z', 'Z')]);
  assert.equal(out[0].info, 'Z');
  assert.equal(out[1].info, 'Y');
});

test('nie mutuje wejścia', () => {
  const a = [mk('2026-07-18T10:00:00.000Z', 'Y')];
  const b = [mk('2026-07-20T09:00:00.000Z', 'Z')];
  dedupeMerge(a, b);
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
});
