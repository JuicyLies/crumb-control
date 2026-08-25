// popup.js - Popup UI for Universal Data Permission Layer

const CATEGORY_LABELS = {
  necessary: 'Necessary',
  preferences: 'Preferences',
  analytics: 'Analytics',
  marketing: 'Marketing',
  social: 'Social',
  unclassified: 'Other'
};

const CATEGORY_ICONS = {
  necessary: '🔒',
  preferences: '⚙️',
  analytics: '📊',
  marketing: '🎯',
  social: '👥',
  unclassified: '❓'
};

document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab?.url) return;
  
  const url = new URL(tab.url);
  const hostname = url.hostname;
  
  // Update site display
  document.getElementById('currentSite').textContent = hostname;
  
  // Load policy and decisions from background
  await loadDecisions(hostname);
  
  // Load statistics
  await loadStatistics();
  
  // Set up event listeners
  setupEventListeners(hostname);
});

async function loadDecisions(hostname) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_DECISIONS', site: hostname }, (response) => {
      if (response && response.decisions) {
        renderDecisions(response.decisions, hostname);
        updateProtectionStatus(response.decisions);
      }
      resolve();
    });
  });
}

function renderDecisions(decisions, hostname) {
  const grid = document.getElementById('decisionsGrid');
  grid.innerHTML = '';
  
  for (const [category, decision] of Object.entries(decisions)) {
    const card = document.createElement('div');
    card.className = `decision-card ${decision === 'allow' ? 'protected' : ''}`;
    
    const icon = CATEGORY_ICONS[category] || '❓';
    const label = CATEGORY_LABELS[category] || category;
    
    card.innerHTML = `
      <div class="decision-header">
        <span class="decision-name">${icon} ${label}</span>
        <span class="decision-value ${decision}">${decision.toUpperCase()}</span>
      </div>
      <div class="decision-source">
        Source: ${getDecisionSource(category, decisions)}
      </div>
    `;
    
    grid.appendChild(card);
  }
}

function getDecisionSource(category, decisions) {
  // In a full implementation, we'd track whether this came from global, site, or context rules
  // For now, just indicate it's from policy
  return 'Policy';
}

function updateProtectionStatus(decisions) {
  const statusEl = document.getElementById('protectionStatus');
  const hasProtection = Object.values(decisions).some(d => d === 'reject' || d === 'allow');
  
  if (hasProtection) {
    const rejectCount = Object.values(decisions).filter(d => d === 'reject').length;
    const allowCount = Object.values(decisions).filter(d => d === 'allow').length;
    
    if (rejectCount > 0 && allowCount === 1) { // Only necessary allowed
      statusEl.textContent = '🛡 Fully Protected';
      statusEl.className = 'status-value protected';
    } else if (rejectCount > 0) {
      statusEl.textContent = '🛡 Partially Protected';
      statusEl.className = 'status-value partial';
    } else {
      statusEl.textContent = '⚠️ Minimal Protection';
      statusEl.className = 'status-value partial';
    }
  } else {
    statusEl.textContent = '❌ Unprotected';
    statusEl.className = 'status-value unprotected';
  }
}

async function loadStatistics() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_STATISTICS' }, (response) => {
      if (response && response.statistics) {
        const totalCmps = Object.values(response.statistics.cmps || {}).reduce((a, b) => a + b, 0);
        document.getElementById('cmpsBlocked').textContent = totalCmps;
      }
      resolve();
    });
  });
}

function setupEventListeners(hostname) {
  // Open options/dashboard
  document.getElementById('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
  
  // Toggle site protection
  const toggleBtn = document.getElementById('toggleSite');
  toggleBtn.addEventListener('click', async () => {
    const isDisabled = toggleBtn.dataset.disabled === 'true';
    await toggleSiteProtection(hostname, !isDisabled);
    toggleBtn.dataset.disabled = (!isDisabled).toString();
    toggleBtn.textContent = isDisabled ? 'Disable on This Site' : 'Enable on This Site';
  });
  
  // Check current disabled state
  chrome.storage.sync.get({ disabledPages: {} }, ({ disabledPages }) => {
    const isDisabled = !!disabledPages[hostname];
    toggleBtn.dataset.disabled = isDisabled.toString();
    toggleBtn.textContent = isDisabled ? 'Enable on This Site' : 'Disable on This Site';
  });
  
  // Report broken CMP
  document.getElementById('reportIssue').addEventListener('click', () => {
    const url = `https://github.com/JuicyLies/UniversalDataPermissionLayer/issues/new?template=broken-cmp.yml&title=[CMP]%20${encodeURIComponent(hostname)}`;
    chrome.tabs.create({ url });
    window.close();
  });
  
  // View audit log
  document.getElementById('viewAudit').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    // The options page will handle showing audit log
    window.close();
  });
  
  // Export DSR
  document.getElementById('exportDSR').addEventListener('click', async (e) => {
    e.preventDefault();
    const btn = e.target;
    btn.textContent = 'Exporting...';
    btn.disabled = true;
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'EXPORT_DSR' }, (response) => {
        if (response && response.data) {
          downloadJSON(response.data, `udp-dsr-${new Date().toISOString().split('T')[0]}.json`);
        }
        btn.textContent = 'Export My Data (DSR)';
        btn.disabled = false;
        resolve();
      });
    });
  });
}

async function toggleSiteProtection(hostname, disable) {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ disabledPages: {} }, ({ disabledPages }) => {
      if (disable) {
        disabledPages[hostname] = true;
      } else {
        delete disabledPages[hostname];
      }
      chrome.storage.sync.set({ disabledPages }, () => {
        // Notify background
        chrome.runtime.sendMessage({ type: 'POLICY_UPDATED' }).catch(() => {});
        resolve();
      });
    });
  });
}

function downloadJSON(data, filename) {
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