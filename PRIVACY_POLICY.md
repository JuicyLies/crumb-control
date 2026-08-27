# Privacy Policy — Crumb Control

**Effective date:** 2026-08-27
**Version:** 0.4.0
**Extension ID:** `udp@juicylies.dev` (Firefox) / pending (Chrome)

---

## Summary

**Crumb Control collects no personal data.** No analytics, no telemetry, no vendor backend, no user accounts, no cloud sync. Everything stays in your browser's own storage.

---

## Data We Store (Locally in Your Browser)

| Data | Storage API | Purpose | Retention |
|---|---|---|---|
| **Policy preferences** | `chrome.storage.sync` | Your consent choices per category and per-site overrides | Until you change or delete them |
| **Activity log** | `chrome.storage.local` | Timestamped record of every banner interaction (site, CMP name, decision, success/failure) | Rolling, max 10,000 entries |
| **Statistics** | `chrome.storage.local` | Aggregated counters (CMPs encountered, sites seen) | Until you clear or uninstall |
| **Banner counter** | `chrome.storage.local` | Lifetime count of banners handled, and the date counting started | Until you clear or uninstall |

`chrome.storage.sync` is the browser's own built-in profile sync. If you are signed into Chrome or Firefox, the browser may replicate this between your devices under **its** privacy policy. We neither operate nor can read that channel. To avoid it entirely, sign out of browser sync or disable extension sync in your browser settings.

---

## Data We Never Have

- **Browsing history** — we never log URLs beyond the hostname needed for per-site preferences.
- **Personally identifiable information** — no email, name, IP address, device fingerprint or tracking ID.
- **Anything at all, in fact** — we operate no server. There is nowhere for your data to go.

---

## Network Requests

The extension makes **zero unsolicited network requests**. It has no backend and phones home to nothing.

| Request | Trigger | Destination | Content |
|---|---|---|---|
| `Sec-GPC: 1` header | Added to outgoing requests via `declarativeNetRequest` | The site you're already visiting | Header only (`Sec-GPC: 1`) — no body |

That is the complete list.

The CMP rule corpus is **bundled inside the extension** at build time, so no rules are fetched at runtime.

---

## What About the Counter?

The Status tab shows how many cookie banners the extension has handled for you. This number is **stored locally and never transmitted**. There is no global leaderboard, no aggregate collection, no reporting endpoint. It is a counter in your own browser, for you.

---

## Third-Party Code

| Component | License | Purpose | Data Access |
|---|---|---|---|
| **Consent-O-Matic** (submodule) | MIT | CMP detection & rule corpus (209 CMPs bundled) | Runs in content script; reads the DOM to find banners; no network access |
| `js-yaml` (npm) | MIT | YAML parsing for the advanced policy editor | Runs locally in the popup only |

No other third-party code runs at runtime. Build-time dependencies (webpack, babel, etc.) are stripped from the production bundle.

---

## Children's Privacy

This extension is not directed at children. We do not knowingly collect data from children — we do not collect data from anyone.

---

## What You Can Do With Your Data

- **Export** — download your full activity log as JSON via "Export my data (DSR)" on the Status tab
- **Edit** — change your preferences at any time in Settings
- **Clear** — wipe the activity log from the Log tab
- **Delete** — uninstall the extension, or clear `chrome.storage` via browser settings
- **Turn off** — disable the extension, or disable it for a single site from the Status tab

We have no central database to request deletion from — your data lives in your browser.

---

## International Transfers

None. No data is transmitted anywhere, so there are no transfers of any kind.

---

## Security

- **Storage:** the browser's own `storage.sync` (encrypted at rest by the browser) and `storage.local`
- **Permissions:** minimal — see the [store listing](STORE_LISTING.md#permissions--why) for justification of each
- **No eval, no remote code** — everything is bundled; no dynamic script loading
- **No secrets held** — the extension has no credentials, tokens or accounts

---

## Changes to This Policy

Material changes will be noted in the changelog and on the GitHub releases page.

**Changed in 0.4.0:** removed all references to end-to-end encrypted cloud sync. That feature was described in earlier drafts of this document but was never implemented and does not exist in any released build. There is no sync endpoint, no passphrase, and no encryption layer, because nothing is ever transmitted. This document now describes only what the extension actually does.

---

## Contact

- **GitHub Issues:** https://github.com/JuicyLies/crumb-control/issues
- **Security:** security@juicylies.dev (or GitHub Security Advisory)
- **Maintainer:** Daniel Milanesi

---

## Legal Basis

Crumb Control does not collect, transmit or process personal data on our behalf, so there is no controller-side lawful basis to declare. Your preferences and activity log are written to your browser's own local storage, stay on your device, and are never sent to us or to any third party — we operate no server and receive nothing.

Because no personal data reaches us, we are not a data controller in respect of your use of this extension. This document describes the extension's actual behaviour and is not legal advice.

---

*This privacy policy covers the Crumb Control browser extension only. It does not cover third-party websites you visit, nor the Consent-O-Matic upstream project (which has its own repository and governance).*
