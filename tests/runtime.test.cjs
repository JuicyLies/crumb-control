const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
function source(file) { return fs.readFileSync(path.join(root, file), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export default PolicyEngine;/g, '').replace(/export /g, ''); }
function base() { return { console, URL, crypto: require('node:crypto').webcrypto, loadYAML: require('js-yaml').load }; }
function policyContext() {
  const ctx = vm.createContext(base());
  vm.runInContext(source('src/shared/PolicyEngine.js') + '\nglobalThis.PolicyEngine = PolicyEngine;', ctx);
  return ctx;
}
function storage(seed = {}) {
  const data = structuredClone(seed);
  return { data, async get(defaults) { return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, structuredClone(data[key] ?? value)])); },
    async set(values) { Object.assign(data, structuredClone(values)); }, async remove(key) { delete data[key]; } };
}
function event() { const listeners = []; return { listeners, addListener(fn) { listeners.push(fn); } }; }
async function background(seed = {}, syncSeed = {}) {
  const ctx = policyContext();
  const local = storage(seed), sync = storage(syncSeed), gpc = [];
  ctx.GDPRConfig = { async init() {} };
  ctx.chrome = { storage: { local, sync, onChanged: event() }, runtime: { onInstalled: event(), onMessage: event(), getURL: p => `chrome-extension://test/${p}`, getManifest: () => ({version:'0.4.1'}) },
    declarativeNetRequest: { async updateEnabledRulesets(v) { gpc.push(v); } } };
  ctx.fetch = async () => { throw new Error('Unavailable'); };
  vm.runInContext(source('src/background/background.js').replace('new BackgroundService();','globalThis.BackgroundService = BackgroundService;'),ctx);
  const service = new ctx.BackgroundService();
  assert.equal(ctx.chrome.runtime.onMessage.listeners.length,1,'listener registers before initialization resolves');
  await service.ready;
  return { service, local, sync, ctx, gpc };
}

test('partial policies retain necessary/default choices and YAML round-trips', () => {
  const { PolicyEngine } = policyContext();
  const engine = new PolicyEngine({global:{analytics:'allow'}, sites:{'example.com':{analytics:'reject'}}});
  assert.equal(engine.getDecision('analytics','example.com'), 'reject');
  assert.equal(engine.getDecision('analytics','elsewhere.com'), 'allow');
  assert.equal(engine.getDecision('necessary','example.com'), 'allow');
  const roundTrip = PolicyEngine.fromYAML(engine.toYAML());
  assert.equal(roundTrip.getDecision('analytics','elsewhere.com'),'allow');
  assert.equal(roundTrip.policy.version,1);
  assert.throws(() => engine.load({global:{marketing:'bogus'}}),/Invalid decision/);
  assert.equal(engine.getDecision('analytics','elsewhere.com'),'allow','invalid update must not replace active policy');
  assert.throws(() => engine.load({global:{necessary:'reject'}}),/Necessary/);
  assert.throws(() => engine.load({gpc:{enabled:'false'}}),/true or false/);
});

test('context rules apply, with site overrides taking precedence', () => {
  const { PolicyEngine } = policyContext();
  const engine = new PolicyEngine({context:{thirdParty:{analytics:'allow'}}});
  assert.equal(engine.getAllDecisions('example.com',true).analytics,'allow');
  assert.equal(engine.getAllDecisions('example.com',false).analytics,'reject');
  engine.setSiteOverride('example.com','analytics','reject');
  assert.equal(engine.getAllDecisions('example.com',true).analytics,'reject');
});

test('concurrent events persist exact counters, sanitized logs and statistics across restart', async () => {
  const { service, local } = await background({udp_audit_log:[{site:'example.com',url:'https://example.com/private?token=x',success:true}]});
  await Promise.all(Array.from({length:20},()=>service.addAuditEntry({site:'example.com/private?token=x',url:'https://secret',cmp:'fixture',clicks:2,success:true})));
  await service.addAuditEntry({site:'example.com',cmp:'fixture',success:true});
  assert.equal((await service.getCounter()).total,21);
  assert.equal((await service.getStatistics()).clicks,40);
  assert.ok(!(JSON.stringify(local.data).includes('token') || JSON.stringify(local.data).includes('https://secret')));
  const restarted = await background(local.data);
  assert.equal((await restarted.service.getCounter()).total,21);
  await restarted.service.handleUDPMessage({type:'CLEAR_AUDIT_LOG'},{});
  assert.equal((await restarted.service.getAuditLog()).length,0);
  assert.equal((await restarted.service.getCounter()).total,21,'clearing log preserves lifetime counter');
});

