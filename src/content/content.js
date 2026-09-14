// content.js - Content script for Crumb Control
// Bundled by webpack - imports Consent-O-Matic engine + our PolicyEngine

import { PolicyEngine, CONSENT_CATEGORIES, CONSENT_DECISIONS } from '../shared/PolicyEngine.js';
import ConsentEngine from '../../Consent-O-Matic/Extension/ConsentEngine.js';
import GDPRConfig from './GDPRConfig.js';
import { watchForTrackers } from './TrackerDetector.js';

let udpPolicyEngine = null;
let udpSiteHost = '';
let udpIsThirdParty = false;
let udpToastShown = false;
let pageStatus = 'initializing';
let pageTrackers = null;
let settingsChanged = false;

function sendMessage(message) {
  return chrome.runtime.sendMessage(message).then(response => {
    if (response?.error) throw new Error(response.error);
    return response;
  });
}

function setPageStatus(status) {
  if (pageStatus === 'handled' && status === 'nothing') return;
  pageStatus = status;
  if (window.top !== window.self && ['handled', 'error', 'unverified'].includes(status)) {
    sendMessage({ type: 'FRAME_STATUS', status }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type === 'GET_PAGE_STATE') {
    respond({ status: settingsChanged ? 'reload' : pageStatus, trackers: pageTrackers });
  } else if (message.type === 'FRAME_STATUS' && window.top === window.self) {
    if (pageStatus !== 'disabled' && !settingsChanged) setPageStatus(message.status);
    respond({ success: true });
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.udp_policy || changes.disabledPages)) settingsChanged = true;
});

