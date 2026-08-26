# HANDOFF — v0.3.0 Redesign Brief

> **For the next session / agent.** This file is self-contained. Read it fully before starting.
> Everything in "Current State" is verified working. Everything in "Your Job" is not yet built.

---

## TL;DR

The extension **works** (cookie banners get auto-dismissed on BBC, Guardian, MaxMara, Asos). The **functionality is done for now**. What's left is a **design and branding overhaul**:

1. Rebuild the UI as a **compact popup** (not a full-page tab)
2. **Bronze / black / dark-grey** colour scheme (kill the blue/purple)
3. **Radically simplify** the settings — 3 presets, advanced hidden behind a toggle
4. **New name** (current one rejected) + **new logo**

Do NOT rewrite the engine, the policy logic, or the build pipeline. Those work.

---

## Current State (verified working — do not break)

| Thing | Status |
|---|---|
| Cookie banner auto-handling | ✅ Working — BBC, Guardian, MaxMara, Asos confirmed |
| 207 CMP rules bundled | ✅ OneTrust, Quantcast, Cookiebot, Sourcepoint, Didomi, TrustArc, Usercentrics + 200 more |
| GPC header (`Sec-GPC: 1`) | ✅ Working (fixed in v0.2.1) |
| Audit log | ✅ Working — Daniel says "the log is good" |
| About section | ✅ Working — Daniel says "that's good" |
| Chrome MV3 build | ✅ `npm run build:chrome` |
| Firefox MV3 build | ✅ `npm run build:firefox` |
| Build verification | ✅ `scripts/verify-build.js` catches missing manifest files |
| GitHub Releases | ✅ v0.2.1 live with both zips |

