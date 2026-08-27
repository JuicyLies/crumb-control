# Live site test results — v0.4.0

Real-world verification of the non-English banner handling, run in headless
Chromium with the built `dist/chrome` extension loaded.

**Test conditions**

- Date: 2026-08-27
- Build: v0.4.0 (`dist/chrome`, the same artifact attached to the release)
- Browser: Chromium 151 (Playwright), `--load-extension`
- Locale: `it-IT`, UA: desktop Chrome 151
- **Network egress: United Kingdom (BT, England)** — a GDPR jurisdiction, so
  consent banners genuinely fire. This matters: testing from a non-EU IP would
  suppress most banners and produce a falsely clean result.
- Method: each site loaded twice — once clean (baseline), once with the
  extension — and the DOM probed for a visible consent overlay.

---

## Results

| Site | Banner before | Banner after | Outcome | Rule |
|---|:--:|:--:|---|---|
| repubblica.it | visible | **removed from DOM** | ✅ handled | `iubendaExtended` |
| lastampa.it | visible | **gone** | ✅ handled | `iubuenda` |
| elmundo.es | visible | **gone** | ✅ handled | `didomi.io` |
| ilfattoquotidiano.it | none¹ | none | ✅ engine ran | `clickio` |
| ansa.it | visible | visible | ⚠️ **declined by design** | `iubendaExtended` |
| spiegel.de | visible | visible | ❌ not handled | `sourcepoint_frame_2022` |
| corriere.it, gazzetta.it, ilsole24ore.com, tgcom24, lemonde.fr, bbc.co.uk | none¹ | none | — | — |

¹ No banner in the baseline either — these sites did not present a consent
overlay under these conditions, so they are not evidence either way.

**Of the 5 sites that presented a dismissable banner, 3 were fully handled.**
ANSA was correctly declined (see below) and Spiegel was missed.

---

## Repubblica — verified fixed

The strongest single result. Strict DOM check on `#iubenda-cs-banner`:

```
baseline   banner visible: true  | container: true  | exists: true
with ext   banner visible: false | container: false | exists: false
```

The element is not merely hidden — it is **removed from the DOM**. Extension
log: `[UDP] Handled CMP: iubendaExtended clicks: 1`.

This fired the rule added in v0.4.0.

---

## ANSA — correctly declined, not a bug

ANSA presents a **pay-or-consent wall**. The buttons inside the banner are:

| Button | Meaning |
|---|---|
| `ACCETTA E CONTINUA` | Accept and continue |
| `RIFIUTA E ABBONATI` | **Reject *and subscribe*** |
| `PREFERENZE COOKIES` | Cookie preferences |

There is no free reject path. The only "reject" requires a paid subscription,
so the extension left the banner alone rather than pushing the user toward a
purchase. **This is the intended behaviour** — Crumb Control does not click
through paywalls, and refusing to guess is safer than guessing wrong.

Pay-or-consent walls are a policy problem, not a detection problem.

---

## Why the normalisation matters — measured, not theoretical

Strings scraped from these live pages during this run, tested against the old
and new matchers:

| Live string | Old matcher | New matcher |
|---|:--:|:--:|
| `Continua senza accettare` (La Stampa) | ✅ | ✅ |
| `l'obiettivo di rendere accessibili` (ANSA, curly `'`) | ❌ | ✅ |
| `pubblicità personalizzata` (Repubblica) | ❌ | ✅ |
| `Sei già abbonato` (ANSA) | ❌ | ✅ |

Three of four real Italian strings fail the old byte-comparison and pass the
normalised one. This is the accent/apostrophe class of bug the v0.4.0 patch
fixes, confirmed against production pages rather than synthetic fixtures.

---

## Known gaps

- **spiegel.de** — Sourcepoint inside a cross-origin iframe. The rule matched
  but registered 0 clicks. Needs investigation.
- **Pay-or-consent walls** (ANSA and similar) are deliberately out of scope.
- Several sites showed no banner at all in this environment. A residential EU
  IP with a fresh profile would exercise more CMPs; results here are a floor,
  not a ceiling.

## Reproducing

```bash
npm run build:chrome
cd /opt/data/browser-env
node baseline.mjs   # clean run, writes baseline.json
node withext.mjs    # extension run, writes withext.json
```
