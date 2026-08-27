import { chromium } from 'playwright-core';
import { PROBE, UA } from './banner-lib.mjs';
import fs from 'fs';

const SITES = [
  'https://www.repubblica.it','https://www.corriere.it','https://www.ansa.it',
  'https://www.gazzetta.it','https://www.ilsole24ore.com','https://www.lastampa.it',
  'https://www.ilfattoquotidiano.it','https://www.tgcom24.mediaset.it',
  'https://www.lemonde.fr','https://www.spiegel.de','https://www.elmundo.es',
  'https://www.bbc.co.uk'
];

const out = [];
for (const url of SITES) {
  const ctx = await chromium.launchPersistentContext('', {
    headless:false, channel:'chromium',
    args:['--no-sandbox','--disable-dev-shm-usage','--headless=new'],
    userAgent: UA, locale:'it-IT', viewport:{width:1280,height:900}
  });
  const p = await ctx.newPage();
  let rec = { url, error:null };
  try {
    await p.goto(url, { waitUntil:'domcontentloaded', timeout:45000 });
    await p.waitForTimeout(6000);           // let CMP scripts inject
    rec.probe = await p.evaluate(PROBE);
  } catch (e) { rec.error = e.message.slice(0,90); }
  out.push(rec);
  console.log(`${rec.error?'ERR ':'    '}${url} -> ${rec.probe? rec.probe.count+' banner(s)':rec.error}`);
  await ctx.close();
}
fs.writeFileSync('/opt/data/browser-env/baseline.json', JSON.stringify(out,null,1));
console.log('\nBASELINE DONE');
