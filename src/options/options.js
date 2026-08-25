// options.js - Main dashboard logic for Universal Data Permission Layer

import { PolicyEngine, CONSENT_CATEGORIES, CONSENT_DECISIONS } from '../shared/PolicyEngine.js';

const STORAGE_KEYS = {
  POLICY: 'udp_policy',
  AUDIT_LOG: 'udp_audit_log',
  SYNC_CONFIG: 'udp_sync_config',
  STATISTICS: 'udp_statistics'
};

const AUDIT_PAGE_SIZE = 50;

class OptionsDashboard {
  constructor() {
    this.policyEngine = new PolicyEngine();
    this.currentAuditPage = 1;
    this.auditFilter = 'all';
    this.auditSearch = '';
    this.siteOverrideEditId = null;
    this.init();
  }

  async init() {
    console.log('[UDP] Dashboard initializing...');
    
    // Load policy
    await this.loadPolicy();
    
    // Set up tab navigation
    this.setupTabs();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load all tab data
    await this.loadDashboardData();
    await this.loadAuditLog();
    await this.loadSiteOverrides();
    await this.loadSyncConfig();
    await this.loadStatistics();
    
    console.log('[UDP] Dashboard ready');
  }

  async loadPolicy() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ [STORAGE_KEYS.POLICY]: null }, (result) => {
        if (result[STORAGE_KEYS.POLICY]) {
          this.policyEngine.load(result[STORAGE_KEYS.POLICY]);
        }
        this.updatePolicyEditor();
        resolve();
      });
    });
  }

  setupTabs() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        tabPanels.forEach(p => p.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
      });
    });
  }

  setupEventListeners() {
    // Header actions
    document.getElementById('btnSyncNow').addEventListener('click', () => this.syncNow());
    document.getElementById('btnExportDSR').addEventListener('click', () => this.exportDSR());
    document.getElementById('btnImportPolicy').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', (e) => this.importPolicy(e));
    
    // Policy editor
    document.getElementById('policyEditor').addEventListener('input', () => this.onPolicyEdit());
    document.getElementById('btnValidatePolicy').addEventListener('click', () => this.validatePolicy());
    document.getElementById('btnResetPolicy').addEventListener('click', () => this.resetPolicy());
    document.getElementById('btnSavePolicy').addEventListener('click', () => this.savePolicy());
    
    // Audit log
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
    document.getElementById('btnClearAudit').addEventListener('click', () => this.clearAuditLog());
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
    
    // Site overrides
    document.getElementById('btnAddSiteOverride').addEventListener('click', () => this.openSiteOverrideModal());
    
    // Site override modal
    document.getElementById('siteOverrideModal').addEventListener('close', (e) => {
      if (e.target.returnValue === 'default') {
        this.saveSiteOverride();
      }
    });
    document.getElementById('modalSave').addEventListener('click', () => {
      document.getElementById('siteOverrideModal').close('default');
    });
    
    // Cloud sync
    document.getElementById('syncEnabled').addEventListener('change', (e) => {
      const enabled = e.target.checked;
      document.getElementById('syncFields').style.display = enabled ? 'block' : 'none';
      document.getElementById('syncFields2').style.display = enabled ? 'block' : 'none';
      document.getElementById('syncFields3').style.display = enabled ? 'block' : 'none';
      document.getElementById('syncActions').style.display = enabled ? 'flex' : 'none';
    });
    document.getElementById('btnTestSync').addEventListener('click', () => this.testSync());
    document.getElementById('btnSaveSync').addEventListener('click', () => this.saveSyncConfig());
    
    // Policy editor live preview
    let previewDebounce;
    document.getElementById('policyEditor').addEventListener('input', () => {
      clearTimeout(previewDebounce);
      previewDebounce = setTimeout(() => this.updatePolicyPreview(), 300);
    });
  }

  // ============ Dashboard Tab ============
  
  async loadDashboardData() {
    const [statsResult, auditResult] = await Promise.all([
      chrome.storage.local.get({ [STORAGE_KEYS.STATISTICS]: { clicks: 0, cmps: {}, sites: {} } }),
      chrome.storage.local.get({ [STORAGE_KEYS.AUDIT_LOG]: [] })
    ]);
    
    const stats = statsResult[STORAGE_KEYS.STATISTICS];
    const auditLog = auditResult[STORAGE_KEYS.AUDIT_LOG];
    
    // Protected sites count (sites with at least one reject decision)
    const sitesWithOverrides = Object.keys(this.policyEngine.policy.sites || {}).length;
    const protectedSites = new Set([
      ...Object.keys(stats.sites || {}),
      ...Object.keys(this.policyEngine.policy.sites || {})
    ]).size;
    
    document.getElementById('statProtectedSites').textContent = protectedSites;
    document.getElementById('statCmpsBlocked').textContent = Object.values(stats.cmps || {}).reduce((a, b) => a + b, 0);
    document.getElementById('statAuditEntries').textContent = auditLog.length;
    
    // Sync status
    const syncResult = await chrome.storage.local.get({ [STORAGE_KEYS.SYNC_CONFIG]: { enabled: false } });
    const syncStatus = syncResult[STORAGE_KEYS.SYNC_CONFIG].enabled ? 'Online' : 'Offline';
    document.getElementById('statSyncStatus').textContent = syncStatus;
    document.getElementById('statSyncStatus').style.color = syncResult[STORAGE_KEYS.SYNC_CONFIG].enabled ? 'var(--success)' : 'var(--text-muted)';
    
    // Recent activity
    this.renderRecentActivity(auditLog.slice(0, 10));
    
    // Top CMPs
    this.renderTopCmps(stats.cmps || {});
  }

  renderRecentActivity(auditLog) {
    const container = document.getElementById('recentActivity');
    
    if (auditLog.length === 0) {
      container.innerHTML = '<div class="empty-state">No activity yet. Browse some sites!</div>';
      return;
    }
    
    container.innerHTML = auditLog
      .slice()
      .reverse()
      .slice(0, 10)
      .map(entry => `
        <div class="activity-item">
          <div class="activity-info">
            <span class="activity-site">${this.escapeHtml(entry.site)}</span>
            <span class="activity-time">${this.formatTime(entry.timestamp)}</span>
          </div>
          <span class="activity-decision ${entry.decision}">${entry.decision}</span>
        </div>
      `).join('');
  }

  renderTopCmps(cmps) {
    const container = document.getElementById('topCmps');
    const sorted = Object.entries(cmps).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    if (sorted.length === 0) {
      container.innerHTML = '<div class="empty-state">No CMPs encountered yet</div>';
      return;
    }
    
    container.innerHTML = sorted.map(([name, count]) => `
      <div class="cmp-item">
        <div class="cmp-info">
          <span class="cmp-name">${this.escapeHtml(name)}</span>
          <span class="cmp-count">${count} encounters</span>
        </div>
        <span style="color: var(--primary); font-weight: 600;">${count}</span>
      </div>
    `).join('');
  }

  // ============ Policy Editor Tab ============
  
  updatePolicyEditor() {
    const editor = document.getElementById('policyEditor');
    editor.value = this.policyEngine.toYAML();
    this.updatePolicyPreview();
  }
  
  updatePolicyPreview() {
    const editor = document.getElementById('policyEditor');
    const preview = document.getElementById('policyPreviewContent');
    
    try {
      const parsed = this.policyEngine.parseYAML(editor.value);
      preview.textContent = JSON.stringify(parsed, null, 2);
      preview.style.color = '#a5b4fc';
    } catch (e) {
      preview.textContent = `Parse error: ${e.message}`;
      preview.style.color = 'var(--danger)';
    }
  }
  
  onPolicyEdit() {
    // Just update preview, don't save yet
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
        results.innerHTML = '<span class="valid">✓ Policy is valid</span>';
      } else {
        results.innerHTML = `
          <span class="errors">✗ Validation errors:</span>
          <ul>${validation.errors.map(e => `<li>${this.escapeHtml(e)}</li>`).join('')}</ul>
        `;
      }
    } catch (e) {
      results.innerHTML = `<span class="errors">✗ Parse error: ${this.escapeHtml(e.message)}</span>`;
    }
  }
  
  resetPolicy() {
    if (!confirm('Reset policy to defaults? This cannot be undone.')) return;
    
    this.policyEngine = new PolicyEngine();
    this.updatePolicyEditor();
    this.validatePolicy();
  }
  
  async savePolicy() {
    const editor = document.getElementById('policyEditor');
    
    try {
      const parsed = this.policyEngine.parseYAML(editor.value);
      this.policyEngine.load(parsed);
      
      const validation = this.policyEngine.validate();
      if (!validation.valid) {
        alert('Policy has validation errors:\n' + validation.errors.join('\n'));
        return;
      }
      
      await chrome.storage.sync.set({ [STORAGE_KEYS.POLICY]: this.policyEngine.serialize() });
      
      // Notify background
      chrome.runtime.sendMessage({ type: 'SET_POLICY', policy: this.policyEngine.serialize() });
      
      this.validatePolicy();
      this.showToast('Policy saved successfully');
      
      // Refresh dashboard
      await this.loadDashboardData();
    } catch (e) {
      alert('Failed to save policy: ' + e.message);
    }
  }

  // ============ Audit Log Tab ============
  
  async loadAuditLog() {
    const result = await chrome.storage.local.get({ [STORAGE_KEYS.AUDIT_LOG]: [] });
    let log = result[STORAGE_KEYS.AUDIT_LOG];
    
    // Apply filters
    if (this.auditFilter === 'success') {
      log = log.filter(e => e.success);
    } else if (this.auditFilter === 'failed') {
      log = log.filter(e => !e.success);
    }
    
    if (this.auditSearch) {
      const search = this.auditSearch.toLowerCase();
      log = log.filter(e => 
        (e.site && e.site.toLowerCase().includes(search)) ||
        (e.cmp && e.cmp.toLowerCase().includes(search)) ||
        (e.category && e.category.toLowerCase().includes(search))
      );
    }
    
    // Sort: newest first
    log.sort((a, b) => b.timestamp - a.timestamp);
    
    // Pagination
    const totalPages = Math.max(1, Math.ceil(log.length / AUDIT_PAGE_SIZE));
    this.currentAuditPage = Math.min(this.currentAuditPage, totalPages);
    
    const start = (this.currentAuditPage - 1) * AUDIT_PAGE_SIZE;
    const pageEntries = log.slice(start, start + AUDIT_PAGE_SIZE);
    
    this.renderAuditTable(pageEntries);
    this.updateAuditPagination(totalPages);
  }
  
  renderAuditTable(entries) {
    const tbody = document.querySelector('#auditTable tbody');
    
    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No entries match your filters</td></tr>';
      return;
    }
    
    tbody.innerHTML = entries.map(entry => `
      <tr>
        <td class="time">${this.formatTime(entry.timestamp)}</td>
        <td class="site" title="${this.escapeHtml(entry.site)}">${this.escapeHtml(entry.site)}</td>
        <td class="cmp" title="${this.escapeHtml(entry.cmp || '—')}">${this.escapeHtml(entry.cmp || '—')}</td>
        <td>${this.escapeHtml(entry.category)}</td>
        <td><span class="decision-badge ${entry.decision}">${entry.decision}</span></td>
        <td>${this.escapeHtml(entry.action)}</td>
        <td><span class="status-badge ${entry.success ? 'success' : 'failed'}">${entry.success ? 'Success' : 'Failed'}</span></td>
      </tr>
    `).join('');
  }
  
  updateAuditPagination(totalPages) {
    document.getElementById('auditPageInfo').textContent = `Page ${this.currentAuditPage} of ${totalPages}`;
    document.getElementById('auditPrev').disabled = this.currentAuditPage <= 1;
    document.getElementById('auditNext').disabled = this.currentAuditPage >= totalPages;
  }
  
  async clearAuditLog() {
    if (!confirm('Clear entire audit log? This cannot be undone.')) return;
    
    await chrome.storage.local.set({ [STORAGE_KEYS.AUDIT_LOG]: [] });
    this.loadAuditLog();
    this.showToast('Audit log cleared');
  }
  
  async exportDSR() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'EXPORT_DSR' }, (response) => {
        if (response && response.data) {
          this.downloadJSON(response.data, `udp-dsr-${new Date().toISOString().split('T')[0]}.json`);
          this.showToast('DSR export downloaded');
        }
        resolve();
      });
    });
  }

  // ============ Site Overrides Tab ============
  
  async loadSiteOverrides() {
    const container = document.getElementById('sitesList');
    const sites = this.policyEngine.policy.sites || {};
    
    if (Object.keys(sites).length === 0) {
      container.innerHTML = '<div class="empty-state">No site overrides configured. Global policy applies everywhere.</div>';
      return;
    }
    
    container.innerHTML = Object.entries(sites).map(([host, rules]) => `
      <div class="site-override-item" data-host="${this.escapeHtml(host)}">
        <div class="site-override-info">
          <span class="site-override-host">${this.escapeHtml(host)}</span>
          <span class="site-override-rule">${Object.entries(rules).map(([cat, dec]) => `${cat}: ${dec}`).join(', ')}</span>
        </div>
        <div class="site-override-actions">
          <button class="btn btn-secondary btn-sm" onclick="window.editSiteOverride('${this.escapeHtml(host)}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="window.deleteSiteOverride('${this.escapeHtml(host)}')">Delete</button>
        </div>
      </div>
    `).join('');
    
    // Make functions globally accessible for inline handlers
    window.editSiteOverride = (host) => this.openSiteOverrideModal(host);
    window.deleteSiteOverride = (host) => this.deleteSiteOverride(host);
  }
  
  openSiteOverrideModal(host = null) {
    const modal = document.getElementById('siteOverrideModal');
    const title = document.getElementById('modalTitle');
    const siteInput = document.getElementById('modalSite');
    
    if (host) {
      // Edit mode
      this.siteOverrideEditId = host;
      title.textContent = 'Edit Site Override';
      siteInput.value = host;
      siteInput.disabled = true;
      
      const rules = this.policyEngine.policy.sites[host] || {};
      const firstCategory = Object.keys(rules)[0] || 'analytics';
      const firstDecision = rules[firstCategory] || 'reject';
      
      document.getElementById('modalCategory').value = firstCategory;
      document.getElementById('modalDecision').value = firstDecision;
    } else {
      // Add mode
      this.siteOverrideEditId = null;
      title.textContent = 'Add Site Override';
      siteInput.value = '';
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
    
    if (!host) {
      alert('Please enter a site hostname');
      return;
    }
    
    if (this.siteOverrideEditId && this.siteOverrideEditId !== host) {
      // Host changed - delete old, add new
      this.policyEngine.policy.sites = this.policyEngine.policy.sites || {};
      delete this.policyEngine.policy.sites[this.siteOverrideEditId];
    }
    
    this.policyEngine.setSiteOverride(host, category, decision);
    await chrome.storage.sync.set({ [STORAGE_KEYS.POLICY]: this.policyEngine.serialize() });
    
    // Notify background
    chrome.runtime.sendMessage({ type: 'SET_POLICY', policy: this.policyEngine.serialize() });
    
    this.loadSiteOverrides();
    await this.loadDashboardData();
    this.showToast('Site override saved');
  }
  
  async deleteSiteOverride(host) {
    if (!confirm(`Delete override for ${host}?`)) return;
    
    delete this.policyEngine.policy.sites[host];
    await chrome.storage.sync.set({ [STORAGE_KEYS.POLICY]: this.policyEngine.serialize() });
    chrome.runtime.sendMessage({ type: 'SET_POLICY', policy: this.policyEngine.serialize() });
    
    this.loadSiteOverrides();
    await this.loadDashboardData();
    this.showToast('Site override deleted');
  }

  // ============ Cloud Sync Tab ============
  
  async loadSyncConfig() {
    const result = await chrome.storage.local.get({ [STORAGE_KEYS.SYNC_CONFIG]: { enabled: false } });
    const config = result[STORAGE_KEYS.SYNC_CONFIG];
    
    document.getElementById('syncEnabled').checked = config.enabled;
    document.getElementById('syncFields').style.display = config.enabled ? 'block' : 'none';
    document.getElementById('syncFields2').style.display = config.enabled ? 'block' : 'none';
    document.getElementById('syncFields3').style.display = config.enabled ? 'block' : 'none';
    document.getElementById('syncActions').style.display = config.enabled ? 'flex' : 'none';
    
    if (config.endpoint) document.getElementById('syncEndpoint').value = config.endpoint;
    if (config.deviceName) document.getElementById('syncDeviceName').value = config.deviceName;
    // Don't show passphrase
    
    if (config.enabled) {
      document.getElementById('syncStatus').style.display = 'block';
      document.getElementById('lastSync').textContent = config.lastSync ? new Date(config.lastSync).toLocaleString() : 'Never';
      document.getElementById('syncedCount').textContent = config.syncedCount || 0;
      document.getElementById('deviceId').textContent = config.deviceId || '—';
    }
  }
  
  async saveSyncConfig() {
    const endpoint = document.getElementById('syncEndpoint').value.trim();
    const passphrase = document.getElementById('syncPassphrase').value;
    const deviceName = document.getElementById('syncDeviceName').value.trim();
    
    if (!endpoint || !passphrase || !deviceName) {
      alert('Please fill in all fields');
      return;
    }
    
    if (passphrase.length < 12) {
      alert('Passphrase must be at least 12 characters');
      return;
    }
    
    const deviceId = crypto.randomUUID();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    const config = {
      enabled: true,
      endpoint,
      passphrase, // Stored locally only, used for key derivation
      salt: btoa(String.fromCharCode(...salt)),
      deviceId,
      deviceName,
      lastSync: null,
      syncedCount: 0
    };
    
    await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_CONFIG]: config });
    
    // Initialize crypto in background
    chrome.runtime.sendMessage({ type: 'SET_SYNC_CONFIG', config });
    
    this.loadSyncConfig();
    this.showToast('Sync configured. Starting first sync...');
    
    // Trigger sync
    setTimeout(() => this.syncNow(), 1000);
  }
  
  async testSync() {
    const endpoint = document.getElementById('syncEndpoint').value.trim();
    if (!endpoint) {
      alert('Please enter an endpoint URL');
      return;
    }
    
    const btn = document.getElementById('btnTestSync');
    btn.textContent = 'Testing...';
    btn.disabled = true;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, deviceId: 'test' })
      });
      
      if (response.ok) {
        this.showToast('Connection test successful');
      } else {
        this.showToast(`Test failed: ${response.status}`, 'error');
      }
    } catch (e) {
      this.showToast(`Test failed: ${e.message}`, 'error');
    } finally {
      btn.textContent = 'Test Connection';
      btn.disabled = false;
    }
  }
  
  async syncNow() {
    const btn = document.getElementById('btnSyncNow');
    const originalHTML = btn.innerHTML;
    
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    btn.disabled = true;
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'SYNC_NOW' }, async (response) => {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        
        if (response?.success) {
          this.showToast('Sync completed');
          await this.loadSyncConfig();
          await this.loadDashboardData();
        } else {
          this.showToast('Sync failed (check configuration)', 'error');
        }
        resolve();
      });
    });
  }

  // ============ Statistics Tab ============
  
  async loadStatistics() {
    const result = await chrome.storage.local.get({ [STORAGE_KEYS.STATISTICS]: { clicks: 0, cmps: {}, sites: {} } });
    const stats = result[STORAGE_KEYS.STATISTICS];
    
    // Top sites
    const topSites = Object.entries(stats.sites || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    document.getElementById('topSitesList').innerHTML = topSites.length > 0
      ? topSites.map(([site, count]) => `
          <div class="site-stat-item">
            <span class="site-stat-name">${this.escapeHtml(site)}</span>
            <span class="site-stat-count">${count}</span>
          </div>
        `).join('')
      : '<div class="empty-state">No data yet</div>';
    
    // CMP coverage
    const topCmps = Object.entries(stats.cmps || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    document.getElementById('cmpCoverageList').innerHTML = topCmps.length > 0
      ? topCmps.map(([cmp, count]) => `
          <div class="cmp-stat-item">
            <span class="cmp-stat-name">${this.escapeHtml(cmp)}</span>
            <span class="cmp-stat-count">${count}</span>
          </div>
        `).join('')
      : '<div class="empty-state">No data yet</div>';
    
    // Chart would need Chart.js - skipping for now to keep deps minimal
    // Could add a simple CSS-based bar chart instead
  }

  // ============ Import/Export ============
  
  async importPolicy(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const text = await file.text();
    const ext = file.name.split('.').pop().toLowerCase();
    
    try {
      let parsed;
      if (ext === 'json') {
        parsed = JSON.parse(text);
      } else {
        parsed = this.policyEngine.parseYAML(text);
      }
      
      this.policyEngine.load(parsed);
      this.updatePolicyEditor();
      this.validatePolicy();
      this.showToast('Policy imported. Click Save to apply.');
    } catch (e) {
      alert('Import failed: ' + e.message);
    }
    
    event.target.value = '';
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

  // ============ Utilities ============
  
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  escapeHtml(text) {
    if (!text) return '—';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  showToast(message, type = 'success') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      background: ${type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)'};
      color: white;
      border-radius: var(--radius-sm);
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    
    // Add animation style if not exists
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new OptionsDashboard());
} else {
  new OptionsDashboard();
}

export { OptionsDashboard };