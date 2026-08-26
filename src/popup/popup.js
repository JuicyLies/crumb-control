// popup.js - Compact panel UI for Universal Data Permission Layer

import { PolicyEngine } from '../shared/PolicyEngine.js';

const CATEGORY_ORDER = ['necessary', 'preferences', 'analytics', 'marketing', 'social', 'unclassified'];

const CATEGORY_LABELS = {
  necessary: 'Necessary',
  preferences: 'Preferences',
  analytics: 'Analytics',
  marketing: 'Marketing',
  social: 'Social',
  unclassified: 'Other'
};

const AUDIT_PAGE_SIZE = 20;

class Popup {
  constructor() {
    this.policyEngine = new PolicyEngine();
    this.hostname = '';
    this.currentAuditPage = 1;
    this.auditFilter = 'all';
    this.auditSearch = '';
    this.siteOverrideEditId = null;
    this.currentPreset = 'essential';
  }

  async init() {
    this.setupTabs();
    this.setupHomeTab();
    this.setupLogTab();
    this.setupSettingsTab();
    this.setupModal();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      try {
        this.hostname = new URL(tab.url).hostname;
      } catch (e) {
        this.hostname = '';
      }
    }
    document.getElementById('currentSite').textContent = this.hostname || '—';

    await this.loadPolicy();
    await this.loadPreset();
    await this.loadDecisions();
    await this.loadAuditLog();
    await this.loadSiteOverrides();
    await this.loadStatistics();
    await this.loadDisabledState();

