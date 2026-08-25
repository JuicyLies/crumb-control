// background.js - Service Worker for Universal Data Permission Layer
// Handles GPC header injection, policy sync, audit logging, and cloud sync

import { PolicyEngine, CONSENT_CATEGORIES, CONSENT_DECISIONS } from '../shared/PolicyEngine.js';

const STORAGE_KEYS = {
  POLICY: 'udp_policy',
  AUDIT_LOG: 'udp_audit_log',
  SYNC_CONFIG: 'udp_sync_config',
  STATISTICS: 'udp_statistics'
};

const AUDIT_LOG_MAX_ENTRIES = 10000;
const STATISTICS_FLUSH_INTERVAL = 30000; // 30 seconds

class BackgroundService {
  constructor() {
    this.policyEngine = new PolicyEngine();
    this.auditBuffer = [];
    this.statisticsBuffer = { clicks: 0, cmps: {}, sites: {} };
    this.syncConfig = null;
    this.cryptoKey = null;
    this.init();
  }

  async init() {
    console.log('[UDP] Background service initializing...');
    
    // Load policy from storage
    await this.loadPolicy();
    
    // Load sync config
    await this.loadSyncConfig();
    
    // Initialize crypto if sync is enabled
    if (this.syncConfig?.enabled) {
      await this.initCrypto();
    }
    
    // Set up declarativeNetRequest for GPC header
    await this.setupGPCRules();
    
    // Set up message handlers
    this.setupMessageHandlers();
    
    // Periodic statistics flush
    setInterval(() => this.flushStatistics(), STATISTICS_FLUSH_INTERVAL);
    
    // Periodic audit sync
    if (this.syncConfig?.enabled) {
      setInterval(() => this.syncAuditLog(), 60000); // Every minute
    }
    
    console.log('[UDP] Background service ready');
  }

  async loadPolicy() {
    try {
      const result = await chrome.storage.sync.get({ [STORAGE_KEYS.POLICY]: null });
      if (result[STORAGE_KEYS.POLICY]) {
        this.policyEngine.load(result[STORAGE_KEYS.POLICY]);
        console.log('[UDP] Policy loaded from sync storage');
      }
    } catch (e) {
      console.error('[UDP] Failed to load policy:', e);
    }
  }

