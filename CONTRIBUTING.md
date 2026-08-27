# Contributing to Crumb Control

Thank you for contributing! This project aims to be a reliable, legally-grounded tool for automating personal data preferences on the web.

## Quick Start

```bash
git clone --recurse-submodules https://github.com/JuicyLies/crumb-control
cd crumb-control
npm install
npm run build:chrome   # verify it compiles
```

## Priority Areas

| Area | Difficulty | Description |
|---|---|---|
| **CMP Adapters** | Low | New CMPs appear constantly; the SDK is intentionally small. |
| **Bug Reports** | Low | "Site X breaks / banner not handled" — include URL and CMP name if known. |
| **PolicyEngine Tests** | Medium | Pure logic, excellent test target. See `src/shared/PolicyEngine.js`. |
| **Firefox/Safari parity** | Medium | Firefox build works; Safari manifest may need adjustments. |
| **Documentation** | Low | Translations, clearer examples. |

## CMP Adapter SDK

The adapter interface. An adapter is a small module exporting:

```js
export default {
  name: 'MyCMP',
  detect:    () => boolean,        // is this CMP present on the page?
  isShowing: () => boolean,        // is the banner currently visible?
  handle: async (consentTypes) => { // perform the clicks
    // consentTypes = { A: true, B: false, D: false, E: false, F: false, X: false }
    return { clicks: number };
  }
};
```

**Rules for acceptance:**
- Adapter must target a specific, identifiable CMP
- No paywall bypassing, no falsifying affirmative consent
- Must handle the CMP's own controls, not override them

## Non-English banners

Most consent banners aren't in English, and this is where coverage is weakest — help here is very welcome.

Two things to know before you start:

**1. Text matching is already normalised.** `scripts/patch-matcher.js` patches Consent-O-Matic's `Tools.findElement()` at build time so `textFilter` comparisons ignore accents, curly vs straight apostrophes, and non-breaking spaces. You do **not** need to list `Funzionalità` and `Funzionalita` separately — write the natural form and it will match either.

The patch is idempotent and re-applies on every build (the submodule stays pristine). If upstream restructures that function the build fails loudly rather than shipping something broken.

Verify the logic with:
```bash
npm run test:matcher
```

**2. Add new rules to `rules-extra/`, not the submodule.** Anything in `Consent-O-Matic/` is wiped on the next submodule update. `rules-extra/*.json` is merged **after** upstream, and upstream always wins on key collisions — so these files can only fill gaps, never break existing coverage.

To add coverage for a banner in your language:

1. Find the banner's container and button selectors (DevTools, right-click → Inspect)
2. Add an entry to `rules-extra/crumb-control-i18n.json` following the existing shape
3. Include the reject/customise/save button text in your language under `textFilter`
4. Rebuild and test on the real site: `npm run build:chrome`

Keep detectors specific. A rule that matches too broadly will click the wrong thing on unrelated sites, which is worse than not matching at all.

## Reporting Bugs

**Template:**
```markdown
**Site:** https://example.com
**CMP:** OneTrust / Cookiebot / Quantcast / unknown
**Expected:** "Reject All" clicked, banner dismissed
**Actual:** banner remains / wrong buttons clicked / page broken
**Steps to reproduce:** ...
**Console errors:** (paste if any)
```

## Code Style

- ESM modules (`import`/`export`)
- No TypeScript (yet) — plain JS with JSDoc
- ESLint + Prettier configs coming; for now match existing style

## Pull Requests

1. Open an issue first for anything non-trivial.
2. Keep changes focused — one logical change per PR.
3. Include a description of *why*, not just *what*.
4. All PRs must pass `npm run build:chrome` and `npm run build:firefox`.

## Legal Guardrails

This project is built on the premise that **automating your own lawful choices is lawful** (GDPR Art. 12(2), 21(5)). Contributions that:

- Bypass paywalls or access controls
- Falsify affirmative consent (e.g., clicking "Accept" when policy says "Reject")
- Target specific vendors for circumvention rather than handling their CMP neutrally

will not be accepted. This is a design constraint, not an oversight.

## License

By contributing, you agree your contributions are licensed under the MIT License (see [LICENSE](LICENSE)).