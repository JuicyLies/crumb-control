# Universal Data Permission Layer — Chrome Web Store Listing

## Store Page Copy

### Short Description (132 char max)
Set your cookie/data preferences **once**. Extension applies them automatically on every site. No more banner fatigue.

### Detailed Description

---

**The problem:** Every site forces you through a consent banner. "Accept All" is one click; refusing takes 5+. Your preferences don't carry over to the next site, or the next device. It's consent fatigue by design.

**The fix:** Universal Data Permission Layer lets you define a **portable, machine-readable policy** — then applies it everywhere, automatically.

```yaml
# Your policy (editable in the dashboard)
global:
  necessary: allow       # required for the site to work
  preferences: reject    # language, layout, etc.
  analytics: reject      # tracking, performance
  marketing: reject      # advertising, retargeting
  social: reject         # embedded widgets
  unclassified: reject   # unknown → deny by default

# Per-site exceptions
sites:
  wikipedia.org:
    preferences: allow
```

### What you get

✅ **Auto-handles cookie banners** — uses the site's own controls, clicks "Reject" (or "Accept") for you per your policy  
✅ **Global Privacy Control (GPC)** — sends `Sec-GPC: 1` header, the standardized opt-out signal  
✅ **Per-site overrides** — exceptions where you want them  
✅ **First-party vs third-party rules** — stricter for third-party contexts  
✅ **Audit log + DSR export** — every decision recorded; export as JSON for your own records  
✅ **Optional encrypted sync** — AES-256-GCM, passphrase never leaves your device, bring-your-own-endpoint  
✅ **Zero telemetry, zero backend** — everything local unless you enable sync  
✅ **Open source (MIT)** — built on Consent-O-Matic's 500+ CMP rule corpus

### How it works

1. Install → open Options → set your global preferences
2. Browse normally — when a CMP banner appears, the extension reads your policy and fills the form
3. Check the Dashboard → see every site, CMP, category, decision, timestamp
4. (Optional) Enable sync → your policy follows you across devices, encrypted end-to-end

### Permissions & why

| Permission | Reason |
|---|---|
| `<all_urls>` (host) | Cookie banners appear on any site; we need to detect & interact with them |
| `storage` | Policy, audit log, statistics — stored locally in browser sync/local storage |
| `activeTab`, `tabs` | Identify the current site for per-site policy scoping |
| `scripting` | Click CMP buttons using the site's own DOM |
| `declarativeNetRequest` | Inject the `Sec-GPC: 1` header on outgoing requests |

No data leaves your browser unless **you** configure an encrypted sync endpoint. No analytics, no tracking, no vendor account required.

### Why this is different

| | I Don't Care About Cookies | Consent-O-Matic | **This extension** |
|---|---|---|---|
| Hides banners | ✅ | ✅ | ✅ |
| Granular preferences | ❌ | ✅ | ✅ |
| Portable policy file | ❌ | ❌ | ✅ |
| Per-site overrides | ❌ | ❌ | ✅ |
| GPC header | ❌ | ❌ | ✅ |
| Audit log + export | ❌ | ❌ | ✅ |
| Encrypted sync | ❌ | ❌ | ✅ |

**Built on Consent-O-Matic** (MIT, Aarhus University) — their CMP detection engine and community rule corpus make this possible. We add the policy layer, GPC, auditability, and sync.

### Scope

This tool automates **your own responses** to consent dialogs using the controls those dialogs already provide. It sends the Global Privacy Control signal. It does **not** block, bypass, or circumvent consent mechanisms; it does **not** falsify consent; it does **not** interfere with strictly necessary cookies.

> 🚧 A reviewed legal positioning statement is in preparation and will be added before public release. Nothing here is legal advice.

---

## Store Assets Checklist

- [ ] 128 × 128 icon (PNG) — use `src/assets/icons/icon_128.png`
- [ ] 440 × 280 promo tile (large promo)
- [ ] 920 × 680 promo tile (marquee) — optional
- [ ] Screenshots (min 1, max 5, 1280×800 or 640×400):
  - [ ] Dashboard showing policy editor
  - [ ] Audit log with real entries
  - [ ] Sync configuration screen
- [ ] Privacy policy URL (hosted, see `PRIVACY_POLICY.md`)
- [ ] Support/contact email (or GitHub issues link)
- [ ] One-time $5 developer fee (already paid via JuicyLies account)

---

## Release Notes (v0.1.0)

**Initial release.** A Manifest V3 browser extension implementing a universal data permission layer:

- Policy engine (YAML/JSON, global + per-site + first/third-party context)
- GPC header injection via declarativeNetRequest
- Consent-O-Matic CMP detection (500+ rules)
- Audit log with DSR JSON export
- Optional end-to-end encrypted cloud sync (AES-256-GCM, PBKDF2)
- 8-tab dashboard: policy editor, audit log, site overrides, sync, statistics, CMP adapters, credits
- Chrome MV3 and Firefox MV3 builds

---

## SEO Keywords (for store search)

cookie consent, privacy, Global Privacy Control, GPC, cookie banner, consent management, cookie preferences, data protection, cookie blocker