  async savePolicy() {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEYS.POLICY]: this.policyEngine.serialize() });
      console.log('[UDP] Policy saved to sync storage');
      
      // Notify all tabs of policy update
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { type: 'POLICY_UPDATED', policy: this.policyEngine.serialize() }).catch(() => {});
        }
      });
    } catch (e) {
      console.error('[UDP] Failed to save policy:', e);
    }
  }

  async loadSyncConfig() {
    try {
      const result = await chrome.storage.local.get({ [STORAGE_KEYS.SYNC_CONFIG]: null });
      this.syncConfig = result[STORAGE_KEYS.SYNC_CONFIG] || { enabled: false };
    } catch (e) {
      console.error('[UDP] Failed to load sync config:', e);
    }
  }

  async saveSyncConfig(config) {
    this.syncConfig = config;
    await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_CONFIG]: config });
  }

  async initCrypto() {
    if (!this.syncConfig?.passphrase) return;
    
    try {
      // Derive key from passphrase using PBKDF2
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.syncConfig.passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      this.cryptoKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode(this.syncConfig.salt || 'udp-salt-v1'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      
      console.log('[UDP] Crypto initialized for encrypted sync');
    } catch (e) {
      console.error('[UDP] Crypto init failed:', e);
    }
  }

  async encrypt(data) {
    if (!this.cryptoKey) return data;
    
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.cryptoKey,
      encoder.encode(JSON.stringify(data))
    );
    
    // Return iv + ciphertext as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encryptedData) {
    if (!this.cryptoKey) return encryptedData;
    
    try {
      const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.cryptoKey,
        ciphertext
      );
      
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      console.error('[UDP] Decrypt failed:', e);
      return null;
    }
  }

  async setupGPCRules() {
    const gpcConfig = this.policyEngine.getGPCConfig();
    if (!gpcConfig.enabled) {
      // Disable ruleset
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1]
      });
      return;
    }
    
    // Rules are defined in rules/gpc-rules.json (static)
    // The ruleset is declared in manifest.json and enabled by default
    console.log('[UDP] GPC header injection active:', gpcConfig.headerName, gpcConfig.headerValue);
  }

  async updateGPCRules() {
    // Re-enable/disable the static ruleset
    const gpcConfig = this.policyEngine.getGPCConfig();
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: gpcConfig.enabled ? ['gpc_ruleset'] : [],
      disableRulesetIds: gpcConfig.enabled ? [] : ['gpc_ruleset']
    });
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      (async () => {
        try {
          const response = await this.handleMessage(message, sender);
          sendResponse(response);
        } catch (e) {
          console.error('[UDP] Message handler error:', e);
          sendResponse({ error: e.message });
        }
      })();
      return true; // Async response
    });
  }

  async handleMessage(message, sender) {
    switch (message.type) {
      case 'GET_POLICY':
        return { policy: this.policyEngine.serialize() };
        
      case 'SET_POLICY':
        this.policyEngine.load(message.policy);
        await this.savePolicy();
        await this.updateGPCRules();
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
        
      case 'SET_SYNC_CONFIG':
        await this.saveSyncConfig(message.config);
        if (message.config.enabled && message.config.passphrase) {
          await this.initCrypto();
        }
        return { success: true };
        
      case 'SYNC_NOW':
        await this.syncAuditLog();
        return { success: true };
        
      case 'GET_STATISTICS':
        return { statistics: await this.getStatistics() };
        
      default:
        return { error: 'Unknown message type' };
    }
  }

  addAuditEntry(entry) {
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      url: entry.url,
      site: entry.site,
      cmp: entry.cmp,
      category: entry.category,
      decision: entry.decision,
      action: entry.action, // 'auto', 'manual', 'gpc', 'topics'
      clicks: entry.clicks || 0,
      success: entry.success !== false
    };
    
    this.auditBuffer.push(auditEntry);
    this.statisticsBuffer.clicks += entry.clicks || 0;
    
    if (entry.cmp) {
      this.statisticsBuffer.cmps[entry.cmp] = (this.statisticsBuffer.cmps[entry.cmp] || 0) + 1;
    }
    
    if (entry.site) {
      this.statisticsBuffer.sites[entry.site] = (this.statisticsBuffer.sites[entry.site] || 0) + 1;
    }
    
    // Flush if buffer is large
    if (this.auditBuffer.length >= 100) {
      this.flushAuditLog();
    }
  }

  async flushAuditLog() {
    if (this.auditBuffer.length === 0) return;
    
    try {
      const result = await chrome.storage.local.get({ [STORAGE_KEYS.AUDIT_LOG]: [] });
      let log = result[STORAGE_KEYS.AUDIT_LOG];
      
      log = [...log, ...this.auditBuffer];
      
      // Trim to max entries
      if (log.length > AUDIT_LOG_MAX_ENTRIES) {
        log = log.slice(-AUDIT_LOG_MAX_ENTRIES);
      }
      
      await chrome.storage.local.set({ [STORAGE_KEYS.AUDIT_LOG]: log });
      this.auditBuffer = [];
    } catch (e) {
      console.error('[UDP] Failed to flush audit log:', e);
    }
  }

  async flushStatistics() {
    try {
      const result = await chrome.storage.local.get({ [STORAGE_KEYS.STATISTICS]: { clicks: 0, cmps: {}, sites: {} } });
      const stats = result[STORAGE_KEYS.STATISTICS];
      
      stats.clicks += this.statisticsBuffer.clicks;
      for (const [cmp, count] of Object.entries(this.statisticsBuffer.cmps)) {
        stats.cmps[cmp] = (stats.cmps[cmp] || 0) + count;
      }
      for (const [site, count] of Object.entries(this.statisticsBuffer.sites)) {
        stats.sites[site] = (stats.sites[site] || 0) + count;
      }
      
      await chrome.storage.local.set({ [STORAGE_KEYS.STATISTICS]: stats });
      this.statisticsBuffer = { clicks: 0, cmps: {}, sites: {} };
    } catch (e) {
      console.error('[UDP] Failed to flush statistics:', e);
    }
  }

  async getAuditLog(limit = 1000) {
    await this.flushAuditLog();
    const result = await chrome.storage.local.get({ [STORAGE_KEYS.AUDIT_LOG]: [] });
    const log = result[STORAGE_KEYS.AUDIT_LOG];
    return log.slice(-limit).reverse(); // Most recent first
  }

  async getStatistics() {
    await this.flushStatistics();
    const result = await chrome.storage.local.get({ [STORAGE_KEYS.STATISTICS]: { clicks: 0, cmps: {}, sites: {} } });
    return result[STORAGE_KEYS.STATISTICS];
  }

  async exportDSR() {
    await this.flushAuditLog();
    await this.flushStatistics();
    
    const [auditResult, statsResult, policyResult, syncResult] = await Promise.all([
      chrome.storage.local.get({ [STORAGE_KEYS.AUDIT_LOG]: [] }),
      chrome.storage.local.get({ [STORAGE_KEYS.STATISTICS]: { clicks: 0, cmps: {}, sites: {} } }),
      chrome.storage.sync.get({ [STORAGE_KEYS.POLICY]: this.policyEngine.getDefaultPolicy() }),
      chrome.storage.local.get({ [STORAGE_KEYS.SYNC_CONFIG]: { enabled: false } })
    ]);
    
    return {
      exportedAt: new Date().toISOString(),
      policy: policyResult[STORAGE_KEYS.POLICY],
      auditLog: auditResult[STORAGE_KEYS.AUDIT_LOG],
      statistics: statsResult[STORAGE_KEYS.STATISTICS],
      syncConfig: {
        enabled: syncResult[STORAGE_KEYS.SYNC_CONFIG].enabled,
        // Don't export passphrase/salt
        endpoint: syncResult[STORAGE_KEYS.SYNC_CONFIG].endpoint
      }
    };
  }

  async syncAuditLog() {
    if (!this.syncConfig?.enabled || !this.syncConfig.endpoint || !this.cryptoKey) return;
    
    try {
      const entries = await this.getAuditLog();
      const encrypted = await this.encrypt(entries);
      
      const response = await fetch(this.syncConfig.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: encrypted, deviceId: this.syncConfig.deviceId })
      });
      
      if (!response.ok) throw new Error(`Sync failed: ${response.status}`);
      console.log('[UDP] Audit log synced:', entries.length, 'entries');
    } catch (e) {
      console.error('[UDP] Sync failed:', e);
    }
  }
}

// Initialize background service
new BackgroundService();

// Handle extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[UDP] Extension installed');
    // Open options page on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  } else if (details.reason === 'update') {
    console.log('[UDP] Extension updated from', details.previousVersion);
  }
});

export { BackgroundService };