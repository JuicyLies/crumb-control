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
    this.policy = policy || this.getDefaultPolicy();
    this.compiledRules = null;
    this.compilePolicy();
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
  getAllDecisions(site) {
    const decisions = {};
    for (const category of Object.values(CONSENT_CATEGORIES)) {
      decisions[category] = this.getDecision(category, site, false);
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
    this.policy = { ...this.getDefaultPolicy(), ...policy };
    // Deep merge sites and context
    if (policy.sites) {
      this.policy.sites = { ...this.getDefaultPolicy().sites, ...policy.sites };
    }
    if (policy.context) {
      this.policy.context = {
        firstParty: { ...this.getDefaultPolicy().context.firstParty, ...policy.context.firstParty },
        thirdParty: { ...this.getDefaultPolicy().context.thirdParty, ...policy.context.thirdParty }
      };
    }
    if (policy.gpc) {
      this.policy.gpc = { ...this.getDefaultPolicy().gpc, ...policy.gpc };
    }
    if (policy.topicsApi) {
      this.policy.topicsApi = { ...this.getDefaultPolicy().topicsApi, ...policy.topicsApi };
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
    const result = { version: 1, global: {}, sites: {}, context: { firstParty: {}, thirdParty: {} }, gpc: {}, topicsApi: {} };
    let currentSection = 'global';
    let currentSite = null;
    let currentContext = null;

    for (const line of yaml.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.search(/\S/);
      const isSite = indent === 2 && trimmed.endsWith(':') && !['global:', 'sites:', 'context:', 'firstParty:', 'thirdParty:', 'gpc:', 'topicsApi:'].includes(trimmed);

      if (trimmed === 'global:') { currentSection = 'global'; continue; }
      if (trimmed === 'sites:') { currentSection = 'sites'; continue; }
      if (trimmed === 'context:') { currentSection = 'context'; continue; }
      if (trimmed === 'firstParty:') { currentContext = 'firstParty'; continue; }
      if (trimmed === 'thirdParty:') { currentContext = 'thirdParty'; continue; }
      if (trimmed === 'gpc:') { currentSection = 'gpc'; continue; }
      if (trimmed === 'topicsApi:') { currentSection = 'topicsApi'; continue; }

      if (isSite) {
        currentSite = trimmed.slice(0, -1);
        result.sites[currentSite] = {};
        continue;
      }

      const [key, ...valParts] = trimmed.split(':');
      const value = valParts.join(':').trim().replace(/^["']|["']$/g, '');

      if (currentSection === 'global') {
        result.global[key.trim()] = value;
      } else if (currentSection === 'sites' && currentSite) {
        result.sites[currentSite][key.trim()] = value;
      } else if (currentSection === 'context' && currentContext) {
        result.context[currentContext][key.trim()] = value;
      } else if (currentSection === 'gpc') {
        result.gpc[key.trim()] = value === 'true' || value === 'false' ? value === 'true' : value;
      } else if (currentSection === 'topicsApi') {
        result.topicsApi[key.trim()] = value === 'true' || value === 'false' ? value === 'true' : value;
      }
    }
    return result;
  }

  /**
   * Validate policy against schema
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];
    const validCategories = Object.values(CONSENT_CATEGORIES);
    const validDecisions = Object.values(CONSENT_DECISIONS);

    // Validate global
    for (const [cat, dec] of Object.entries(this.policy.global)) {
      if (!validCategories.includes(cat)) errors.push(`Invalid category in global: ${cat}`);
      if (!validDecisions.includes(dec)) errors.push(`Invalid decision in global.${cat}: ${dec}`);
    }

    // Validate sites
    for (const [site, rules] of Object.entries(this.policy.sites)) {
      for (const [cat, dec] of Object.entries(rules)) {
        if (!validCategories.includes(cat)) errors.push(`Invalid category in sites.${site}: ${cat}`);
        if (!validDecisions.includes(dec)) errors.push(`Invalid decision in sites.${site}.${cat}: ${dec}`);
      }
    }

    // Validate context
    for (const ctx of ['firstParty', 'thirdParty']) {
      for (const [cat, dec] of Object.entries(this.policy.context[ctx] || {})) {
        if (!validCategories.includes(cat)) errors.push(`Invalid category in context.${ctx}: ${cat}`);
        if (!validDecisions.includes(dec)) errors.push(`Invalid decision in context.${ctx}.${cat}: ${dec}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export default PolicyEngine;