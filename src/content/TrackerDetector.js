/**
 * Tracker detection.
 *
 * IMPORTANT — what this does and does not claim.
 *
 * Crumb Control does not block network requests. It answers consent banners.
 * So this module does not report "trackers blocked", because that would be a
 * lie, and a privacy tool that overclaims deserves everything it gets.
 *
 * What it does: watches which third-party resources the page actually loaded,
 * matches them against a list of known tracking hosts, and reports what it
 * saw. That is an observation, and it is honest.
 *
 * The number is useful because it shows the user what a site pulls in — which
 * is exactly the thing consent banners are asking permission for.
 */

// Known tracker hosts, grouped so the popup can say something meaningful
// rather than just showing a number. Kept deliberately small and obvious:
// every entry here is a company whose primary business is tracking.
const TRACKER_HOSTS = {
  advertising: [
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'adnxs.com',
    'rubiconproject.com',
    'pubmatic.com',
    'criteo.com',
    'criteo.net',
    'taboola.com',
    'outbrain.com',
    'smartadserver.com',
    'openx.net',
    'casalemedia.com',
    'adform.net',
    'teads.tv',
    '33across.com',
    'sharethrough.com',
    'indexexchange.com',
    'media.net',
    'amazon-adsystem.com',
  ],
  analytics: [
    'google-analytics.com',
    'googletagmanager.com',
    'hotjar.com',
    'mixpanel.com',
    'segment.com',
    'segment.io',
    'amplitude.com',
    'fullstory.com',
    'mouseflow.com',
    'clarity.ms',
    'quantserve.com',
    'scorecardresearch.com',
    'chartbeat.com',
    'nr-data.net',
    'newrelic.com',
    'matomo.cloud',
    'statcounter.com',
    'plausible.io',
  ],
  social: [
    'facebook.net',
    'facebook.com',
    'connect.facebook.net',
    'twitter.com',
    'ads-twitter.com',
    't.co',
    'linkedin.com',
    'licdn.com',
    'tiktok.com',
    'analytics.tiktok.com',
    'pinterest.com',
    'pinimg.com',
    'snapchat.com',
    'sc-static.net',
    'reddit.com',
    'redditstatic.com',
  ],
  fingerprinting: [
    'fingerprintjs.com',
    'fpjs.io',
    'perimeterx.net',
    'px-cloud.net',
    'datadome.co',
    'castle.io',
  ],
};

// Flatten once at module load for fast lookup.
const HOST_TO_CATEGORY = new Map();
for (const [category, hosts] of Object.entries(TRACKER_HOSTS)) {
  for (const host of hosts) {
    HOST_TO_CATEGORY.set(host, category);
  }
}

/**
 * Returns the registrable-ish domain for comparison purposes.
 * Not a full PSL implementation — we only need "is this the same site".
 */
function baseDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length <= 2) {
    return hostname;
  }
  // Handle common two-part TLDs (co.uk, com.au, co.jp ...)
  const twoPartTlds = ['co', 'com', 'net', 'org', 'gov', 'ac', 'edu'];
  if (parts.length >= 3 && twoPartTlds.includes(parts[parts.length - 2])) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Matches a hostname against the tracker list.
 * Returns the category name, or null if it is not a known tracker.
 */
function classifyHost(hostname) {
  if (HOST_TO_CATEGORY.has(hostname)) {
    return HOST_TO_CATEGORY.get(hostname);
  }
  // Match subdomains: "www.google-analytics.com" -> "google-analytics.com"
  for (const [host, category] of HOST_TO_CATEGORY) {
    if (hostname === host || hostname.endsWith('.' + host)) {
      return category;
    }
  }
  return null;
}

/**
 * Scans resources the page has already loaded.
 * Uses the Performance API, which records every resource fetch without us
 * needing webRequest permissions or touching the network ourselves.
 */
export function scanLoadedTrackers() {
  const pageDomain = baseDomain(location.hostname);
  const found = new Map(); // domain -> category

  let entries = [];
  try {
    entries = performance.getEntriesByType('resource') || [];
  } catch (e) {
    return { total: 0, byCategory: {}, domains: [] };
  }

  for (const entry of entries) {
    let hostname;
    try {
      hostname = new URL(entry.name).hostname;
    } catch (e) {
      continue;
    }

    // First-party resources are not trackers for our purposes.
    if (baseDomain(hostname) === pageDomain) {
      continue;
    }

    const category = classifyHost(hostname);
    if (category) {
      found.set(baseDomain(hostname), category);
    }
  }

  const byCategory = {};
  for (const category of found.values()) {
    byCategory[category] = (byCategory[category] || 0) + 1;
  }

  return {
    total: found.size,
    byCategory,
    domains: [...found.keys()].sort(),
  };
}

/**
 * Watches for trackers that load after the initial scan (lazily injected
 * scripts, or ones that only fire after a consent decision).
 * Calls onUpdate with fresh results whenever something new appears.
 */
export function watchForTrackers(onUpdate) {
  let lastTotal = -1;

  const report = () => {
    const result = scanLoadedTrackers();
    if (result.total !== lastTotal) {
      lastTotal = result.total;
      onUpdate(result);
    }
  };

  report();

  try {
    const observer = new PerformanceObserver(() => report());
    observer.observe({ entryTypes: ['resource'] });
    return () => observer.disconnect();
  } catch (e) {
    // PerformanceObserver unavailable — fall back to a couple of delayed scans.
    const timers = [setTimeout(report, 2000), setTimeout(report, 5000)];
    return () => timers.forEach(clearTimeout);
  }
}
