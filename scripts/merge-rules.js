#!/usr/bin/env node
// Merges Consent-O-Matic's individual rule files + base Rules.json into one BundledRules.json
// Run before build to refresh the bundled CMP ruleset.
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const root = path.resolve(__dirname, '..');
const comDir = path.join(root, 'Consent-O-Matic');
const merged = {};

// Keys that are metadata, not CMP definitions
const META_KEYS = new Set(['$schema', 'references', '_comment']);
const isMeta = (k) => META_KEYS.has(k) || k.startsWith('_');

// Base Rules.json
try {
  const base = JSON.parse(fs.readFileSync(path.join(comDir, 'Rules.json'), 'utf8'));
  for (const [k, v] of Object.entries(base)) {
    if (!isMeta(k)) merged[k] = v;
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
      if (!isMeta(k) && !(k in merged)) {
        merged[k] = v;
        count++;
      }
    }
  } catch (e) {
    console.warn(`Skipping ${path.basename(f)}: ${e.message}`);
  }
}

// Crumb Control's own supplementary rules (rules-extra/).
// Loaded LAST so upstream definitions always win — these only fill gaps,
// primarily non-English / Italian banners that upstream doesn't cover.
const extraFiles = glob.sync(path.join(root, 'rules-extra', '*.json'));
let extraCount = 0;
for (const f of extraFiles) {
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const [k, v] of Object.entries(d)) {
      if (isMeta(k)) continue;
      if (k in merged) {
        console.warn(`  rules-extra: "${k}" already defined upstream, keeping upstream version`);
        continue;
      }
      // Strip our own annotation keys from the rule body
      if (v && typeof v === 'object') delete v._comment;
      merged[k] = v;
      extraCount++;
    }
  } catch (e) {
    console.warn(`Skipping ${path.basename(f)}: ${e.message}`);
  }
}

const out = path.join(comDir, 'BundledRules.json');
fs.writeFileSync(out, JSON.stringify(merged));
console.log(
  `Merged ${Object.keys(merged).length} CMPs ` +
  `(${count} from rules/, ${extraCount} from rules-extra/) ` +
  `-> ${out} (${Math.round(fs.statSync(out).size / 1024)}KB)`
);
