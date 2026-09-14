# Marketing assets and preparation — 14 September 2026

Reviewed `Z:/Shared/VibeCode/crumb-control-marketing`: nine carousel decks, including the paywall deck missing from the old inventory. The bronze/black typography is readable and consistent. These are useful drafts; more artwork is not the immediate bottleneck.

## Copy to correct before publication

- `italian-bug`: “most cookie blockers are built on” Consent-O-Matic is unsupported. Say “the Consent-O-Matic project our extension builds on.” The upstream fix is submitted in PR https://github.com/cavi-au/Consent-O-Matic/pull/597; do not imply it has merged. 679 is a count of matchers, not proof all 679 failed. Slide 6 displays the same apostrophe on both sides; use a clearly labelled U+2019 versus U+0027 example.
- `spiegel-13`, `eprivacy-money`, `italy-sites`: retain the original dated measurement, consent state, browser/location and raw evidence before publishing the tracker counts. Counts are observations of known domains, not proof every resource tracks an individual or that the extension blocks them. The extension's recorded banner test missed Spiegel; do not imply this deck demonstrates successful handling there.
- `eprivacy`, `eprivacy-rant`, `eprivacy-hacks`, `eprivacy-money`: the draft-law/memo story needs primary citations and a precise distinction between the February 2025 withdrawal announcement and formal withdrawal. “Cookie banners were supposed to be illegal” and “no banners ever” oversimplify a proposal. Prefer a separate, sourced educational story after product demos establish what the extension does.
- `reject-all-lie`: remove “always,” “every banner,” “any language,” the unsupported six-month development timeline and general claims that closing an X means consent. Describe observed examples and supported banners.
- `paywall`: preserve the documented ANSA button labels, but do not present a historical example as a universal or current legal rule. Make clear Crumb Control does not bypass subscriptions.
- Several decks end only with a comment prompt. For install-focused variants, provide a desktop-install destination after a store listing exists.

Do not add trending music automatically. Use original or appropriately licensed audio and TikTok's commercial disclosure when promoting your own product. No publishing or account connection has been performed.

## Reusable local preparation

From the extension project:

```powershell
node scripts/marketing-pack.cjs --source "Z:\Shared\VibeCode\crumb-control-marketing" --videos
```

Requires Node and FFmpeg on PATH. Omit `--videos` for slide/caption packs only, or add `--deck italian-bug` to prepare one deck. Output defaults to the source folder's `_exports` directory.

The tool checks slide order and PNG dimensions, separates audio instructions from captions, copies slides into revision-specific folders, assembles silent 1080×1920 H.264 videos (four seconds per slide), and writes a local preview page and JSON manifest. Content hashes make reruns reuse existing videos and preserve previous revisions. The manifest explicitly marks all existing decks as requiring copy review. Source artwork is unchanged.

Start with a corrected Italian-bug story plus real before/after desktop recordings. Publish a small batch on one account through Buffer or Metricool and assess visits/store clicks before paying for traffic. No platform account creation, fake engagement, browser fingerprinting or custom direct uploader is needed for this workflow.
