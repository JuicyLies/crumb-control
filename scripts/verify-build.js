#!/usr/bin/env node
/**
 * verify-build.js — validate that a built extension is actually loadable.
 *
 * Catches the failure mode where webpack reports "compiled successfully"
 * (JS bundling OK) while assets referenced by manifest.json were never
 * copied — producing a zip that Chrome refuses to load.
 *
 * Usage: node scripts/verify-build.js <dist-dir>
 * Exit:  0 = all referenced files present, 1 = something missing
 */

const fs = require('fs');
const path = require('path');

const distDir = process.argv[2];

if (!distDir) {
  console.error('Usage: node scripts/verify-build.js <dist-dir>');
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.error(`FAIL: dist directory not found: ${distDir}`);
  process.exit(1);
}

const manifestPath = path.join(distDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`FAIL: manifest.json not found in ${distDir}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error(`FAIL: manifest.json is not valid JSON — ${e.message}`);
  process.exit(1);
}

// Collect every file path the manifest points at
const refs = new Set();

if (manifest.action?.default_popup) refs.add(manifest.action.default_popup);
if (manifest.options_ui?.page) refs.add(manifest.options_ui.page);
if (manifest.background?.service_worker) refs.add(manifest.background.service_worker);
for (const s of manifest.background?.scripts ?? []) refs.add(s);

for (const cs of manifest.content_scripts ?? []) {
  for (const j of cs.js ?? []) refs.add(j);
  for (const c of cs.css ?? []) refs.add(c);
}

for (const icon of Object.values(manifest.icons ?? {})) refs.add(icon);
for (const icon of Object.values(manifest.action?.default_icon ?? {})) refs.add(icon);

for (const r of manifest.declarative_net_request?.rule_resources ?? []) {
  if (r.path) refs.add(r.path);
}

for (const war of manifest.web_accessible_resources ?? []) {
  for (const res of war.resources ?? []) {
    if (!res.includes('*')) refs.add(res);
  }
}

// Verify each one exists on disk
const missing = [];
const present = [];

for (const ref of [...refs].sort()) {
  const full = path.join(distDir, ref);
  if (fs.existsSync(full)) {
    present.push(ref);
  } else {
    missing.push(ref);
  }
}

console.log(`Verifying ${distDir} (manifest_version ${manifest.manifest_version}, v${manifest.version})`);
console.log('');

for (const p of present) console.log(`  OK    ${p}`);
for (const m of missing) console.log(`  MISS  ${m}`);

console.log('');

if (missing.length > 0) {
  console.error(`FAIL: ${missing.length} file(s) referenced by manifest.json are missing from the build.`);
  console.error('The extension would fail to load. Check the CopyPlugin patterns in webpack.config.js.');
  process.exit(1);
}

console.log(`PASS: all ${present.length} manifest-referenced files present.`);
process.exit(0);