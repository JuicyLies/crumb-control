# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ |

Only the latest release is supported.

## Reporting a Vulnerability

**Do not file a public issue for security vulnerabilities.**

Instead, email **security@juicylies.dev** (or open a GitHub Security Advisory privately) with:

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Any suggested fix

We will acknowledge within 48 hours and aim to ship a fix within 30 days for confirmed issues.

## Threat Model

This extension operates under the following assumptions:

| Asset | Protection |
|-------|------------|
| User policy & audit log | Stored in `chrome.storage` (local + sync); never sent to us |
| Sync passphrase | Derived client-side; never transmitted |
| Sync payload | Encrypted with AES-256-GCM before leaving device |
| CMP interaction | Uses the CMP's own DOM and event handlers; no code injection beyond user-initiated clicks |
| Network requests | Only to user-configured sync endpoint; no telemetry, no vendor backend |

**Explicitly out of scope:**
- Compromise of the browser's own storage APIs
- Compromise of the user's sync endpoint
- Sites that detect and deliberately break when consent is refused

## Known Limitations

- **Manifest V3 service worker lifecycle** — the background worker may be suspended; policy updates are pushed to open tabs but closed tabs will reload policy on next navigation.
- **CMP detection is heuristic** — unknown CMPs are ignored (fail-open).
- **`declarativeNetRequest` rule limits** — GPC header injection uses a single static rule; dynamic per-site header rules are not supported in current MV3.
- **Third-party iframe context** — the content script runs in all frames; policy resolution prefers the top-frame hostname but third-party iframes may not coordinate perfectly.

## Dependency Security

- `npm audit` runs in CI
- Only production dependencies in `package.json` (one: `js-yaml`)
- Submodule: Consent-O-Matic (MIT, auditable)

## Disclosure Timeline

| Event | Target |
|-------|--------|
| Acknowledge report | ≤ 48 hours |
| Confirm / triage | ≤ 7 days |
| Fix merged | ≤ 30 days |
| Public disclosure | After fix ships + 7 days (or coordinated with reporter) |

## Safe Harbour

We follow coordinated vulnerability disclosure. Researchers who make a good-faith effort to avoid privacy violations, data destruction, and service disruption — and who report findings through this channel — will not face legal action.

---

**PGP key:** (if you have one, paste it here)

*This policy is adapted from standard responsible disclosure templates and applies to this repository only.*