// GDPRConfig - Ported from Consent-O-Matic/Extension/GDPRConfig.js
// Handles storage of Consent-O-Matic settings and rule lists

const DEFAULT_SETTINGS = {
  enabled: true,
  logCMPData: true,
  alwaysForceRulesUpdate: false,
  debugLog: false
};

const DEFAULT_DEBUG = {
  debugLog: false,
  alwaysForceRulesUpdate: false
};

const DEFAULT_RULE_LISTS = [
  "https://raw.githubusercontent.com/cavi-au/Consent-O-Matic/master/Rules.json"
];

const DEFAULT_CONSENT_VALUES = {
  'A': false,  // Preferences
  'B': false,  // Performance/Analytics
  'D': false,  // Information/Analytics
  'E': false,  // Content/Social
  'F': false,  // Advertising/Marketing
  'X': false   // Other
};

export default class GDPRConfig {
  static async init() {
    // Initialize defaults if not present
    await this.setDefaultSettings();
  }

  static async getGeneralSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get({
        'GDPRGeneralSettings': DEFAULT_SETTINGS
      }, (result) => {
        resolve({ ...DEFAULT_SETTINGS, ...result.GDPRGeneralSettings });
      });
    });
  }

  static async setGeneralSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        'GDPRGeneralSettings': { ...DEFAULT_SETTINGS, ...settings }
      }, () => resolve({ success: true }));
    });
  }

  static async getDebugValues() {
    return new Promise((resolve) => {
      chrome.storage.local.get({
        'GDPRDebugValues': DEFAULT_DEBUG
      }, (result) => {
        resolve({ ...DEFAULT_DEBUG, ...result.GDPRDebugValues });
      });
    });
  }

  static async setDebugValues(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        'GDPRDebugValues': { ...DEFAULT_DEBUG, ...values }
      }, () => resolve({ success: true }));
    });
  }

  static async getConsentValues() {
    return new Promise((resolve) => {
      chrome.storage.local.get({
        'GDPRConsentValues': DEFAULT_CONSENT_VALUES
      }, (result) => {
        resolve({ ...DEFAULT_CONSENT_VALUES, ...result.GDPRConsentValues });
      });
    });
  }

  static async setConsentValues(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        'GDPRConsentValues': { ...DEFAULT_CONSENT_VALUES, ...values }
      }, () => resolve({ success: true }));
    });
  }

  static async getRuleLists() {
    return new Promise((resolve) => {
      chrome.storage.local.get({
        'GDPRRuleLists': DEFAULT_RULE_LISTS
      }, (result) => {
        resolve([...DEFAULT_RULE_LISTS, ...(result.GDPRRuleLists || [])]);
      });
    });
  }

  static async setRuleLists(lists) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        'GDPRRuleLists': [...DEFAULT_RULE_LISTS, ...lists]
      }, () => resolve({ success: true }));
    });
  }

  static async getCustomRuleLists() {
    return new Promise((resolve) => {
      chrome.storage.local.get({
        'GDPRCustomRuleLists': {}
      }, (result) => {
        resolve(result.GDPRCustomRuleLists || {});
      });
    });
  }

  static async setCustomRuleLists(lists) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        'GDPRCustomRuleLists': lists
      }, () => resolve({ success: true }));
    });
  }

  static async getStatistics() {
    return new Promise((resolve) => {
      chrome.storage.local.get({
        'GDPRStatistics': { cmps: {} }
      }, (result) => {
        resolve(result.GDPRStatistics || { cmps: {} });
      });
    });
  }

  static async setStatistics(stats) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        'GDPRStatistics': stats
      }, () => resolve({ success: true }));
    });
  }

  static async setDefaultSettings() {
    const result = await chrome.storage.local.get(['GDPRGeneralSettings', 'GDPRDebugValues', 'GDPRConsentValues', 'GDPRRuleLists']);
    
    const updates = {};
    if (!result.GDPRGeneralSettings) updates['GDPRGeneralSettings'] = DEFAULT_SETTINGS;
    if (!result.GDPRDebugValues) updates['GDPRDebugValues'] = DEFAULT_DEBUG;
    if (!result.GDPRConsentValues) updates['GDPRConsentValues'] = DEFAULT_CONSENT_VALUES;
    if (!result.GDPRRuleLists) updates['GDPRRuleLists'] = DEFAULT_RULE_LISTS;
    
    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
  }
}