// Small bronze/black confirmation card, shown only when a banner was actually
// handled. Shadow DOM keeps page CSS from touching it (and vice versa).
async function showUdpConfirmationToast(presetLabel) {
  if (udpToastShown) return;
  if (window.top !== window.self) return; // top-level document only

  let toastEnabled = true;
  try {
    const stored = await chrome.storage.sync.get({ udp_toast_enabled: true });
    toastEnabled = stored.udp_toast_enabled !== false;
  } catch (e) {
    return;
  }
  if (!toastEnabled) return;

  udpToastShown = true;

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const transition = reducedMotion ? 'opacity 0.01s linear' : 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

  const host = document.createElement('div');
  host.id = 'udp-toast-host';
  host.style.all = 'initial';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .udp-toast {
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 280px;
      box-sizing: border-box;
      background: #161616;
      border: 1px solid #2e2e2e;
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: pointer;
      opacity: 0;
      transform: translateY(12px);
      transition: ${transition};
      z-index: 2147483647;
    }
    .udp-toast.udp-visible { opacity: 1; transform: translateY(0); }
    .udp-toast-check {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      margin-top: 1px;
      border-radius: 50%;
      background: #b87333;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .udp-toast-check svg { width: 13px; height: 13px; display: block; }
    .udp-toast-text { min-width: 0; }
    .udp-toast-title {
      font-size: 12.5px;
      font-weight: 700;
      color: #e8e6e3;
      line-height: 1.3;
    }
    .udp-toast-sub {
      font-size: 10.5px;
      color: #8a8580;
      margin-top: 2px;
    }
  `;

  const card = document.createElement('div');
  card.className = 'udp-toast';
  card.setAttribute('role', 'status');
  card.innerHTML = `
    <span class="udp-toast-check">
      <svg viewBox="0 0 24 24" fill="none" stroke="#0d0d0d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 7"/></svg>
    </span>
    <span class="udp-toast-text">
      <span class="udp-toast-title">Cookie preferences set</span>
      <span class="udp-toast-sub">${presetLabel}</span>
    </span>
  `;

  shadow.appendChild(style);
  shadow.appendChild(card);
  document.documentElement.appendChild(host);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    card.classList.remove('udp-visible');
    setTimeout(() => host.remove(), reducedMotion ? 20 : 320);
  };

  card.addEventListener('click', dismiss);
  requestAnimationFrame(() => card.classList.add('udp-visible'));
  setTimeout(dismiss, 3000);
}

function getUDPConsentValues() {
  if (!udpPolicyEngine) return {};
  
  const decisions = udpPolicyEngine.getAllDecisions(udpSiteHost, udpIsThirdParty);
  const values = {};
  
  // Map our policy categories to CMP categories (A/B/D/E/F/X)
  const mapping = {
    [CONSENT_CATEGORIES.PREFERENCES]: 'A',
    [CONSENT_CATEGORIES.ANALYTICS]: 'B',
    [CONSENT_CATEGORIES.MARKETING]: 'F',
    [CONSENT_CATEGORIES.SOCIAL]: 'E',
    [CONSENT_CATEGORIES.UNCLASSIFIED]: 'X',
  };
  
  for (const [cat, decision] of Object.entries(decisions)) {
    const cmpCat = mapping[cat];
    if (cmpCat) {
      values[cmpCat] = decision === CONSENT_DECISIONS.ALLOW;
    }
  }
  
  values.D = values.B; // Both upstream analytics categories follow the analytics choice.
  return values;
}

async function contentScriptRunner() {
  if (document.contentType !== "text/html") return;

  const insideIframe = window !== window.parent;
  const url = insideIframe ? await sendMessage('GetTabUrl') : location.href;
  const urlObj = new URL(url);
  udpSiteHost = urlObj.hostname;
  udpIsThirdParty = insideIframe && location.hostname !== udpSiteHost;
  const stored = await chrome.storage.sync.get({ udp_policy: null, disabledPages: {} });
  if (stored.disabledPages[udpSiteHost]) {
    setPageStatus('disabled');
    return;
  }
  udpPolicyEngine = new PolicyEngine(stored.udp_policy);
  if (Object.values(udpPolicyEngine.getAllDecisions(udpSiteHost, udpIsThirdParty)).includes('ask')) {
    setPageStatus('manual');
    return; // A boolean-only CMP adapter cannot faithfully automate an "ask" decision.
  }
  const fetchedRules = await sendMessage('GetRuleList');
  if (!Array.isArray(fetchedRules) || !fetchedRules.length) throw new Error('No bundled rules available');

  const customRules = await GDPRConfig.getCustomRuleLists();

  // Merge rule lists
  const config = Object.assign({}, ...fetchedRules, customRules);
  if (config.$schema) delete config.$schema;

  // Get debug and general settings
  const debugValues = await GDPRConfig.getDebugValues();
  const generalSettings = await GDPRConfig.getGeneralSettings();

  // Get OUR consent values from policy engine
  const consentTypes = getUDPConsentValues();

  // Subtitle for the confirmation toast (see handledCallback below).
  const presetLabel = 'Your preferences applied';

  if (debugValues.debugLog) {
    console.log("[UDP] Fetched rules:", fetchedRules.length, "rule sets");
    console.log("[UDP] Consent types from policy:", consentTypes);
    console.log("[UDP] Site:", udpSiteHost, "| Third party:", udpIsThirdParty);
  }

  // Callback for when CMP is handled
  const handledCallback = (evt) => {
    if (evt.handled && evt.clicks > 0) {
      setPageStatus('handled');
      // Log to our audit system
      sendMessage({
        type: "LOG_AUDIT",
        entry: {
          timestamp: Date.now(),
          site: udpSiteHost,
          cmp: evt.cmpName,
          clicks: evt.clicks,
          decision: 'auto',
          action: 'auto',
          success: true
        }
      }).catch(error => console.error('[UDP] Audit persistence failed:', error));
      console.log("[UDP] Handled CMP:", evt.cmpName, "clicks:", evt.clicks);
      showUdpConfirmationToast(presetLabel);
    } else if (evt.error) {
      setPageStatus('error');
      sendMessage({ type: 'LOG_AUDIT', entry: { site: udpSiteHost, cmp: evt.cmpName, success: false } }).catch(() => {});
    } else {
      setPageStatus(evt.handled ? 'unverified' : 'nothing');
    }
  };

  // Start ConsentEngine with OUR consent values
  if (generalSettings.enabled !== false) {
    setPageStatus('searching');
    ConsentEngine.debugValues = debugValues;
    ConsentEngine.generalSettings = generalSettings;
    ConsentEngine.topFrameUrl = udpSiteHost;

    try {
      const engine = new ConsentEngine(config, consentTypes, handledCallback);
      ConsentEngine.singleton = engine;

      if (debugValues.debugLog) {
        console.log("[UDP] ConsentEngine loaded with", engine.cmps.length, "CMPs");
      }
    } catch (e) {
      setPageStatus('error');
      console.error("[UDP] Failed to start ConsentEngine:", e);
    }
  } else {
    setPageStatus('disabled');
  }
}

// Scroll behaviour preservation (from Consent-O-Matic)
window.consentScrollBehaviours = {};

function getCalculatedStyles() {
  ["html", "html body"].forEach(element => {
    let node = document.querySelector(element);
    if (node) {
      let styles = window.getComputedStyle(node);
      window.consentScrollBehaviours[element + ".consent-scrollbehaviour-override"] = ["position", "overflow", "overflow-y"].map(property => {
        return { property, value: styles[property] };
      });
    }
  });
}

let topContentTag = document.querySelector("html");
if (topContentTag) {
  let observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.matches != null && node.matches("body")) {
          getCalculatedStyles();
          observer.disconnect();
        }
      });
    });
  });
  observer.observe(topContentTag, { childList: true });
}

window.addEventListener("message", (event) => {
  try {
    if (event.data?.enforceScrollBehaviours != null) {
      ConsentEngine.enforceScrollBehaviours(event.data.enforceScrollBehaviours);
    }
  } catch (e) {
    console.error("[UDP] Error in message listener:", e);
  }
});

function startContentScript() {
  contentScriptRunner().catch(error => {
    setPageStatus('error');
    console.error('[UDP] Could not initialize:', error);
  });
}

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startContentScript);
} else {
  startContentScript();
}

// Observe which third-party trackers this page loads, and tell the popup.
// This is observation only — we do not block anything, and the data never
// leaves the browser. See TrackerDetector.js for why we don't say "blocked".
if (window.top === window) {
  watchForTrackers((result) => { pageTrackers = result; });
}

// Expose UDP API
window.UDP = {
  getPolicy: () => udpPolicyEngine?.serialize(),
  getDecisions: () => udpPolicyEngine?.getAllDecisions(udpSiteHost) || {},
  getSiteHost: () => udpSiteHost,
  isThirdParty: () => udpIsThirdParty
};
