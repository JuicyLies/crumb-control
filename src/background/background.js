// background.js - Service Worker for Universal Data Permission Layer

import { PolicyEngine } from '../shared/PolicyEngine.js';
import GDPRConfig from '../content/GDPRConfig.js';

const STORAGE_KEYS = {
  POLICY: 'udp_policy',
  AUDIT_LOG: 'udp_audit_log',
  SYNC_CONFIG: 'udp_sync_config',
  STATISTICS: 'udp_statistics'
};

const AUDIT_LOG_MAX_ENTRIES = 10000;
let tabStatusMap = new Map();

const STATUS = { INIT: 0, NOTHING: 1, SEARCHING: 2, ERROR: 3, HANDLED: 4 };

class BackgroundService {
  constructor() {
    this.policyEngine = new PolicyEngine();
    this.auditBuffer = [];
    this.statisticsBuffer = { clicks: 0, cmps: {}, sites: {} };
    this.init();
  }

  async init() {
    console.log('[UDP] Background service initializing...');
    await GDPRConfig.init();
    await this.loadPolicy();
    await this.setupGPC();
    this.setupMessageHandlers();
    setInterval(() => this.flushAudit(), 30000);
    console.log('[UDP] Background service ready');
  }

  async loadPolicy() {
    try {
      const result = await chrome.storage.sync.get({ [STORAGE_KEYS.POLICY]: null });
      if (result[STORAGE_KEYS.POLICY]) {
        this.policyEngine.load(result[STORAGE_KEYS.POLICY]);
      }
    } catch (e) {
      console.error('[UDP] Failed to load policy:', e);
    }
  }

  async savePolicy() {
    await chrome.storage.sync.set({ [STORAGE_KEYS.POLICY]: this.policyEngine.serialize() });
  }

