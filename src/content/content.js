// content.js - Content script for Universal Data Permission Layer
// Integrates Consent-O-Matic's CMP detection with our Policy Engine

import { PolicyEngine, CONSENT_CATEGORIES, CONSENT_DECISIONS } from '../shared/PolicyEngine.js';

// Global flag to prevent double initialization
window._udpInitialized = window._udpInitialized || false;

class UDPContentScript {
  constructor() {
    this.policyEngine = new PolicyEngine();
    this.consentEngine = null;
    this.siteHost = '';
    this.isThirdParty = false;
    this.decisions = {};
    this.pendingCMPs = new Map();
    this.init();
  }

  async init() {
    if (window._udpInitialized) return;
    window._udpInitialized = true;
    
    // Determine site context
    this.siteHost = window.location.hostname;
    this.isThirdParty = window !== window.top;
    
    if (this.isThirdParty) {
      try {
        // Get top frame URL for cross-frame coordination
        this.siteHost = await this.getTopFrameHost();
      } catch (e) {
        console.warn('[UDP] Could not determine top frame host:', e);
      }
    }
    
    // Load policy from background
    await this.loadPolicy();
    
    // Load Consent-O-Matic engine if available
    await this.loadConsentEngine();
    
    // Start listening for CMP detections
    this.startCMPListener();
  }

  async getTopFrameHost() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_TOP_FRAME_URL' }, (response) => {
        if (response && response.url) {
          const url = new URL(response.url);
          resolve(url.hostname);
        } else {
          resolve(window.location.hostname);
        }
      });
    });
  }

  async loadPolicy() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_POLICY' }, (response) => {
        if (response && response.policy) {
          this.policyEngine.load(response.policy);
          this.decisions = this.policyEngine.getAllDecisions(this.siteHost);
          console.log('[UDP] Policy loaded for', this.siteHost, this.decisions);
        }
        resolve();
      });
    });
  }

  async loadConsentEngine() {
    // Check if Consent-O-Matic is already loaded (injected by their content script)
    if (window.ConsentEngine && window.ConsentEngine.singleton) {
      this.consentEngine = window.ConsentEngine.singleton;
      console.log('[UDP] Found existing ConsentEngine instance');
      this.patchConsentEngine();
      return;
    }
    
    // Wait for ConsentEngine to be available
    let attempts = 0;
    while (attempts < 50) { // 5 seconds max
      await new Promise(r => setTimeout(r, 100));
      if (window.ConsentEngine && window.ConsentEngine.singleton) {
        this.consentEngine = window.ConsentEngine.singleton;
        console.log('[UDP] ConsentEngine found after wait');
        this.patchConsentEngine();
        return;
      }
      attempts++;
    }
    
    console.log('[UDP] No ConsentEngine found, running in policy-only mode');
    // We'll still apply GPC headers and can manually handle simple CMPs
  }

  patchConsentEngine() {
    if (!this.consentEngine) return;
    
    // Override the consent handling to use our policy decisions
    const originalHandleCallback = this.consentEngine.handledCallback;
    this.consentEngine.handledCallback = (evt) => {
      // Log audit entry for our dashboard
      if (evt.handled && this.consentEngine.currentCMP) {
        this.logAudit({
          url: window.location.href,
          site: this.siteHost,
          cmp: this.consentEngine.currentCMP.name,
          category: 'all', // Could be more granular
          decision: 'auto',
          action: 'auto',
          clicks: evt.clicks,
          success: true
        });
      }
      
      // Call original callback
      if (originalHandleCallback) {
        originalHandleCallback(evt);
      }
    };
    
    // Patch the consent type resolution to use our policy
    const originalRunMethod = this.consentEngine.currentCMP?.runMethod;
    // Note: We can't easily patch the internal consent type mapping without deeper integration
    // The approach is to inject our decisions into the consentTypes passed to the engine
  }

  startCMPListener() {
    // Listen for messages from background (policy updates)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'POLICY_UPDATED') {
        this.policyEngine.load(message.policy);
        this.decisions = this.policyEngine.getAllDecisions(this.siteHost);
        console.log('[UDP] Policy updated:', this.decisions);
      }
    });
  }

  /**
   * Get consent decision for a specific CMP category
   * Maps Consent-O-Matic categories (A, B, D, E, F, X) to our categories
   */
  getDecisionForCMPCategory(cmpCategory) {
    // Consent-O-Matic categories:
    // A = Preferences (Functional)
    // B = Performance (Analytics)
    // D = Information (Analytics)
    // E = Content (Marketing)
    // F = Advertising (Marketing)
    // X = Other (Unclassified)
    
    const mapping = {
      'A': CONSENT_CATEGORIES.PREFERENCES,
      'B': CONSENT_CATEGORIES.ANALYTICS,
      'D': CONSENT_CATEGORIES.ANALYTICS,
      'E': CONSENT_CATEGORIES.MARKETING,
      'F': CONSENT_CATEGORIES.MARKETING,
      'X': CONSENT_CATEGORIES.UNCLASSIFIED
    };
    
    const ourCategory = mapping[cmpCategory] || CONSENT_CATEGORIES.UNCLASSIFIED;
    return this.decisions[ourCategory] || CONSENT_DECISIONS.REJECT;
  }

  /**
   * Override consent values passed to ConsentEngine with our policy decisions
   */
  getPolicyConsentValues() {
    const values = {};
    for (const [cat, decision] of Object.entries(this.decisions)) {
      // Map our categories back to CMP categories
      const mapping = {
        [CONSENT_CATEGORIES.PREFERENCES]: 'A',
        [CONSENT_CATEGORIES.ANALYTICS]: 'B', // Both B and D map to analytics
        [CONSENT_CATEGORIES.MARKETING]: 'F', // Both E and F map to marketing
        [CONSENT_CATEGORIES.SOCIAL]: 'E',
        [CONSENT_CATEGORIES.UNCLASSIFIED]: 'X',
        [CONSENT_CATEGORIES.NECESSARY]: null // Never in CMP
      };
      
      const cmpCat = mapping[cat];
      if (cmpCat) {
        values[cmpCat] = decision === CONSENT_DECISIONS.ALLOW;
      }
    }
    return values;
  }

  logAudit(entry) {
    chrome.runtime.sendMessage({ type: 'LOG_AUDIT', entry });
  }

  // Expose API for dashboard/options page
  exposeAPI() {
    window.UDP = {
      getDecisions: () => this.decisions,
      getPolicy: () => this.policyEngine.serialize(),
      setSiteOverride: (category, decision) => {
        this.policyEngine.setSiteOverride(this.siteHost, category, decision);
        this.decisions = this.policyEngine.getAllDecisions(this.siteHost);
        chrome.runtime.sendMessage({ type: 'SET_POLICY', policy: this.policyEngine.serialize() });
      }
    };
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new UDPContentScript());
} else {
  new UDPContentScript();
}

export { UDPContentScript };