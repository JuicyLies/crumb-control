// Real Chromium + production extension + a local consent fixture. No third-party test website.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
async function main() {
  const headers=[];
  const server=http.createServer((req,res)=>{
    headers.push({url:req.url,gpc:req.headers['sec-gpc']});
    res.setHeader('Content-Type','text/html');
    res.end(`<!doctype html><title>Consent fixture</title><style>body{font:20px system-ui;padding:60px;background:#eee}#cc-test-banner{padding:30px;border:1px solid #444;background:white}label,button{display:block;margin:20px}</style><h1>Crumb Control consent test</h1><div id="cc-test-banner"><label><input type="checkbox" id="analytics">Analytics</label><button id="save">Save preferences</button></div><p id="result"></p><script>document.querySelector('#save').onclick=()=>{const choice=document.querySelector('#analytics').checked;document.querySelector('#result').textContent=choice?'allowed':'rejected';document.querySelector('#cc-test-banner').remove();};</script>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'crumb-control-browser-'));
  let context;
  try {
    const extension=path.resolve(__dirname,'../dist/chrome');
    context=await chromium.launchPersistentContext(profile,{headless:true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),
      args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--disable-background-networking']});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const errors=[];worker.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
    const rule={fixture:{detectors:[{presentMatcher:[{type:'css',target:{selector:'#cc-test-banner'}}],showingMatcher:[{type:'css',target:{selector:'#cc-test-banner',displayFilter:true}}]}],methods:[
      {name:'DO_CONSENT',action:{type:'consent',consents:[{type:'D',matcher:{type:'checkbox',target:{selector:'#analytics'}},toggleAction:{type:'click',target:{selector:'#analytics'}}}]}},
      {name:'SAVE_CONSENT',action:{type:'click',target:{selector:'#save'}}}
    ]}};
    await worker.evaluate(async rule=>{await chrome.storage.local.set({GDPRCustomRuleLists:rule});},rule);
    const page=await context.newPage();
    const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
    async function configure(policy,disabled=false) {
      await worker.evaluate(async ({policy,disabled})=>{
        await chrome.storage.sync.set({udp_policy:policy,disabledPages:disabled?{'127.0.0.1':true}:{}});
      },{policy,disabled});
    }
    const base={version:1,global:{necessary:'allow',preferences:'reject',analytics:'reject',marketing:'reject',social:'reject',unclassified:'reject'},sites:{},context:{firstParty:{},thirdParty:{}},gpc:{enabled:true,headerName:'Sec-GPC',headerValue:'1'}};
    await configure(base);
    await page.goto(origin+'/default?private=do-not-log');
    await page.waitForFunction(()=>document.querySelector('#result').textContent==='rejected');
    assert.equal(headers.find(h=>h.url.startsWith('/default')).gpc,'1');
    console.log('PASS default policy rejects actual fixture consent; GPC header received');
    await configure({...base,global:{...base.global,analytics:'allow'}});
    await page.goto(origin+'/global');await page.waitForFunction(()=>document.querySelector('#result').textContent==='allowed');
    await configure({...base,sites:{'127.0.0.1':{analytics:'allow'}}});
    await page.goto(origin+'/override');await page.waitForFunction(()=>document.querySelector('#result').textContent==='allowed');
    console.log('PASS global and site overrides change saved consent through the real CMP engine');
    await configure(base,true);await page.goto(origin+'/paused');await page.waitForTimeout(1200);
    assert.equal(await page.locator('#cc-test-banner').count(),1);
    assert.equal(await page.locator('#result').textContent(),'');
    await configure({...base,global:{...base.global,analytics:'ask'}});
    await page.goto(origin+'/manual');await page.waitForTimeout(1200);assert.equal(await page.locator('#cc-test-banner').count(),1);
    console.log('PASS paused site and manual choice leave the banner untouched');
    const id=new URL(worker.url()).host;
    const popup=await context.newPage();await page.bringToFront();await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.waitForFunction(()=>document.querySelector('#protectionStatus').textContent.includes('Manual choice'));
    const images=await popup.locator('img').evaluateAll(nodes=>nodes.every(n=>n.complete&&n.naturalWidth>0));assert.equal(images,true);
    await popup.locator('[data-tab="settings"]').click();
    assert.equal(await popup.locator('#gpcToggle').isChecked(),true);
    await popup.locator('#gpcSettingRow').click();
    await worker.evaluate(async()=>{for(let i=0;i<100;i++){if(!(await chrome.declarativeNetRequest.getEnabledRulesets()).includes('gpc_ruleset'))return;await new Promise(r=>setTimeout(r,50));}throw new Error('GPC setting did not disable');});
    console.log('PASS visible GPC setting updates the active network ruleset');
    await popup.screenshot({path:path.resolve(__dirname,'../dist/popup-verified.png')});
    await configure(base);
    await popup.waitForFunction(()=>!document.querySelector('#reloadSite').hidden);
    assert.match(await popup.locator('#protectionStatus').textContent(),/reload/);
    console.log('PASS popup shows real page status and reload action after settings change');
    await popup.close();
    await configure({...base,gpc:{...base.gpc,enabled:false}});
    await worker.evaluate(async()=>{for(let i=0;i<100;i++){if(!(await chrome.declarativeNetRequest.getEnabledRulesets()).includes('gpc_ruleset'))return;await new Promise(r=>setTimeout(r,50));}throw new Error('GPC did not disable');});
    await page.goto(origin+'/gpc-off');
    assert.equal(headers.find(h=>h.url==='/gpc-off').gpc,undefined);
    await page.waitForFunction(()=>document.querySelector('#result').textContent==='rejected');
    await worker.evaluate(async()=>{for(let i=0;i<100;i++){const {udp_banner_counter}=await chrome.storage.local.get({udp_banner_counter:{total:0}});if(udp_banner_counter.total>=4)return;await new Promise(r=>setTimeout(r,50));}throw new Error('Activity counter did not settle');});
    const stored=await worker.evaluate(()=>chrome.storage.local.get({udp_audit_log:[],udp_banner_counter:{total:0}}));
    assert.ok(stored.udp_banner_counter.total>=4);
    assert.equal(JSON.stringify(stored).includes('do-not-log'),false);
    assert.ok(stored.udp_audit_log.every(e=>!('url' in e)&&e.site==='127.0.0.1'));
    assert.deepEqual(pageErrors,[]);assert.deepEqual(errors,[]);
    console.log('PASS GPC toggles off; durable hostname-only activity; no runtime errors');
  } finally {
    if(context)await context.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
