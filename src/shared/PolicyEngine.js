import { load as loadYAML } from 'js-yaml';

// PolicyEngine.js - Core policy engine for Crumb Control
// Handles YAML/JSON policy parsing, site-scoped overrides, and consent decision making

export const CONSENT_CATEGORIES = {
  NECESSARY: 'necessary',      // Strictly necessary cookies (always allowed)
  PREFERENCES: 'preferences',   // Functional/preferences cookies
  ANALYTICS: 'analytics',       // Analytics/performance cookies
  MARKETING: 'marketing',       // Advertising/targeting cookies
  SOCIAL: 'social',             // Social media cookies
  UNCLASSIFIED: 'unclassified'  // Unknown category
};

export const CONSENT_DECISIONS = {
  ALLOW: 'allow',
  REJECT: 'reject',
  ASK: 'ask'  // Defer to CMP default / user interaction
};

export class PolicyEngine {
  constructor(policy = null) {
    this.compiledRules = null;
    this.load(policy || this.getDefaultPolicy());
  }

  getDefaultPolicy() {
    return {
      version: 1,
      global: {
        [CONSENT_CATEGORIES.NECESSARY]: CONSENT_DECISIONS.ALLOW,
        [CONSENT_CATEGORIES.PREFERENCES]: CONSENT_DECISIONS.REJECT,
        [CONSENT_CATEGORIES.ANALYTICS]: CONSENT_DECISIONS.REJECT,
        [CONSENT_CATEGORIES.MARKETING]: CONSENT_DECISIONS.REJECT,
        [CONSENT_CATEGORIES.SOCIAL]: CONSENT_DECISIONS.REJECT,
        [CONSENT_CATEGORIES.UNCLASSIFIED]: CONSENT_DECISIONS.REJECT
      },
      // Per-site overrides: { "example.com": { analytics: "allow" } }
      sites: {},
      // First-party vs third-party context rules
      context: {
        firstParty: {},   // category -> decision
        thirdParty: {}    // category -> decision
      },
      // GPC signal (Global Privacy Control)
      gpc: {
        enabled: true,
        headerName: 'Sec-GPC',
        headerValue: '1'
      },
      // Topics API / Privacy Sandbox
      topicsApi: {
        enabled: false,  // opt-out by default
        headerName: 'Permissions-Policy',
        headerValue: 'browsing-topics=()'
      },
      // Fenced frames (Privacy Sandbox)
      fencedFrames: {
        enabled: false
      }
    };
  }

  compilePolicy() {
    // Pre-compile for fast decision making
    this.compiledRules = {
      global: { ...this.policy.global },
      sites: { ...this.policy.sites },
      context: { ...this.policy.context }
    };
  }

  /**
   * Get consent decision for a category on a specific site with context
   * @param {string} category - One of CONSENT_CATEGORIES
   * @param {string} site - Hostname (e.g., "example.com")
   * @param {boolean} isThirdParty - Whether this is a third-party context
   * @returns {string} - One of CONSENT_DECISIONS
   */
  getDecision(category, site, isThirdParty = false) {
    if (category === CONSENT_CATEGORIES.NECESSARY) return CONSENT_DECISIONS.ALLOW;
    // 1. Check site-specific override
    if (this.compiledRules.sites[site] && this.compiledRules.sites[site][category] !== undefined) {
      return this.compiledRules.sites[site][category];
    }

    // 2. Check context-specific rule
    const contextKey = isThirdParty ? 'thirdParty' : 'firstParty';
    if (this.compiledRules.context[contextKey][category] !== undefined) {
      return this.compiledRules.context[contextKey][category];
    }

    // 3. Fall back to global
    return this.compiledRules.global[category] || CONSENT_DECISIONS.REJECT;
  }

  /**
   * Get all decisions for a site (used by content script)
   * @param {string} site - Hostname
   * @returns {Object} - Map of category -> decision
   */
  getAllDecisions(site, isThirdParty = false) {
    const decisions = {};
    for (const category of Object.values(CONSENT_CATEGORIES)) {
      decisions[category] = this.getDecision(category, site, isThirdParty);
    }
    return decisions;
  }

  /**
   * Set a site-specific override
   * @param {string} site - Hostname
   * @param {string} category - Category
   * @param {string} decision - Decision
   */
  setSiteOverride(site, category, decision) {
    if (!this.compiledRules.sites[site]) {
      this.compiledRules.sites[site] = {};
    }
    this.compiledRules.sites[site][category] = decision;
    this.policy.sites = this.compiledRules.sites;
  }

  /**
   * Set a context rule (first-party or third-party)
   * @param {boolean} isThirdParty
   * @param {string} category
   * @param {string} decision
   */
  setContextRule(isThirdParty, category, decision) {
    const contextKey = isThirdParty ? 'thirdParty' : 'firstParty';
    this.compiledRules.context[contextKey][category] = decision;
    this.policy.context = this.compiledRules.context;
  }

  /**
   * Set global default for a category
   * @param {string} category
   * @param {string} decision
   */
  setGlobalDefault(category, decision) {
    this.compiledRules.global[category] = decision;
    this.policy.global = this.compiledRules.global;
  }

  /**
   * Get GPC configuration
   * @returns {Object}
   */
  getGPCConfig() {
    return this.policy.gpc;
  }

  /**
   * Get Topics API configuration
   * @returns {Object}
   */
  getTopicsConfig() {
    return this.policy.topicsApi;
  }