**Known limitation (not a bug, don't "fix" by guessing):** New York Times uses a custom in-house CMP with no rule in the upstream corpus. The engine deliberately ignores banners it can't identify rather than clicking blind. A hand-written NYT adapter is a separate optional task.

---

## Your Job (v0.3.0)

### 1. UI: popup, not a page

**Current (wrong):** clicking the extension opens a full browser tab with an 8-tab dashboard. Daniel: *"You've made it into a site. It would be a lot cleaner if we just had it like a pop-up."*

**Target:** A compact panel anchored top-right, like a crypto wallet extension (MetaMask / Phantom / Rabby are the reference points Daniel named).

- Fixed dimensions — roughly **360–420px wide × 550–600px tall**
- **Left sidebar** with icon-based nav + **main content panel** on the right
- Everything lives in `popup.html` — the options page should become minimal or disappear entirely
- Must not feel like a website. It's a utility panel.

**Files:** `src/popup/popup.html`, `src/popup/popup.css`, `src/popup/popup.js`

### 2. Colour scheme: bronze / black / dark grey

Daniel's words: *"do a bronze, blackish colour scheme, grayish, black, grayish, darker scheme, not this blue scheme."*

Replace the entire existing palette. Current CSS variables to kill:
```
--primary: #6366f1   (indigo)   ← DELETE
--primary-hover: #818cf8         ← DELETE
gradients to #8b5cf6 (purple)    ← DELETE
```

Suggested direction (refine as you see fit — bronze is the accent, not the background):
```css
--bg:            #0d0d0d;   /* near-black */
--bg-elevated:   #161616;   /* panel */
--bg-card:       #1e1e1e;   /* card */
--border:        #2e2e2e;
--text:          #e8e6e3;   /* warm off-white, not blue-white */
--text-muted:    #8a8580;
--bronze:        #b87333;   /* primary accent */
--bronze-light:  #cd8f4f;   /* hover */
--bronze-dim:    rgba(184, 115, 51, 0.15);  /* subtle bg */
--success:       #7d9471;   /* muted sage, not neon green */
--danger:        #a85751;   /* muted brick, not neon red */
```
Keep it muted and warm. No neon. Metallic bronze accents against near-black.

### 3. Simplified settings

Daniel: *"We don't need a login system for accounts... Simplify it. Just have an option to only accept necessary cookies, set it up however you want, or completely no cookies at all."*

**Primary UI = three preset buttons. That's it.**

| Preset | Behaviour |
|---|---|
| **Essential only** *(default)* | necessary: allow — everything else: reject |
| **Balanced** | necessary + preferences: allow — analytics/marketing/social: reject |
| **Custom** | Reveals the per-category toggles |

- Advanced (YAML editor, per-site overrides, context rules, sync config) goes behind a **"Advanced settings"** disclosure — collapsed by default
- **Remove the Cloud Sync tab from the main view entirely.** It stays in advanced. There is no login and never will be.
- Must **work out of the box with zero setup**. Default = "Essential only", active immediately on install.

**Tabs to keep in the popup:** Status/Home, Log, Settings, About
**Tabs to demote to advanced:** Policy Engine (YAML), Site Overrides, Cloud Sync, Statistics, CMP Adapters

### 4. New name + logo

Current name **"Universal Data Permission Layer"** is rejected — too long, too corporate, unmemorable.

**Deliver 4 name candidates.** Criteria:
- Short (1–2 words), memorable, pronounceable
- Available as a `.com` or at least not trademark-colliding with an existing extension
- Not "CookieSomething" — there are a dozen of those
- Evokes: quiet automation, privacy, refusal-by-default, a shield or gatekeeper

**Deliver 4 logo concepts.** Constraints:
- Must read clearly at **16×16px** (browser toolbar) — this is the hard constraint
- Bronze/black palette
- Simple geometric shape, no fine detail
- Deliver as SVG + rendered PNG at 16/48/128
- Existing icons live in `src/assets/icons/` (currently inherited from Consent-O-Matic — must be replaced)

Present all 8 (4 names, 4 logos) to Daniel for selection. Do not pick unilaterally.

---

## Project Facts

**Repo:** https://github.com/JuicyLies/UniversalDataPermissionLayer (private)
**Local path:** `/mnt/user/data/Shared/VibeCode/UniversalDataPermissionLayer/`
**Current version:** v0.2.1

### Build
```bash
npm install                # first time only
npm run build:chrome       # merge-rules -> webpack -> verify
npm run build:firefox
```
Output: `dist/chrome/`, `dist/firefox/`, plus zips in `dist/`.
**Always run the build before pushing.** `scripts/verify-build.js` catches missing files that would make the extension fail to load — this bug already shipped once (v0.1.0) and wasted a full test cycle.

### Architecture
```
src/
├── manifest.json           MV3 Chrome manifest
├── manifest.firefox.json   MV3 Firefox manifest
├── shared/PolicyEngine.js  Policy resolution: site override -> context -> global default
├── background/background.js  Service worker: GPC header, rule fetching, audit log,
│                             + Consent-O-Matic message routing (string messages)
├── content/
│   ├── content.js          Bundles ConsentEngine + our policy. THE CRITICAL FILE.
│   ├── GDPRConfig.js       Consent-O-Matic settings storage
│   └── content.css         Progress dialog styles
├── popup/                  ← YOU ARE REBUILDING THIS
├── options/                ← YOU ARE MOSTLY DELETING THIS
└── rules/gpc-rules.json    declarativeNetRequest ruleset for Sec-GPC header

Consent-O-Matic/            git submodule (MIT, Aarhus University)
scripts/merge-rules.js      Merges 204 rule files + Rules.json -> BundledRules.json (207 CMPs)
scripts/verify-build.js     Validates every manifest-referenced file exists in dist
```

### How the policy maps to the engine
Consent-O-Matic uses single-letter categories. `content.js` translates:

| CoM | Meaning | Our category |
|:---:|---|---|
| A | Preferences / functional | `preferences` |
| B | Performance | `analytics` |
| D | Information / statistics | `analytics` |
| E | Content / social | `social` |
| F | Advertising | `marketing` |
| X | Other | `unclassified` |

`true` = accept, `false` = reject. See `getUDPConsentValues()` in `src/content/content.js`.

---

## Hard Rules

1. **No user accounts, no login, no backend.** Ever. Privacy is the product.
2. **No telemetry.** The extension must make zero unsolicited network requests.
3. **Don't break the engine.** `content.js` bundling ConsentEngine is the fix that made v0.2.0 work. If `dist/chrome/content.js` drops below ~35KB, the engine fell out of the bundle again.
4. **Run `npm run build:chrome` before every push.** Non-negotiable.
5. **Legal sections stay as "coming soon" placeholders.** Daniel is sourcing reviewed legal copy separately. Do not write legal claims, do not cite article numbers, do not guess at regulation status.
6. **Ask before picking** the final name/logo. Present options.

---

## Environment Notes

- `/opt/data` is **tmpfs (RAM)** on a 12GB server. Projects live in `/mnt/user/data/Shared/VibeCode/`. Don't write large files to `/opt/data`.
- Hermes' `write_file` tool is blocked outside `/opt/data` (HERMES_WRITE_SAFE_ROOT). **Use bash heredocs** to write files in the project dir.
- Git push works via credential helper at `/opt/data/.git-credentials` — plain `git push origin main` is fine.
- Claude Code is available at `/usr/local/bin/claude/bin/claude` with `HOME=/usr/local/bin/claude`. Pro subscription, 5 plugins.

---

## Definition of Done for v0.3.0

- [ ] Popup is a compact panel (~400×580), sidebar + main, opens from toolbar icon
- [ ] Bronze/black/dark-grey throughout, zero blue/purple remaining
- [ ] Three presets visible immediately; advanced collapsed
- [ ] No sync/login in the primary view
- [ ] 4 name options + 4 logo concepts presented to Daniel
- [ ] `npm run build:chrome` and `build:firefox` both pass verification
- [ ] Banner handling still works after the refactor (retest BBC + Guardian)
- [ ] Tagged and released as v0.3.0 with both zips attached
