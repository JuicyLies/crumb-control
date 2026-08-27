# Crumb Control — Store Listing

## Store Page Copy

### Short Description (132 char max)
Set your cookie preferences once. Crumb Control answers consent banners for you, on every site — in any language.

### Detailed Description

---

**The problem:** Every site forces you through a consent banner. "Accept All" is one click; refusing takes five. Your preferences don't carry to the next site, or the next device. It's consent fatigue by design.

The EU's ePrivacy Regulation was meant to fix this — set your choice once in the browser, sites must respect it. Lobbying killed it. Crumb Control is that idea, built as an extension you install yourself.

**The fix:** Choose what you want to allow. Crumb Control clicks the right buttons on every banner, automatically.

### What you get

✅ **Auto-handles cookie banners** — uses the site's own controls, picks "Reject" (or "Accept") per your settings
✅ **Works in your language** — accent- and punctuation-tolerant matching, so Italian, French, German and Spanish banners work, not just English
✅ **209 CMP rules** — OneTrust, Cookiebot, Quantcast, Didomi, Sourcepoint, Iubenda, Usercentrics and 200+ more
✅ **Global Privacy Control** — sends `Sec-GPC: 1`, the standardised opt-out signal some laws require sites to honour
✅ **Per-site decisions in one tap** — override any category for a single site without touching your global settings
✅ **Running counter** — see how many banners it's handled for you
✅ **Activity log + JSON export** — every decision recorded, exportable for your own records
✅ **Zero telemetry, zero backend** — no accounts, no servers, nothing leaves your browser
✅ **Open source (MIT)** — built on Consent-O-Matic's CMP rule corpus

### How it works

1. Install — it works immediately, rejecting everything except strictly necessary cookies
2. Browse normally — banners get answered before you see them
3. Click the toolbar icon to check status, adjust categories, or flip a decision for the current site
4. A small confirmation appears in the corner when a banner is handled (switchable off)

### Permissions & why

| Permission | Reason |
|---|---|
| `<all_urls>` (host) | Cookie banners appear on any site; we need to detect and interact with them |
| `storage` | Your settings, activity log and counter — stored locally in the browser |
| `activeTab`, `tabs` | Identify the current site for per-site scoping |
| `scripting` | Click banner buttons using the site's own DOM |
| `declarativeNetRequest` | Inject the `Sec-GPC: 1` header on outgoing requests |

No data leaves your browser. No analytics, no tracking, no vendor account.

### Why this is different

| | I Don't Care About Cookies | Consent-O-Matic | **Crumb Control** |
|---|---|---|---|
| Hides banners | ✅ | ✅ | ✅ |
| Granular preferences | ❌ | ✅ | ✅ |
| Accent/non-English tolerant matching | partial | partial | ✅ |
| Per-site decisions in one tap | ❌ | ❌ | ✅ |
| GPC header | ❌ | ❌ | ✅ |
| Activity log + export | ❌ | ❌ | ✅ |

**Built on Consent-O-Matic** (MIT, Aarhus University) — their CMP detection engine and community rule corpus make this possible. We add the preferences layer, GPC, language-tolerant matching, auditability and the simplified UI.

### Scope

This tool automates **your own responses** to consent dialogs using the controls those dialogs already provide. It sends the Global Privacy Control signal. It does **not** block, bypass or circumvent consent mechanisms; it does **not** falsify consent; it does **not** interfere with strictly necessary cookies.

When it can't confidently identify a banner, it leaves it alone rather than clicking blind.

> 🚧 A reviewed legal positioning statement is in preparation and will be added before public release. Nothing here is legal advice.

---

## Store Assets Checklist

- [ ] 128 × 128 icon (PNG) — use `src/assets/icons/icon_128.png`
- [ ] 440 × 280 promo tile (large promo)
- [ ] 920 × 680 promo tile (marquee) — optional
- [ ] Screenshots (min 1, max 5, 1280×800 or 640×400):
  - [ ] Status tab — counter and consent decisions
  - [ ] Settings tab — category toggles
  - [ ] Activity log with real entries
  - [ ] Confirmation toast on a live site
- [ ] Privacy policy URL (hosted, see `PRIVACY_POLICY.md`)
- [ ] Support/contact email (or GitHub issues link)
- [ ] One-time $5 developer fee (already paid via JuicyLies account)

---

## Release Notes

### v0.4.0

- **Smaller, rounded popup** — 352×500 with rounded corners
- **Consent decisions are now buttons** — tap any category to flip it for the current site only
- **Presets removed** — category toggles are the single source of truth
- **Much better non-English support** — banner text is now matched with accents, curly apostrophes and non-breaking spaces normalised. Fixes Italian, French, German and Spanish banners that previously went unhandled.
- **Iubenda coverage extended** — the dominant CMP on Italian sites
- **Banner counter** — running local tally of banners handled
- **Rewritten About section**

### v0.3.0

- Rebranded to Crumb Control, new logo
- Rebuilt UI as a compact bronze/black popup panel
- Simplified settings; advanced options moved behind a disclosure
- Confirmation toast when a banner is handled

### v0.2.1

- Fixed GPC header injection (invalid `declarativeNetRequest` resource type)
- Fixed core bug where the Consent-O-Matic engine was never wired in

---

## SEO Keywords (for store search)

cookie consent, privacy, Global Privacy Control, GPC, cookie banner, consent management, cookie preferences, data protection, cookie blocker, reject cookies, GDPR, banner blocker