  /**
   * Serialize policy for storage
   * @returns {Object}
   */
  serialize() {
    return JSON.parse(JSON.stringify(this.policy));
  }

  /**
   * Deserialize and load policy
   * @param {Object} policy
   */
  load(policy) {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
      throw new Error('Policy must be an object');
    }
    const defaults = this.getDefaultPolicy();
    const candidate = {
      ...defaults, ...policy,
      global: { ...defaults.global, ...policy.global },
      sites: { ...policy.sites },
      context: {
        firstParty: { ...policy.context?.firstParty },
        thirdParty: { ...policy.context?.thirdParty }
      },
      gpc: { ...defaults.gpc, ...policy.gpc },
      topicsApi: { ...defaults.topicsApi, ...policy.topicsApi }
    };
    const previous = this.policy;
    this.policy = candidate;
    let validation;
    try { validation = this.validate(); }
    catch (error) { this.policy = previous; throw error; }
    if (!validation.valid) {
      this.policy = previous;
      throw new Error(validation.errors.join('; '));
    }
    this.compilePolicy();
  }

  /**
   * Convert policy to YAML string (for UI editor)
   * @returns {string}
   */
  toYAML() {
    const lines = [];
    lines.push(`version: ${this.policy.version}`);
    lines.push('global:');
    for (const [cat, dec] of Object.entries(this.policy.global)) {
      lines.push(`  ${cat}: ${dec}`);
    }
    lines.push('sites:');
    for (const [site, rules] of Object.entries(this.policy.sites)) {
      lines.push(`  ${site}:`);
      for (const [cat, dec] of Object.entries(rules)) {
        lines.push(`    ${cat}: ${dec}`);
      }
    }
    lines.push('context:');
    lines.push('  firstParty:');
    for (const [cat, dec] of Object.entries(this.policy.context.firstParty)) {
      lines.push(`    ${cat}: ${dec}`);
    }
    lines.push('  thirdParty:');
    for (const [cat, dec] of Object.entries(this.policy.context.thirdParty)) {
      lines.push(`    ${cat}: ${dec}`);
    }
    lines.push('gpc:');
    lines.push(`  enabled: ${this.policy.gpc.enabled}`);
    lines.push(`  headerName: ${this.policy.gpc.headerName}`);
    lines.push(`  headerValue: "${this.policy.gpc.headerValue}"`);
    lines.push('topicsApi:');
    lines.push(`  enabled: ${this.policy.topicsApi.enabled}`);
    lines.push(`  headerName: ${this.policy.topicsApi.headerName}`);
    lines.push(`  headerValue: "${this.policy.topicsApi.headerValue}"`);
    return lines.join('\n');
  }

  /**
   * Parse YAML string and load policy
   * @param {string} yaml
   */
  static fromYAML(yaml) {
    const engine = new PolicyEngine();
    const parsed = engine.parseYAML(yaml);
    engine.load(parsed);
    return engine;
  }

  /**
   * Simple YAML parser (handles our policy format)
   * For production, use js-yaml
   * @param {string} yaml
   * @returns {Object}
   */
  parseYAML(yaml) {
    const parsed = loadYAML(yaml);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Enter a YAML policy object');
    }
    return parsed;
  }

  /**
   * Validate policy against schema
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];
    const validCategories = Object.values(CONSENT_CATEGORIES);
    const validDecisions = Object.values(CONSENT_DECISIONS);

    if (this.policy.global.necessary !== 'allow') errors.push('Necessary cookies must remain allowed');
    if (typeof this.policy.gpc.enabled !== 'boolean') errors.push('gpc.enabled must be true or false');
    if (this.policy.gpc.headerName !== 'Sec-GPC' || this.policy.gpc.headerValue !== '1') errors.push('GPC uses the fixed Sec-GPC: 1 header');
    if (this.policy.topicsApi.enabled || this.policy.fencedFrames?.enabled) errors.push('Privacy Sandbox controls are not implemented');

    // Validate global
    for (const [cat, dec] of Object.entries(this.policy.global)) {
      if (!validCategories.includes(cat)) errors.push(`Invalid category in global: ${cat}`);
      if (!validDecisions.includes(dec)) errors.push(`Invalid decision in global.${cat}: ${dec}`);
    }

    // Validate sites
    for (const [site, rules] of Object.entries(this.policy.sites)) {
      if (!rules || typeof rules !== 'object' || Array.isArray(rules)) { errors.push(`Invalid rules for ${site}`); continue; }
      if (rules.necessary && rules.necessary !== 'allow') errors.push(`Necessary cookies must remain allowed on ${site}`);
      for (const [cat, dec] of Object.entries(rules)) {
        if (!validCategories.includes(cat)) errors.push(`Invalid category in sites.${site}: ${cat}`);
        if (!validDecisions.includes(dec)) errors.push(`Invalid decision in sites.${site}.${cat}: ${dec}`);
      }
    }

    // Validate context
    for (const ctx of ['firstParty', 'thirdParty']) {
      if (this.policy.context[ctx]?.necessary && this.policy.context[ctx].necessary !== 'allow') errors.push('Necessary cookies must remain allowed');
      for (const [cat, dec] of Object.entries(this.policy.context[ctx] || {})) {
        if (!validCategories.includes(cat)) errors.push(`Invalid category in context.${ctx}: ${cat}`);
        if (!validDecisions.includes(dec)) errors.push(`Invalid decision in context.${ctx}.${cat}: ${dec}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export default PolicyEngine;