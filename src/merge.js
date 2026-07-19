// src/merge.js
import { entryKey } from './parse.js';

export function dedupeMerge(existing, incoming) {
  const byKey = new Map();
  for (const e of incoming) byKey.set(entryKey(e), e);   // incoming jako baza
  for (const e of existing) byKey.set(entryKey(e), e);   // existing nadpisuje (wygrywa)
  return [...byKey.values()].sort((x, y) => (x.ts < y.ts ? 1 : x.ts > y.ts ? -1 : 0));
}
