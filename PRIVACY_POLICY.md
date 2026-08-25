# Privacy Policy — Universal Data Permission Layer

**Effective date:** 2025-08-25  
**Version:** 0.1  
**Extension ID:** `udp@juicylies.dev` (Firefox) / pending (Chrome)

---

## Summary

**Universal Data Permission Layer collects no personal data.** No analytics, no telemetry, no vendor backend, no user accounts. All data stays in your browser's local storage unless you explicitly enable optional encrypted sync.

---

## Data We Store (Locally in Your Browser)

| Data | Storage API | Purpose | Retention |
|---|---|---|---|
| **Policy preferences** | `chrome.storage.sync` | Your consent choices per category, per-site overrides, context rules | Until you change or delete them |
| **Audit log** | `chrome.storage.local` | Timestamped record of every CMP interaction (site, CMP name, category, decision, success/failure) | Rolling, max 10,000 entries |
| **Statistics** | `chrome.storage.local` | Aggregated counters (clicks, CMPs encountered, sites visited) | Until you clear or uninstall |
| **Sync configuration** | `chrome.storage.local` | Your endpoint URL, device name, salt, device ID — **NOT your passphrase** | Until you disable sync |

---

## Data We Never Have

- **Your passphrase** — used client-side to derive an AES-256-GCM key via PBKDF2 (100,000 iterations). Never transmitted, never stored.
- **Sync payload plaintext** — encrypted locally before transmission. Your sync endpoint receives ciphertext only.
- **Browsing history** — we never log URLs beyond the hostname needed for per-site policy.
- **Personally identifiable information** — no email, name, IP address, device fingerprint, or tracking ID.

---

## Network Requests

The extension makes **zero unsolicited network requests**.

| Request | Trigger | Destination | Content |
|---|---|---|---|
| `Sec-GPC: 1` header | Added to *all* outgoing requests via `declarativeNetRequest` | The site you're visiting | Header only (`Sec-GPC: 1`) — no body |
| Sync upload | You click "Sync Now" or scheduled interval | **Your configured endpoint only** | JSON: `{ "data": "<base64 AES-GCM ciphertext>", "deviceId": "..." }` |
| Sync download | (Future) pull from your endpoint | **Your configured endpoint only** | Encrypted payload |

**We do not operate a sync server.** You provide the endpoint URL. It can be a simple HTTPS endpoint that accepts POST with the JSON body above and returns the same for download. Example implementations are in the documentation.

---

## Third-Party Code

| Component | License | Purpose | Data Access |
|---|---|---|---|
| **Consent-O-Matic** (submodule) | MIT | CMP detection & rule corpus (500+ CMPs) | Runs in content script; reads DOM to find banners; no network |
| `js-yaml` (npm) | MIT | YAML parsing for policy editor | Runs in options page; local only |

No other third-party code runs at runtime. All build-time dependencies (webpack, babel, etc.) are stripped from the production bundle.

---

## Children's Privacy

This extension is not directed at children. We do not knowingly collect data from children. If you believe a child has provided data, contact us and we will delete it.

---

## What You Can Do With Your Data

The extension gives you direct control:

- **Export** — download your full audit log as JSON from the dashboard
- **Edit** — change your policy at any time in the dashboard
- **Delete** — uninstall the extension, or clear `chrome.storage` via browser settings
- **Move** — your policy YAML/JSON is portable; import/export from the dashboard
- **Turn off** — disable the extension, or disable GPC in the policy

We have no central database to request deletion from — your data lives in your browser.

---

## International Transfers

If you enable sync, the destination is **your decision and your configuration**. The payload is encrypted end-to-end; the endpoint operator sees only ciphertext.

---

## Security

- **Encryption:** AES-256-GCM, 96-bit IV, PBKDF2-SHA256 (100k iterations)
- **Storage:** Chrome's built-in `storage.sync` (encrypted at rest by the browser) and `storage.local`
- **Permissions:** Minimal — see the [store listing](STORE_LISTING.md#permissions--why) for justification
- **No eval / no remote code** — all code is bundled; no dynamic script loading

---

## Changes to This Policy

Material changes will be noted in the extension's changelog and on the GitHub releases page. Your continued use after a change constitutes acceptance.

---

## Contact

- **GitHub Issues:** https://github.com/JuicyLies/UniversalDataPermissionLayer/issues
- **Security:** security@juicylies.dev (or GitHub Security Advisory)
- **Maintainer:** Daniel Milanesi

---

## Legal Basis

> 🚧 **Coming soon.** The lawful-basis analysis for each kind of processing is
> being prepared with proper legal review and will be published here before
> public release.

---

*This privacy policy covers the Universal Data Permission Layer browser extension only. It does not cover third-party websites you visit, nor the Consent-O-Matic upstream project (which has its own repository and governance).*