test('export reads synchronized policy and actual version, failed events never count', async () => {
  const { service } = await background({}, {udp_policy:{global:{analytics:'allow'}},disabledPages:{'example.com':true}});
  await service.addAuditEntry({site:'example.com',success:false});
  const data = await service.exportDSR();
  assert.equal(data.policy.global.analytics,'allow');
  assert.equal(data.disabledPages['example.com'],true);
  assert.equal(data.version,'0.4.1');
  assert.equal(data.counter.total,0);
});

test('rules fail locally, and GPC follows synchronized changes', async () => {
  const { service, ctx, sync, gpc } = await background();
  const requests=[];ctx.fetch=async url=>{requests.push(url);return {ok:false};};
  await assert.rejects(service.fetchRules(),/Bundled/);
  assert.deepEqual(requests,['chrome-extension://test/Rules.json']);
  await sync.set({udp_policy:{gpc:{enabled:false}}});
  ctx.chrome.storage.onChanged.listeners[0]({udp_policy:{}},'sync');
  await service.queue;
  assert.equal(gpc.at(-1).disableRulesetIds[0],'gpc_ruleset');
});

async function page(seed, {iframe=false, frameHost='example.com',rulesError=false}={}) {
  const ctx = policyContext();const instances=[];const sent=[];
  const win={addEventListener(){}};win.top=win.self=win.parent=win;if(iframe)win.top=win.parent={};
  Object.assign(ctx,{window:win,location:{href:`https://${frameHost}/private?token=x`,hostname:frameHost},
    document:{contentType:'text/html',readyState:'loading',addEventListener(){},querySelector(){return null;}},
    chrome:{storage:{sync:storage(seed),onChanged:event()},runtime:{onMessage:event(),async sendMessage(m){sent.push(m);if(m==='GetTabUrl')return 'https://example.com/';return rulesError?{error:'missing rules'}:[{}];}}},
    GDPRConfig:{async getCustomRuleLists(){return{};},async getDebugValues(){return{};},async getGeneralSettings(){return {enabled:true};}},
    ConsentEngine:class {constructor(config,values,callback){instances.push({values,callback});}},watchForTrackers(){}});
  vm.runInContext(source('src/content/content.js')+'\nglobalThis.run = contentScriptRunner; globalThis.status = () => pageStatus;',ctx);
  return {ctx,instances,sent,run:()=>ctx.run()};
}

test('page engine receives saved global/site preferences and both analytics categories', async () => {
  const p=await page({udp_policy:{global:{marketing:'allow'},sites:{'example.com':{analytics:'allow'}}}});await p.run();
  assert.equal(p.instances[0].values.F,true);assert.equal(p.instances[0].values.B,true);assert.equal(p.instances[0].values.D,true);
  p.instances[0].callback({handled:true,clicks:0});assert.equal(p.ctx.status(),'unverified');
});

test('disabled sites and ask policies never start or download banner rules', async () => {
  for (const seed of [{disabledPages:{'example.com':true}},{udp_policy:{global:{analytics:'ask'}}}]) {
    const p=await page(seed);await p.run();assert.equal(p.instances.length,0);assert.equal(p.sent.length,0);
  }
});

test('iframe uses top-site choices with the correct context; broken rules fail visibly', async () => {
  const p=await page({udp_policy:{context:{thirdParty:{analytics:'allow'}}}},{iframe:true,frameHost:'cmp.example.net'});
  await p.run();assert.equal(p.instances[0].values.B,true);
  const bad=await page({}, {rulesError:true});await assert.rejects(bad.run(),/missing rules/);
  assert.equal(bad.instances.length,0);
});
