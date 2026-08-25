# Universal Data Permission Layer

**Beyond cookie banner clickers.** A Manifest V3 browser extension that implements a **comprehensive, extensible, cross-platform data permission layer** — going far beyond what Consent-O-Matic offers.

## The Problem

EU regulators wanted browsers to let users set cookie/data preferences **once**, so consent banners would auto-configure and disappear. Google pressured them to pause. We build the equivalent — and more — as a browser extension.

## What's New vs Consent-O-Matic

| Feature | Consent-O-Matic | Universal Data Permission Layer |
|---------|----------------|----------------------------------|
| Cookie banner auto-clicking | ✅ | ✅ (inherited) |
| **YAML/JSON policy engine** — "Reject analytics globally, accept functional" | ❌ | ✅ |
| **GPC header injection** (`Sec-GPC: 1`) | ❌ | ✅ |
| **Topics API / Privacy Sandbox** signals | ❌ | ✅ |
| **Extensible CMP adapter SDK** | ❌ | ✅ |
| **Encrypted cloud sync** (E2E, privacy-preserving) | ❌ | ✅ |
| **Audit dashboard** — every site, what you consented to, when | ❌ | ✅ |
| **DSR export** (GDPR Article 15/17) | ❌ | ✅ |
| **Cross-device** via cloud sync | ❌ | ✅ |
| **First-party vs third-party context** awareness | ⚠️ partial | ✅ |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CONTENT SCRIPT (every page, MV3)                           │
│  ├─ Inherits CMP detection from Consent-O-Matic            │
│  ├─ Reads user Policy (sync from background)               │
│  ├─ Decides per-CMP consent choices via PolicyEngine       │
│  └─ Logs audit entry per interaction                       │
├─────────────────────────────────────────────────────────────┤
│  SERVICE WORKER (MV3 background)                            │
│  ├─ GPC header injection (declarativeNetRequest)           │
│  ├─ Topics API opt-out signals                             │
│  ├─ Policy sync (chrome.storage.sync)                      │
│  ├─ Encrypted cloud sync (optional, WebCrypto AES-GCM)     │
│  └─ Audit log aggregation                                  │
├─────────────────────────────────────────────────────────────┤
│  POLICY ENGINE (shared module)                              │
│  ├─ YAML/JSON rule parsing                                 │
│  ├─ Site-scoped overrides                                  │
│  ├─ Category-level preferences (analytics, ads, etc.)      │
│  └─ First-party vs third-party rules                       │
├─────────────────────────────────────────────────────────────┤
│  ADAPTER SDK (community-extensible)                         │
│  ├─ Standard CMP interface: detect(), handle(), hide()     │
│  ├─ Rule schema validation                                 │
│  └─ Hot-load community adapters                            │
├─────────────────────────────────────────────────────────────┤
│  DASHBOARD (options page)                                   │
│  ├─ Site-by-site consent history                           │
│  ├─ DSR export (JSON / CSV)                                │
│  ├─ Policy editor (YAML with schema validation)            │
│  └─ Sync status & device list                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
git clone https://github.com/JuicyLies/UniversalDataPermissionLayer
cd UniversalDataPermissionLayer
npm install
npm run build:chrome   # → dist/chrome/
npm run build:firefox  # → dist/firefox/
```

Load the `dist/chrome/` folder in `chrome://extensions` with Developer Mode on.

## License

MIT (Consent-O-Matic is MIT; we extend it under the same terms). See `LICENSE`.

## Roadmap

- [x] Repo scaffold + Consent-O-Matic upstream merge
- [x] Policy engine (YAML/JSON with JSON Schema validation)
- [x] GPC header injection via `declarativeNetRequest`
- [ ] Topics API opt-out
- [ ] Encrypted cloud sync (WebCrypto AES-GCM + passphrase)
- [ ] Audit dashboard
- [ ] CMP adapter SDK + community adapter loader
- [ ] Firefox/Safari ports
