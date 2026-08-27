// Shared banner-detection probe. Looks for a VISIBLE consent overlay.
export const PROBE = () => {
  const SEL = [
    '#iubenda-cs-banner','.iubenda-cs-container','[class*="iubenda-cs-"]',
    '#onetrust-banner-sdk','#onetrust-consent-sdk','.ot-sdk-container',
    '#CybotCookiebotDialog','#cookiebanner',
    '.qc-cmp2-container','.qc-cmp-ui-container',
    '#didomi-notice','.didomi-popup-container',
    '#usercentrics-root','#uc-center-container',
    '.sp_message_container','[id^="sp_message_container"]',
    '#cmpbox','#cmpbox2','.cmpboxBG',
    '[id*="cookie" i][class*="banner" i]','[class*="cookie-banner" i]',
    '[class*="cookie-consent" i]','[id*="cookieConsent" i]',
    '[class*="cookie-notice" i]','[id*="cookie-law" i]',
    '[aria-label*="cookie" i]','[aria-label*="consent" i]',
    '[role="dialog"][class*="cookie" i]','[role="dialog"][class*="consent" i]'
  ];
  const vis = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 100 && r.height > 40 &&
           s.display !== 'none' && s.visibility !== 'hidden' &&
           parseFloat(s.opacity) > 0.1;
  };
  const found = [];
  for (const sel of SEL) {
    let els = [];
    try { els = [...document.querySelectorAll(sel)]; } catch (e) { continue; }
    for (const el of els) {
      if (!vis(el)) continue;
      const id = (el.id ? '#'+el.id : '') +
                 (typeof el.className === 'string' && el.className
                    ? '.'+el.className.trim().split(/\s+/).slice(0,2).join('.') : '');
      if (!found.some(f => f.id === id)) {
        found.push({ sel, id, text: (el.innerText||'').replace(/\s+/g,' ').trim().slice(0,110) });
      }
    }
  }
  // also: is the page scroll-locked? classic consent-wall symptom
  const b = getComputedStyle(document.body);
  const h = getComputedStyle(document.documentElement);
  const locked = b.overflow === 'hidden' || h.overflow === 'hidden' ||
                 b.position === 'fixed';
  return { count: found.length, banners: found.slice(0,4), scrollLocked: locked };
};

export const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
