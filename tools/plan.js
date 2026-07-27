// tools/plan.js
// Uruchomienie symulacji poza przegladarka — ten sam silnik, co na stronie.
// Uzycie:
//   node tools/plan.js plan.json
//   cat plan.json | node tools/plan.js

import { readFileSync } from 'node:fs';
import { normalizujPlan, bledyPlanu } from '../src/wioska/plan.js';
import { symuluj } from '../src/wioska/symulacja.js';
import { osCzasuTekst, planTekst } from '../src/wioska/format.js';

const zrodlo = process.argv[2]
  ? readFileSync(process.argv[2], 'utf8')
  : readFileSync(0, 'utf8');

const plan = normalizujPlan(JSON.parse(zrodlo));
const bledy = bledyPlanu(plan);
if (bledy.length) {
  console.error('Plan jest niepoprawny:');
  for (const b of bledy) console.error(`  • ${b}`);
  process.exit(1);
}

const wynik = symuluj(plan);
console.log(osCzasuTekst(wynik));
console.log('');
console.log(planTekst(plan, wynik));
