// All durable writes finish before the message is acknowledged. No timer-only buffers.
import { PolicyEngine } from '../shared/PolicyEngine.js';
import GDPRConfig from '../content/GDPRConfig.js';

const KEYS = { policy: 'udp_policy', log: 'udp_audit_log', stats: 'udp_statistics', counter: 'udp_banner_counter' };
const MAX_ENTRIES = 10000;
const PRESETS = {
  essential: { necessary: 'allow', preferences: 'reject', analytics: 'reject', marketing: 'reject', social: 'reject', unclassified: 'reject' },
  balanced: { necessary: 'allow', preferences: 'allow', analytics: 'reject', marketing: 'reject', social: 'reject', unclassified: 'reject' },
  allowAll: { necessary: 'allow', preferences: 'allow', analytics: 'allow', marketing: 'allow', social: 'allow', unclassified: 'allow' }
};

function hostname(value) {
  try { return new URL(value.includes('://') ? value : `https://${value}`).hostname; }
  catch { return ''; }
}

// Explicit fields prevent legacy URLs/query strings or arbitrary message data being persisted.
function cleanEntry(entry) {
  return {
    id: entry.id || crypto.randomUUID(), timestamp: Number(entry.timestamp) || Date.now(),
    site: hostname(String(entry.site || '')), cmp: String(entry.cmp || '').slice(0, 160),
    clicks: Math.max(0, Number(entry.clicks) || 0),
    decision: 'auto', action: 'auto', success: entry.success === true
  };
}

