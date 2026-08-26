// content.js - Content script for Universal Data Permission Layer
// Bundled by webpack - imports Consent-O-Matic engine + our PolicyEngine

import { PolicyEngine, CONSENT_CATEGORIES, CONSENT_DECISIONS } from '../shared/PolicyEngine.js';
import ConsentEngine from '../../Consent-O-Matic/Extension/ConsentEngine.js';
import GDPRConfig from './GDPRConfig.js';

let udpPolicyEngine = null;
let udpSiteHost = '';
let udpIsThirdParty = false;

function getUDPConsentValues() {
  if (!udpPolicyEngine) return {};
  
  const decisions = udpPolicyEngine.getAllDecisions(udpSiteHost);
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
  
  return values;
}

async function contentScriptRunner() {
  if (document.contentType !== "text/html") return;

  // Figure out the URL
  let url = location.href;
  let insideIframe = window !== window.parent;
  if (insideIframe) {
    url = await new Promise((resolve) => {
      chrome.runtime.sendMessage("GetTabUrl", (response) => {
        resolve(response);
      });
    });
  }
  const urlObj = new URL(url);
  udpSiteHost = urlObj.host;
  udpIsThirdParty = insideIframe;

  // Initialize our policy engine with defaults
  udpPolicyEngine = new PolicyEngine();

  // Get Consent-O-Matic's rule lists from background
  const fetchedRules = await new Promise((resolve) => {
    chrome.runtime.sendMessage("GetRuleList", (response) => {
      resolve(response || []);
    });
  });

  const customRules = await GDPRConfig.getCustomRuleLists();

  // Merge rule lists
  const config = Object.assign({}, ...fetchedRules, customRules);
  if (config.$schema) delete config.$schema;

  // Get debug and general settings
  const debugValues = await GDPRConfig.getDebugValues();
  const generalSettings = await GDPRConfig.getGeneralSettings();

  // Get OUR consent values from policy engine
  const consentTypes = getUDPConsentValues();

  if (debugValues.debugLog) {
    console.log("[UDP] Fetched rules:", fetchedRules.length, "rule sets");
    console.log("[UDP] Consent types from policy:", consentTypes);
    console.log("[UDP] Site:", udpSiteHost, "| Third party:", udpIsThirdParty);
  }

  // Callback for when CMP is handled
  const handledCallback = (evt) => {
    if (evt.handled) {
      // Log to our audit system
      chrome.runtime.sendMessage({
        type: "LOG_AUDIT",
        entry: {
          timestamp: Date.now(),
          url: location.href,
          site: udpSiteHost,
          cmp: evt.cmpName,
          clicks: evt.clicks,
          decision: 'auto',
          action: 'auto',
          success: true
        }
      });
      console.log("[UDP] Handled CMP:", evt.cmpName, "clicks:", evt.clicks);
    } else if (evt.error) {
      console.warn("[UDP] CMP error");
    }
  };

  // Start ConsentEngine with OUR consent values
  if (generalSettings.enabled !== false) {
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
      console.error("[UDP] Failed to start ConsentEngine:", e);
    }
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

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", contentScriptRunner);
} else {
  contentScriptRunner();
}

// Expose UDP API
window.UDP = {
  getPolicy: () => udpPolicyEngine?.serialize(),
  getDecisions: () => udpPolicyEngine?.getAllDecisions(udpSiteHost) || {},
  getSiteHost: () => udpSiteHost,
  isThirdParty: () => udpIsThirdParty
};
