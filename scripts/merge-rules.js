#!/usr/bin/env node
// Merges Consent-O-Matic's individual rule files + base Rules.json into one BundledRules.json
// Run before build to refresh the bundled CMP ruleset.
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const root = path.resolve(__dirname, '..');
const comDir = path.join(root, 'Consent-O-Matic');
const merged = {};

// Base Rules.json
try {
  const base = JSON.parse(fs.readFileSync(path.join(comDir, 'Rules.json'), 'utf8'));
  for (const [k, v] of Object.entries(base)) {
    if (k !== '$schema' && k !== 'references') merged[k] = v;
  }
} catch (e) {
  console.warn('No base Rules.json:', e.message);
}

// Individual rule files
const files = glob.sync(path.join(comDir, 'rules', '*.json'));
let count = 0;
for (const f of files) {
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const [k, v] of Object.entries(d)) {
      if (k !== '$schema' && k !== 'references' && !(k in merged)) {
        merged[k] = v;
        count++;
      }
    }
  } catch (e) {
    console.warn(`Skipping ${path.basename(f)}: ${e.message}`);
  }
}

const out = path.join(comDir, 'BundledRules.json');
fs.writeFileSync(out, JSON.stringify(merged));
console.log(`Merged ${Object.keys(merged).length} CMPs (${count} from rules/) -> ${out} (${Math.round(fs.statSync(out).size/1024)}KB)`);
