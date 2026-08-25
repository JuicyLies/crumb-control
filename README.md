# Universal Data Permission Layer

> Set your data preferences **once**. Have every site respect them automatically.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Chrome](https://img.shields.io/badge/Chrome-supported-green.svg)](#installation)
[![Firefox](https://img.shields.io/badge/Firefox-supported-green.svg)](#installation)

A browser extension that turns your privacy preferences into a **portable, machine-readable policy** — then applies it everywhere, automatically. No more clicking "Accept All" just to make a banner disappear.

---

## Table of Contents

- [The Problem](#the-problem)
- [What This Does](#what-this-does)
- [Legal Foundation](#legal-foundation)
- [How It Compares](#how-it-compares)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Privacy & Security Design](#privacy--security-design)
- [Scope & Limitations](#scope--limitations)
- [Contributing](#contributing)
- [Credits](#credits)
- [License](#license)

---

## The Problem

Under EU law, consent to non-essential cookies and tracking must be **freely given, specific, informed, and unambiguous** — and it must be **as easy to withdraw as to give**.

In practice, the web delivers the opposite:

- **Consent fatigue by design.** A new banner on every site, every device, every cookie clear. "Accept All" is one click; refusing often takes five, buried behind "Manage Preferences."
- **Dark patterns.** Prominent accept buttons, greyed-out reject buttons, pre-ticked "legitimate interest" toggles.
- **No portability.** Your carefully-set preferences on one site mean nothing on the next.
- **No auditability.** Try answering "what did I consent to on this site, and when?" You can't.

The fix was supposed to be a **machine-readable signal** — your browser announces your preferences once, sites honour them, banners stop appearing. That has not happened.

**This extension implements what the browser should have shipped.**

---

## What This Does

### 1. Policy Engine — decide once
Define preferences as a portable YAML/JSON policy:

```yaml
version: 1
global:
  necessary: allow       # strictly necessary — always required for the site to work
  preferences: reject    # functional (language, layout)
  analytics: reject      # measurement, performance
  marketing: reject      # advertising, retargeting
  social: reject         # embedded social widgets
  unclassified: reject   # unknown category — deny by default

sites:
  wikipedia.org:
    preferences: allow   # per-site exception

context:
  thirdParty:
    analytics: reject    # stricter rules for third-party contexts
```

Resolution order: **site override → context rule → global default.** Unknown categories default to `reject`.

### 2. Automatic Consent Handling
When a Consent Management Platform (CMP) banner appears, the extension reads your policy and fills the form the way *you* would have — using the interface the site itself provides. Detection uses the [Consent-O-Matic](https://github.com/cavi-au/Consent-O-Matic) rule corpus (500+ CMPs), included as a git submodule so upstream rule updates flow in.

### 3. Global Privacy Control (GPC)
Injects the `Sec-GPC: 1` header on outgoing requests — a standardised, machine-readable signal indicating you opt out of the sale or sharing of your personal data. See [Global Privacy Control](https://globalprivacycontrol.org/) for the specification.

### 4. Audit Log & Data Subject Request Export
Every consent decision is recorded locally: site, CMP, category, decision, timestamp, outcome. Export the full record as JSON to keep your own evidence of what you accepted or refused, and when.

### 5. Encrypted Cross-Device Sync *(optional, off by default)*
Sync policy and audit log across devices using **AES-256-GCM** with a key derived via **PBKDF2 (100,000 iterations)** from a passphrase that never leaves your device. Bring your own endpoint — there is no vendor server.

### 6. CMP Adapter SDK
A small interface so the community can add coverage for new CMPs:

```js
export default {
  name: 'MyCMP',
  detect:    () => document.querySelector('#my-cmp-banner') !== null,
  isShowing: () => document.querySelector('#my-cmp-banner')?.style.display !== 'none',
  handle: async (consentTypes) => {
    document.querySelector('#reject-all')?.click();
    return { clicks: 1 };
  }
};
```

---

## Legal Foundation

### The ePrivacy Regulation — what was supposed to happen

The EU **ePrivacy Regulation** (proposed 2017, intended to replace the 2002/2009 ePrivacy Directive) contained a provision that would have solved the cookie-banner problem at the source:

> **Article 9 (original draft):** Users configure their consent preferences **once in their browser** (e.g., "Block all third-party tracking cookies" / "Accept analytics"). Browsers send a standardised, machine-readable signal to every site. Sites are **legally required** to honour it — no pop-up walls, no per-site banners.

This would have made cookie fatigue a solved problem: **browser-level consent, legally binding.**

### Why it didn't happen

The provision was stripped during legislative negotiations (2018–2021) under heavy lobbying:

| Actor | Argument |
|---|---|
| **Google & ad-tech coalitions** | Centralised browser consent hands power to browser vendors (Chrome, Safari, Edge) — Google could set defaults favouring its own ad network. |
| **Digital publishers (news/media)** | If users set "Reject All" once, sites lose ad revenue without ever getting to ask. |
| **EU Council (Germany, France, Ireland, others)** | Deadlocked over the text; the mandate was watered down in successive drafts. |

**Result:** the Regulation stalled. Cookie consent today remains under the **old ePrivacy Directive + GDPR** — hence the banner flood.

### Where enforcement has gone instead

With the Regulation stalled, regulators pivoted to enforcing the **GDPR's existing rules on valid consent**:

- **EDPB Guidelines 05/2020** — consent invalid if refusing is materially harder than accepting.
- **EDPB Guidelines 03/2022** — deceptive design patterns in banners.
- **CJEU: Planet49 (C‑673/17)** — pre-ticked boxes ≠ valid consent.
- **CJEU: Orange România (C‑61/19)** — controller bears burden of proving consent.
- **National DPAs** — fines for Google, Meta, others for making "Reject All" harder than "Accept All."

### Global Privacy Control (GPC)

GPC is an independent technical standard for a browser opt-out signal (`Sec-GPC: 1`). Its legal force varies:

- **California (CCPA/CPRA):** AG treats GPC as a valid opt-out; enforcement actions have cited failure to honour it.
- **Colorado, Connecticut, other US states:** statutes recognise universal opt-out mechanisms.
- **EU:** GPC is not named in the GDPR, but **Art. 21(5)** expressly permits objecting *"by automated means using technical specifications"* — the category GPC is designed to occupy.

> **This extension implements what the ePrivacy Regulation would have mandated:** a portable, browser-level preference layer that sends GPC and auto-applies your choices to CMPs — available now, without waiting for the law to catch up.

---

## How It Compares

| Capability | I Don't Care About Cookies | Consent-O-Matic | **This project** |
|---|:---:|:---:|:---:|
| Hides / dismisses banners | ✅ | ✅ | ✅ |
| Respects granular preferences | ❌ | ✅ | ✅ |
| Portable policy file (YAML/JSON) | ❌ | ❌ | ✅ |
| Per-site overrides | ❌ | ⚠️ on/off only | ✅ per-category |
| First-party vs third-party rules | ❌ | ❌ | ✅ |
| GPC header injection | ❌ | ❌ | ✅ |
| Audit log | ❌ | ⚠️ counters only | ✅ full record |
| DSR export | ❌ | ❌ | ✅ |
| Encrypted cross-device sync | ❌ | ❌ | ✅ optional |
| Community adapter SDK | ❌ | ⚠️ rules only | ✅ |

**Consent-O-Matic is excellent and this project stands on it.** The difference in intent: Consent-O-Matic answers *"make this banner go away correctly."* This project answers *"give me a portable, auditable data-permission policy that follows me across the web."*

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  CONTENT SCRIPT  (all frames, document_start)              │
│  • CMP detection via Consent-O-Matic rules                 │
│  • Maps CMP categories (A/B/D/E/F/X) → policy categories   │
│  • Applies decision, logs audit entry                      │
├────────────────────────────────────────────────────────────┤
│  SERVICE WORKER  (MV3 background)                          │
│  • GPC header injection (declarativeNetRequest)            │
│  • Policy storage & broadcast to tabs                      │
│  • Audit buffering + statistics                            │
│  • Encrypted sync (WebCrypto AES-GCM)                      │
├────────────────────────────────────────────────────────────┤
│  POLICY ENGINE  (shared)                                   │
│  • site override → context rule → global default           │
│  • Schema validation, YAML ⇄ JSON                          │
├────────────────────────────────────────────────────────────┤
│  DASHBOARD  (options page)                                 │
│  • Policy editor · Audit log · Site overrides              │
│  • Sync config · Statistics · Adapter SDK docs             │
└────────────────────────────────────────────────────────────┘
```

**Category mapping** — Consent-O-Matic uses single letters; this project uses semantic names:

| CoM | Meaning | Policy category |
|:---:|---|---|
| A | Preferences / functional | `preferences` |
| B | Performance | `analytics` |
| D | Information / statistics | `analytics` |
| E | Content / social | `social` |
| F | Advertising | `marketing` |
| X | Other | `unclassified` |

---

## Installation

### From source

```bash
git clone --recurse-submodules https://github.com/JuicyLies/UniversalDataPermissionLayer
cd UniversalDataPermissionLayer
npm install

npm run build:chrome     # → dist/chrome/
npm run build:firefox    # → dist/firefox/
```

> Already cloned without submodules? Run `git submodule update --init --recursive`.

**Chrome / Edge / Brave** — go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select `dist/chrome/`.

**Firefox** — go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, select any file inside `dist/firefox/`.

### Requirements
- Node.js 18+
- Chrome 109+ / Firefox 109+

---

## Configuration

Open the extension's options page for the dashboard:

| Tab | Purpose |
|---|---|
| **Dashboard** | Protected sites, CMPs handled, recent activity |
| **Policy Engine** | YAML editor with live preview and validation |
| **Audit Log** | Searchable, filterable, paginated history |
| **Site Overrides** | Per-site, per-category exceptions |
| **Cloud Sync** | Optional encrypted sync configuration |
| **Statistics** | Top sites, CMP coverage |
| **CMP Adapters** | Adapter SDK docs and loading |

Import/export policies as `.yaml` or `.json` from the header — the policy is portable between devices and shareable.

---

## Privacy & Security Design

**This extension collects nothing.** There is no telemetry, no analytics, no vendor backend, no account.

| Data | Where it lives | Leaves your device? |
|---|---|---|
| Policy | `chrome.storage.sync` | Only via browser's own sync, or your sync endpoint |
| Audit log | `chrome.storage.local` | Only if you enable sync, encrypted |
| Statistics | `chrome.storage.local` | Never |
| Sync passphrase | Local only | **Never** |

**Encryption:** AES-256-GCM with a random 96-bit IV per payload; key derived with PBKDF2-SHA256 at 100,000 iterations. Encryption happens **before** transmission — a sync endpoint operator sees ciphertext only.

**Permissions and why they are needed:**

| Permission | Reason |
|---|---|
| `storage` | Store policy, audit log, statistics |
| `activeTab`, `tabs` | Identify the current site for policy scoping |
| `scripting` | Interact with CMP dialogs |
| `declarativeNetRequest` | Inject the `Sec-GPC` header |
| `<all_urls>` | Cookie banners appear on any site |

Broad host access is unavoidable for this class of tool — which is exactly why the source is public and auditable. Read [`src/background/background.js`](src/background/background.js) and verify there is no exfiltration path.

---

## Scope & Limitations

### What this tool does
It automates **your own responses** to consent dialogs, using the controls those
dialogs already provide, according to preferences **you** configured. It sends the
standardised Global Privacy Control opt-out signal.

### What this tool does not do
- It does **not** block, bypass, or circumvent consent mechanisms.
- It does **not** falsify consent — it records refusal, which is the safe default.
- It does **not** defeat paywalls or access controls.
- It does **not** interfere with strictly necessary cookies.

### Technical limitations

1. **CMP detection is imperfect.** Coverage depends on the Consent-O-Matic rule
   corpus. Unrecognised CMPs are left alone — the extension fails *open* (does
   nothing) rather than guessing.
2. **A signal is not enforcement.** Sending GPC does not force a site to honour it.
3. **Some sites may break.** Aggressive refusal occasionally interferes with
   functionality. Use per-site overrides.
4. **Manifest V3 constraints.** No persistent background page; the service worker
   may be suspended. Header injection is subject to `declarativeNetRequest` rule
   limits.

### Legal positioning

> 🚧 **Coming soon** — see [Legal Foundation](#legal-foundation).
>
> This README is technical documentation. It is **not legal advice**. Consult a
> qualified data protection lawyer before relying on this tool for compliance
> purposes, especially in a commercial context.

---

## Contributing

Contributions welcome — particularly:

- **CMP adapters** for uncovered platforms (see the Adapters tab for the SDK)
- **Bug reports** for sites where handling misfires — include the URL and CMP name
- **Translations**
- **Tests** — `PolicyEngine` is pure logic and an ideal target

Please open an issue before starting substantial work. Contributions are accepted under the MIT licence.

**Please do not** submit anything designed to bypass paywalls, defeat access controls, or falsify affirmative consent. Such changes will be rejected.

---

## Credits

Built on [**Consent-O-Matic**](https://github.com/cavi-au/Consent-O-Matic) by the Centre for Advanced Visualisation and Interaction (CAVI), Aarhus University — © Janus Bager Kristensen and Rolf Bagge, MIT licensed. Their CMP detection engine and community rule corpus make this project possible. If you find this useful, please star their repository too.

Also drawing on:
- [Global Privacy Control](https://globalprivacycontrol.org/) — the opt-out signal specification
- [EDPB](https://edpb.europa.eu/) — guidance on consent and deceptive design patterns

---

## License

MIT — see [LICENSE](LICENSE).

Consent-O-Matic is separately MIT licensed; its copyright notice is retained in the submodule.

---

<div align="center">
<strong>Privacy is a right, not a preference toggle buried three clicks deep.</strong>
</div>