    document.getElementById('aboutVersion').textContent = `Version ${chrome.runtime.getManifest().version}`;
  }

  // ============ Tabs ============

  setupTabs() {
    const navBtns = document.querySelectorAll('.nav-icon-btn');
    const panels = document.querySelectorAll('.tab-panel');

    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        panels.forEach(p => p.classList.remove('active'));
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      });
    });
  }

  // ============ Home tab ============

  setupHomeTab() {
    const toggleBtn = document.getElementById('toggleSite');
    toggleBtn.addEventListener('click', async () => {
      const isDisabled = toggleBtn.dataset.disabled === 'true';
      await this.toggleSiteProtection(!isDisabled);
      toggleBtn.dataset.disabled = (!isDisabled).toString();
      toggleBtn.textContent = isDisabled ? 'Disable on this site' : 'Enable on this site';
    });

    document.getElementById('reportIssue').addEventListener('click', () => {
      const url = `https://github.com/JuicyLies/UniversalDataPermissionLayer/issues/new?template=broken-cmp.yml&title=[CMP]%20${encodeURIComponent(this.hostname)}`;
      chrome.tabs.create({ url });
      window.close();
    });

    document.getElementById('exportDSR').addEventListener('click', async (e) => {
      e.preventDefault();
      const link = e.target;
      const original = link.textContent;
      link.textContent = 'Exporting...';
      const response = await this.sendMessage({ type: 'EXPORT_DSR' });
      if (response?.data) {
        this.downloadJSON(response.data, `udp-dsr-${new Date().toISOString().split('T')[0]}.json`);
      }
      link.textContent = original;
    });
  }

  async loadDecisions() {
    const response = await this.sendMessage({ type: 'GET_DECISIONS', site: this.hostname });
    const decisions = response?.decisions || {};
    this.renderDecisions(decisions);
    this.updateProtectionStatus(decisions);
  }

  renderDecisions(decisions) {
    const grid = document.getElementById('decisionsGrid');
    grid.innerHTML = '';
    for (const category of CATEGORY_ORDER) {
      const decision = decisions[category];
      if (!decision) continue;
      const card = document.createElement('div');
      card.className = 'decision-card';
      card.innerHTML = `
        <span class="decision-name">${CATEGORY_LABELS[category] || category}</span>
        <span class="decision-value ${decision}">${decision.toUpperCase()}</span>
      `;
      grid.appendChild(card);
    }
  }

  updateProtectionStatus(decisions) {
    const el = document.getElementById('protectionStatus');
    const values = Object.values(decisions);
    if (values.length === 0) {
      el.textContent = 'Unable to determine status';
      el.className = 'status-banner';
      return;
    }
    const rejectCount = values.filter(d => d === 'reject').length;
    const allowCount = values.filter(d => d === 'allow').length;

    if (rejectCount > 0 && allowCount <= 1) {
      el.textContent = 'Fully protected';
      el.className = 'status-banner protected';
    } else if (rejectCount > 0) {
      el.textContent = 'Partially protected';
      el.className = 'status-banner partial';
    } else {
      el.textContent = 'Minimal protection';
      el.className = 'status-banner unprotected';
    }
  }

  async loadDisabledState() {
    const { disabledPages } = await chrome.storage.sync.get({ disabledPages: {} });
    const isDisabled = !!disabledPages[this.hostname];
    const toggleBtn = document.getElementById('toggleSite');
    toggleBtn.dataset.disabled = isDisabled.toString();
    toggleBtn.textContent = isDisabled ? 'Enable on this site' : 'Disable on this site';
  }

  async toggleSiteProtection(disable) {
    const { disabledPages } = await chrome.storage.sync.get({ disabledPages: {} });
    if (disable) {
      disabledPages[this.hostname] = true;
    } else {
      delete disabledPages[this.hostname];
    }
    await chrome.storage.sync.set({ disabledPages });
    this.sendMessage({ type: 'POLICY_UPDATED' }).catch(() => {});
  }

  // ============ Log tab ============

  setupLogTab() {
    document.getElementById('auditFilter').addEventListener('change', (e) => {
      this.auditFilter = e.target.value;
      this.currentAuditPage = 1;
      this.loadAuditLog();
    });
    document.getElementById('auditSearch').addEventListener('input', (e) => {
      this.auditSearch = e.target.value;
      this.currentAuditPage = 1;
      this.loadAuditLog();
    });
    document.getElementById('auditPrev').addEventListener('click', () => {
      if (this.currentAuditPage > 1) {
        this.currentAuditPage--;
        this.loadAuditLog();
      }
    });
    document.getElementById('auditNext').addEventListener('click', () => {
      this.currentAuditPage++;
      this.loadAuditLog();
    });
    document.getElementById('clearAudit').addEventListener('click', async (e) => {
      e.preventDefault();
      if (!confirm('Clear entire audit log? This cannot be undone.')) return;
      await chrome.storage.local.set({ udp_audit_log: [] });
      this.currentAuditPage = 1;
      await this.loadAuditLog();
    });
  }

  async loadAuditLog() {
    const response = await this.sendMessage({ type: 'GET_AUDIT_LOG', limit: 10000 });
    let log = response?.log || [];

    if (this.auditFilter === 'success') log = log.filter(e => e.success);
    else if (this.auditFilter === 'failed') log = log.filter(e => !e.success);

    if (this.auditSearch) {
      const search = this.auditSearch.toLowerCase();
      log = log.filter(e =>
        (e.site && e.site.toLowerCase().includes(search)) ||
        (e.cmp && e.cmp.toLowerCase().includes(search))
      );
    }

    log.sort((a, b) => b.timestamp - a.timestamp);

    const totalPages = Math.max(1, Math.ceil(log.length / AUDIT_PAGE_SIZE));
    this.currentAuditPage = Math.min(this.currentAuditPage, totalPages);
    const start = (this.currentAuditPage - 1) * AUDIT_PAGE_SIZE;
    const pageEntries = log.slice(start, start + AUDIT_PAGE_SIZE);

    this.renderAuditList(pageEntries);
    document.getElementById('auditPageInfo').textContent = `Page ${this.currentAuditPage} of ${totalPages}`;
    document.getElementById('auditPrev').disabled = this.currentAuditPage <= 1;
    document.getElementById('auditNext').disabled = this.currentAuditPage >= totalPages;
  }

  renderAuditList(entries) {
    const container = document.getElementById('auditList');
    if (entries.length === 0) {
      container.innerHTML = '<div class="empty-state">No entries match your filters</div>';
      return;
    }
    container.innerHTML = entries.map(entry => `
      <div class="log-entry">
        <div class="log-entry-top">
          <span class="log-entry-site" title="${this.escapeHtml(entry.site)}">${this.escapeHtml(entry.site)}</span>
          <span class="log-entry-time">${this.formatTime(entry.timestamp)}</span>
        </div>
        <div class="log-entry-meta">
          <span>${this.escapeHtml(entry.cmp || '—')}</span>
          <span class="status-badge ${entry.success ? 'success' : 'failed'}">${entry.success ? 'Success' : 'Failed'}</span>
        </div>
      </div>
    `).join('');
  }

  // ============ Settings tab ============

  setupSettingsTab() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectPreset(btn.dataset.preset));
    });

    document.querySelectorAll('#customToggles input[data-cat]').forEach(input => {
      input.addEventListener('change', () => this.onCustomToggleChange());
    });

    document.getElementById('btnAddSiteOverride').addEventListener('click', () => this.openSiteOverrideModal());

    document.getElementById('btnValidatePolicy').addEventListener('click', () => this.validatePolicy());
    document.getElementById('btnResetPolicy').addEventListener('click', () => this.resetPolicy());
    document.getElementById('btnSavePolicy').addEventListener('click', () => this.savePolicyFromEditor());
  }

  async loadPolicy() {
    const response = await this.sendMessage({ type: 'GET_POLICY' });
    if (response?.policy) {
      this.policyEngine.load(response.policy);
    }
    this.updatePolicyEditor();
  }

  async loadPreset() {
    const response = await this.sendMessage({ type: 'GET_PRESET' });
    this.currentPreset = response?.preset || 'essential';
    this.renderPresetSelection();
  }

  renderPresetSelection() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === this.currentPreset);
    });

    const customToggles = document.getElementById('customToggles');
    if (this.currentPreset === 'custom') {
      customToggles.hidden = false;
      const decisions = this.policyEngine.policy.global;
      document.querySelectorAll('#customToggles input[data-cat]').forEach(input => {
        input.checked = decisions[input.dataset.cat] === 'allow';
      });
    } else {
      customToggles.hidden = true;
    }
  }

  async selectPreset(preset) {
    this.currentPreset = preset;
    this.renderPresetSelection();

    if (preset === 'custom') {
      // Reflect current toggle state into policy (don't overwrite until user flips one)
      return;
    }

    await this.sendMessage({ type: 'SET_PRESET', preset });
    await this.loadPolicy();
    await this.loadDecisions();
  }

  async onCustomToggleChange() {
    document.querySelectorAll('#customToggles input[data-cat]').forEach(input => {
      this.policyEngine.setGlobalDefault(input.dataset.cat, input.checked ? 'allow' : 'reject');
    });
    await this.persistPolicy('custom');
    this.updatePolicyEditor();
    await this.loadDecisions();
  }

  async persistPolicy(preset) {
    await this.sendMessage({ type: 'SET_POLICY', policy: this.policyEngine.serialize(), preset });
  }

  // ---- Advanced: policy YAML editor ----

  updatePolicyEditor() {
    document.getElementById('policyEditor').value = this.policyEngine.toYAML();
  }

  validatePolicy() {
    const editor = document.getElementById('policyEditor');
    const results = document.getElementById('validationResults');
    try {
      const parsed = this.policyEngine.parseYAML(editor.value);
      const tempEngine = new PolicyEngine();
      tempEngine.load(parsed);
      const validation = tempEngine.validate();
      if (validation.valid) {
        results.innerHTML = '<span class="valid">Policy is valid</span>';
      } else {
        results.innerHTML = `<span class="errors">Validation errors:</span><ul>${validation.errors.map(e => `<li>${this.escapeHtml(e)}</li>`).join('')}</ul>`;
      }
    } catch (e) {
      results.innerHTML = `<span class="errors">Parse error: ${this.escapeHtml(e.message)}</span>`;
    }
  }

  async resetPolicy() {
    if (!confirm('Reset policy to defaults? This cannot be undone.')) return;
    await this.sendMessage({ type: 'SET_PRESET', preset: 'essential' });
    await this.loadPolicy();
    this.currentPreset = 'essential';
    this.renderPresetSelection();
    await this.loadDecisions();
  }

  async savePolicyFromEditor() {
    const editor = document.getElementById('policyEditor');
    try {
      const parsed = this.policyEngine.parseYAML(editor.value);
      this.policyEngine.load(parsed);
      const validation = this.policyEngine.validate();
      if (!validation.valid) {
        alert('Policy has validation errors:\n' + validation.errors.join('\n'));
        return;
      }
      await this.persistPolicy('custom');
      this.currentPreset = 'custom';
      this.renderPresetSelection();
      this.validatePolicy();
      await this.loadDecisions();
    } catch (e) {
      alert('Failed to save policy: ' + e.message);
    }
  }

  // ---- Advanced: site overrides ----

  async loadSiteOverrides() {
    const container = document.getElementById('sitesList');
    const sites = this.policyEngine.policy.sites || {};

    if (Object.keys(sites).length === 0) {
      container.innerHTML = '<div class="empty-state">No overrides. Global policy applies everywhere.</div>';
      return;
    }

    container.innerHTML = Object.entries(sites).map(([host, rules]) => `
      <div class="site-override-item" data-host="${this.escapeHtml(host)}">
        <div class="site-override-info">
          <span class="site-override-host">${this.escapeHtml(host)}</span>
          <span class="site-override-rule">${Object.entries(rules).map(([cat, dec]) => `${cat}: ${dec}`).join(', ')}</span>
        </div>
        <div class="site-override-actions">
          <button class="btn btn-ghost btn-sm" data-edit="${this.escapeHtml(host)}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-delete="${this.escapeHtml(host)}">Delete</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => this.openSiteOverrideModal(btn.dataset.edit));
    });
    container.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => this.deleteSiteOverride(btn.dataset.delete));
    });
  }

  setupModal() {
    const modal = document.getElementById('siteOverrideModal');
    modal.addEventListener('close', () => {
      if (modal.returnValue === 'default') this.saveSiteOverride();
    });
    document.getElementById('modalSave').addEventListener('click', () => modal.close('default'));
  }

  openSiteOverrideModal(host = null) {
    const modal = document.getElementById('siteOverrideModal');
    const title = document.getElementById('modalTitle');
    const siteInput = document.getElementById('modalSite');

    if (host) {
      this.siteOverrideEditId = host;
      title.textContent = 'Edit site override';
      siteInput.value = host;
      siteInput.disabled = true;
      const rules = this.policyEngine.policy.sites[host] || {};
      const firstCategory = Object.keys(rules)[0] || 'analytics';
      document.getElementById('modalCategory').value = firstCategory;
      document.getElementById('modalDecision').value = rules[firstCategory] || 'reject';
    } else {
      this.siteOverrideEditId = null;
      title.textContent = 'Add site override';
      siteInput.value = this.hostname || '';
      siteInput.disabled = false;
      document.getElementById('modalCategory').value = 'analytics';
      document.getElementById('modalDecision').value = 'reject';
    }

    modal.showModal();
  }

  async saveSiteOverride() {
    const host = document.getElementById('modalSite').value.trim();
    const category = document.getElementById('modalCategory').value;
    const decision = document.getElementById('modalDecision').value;
    if (!host) return;

    if (this.siteOverrideEditId && this.siteOverrideEditId !== host) {
      delete this.policyEngine.policy.sites[this.siteOverrideEditId];
    }
    this.policyEngine.setSiteOverride(host, category, decision);
    await this.persistPolicy(this.currentPreset);
    await this.loadSiteOverrides();
    await this.loadDecisions();
  }

  async deleteSiteOverride(host) {
    if (!confirm(`Delete override for ${host}?`)) return;
    delete this.policyEngine.policy.sites[host];
    await this.persistPolicy(this.currentPreset);
    await this.loadSiteOverrides();
    await this.loadDecisions();
  }

  // ---- Advanced: statistics ----

  async loadStatistics() {
    const response = await this.sendMessage({ type: 'GET_STATISTICS' });
    const stats = response?.statistics || { cmps: {}, sites: {} };
    const auditResponse = await this.sendMessage({ type: 'GET_AUDIT_LOG', limit: 100000 });

    document.getElementById('statCmps').textContent = Object.values(stats.cmps || {}).reduce((a, b) => a + b, 0);
    document.getElementById('statSites').textContent = Object.keys(stats.sites || {}).length;
    document.getElementById('statEntries').textContent = (auditResponse?.log || []).length;
  }

  // ============ Utilities ============

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => resolve(response));
    });
  }

  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const diff = Date.now() - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  }

  escapeHtml(text) {
    if (!text) return '—';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => new Popup().init());
