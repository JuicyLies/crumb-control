# Changelog

All notable changes to Crumb Control are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.0] — 2026-08-27

### Added
- **Language-tolerant banner matching.** Banner text is now normalised on both sides before comparison — accents stripped, curly apostrophes unified, non-breaking spaces collapsed. This fixes non-English banners that were silently ignored.
- **Extended Iubenda coverage** (`rules-extra/`), the dominant CMP on Italian sites, plus a conservative multilingual reject-button fallback. 207 → 209 bundled CMPs.
- **Banner counter** on the Status tab — a lifetime tally of banners handled. Stored locally, never transmitted.
- **Per-site consent decisions.** Every category on the Status tab is now a button; tapping one flips it for the current site only, leaving global settings untouched.
- `scripts/patch-matcher.js` — re-applies the matcher fix to the Consent-O-Matic submodule at build time. Idempotent, and fails loudly if upstream restructures the target function.
- `scripts/test-matcher.js` — 11 regression cases covering the real-world failures the patch fixes.
- Issue templates for broken banners, bugs and feature requests.

### Changed
- Popup is smaller (400×580 → 352×500) with rounded corners.
- Settings presets removed; category toggles are now the single source of truth. "Essential only" remains the fresh-install default.
- About section rewritten with how-it-works, privacy stance and honest limitations.
- Build no longer ships unused Consent-O-Matic sources, the rule editor, or the 764KB master icon — roughly 900KB removed from the packaged extension.
- `npm test` now runs the matcher regression suite, and CI runs tests (previously it only built).

### Removed
- **`scripting` permission.** It was declared but never used. Fewer permissions, smaller install warning, less review friction.

### Fixed
- The in-app "Report broken cookie banner" button pointed at an issue template that didn't exist, so every report attempt failed. The template now exists.
- Documentation described end-to-end encrypted cloud sync (AES-256-GCM, PBKDF2, user-configured endpoint) that was **never implemented**. All such claims removed — see the note in `PRIVACY_POLICY.md`. Settings do sync, but via the browser's own profile sync, under the browser vendor's policy.
- Corrected the "500+ CMP rules" claim to the actual bundled count.
- Removed references to a dashboard and options page that haven't existed since 0.3.0.

---

## [0.3.0] — 2026-08-26

### Added
- Confirmation toast when a banner is handled (can be switched off).
- Per-category toggles in Settings.

### Changed
- Rebranded to **Crumb Control**; new logo.
- UI rebuilt as a compact bronze/black popup panel, replacing the full-page dashboard.
- Settings simplified to presets, with advanced options behind a disclosure.

---

## [0.2.1] — 2026-08-25

### Fixed
- GPC header injection: `fetch` is not a valid `declarativeNetRequest` resource type; switched to `xmlhttprequest` and `other`.

---

## [0.2.0] — 2026-08-25

### Fixed
- **Core bug:** the Consent-O-Matic engine was never wired in, so banners went unhandled. This is the release where the extension started actually working.

---

## [0.1.0] — 2026-08-25

Initial release. MV3 extension with a policy engine, GPC header injection, Consent-O-Matic CMP detection, audit log with JSON export, and Chrome + Firefox builds.

[0.4.0]: https://github.com/JuicyLies/crumb-control/releases/tag/v0.4.0
[0.3.0]: https://github.com/JuicyLies/crumb-control/releases/tag/v0.3.0
[0.2.1]: https://github.com/JuicyLies/crumb-control/releases/tag/v0.2.1
[0.2.0]: https://github.com/JuicyLies/crumb-control/releases/tag/v0.2.0
[0.1.0]: https://github.com/JuicyLies/crumb-control/releases/tag/v0.1.0