export class BackgroundService {
  constructor() {
    this.policyEngine = new PolicyEngine();
    this.queue = Promise.resolve();
    this.auditQueue = Promise.resolve();
    this.rules = null;
    // Register synchronously so service-worker wake-up events cannot be missed.
    this.setupMessageHandlers();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes[KEYS.policy]) {
        this.enqueue(async () => { await this.loadPolicy(); await this.setupGPC(); }).catch(console.error);
      }
    });
    chrome.runtime.onInstalled.addListener(() => {
      this.enqueue(async () => { await this.loadPolicy(); await this.setupGPC(); }).catch(console.error);
    });
    this.ready = this.init();
  }

  enqueue(operation) {
    const next = this.queue.then(() => this.ready).then(operation);
    this.queue = next.catch(() => {});
    return next;
  }

  async init() {
    await GDPRConfig.init();
    await this.loadPolicy();
    await this.setupGPC();
    // Upgrade old logs in place, removing page URLs saved by earlier versions.
    const stored = await chrome.storage.local.get({ [KEYS.log]: [] });
    await chrome.storage.local.set({ [KEYS.log]: stored[KEYS.log].slice(-MAX_ENTRIES).map(cleanEntry) });
    await chrome.storage.local.remove('cachedEntries');
  }

  async loadPolicy() {
    const result = await chrome.storage.sync.get({ [KEYS.policy]: null });
    this.policyEngine.load(result[KEYS.policy] || this.policyEngine.getDefaultPolicy());
  }

  async savePolicy(policy) {
    const candidate = new PolicyEngine(policy);
    await chrome.storage.sync.set({ [KEYS.policy]: candidate.serialize() });
    this.policyEngine = candidate;
    await this.setupGPC();
  }

  async setupGPC() {
    const enabled = this.policyEngine.getGPCConfig().enabled;
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enabled ? ['gpc_ruleset'] : [],
      disableRulesetIds: enabled ? [] : ['gpc_ruleset']
    });
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.enqueue(() => typeof message === 'string'
        ? this.handleCoMMessage(message, sender)
        : this.handleUDPMessage(message, sender))
        .then(sendResponse, error => sendResponse({ error: error.message }));
      return true;
    });
  }

  async handleCoMMessage(message, sender) {
    const [cmd, ...rest] = message.split('|');
    switch (cmd) {
      case 'GetTabUrl': return sender.tab?.url || '';
      case 'GetRuleList': return this.fetchRules();
      case 'GetCustomRuleList': return GDPRConfig.getCustomRuleLists();
      case 'AddCustomRule': {
        const custom = await GDPRConfig.getCustomRuleLists();
        await GDPRConfig.setCustomRuleLists({ ...custom, ...JSON.parse(rest.join('|')) });
        return true;
      }
      case 'DeleteCustomRule': {
        const custom = await GDPRConfig.getCustomRuleLists();
        delete custom[rest.join('|')];
        await GDPRConfig.setCustomRuleLists(custom);
        return true;
      }
      // Our content callback is the single writer of audit events, avoiding double counting.
      case 'HandledCMP': case 'CMPError': case 'NothingFound': case 'Searching': return true;
      default: return null;
    }
  }

  async pageState(tabId) {
    try { return await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_STATE' }, { frameId: 0 }); }
    catch { return { status: 'unavailable', trackers: null }; }
  }

  async handleUDPMessage(message, sender) {
    switch (message.type) {
      case 'GET_POLICY': return { policy: this.policyEngine.serialize() };
      case 'SET_POLICY':
        await this.savePolicy(message.policy);
        return { success: true };
      case 'GET_PRESET': return { preset: 'custom' };
      case 'SET_PRESET': {
        if (!PRESETS[message.preset]) throw new Error('Unknown preset');
        const policy = this.policyEngine.serialize();
        policy.global = PRESETS[message.preset];
        await this.savePolicy(policy);
        return { success: true };
      }
      case 'GET_DECISIONS': return { decisions: this.policyEngine.getAllDecisions(message.site) };
      case 'SET_SITE_OVERRIDE': {
        const candidate = new PolicyEngine(this.policyEngine.serialize());
        candidate.setSiteOverride(message.site, message.category, message.decision);
        await this.savePolicy(candidate.serialize());
        return { success: true };
      }
      case 'SET_SITE_DISABLED': {
        const site = hostname(String(message.site || ''));
        if (!site || site !== message.site) throw new Error('Enter a valid hostname');
        const { disabledPages } = await chrome.storage.sync.get({ disabledPages: {} });
        if (message.disabled) disabledPages[site] = true;
        else delete disabledPages[site];
        await chrome.storage.sync.set({ disabledPages });
        return { success: true };
      }
      case 'LOG_AUDIT':
        await this.addAuditEntry({ ...message.entry, site: hostname(sender.tab?.url || '') });
        return { success: true };
      case 'GET_AUDIT_LOG': return { log: await this.getAuditLog(message.limit) };
      case 'CLEAR_AUDIT_LOG':
        await this.auditQueue;
        await chrome.storage.local.set({ [KEYS.log]: [] });
        return { success: true };
      case 'EXPORT_DSR': return { data: await this.exportDSR() };
      case 'GET_STATISTICS': return { statistics: await this.getStatistics() };
      case 'GET_COUNTER': return { counter: await this.getCounter() };
      case 'GET_PAGE_STATE': return this.pageState(message.tabId);
      case 'GET_TRACKERS': return { trackers: (await this.pageState(message.tabId))?.trackers || null };
      case 'FRAME_STATUS':
        if (sender.frameId !== 0 && sender.tab?.id != null) {
          try { await chrome.tabs.sendMessage(sender.tab.id, message, { frameId: 0 }); } catch { /* Navigated. */ }
        }
        return { success: true };
      default: throw new Error('Unknown message type');
    }
  }

  async fetchRules() {
    if (this.rules) return [this.rules];
    const response = await fetch(chrome.runtime.getURL('Rules.json'));
    if (!response.ok) throw new Error('Bundled banner rules could not be loaded');
    this.rules = await response.json();
    return [this.rules];
  }

  addAuditEntry(raw) {
    const operation = this.auditQueue.then(async () => {
      const entry = cleanEntry(raw);
      const now = Date.now();
      const stored = await chrome.storage.local.get({
        [KEYS.log]: [], [KEYS.counter]: { total: 0, since: null },
        [KEYS.stats]: { clicks: 0, cmps: {}, sites: {} }
      });
      const log = [...stored[KEYS.log], entry].slice(-MAX_ENTRIES);
      const counter = stored[KEYS.counter];
      const stats = stored[KEYS.stats];
      if (entry.success) { counter.total++; counter.since ||= now; }
      stats.clicks += entry.clicks;
      if (entry.cmp) stats.cmps[entry.cmp] = (stats.cmps[entry.cmp] || 0) + 1;
      if (entry.site) stats.sites[entry.site] = (stats.sites[entry.site] || 0) + 1;
      await chrome.storage.local.set({ [KEYS.log]: log, [KEYS.counter]: counter, [KEYS.stats]: stats });
    });
    this.auditQueue = operation.catch(() => {});
    return operation;
  }

  async getAuditLog(limit = 100) {
    await this.auditQueue;
    const stored = await chrome.storage.local.get({ [KEYS.log]: [] });
    return stored[KEYS.log].slice(-Math.max(1, Math.min(MAX_ENTRIES, Number(limit) || 100)));
  }

  async getStatistics() {
    const stored = await chrome.storage.local.get({ [KEYS.stats]: { clicks: 0, cmps: {}, sites: {} } });
    return stored[KEYS.stats];
  }

  async getCounter() {
    const stored = await chrome.storage.local.get({ [KEYS.counter]: { total: 0, since: null } });
    return stored[KEYS.counter];
  }

  async exportDSR() {
    await this.auditQueue;
    const preferences = await chrome.storage.sync.get({ [KEYS.policy]: null, disabledPages: {}, udp_toast_enabled: true });
    return {
      policy: preferences[KEYS.policy] || this.policyEngine.serialize(),
      disabledPages: preferences.disabledPages, confirmationToast: preferences.udp_toast_enabled,
      auditLog: await this.getAuditLog(MAX_ENTRIES), statistics: await this.getStatistics(),
      counter: await this.getCounter(), exportDate: new Date().toISOString(),
      version: chrome.runtime.getManifest().version
    };
  }
}

new BackgroundService();