  async setupGPC() {
    const gpc = this.policyEngine.getGPCConfig();
    try {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: gpc.enabled ? ['gpc_ruleset'] : [],
        disableRulesetIds: gpc.enabled ? [] : ['gpc_ruleset']
      });
    } catch(e) { console.warn('[UDP] GPC ruleset:', e.message); }
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      (async () => {
        try {
          // Consent-O-Matic uses string messages (pipe-delimited)
          if (typeof message === 'string') {
            const response = await this.handleCoMMessage(message, sender);
            sendResponse(response);
          } else {
            const response = await this.handleUDPMessage(message, sender);
            sendResponse(response);
          }
        } catch (e) {
          console.error('[UDP] Message error:', e);
          sendResponse({ error: e.message });
        }
      })();
      return true;
    });
  }

  async handleCoMMessage(message, sender) {
    const parts = message.split('|');
    const cmd = parts[0];

    switch (cmd) {
      case 'GetTabUrl':
        return sender.tab?.url || '';

      case 'GetRuleList': {
        const debug = await GDPRConfig.getDebugValues();
        return await this.fetchRules(debug.alwaysForceRulesUpdate);
      }

      case 'GetCustomRuleList':
        return await GDPRConfig.getCustomRuleLists();

      case 'AddCustomRule': {
        const newRule = JSON.parse(parts[1]);
        const custom = await GDPRConfig.getCustomRuleLists();
        const combined = Object.assign({}, custom, newRule);
        await GDPRConfig.setCustomRuleLists(combined);
        return true;
      }

      case 'DeleteCustomRule': {
        const del = parts[1];
        const custom = await GDPRConfig.getCustomRuleLists();
        delete custom[del];
        await GDPRConfig.setCustomRuleLists(custom);
        return true;
      }

      case 'CMPError':
        tabStatusMap.set(sender.tab?.id, STATUS.ERROR);
        return true;

      case 'NothingFound':
        tabStatusMap.set(sender.tab?.id, STATUS.NOTHING);
        return true;

      case 'Searching':
        tabStatusMap.set(sender.tab?.id, STATUS.SEARCHING);
        return true;

      case 'HandledCMP': {
        const json = JSON.parse(parts[1]);
        tabStatusMap.set(sender.tab?.id, STATUS.HANDLED);

        // Log to our audit system too
        this.addAuditEntry({
          timestamp: Date.now(),
          site: new URL(sender.tab?.url || '').host,
          cmp: json.cmp,
          clicks: json.clicks,
          decision: 'auto',
          action: 'auto',
          success: true
        });

        return true;
      }

      default:
        return null;
    }
  }

  async handleUDPMessage(message, sender) {
    switch (message.type) {
      case 'GET_POLICY':
        return { policy: this.policyEngine.serialize() };

      case 'SET_POLICY':
        this.policyEngine.load(message.policy);
        await this.savePolicy();
        await this.setupGPC();
        return { success: true };

      case 'GET_DECISIONS':
        return { decisions: this.policyEngine.getAllDecisions(message.site) };

      case 'SET_SITE_OVERRIDE':
        this.policyEngine.setSiteOverride(message.site, message.category, message.decision);
        await this.savePolicy();
        return { success: true };

      case 'LOG_AUDIT':
        this.addAuditEntry(message.entry);
        return { success: true };

      case 'GET_AUDIT_LOG':
        return { log: await this.getAuditLog(message.limit) };

      case 'EXPORT_DSR':
        return { data: await this.exportDSR() };

      case 'GET_STATISTICS':
        return { statistics: await this.getStatistics() };

      default:
        return { error: 'Unknown message type' };
    }
  }

  async fetchRules(forceUpdate = false) {
    // Try bundled Rules.json first
    try {
      const url = chrome.runtime.getURL('Rules.json');
      const entry = await chrome.storage.local.get({ cachedEntries: {} });
      const cached = entry.cachedEntries[url];
      const maxStaleness = 22 * 3600 * 1000 + Math.random() * 26 * 3600 * 1000;

      if (!forceUpdate && cached && (Date.now() - cached.timestamp) < maxStaleness) {
        return [cached.rules];
      }

      const response = await fetch(url);
      if (response.ok) {
        const rules = await response.json();
        const updated = { ...entry.cachedEntries, [url]: { timestamp: Date.now(), rules } };
        await chrome.storage.local.set({ cachedEntries: updated });
        return [rules];
      }
    } catch (e) {
      console.warn('[UDP] Failed to load bundled rules:', e.message);
    }

    // Fallback: fetch from remote
    try {
      const ruleLists = await GDPRConfig.getRuleLists();
      const rules = [];
      for (const listUrl of ruleLists) {
        const response = await fetch(listUrl);
        if (response.ok) {
          const data = await response.json();
          rules.push(data);
        }
      }
      return rules;
    } catch (e) {
      console.error('[UDP] Failed to fetch remote rules:', e);
      return [];
    }
  }

  addAuditEntry(entry) {
    this.auditBuffer.push({
      id: crypto.randomUUID(),
      timestamp: entry.timestamp || Date.now(),
      ...entry
    });

    if (entry.cmp) {
      this.statisticsBuffer.cmps[entry.cmp] = (this.statisticsBuffer.cmps[entry.cmp] || 0) + 1;
    }
    if (entry.site) {
      this.statisticsBuffer.sites[entry.site] = (this.statisticsBuffer.sites[entry.site] || 0) + 1;
    }

    if (this.auditBuffer.length >= 100) {
      this.flushAudit();
    }
  }

  async flushAudit() {
    if (!this.auditBuffer.length) return;
    try {
      const result = await chrome.storage.local.get({ [STORAGE_KEYS.AUDIT_LOG]: [] });
      const log = result[STORAGE_KEYS.AUDIT_LOG];
      log.push(...this.auditBuffer);
      if (log.length > AUDIT_LOG_MAX_ENTRIES) {
        log.splice(0, log.length - AUDIT_LOG_MAX_ENTRIES);
      }
      await chrome.storage.local.set({ [STORAGE_KEYS.AUDIT_LOG]: log });
      this.auditBuffer = [];
    } catch (e) {
      console.error('[UDP] Flush audit failed:', e);
    }
  }

  async getAuditLog(limit = 100) {
    await this.flushAudit();
    const result = await chrome.storage.local.get({ [STORAGE_KEYS.AUDIT_LOG]: [] });
    return result[STORAGE_KEYS.AUDIT_LOG].slice(-limit);
  }

  async getStatistics() {
    await this.flushAudit();
    const result = await chrome.storage.local.get({ [STORAGE_KEYS.STATISTICS]: { clicks: 0, cmps: {}, sites: {} } });
    const stats = result[STORAGE_KEYS.STATISTICS];
    // Merge buffered
    for (const [k, v] of Object.entries(this.statisticsBuffer.cmps)) {
      stats.cmps[k] = (stats.cmps[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(this.statisticsBuffer.sites)) {
      stats.sites[k] = (stats.sites[k] || 0) + v;
    }
    return stats;
  }

  async exportDSR() {
    await this.flushAudit();
    const result = await chrome.storage.local.get({
      [STORAGE_KEYS.AUDIT_LOG]: [],
      [STORAGE_KEYS.POLICY]: null
    });
    return {
      policy: result[STORAGE_KEYS.POLICY],
      auditLog: result[STORAGE_KEYS.AUDIT_LOG],
      statistics: await this.getStatistics(),
      exportDate: new Date().toISOString(),
      version: '0.2.0'
    };
  }
}

new BackgroundService();
