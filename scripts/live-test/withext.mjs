import { chromium } from 'playwright-core';
import { PROBE, UA } from './banner-lib.mjs';
import fs from 'fs';

const EXT='/mnt/user/data/Shared/VibeCode/crumb-control/dist/chrome';
const SITES = JSON.parse(fs.readFileSync('/opt/data/browser-env/baseline.json','utf8')).map(r=>r.url);

const out=[];
for (const url of SITES) {
  const ctx = await chromium.launchPersistentContext('', {
    headless:false, channel:'chromium',
    args:['--no-sandbox','--disable-dev-shm-usage','--headless=new',
          `--disable-extensions-except=${EXT}`,`--load-extension=${EXT}`],
    userAgent: UA, locale:'it-IT', viewport:{width:1280,height:900}
  });
  // wait for the extension SW so the content script is definitely registered
  for (let i=0;i<20 && ctx.serviceWorkers().length===0;i++) await new Promise(r=>setTimeout(r,250));

  const p = await ctx.newPage();
  const logs=[];
  p.on('console', m=>{ const t=m.text(); if(t.includes('[UDP]')) logs.push(t.slice(0,120)); });

  let rec={url,error:null,udp:[]};
  try {
    await p.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    await p.waitForTimeout(11000);   // CMP injects, then engine acts
    rec.probe = await p.evaluate(PROBE);
    rec.udp = logs;
  } catch(e){ rec.error=e.message.slice(0,90); }
  out.push(rec);
  const handled = rec.udp.filter(l=>l.includes('Handled CMP'));
  console.log(`${url} -> ${rec.probe?rec.probe.count:'ERR'} banner(s) ${handled.length?'| HANDLED: '+handled[0].slice(0,60):''}`);
  await ctx.close();
}
fs.writeFileSync('/opt/data/browser-env/withext.json',JSON.stringify(out,null,1));
console.log('\nWITH-EXTENSION DONE');
