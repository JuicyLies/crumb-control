#!/usr/bin/env node
/**
 * Verifies the language-tolerant matcher logic against the real-world cases
 * that were silently failing on non-English (esp. Italian) cookie banners.
 *
 * Run: node scripts/test-matcher.js
 */

// Mirror of the normaliser injected by patch-matcher.js
function normalize(str) {
  if (str == null) return '';
  return String(str)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u00B4\u0060]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\s\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]+/g, ' ')
    .trim()
    .toLowerCase();
}

// The OLD behaviour, for comparison
function oldMatch(pageText, ruleText) {
  const re = /\s{2,}/gm;
  return pageText.toLowerCase().replace(re, ' ')
    .indexOf(ruleText.toLowerCase().replace(re, ' ')) !== -1;
}

function newMatch(pageText, ruleText) {
  return normalize(pageText).indexOf(normalize(ruleText)) !== -1;
}

const cases = [
  {
    name: 'IT curly vs straight apostrophe (real iubenda rule text)',
    rule: 'Miglioramento dell\u2019esperienza',
    page: "Miglioramento dell'esperienza",
    want: true
  },
  {
    name: 'IT straight rule vs curly page',
    rule: "Miglioramento dell'esperienza",
    page: 'Miglioramento dell\u2019esperienza',
    want: true
  },
  {
    name: 'IT accented -> unaccented',
    rule: 'Funzionalit\u00e0',
    page: 'Funzionalita',
    want: true
  },
  {
    name: 'IT NFD decomposed accent',
    rule: 'Pubblicit\u00e0',
    page: 'Pubblicita\u0300',
    want: true
  },
  {
    name: 'IT non-breaking space',
    rule: 'Targeting e Pubblicit\u00e0',
    page: 'Targeting\u00a0e\u00a0Pubblicit\u00e0',
    want: true
  },
  {
    name: 'DE umlaut',
    rule: 'Auswahl best\u00e4tigen',
    page: 'Auswahl bestatigen',
    want: true
  },
  {
    name: 'FR accents + apostrophe',
    rule: "Continuer sans accepter",
    page: 'Continuer\u00a0sans\u00a0accepter',
    want: true
  },
  {
    name: 'ES tilde',
    rule: 'Configuraci\u00f3n',
    page: 'Configuracion',
    want: true
  },
  {
    name: 'EN unchanged (regression guard)',
    rule: 'Accept all',
    page: 'Accept all cookies',
    want: true
  },
  {
    name: 'Genuine non-match must stay non-matching',
    rule: 'Accept all',
    page: 'Reject everything',
    want: false
  },
  {
    name: 'Different words that normalise close but differ',
    rule: 'Marketing',
    page: 'Analytics and measurement',
    want: false
  }
];

let pass = 0, fail = 0, fixed = 0;

console.log('\n  case                                                  old    new   expect');
console.log('  ' + '-'.repeat(76));

for (const c of cases) {
  const o = oldMatch(c.page, c.rule);
  const n = newMatch(c.page, c.rule);
  const ok = n === c.want;

  if (ok) pass++; else fail++;
  if (!o && n && c.want) fixed++;

  console.log(
    '  ' + c.name.padEnd(52) +
    String(o).padEnd(7) + String(n).padEnd(6) + String(c.want).padEnd(7) +
    (ok ? '' : '   <-- FAIL')
  );
}

console.log('  ' + '-'.repeat(76));
console.log(`\n  ${pass} passed, ${fail} failed`);
console.log(`  ${fixed} case(s) newly fixed by the patch (old=false -> new=true)\n`);

process.exit(fail === 0 ? 0 : 1);
