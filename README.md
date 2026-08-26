# Crumb Control

> **Stop clicking cookie banners.** Tell your browser what you want once, and it handles every website for you.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Works in Chrome](https://img.shields.io/badge/Works%20in-Chrome-green.svg)](#try-it)
[![Works in Firefox](https://img.shields.io/badge/Works%20in-Firefox-green.svg)](#try-it)

---

## What is this?

You know those cookie pop-ups that appear on **every single website**? The ones where "Accept All" is one big button and "Reject All" is buried behind three clicks?

This is a browser add-on that **does the clicking for you**. You choose your preferences once — "block all tracking, allow the stuff that makes sites work" — and the add-on quietly says "reject" (or "accept") on your behalf, every time, on every site.

You never see the banners. You never have to think about it.

---

## Why does this need to exist?

Because the law that was supposed to fix this got killed by lobbying.

**The story (2017–today):**

The EU wrote a new law called the **ePrivacy Regulation**. Buried in Article 9 was a beautiful, simple idea:

> *You set your cookie preferences **once**, in your web browser. Websites are legally required to read that setting and respect it. No more pop-ups. Ever.*

Then the lobbying started:

- **Google and the ad industry** said: "If browsers control consent, that gives too much power to browser makers." (Read: it would break their ad business.)
- **News websites and publishers** said: "If people can set 'Reject All' once, we lose ad money without ever getting to ask them."
- **EU member states** (Germany, France, Ireland, others) got stuck in the argument. The law was watered down draft after draft, and eventually shelved.

**Result:** No new law. So every site still shows you a pop-up, dark patterns make "Reject" harder than "Accept," and you're stuck clicking banners forever.

**This add-on is what that law was supposed to be** — except it's a browser add-on you install yourself, not a legal mandate. Same outcome: set your preferences once, forget the banners exist.

---

## What it does, in plain English

| Feature | What it means |
|---|---|
| 🍪 **Auto-clicks cookie banners** | You never see them. The add-on picks the buttons for you based on what you told it. |
| 🎛️ **You choose the rules** | "Reject tracking everywhere. Allow analytics on Wikipedia only." Whatever you want. |
| 📡 **Sends a "don't track me" signal** | A universal opt-out signal called Global Privacy Control. Some laws (California) legally require sites to obey it. |
| 📋 **Keeps a log** | Every decision it made — which site, what it clicked, when. Download it as a file any time. |
| 🔒 **Sync across your devices (optional)** | Your settings can follow you between laptop and desktop. Encrypted end-to-end. Off by default. |
| 🚫 **Zero tracking** | The add-on itself collects **nothing**. No accounts. No servers. Everything stays in your browser. |

---

## Try it

You have three ways, from easiest to most involved.

### Option 1: Chrome Web Store *(coming soon)*
Once the store review is done, you'll click **Add to Chrome** and that's it. Watch this space.

### Option 2: Download and drop in
1. Grab the latest release from the [Releases page](https://github.com/JuicyLies/crumb-control/releases)
2. Download `udp-chrome-v0.1.0.zip` (or `udp-firefox-v0.1.0.zip`)
3. **Unzip it** somewhere
4. In Chrome: open `chrome://extensions`, flip the **Developer mode** switch (top right), click **Load unpacked**, pick the unzipped folder
5. In Firefox: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, pick any file inside the unzipped folder

### Option 3: Build it yourself
For developers who want to hack on it:

```bash
git clone --recurse-submodules https://github.com/JuicyLies/crumb-control
cd crumb-control
npm install
npm run build:chrome   # or build:firefox
```

Then load `dist/chrome/` (or `dist/firefox/`) as an unpacked extension.

**Need:** Node.js 18 or newer.

---

## How to actually use it

Once installed, click the Crumb Control icon in your browser toolbar. Everything lives in one compact popup — there's no separate settings page, no dashboard, and no account to create.

| Tab | What it does |
|---|---|
| **Status** | What happened on the current site — whether a banner was found, recognised and handled |
| **Log** | Recent activity across sites, so you can check it's doing its job |
| **Settings** | Pick a preset, or flip individual categories |
| **About** | Version, credits and links |

### Choosing what gets blocked

Pick a preset and you're done:

- **Essential only** — reject everything except cookies the site genuinely needs to function *(default)*
- **Balanced** — allow preferences, reject tracking and marketing
- **Allow all** — accept everything
- **Custom** — flip individual categories yourself

The categories are **necessary**, **preferences**, **analytics**, **marketing**, **social** and **unclassified**. `necessary` is locked on, because switching it off breaks sites. Flip any other toggle and the preset switches to Custom automatically — changes save instantly, there's no Save button.

When a banner is handled, a small confirmation appears in the corner of the page for a few seconds so you know it worked. You can turn that off in Settings.

---

## Browser support

| Browser | Status |
|---|---|
| **Chrome** | Supported |
| **Firefox** | Supported |
| **Brave** | Planned — Chromium-based, so the Chrome build is expected to work; not yet formally tested |
| **Edge** | Planned — same as above |
| **Opera** | Planned — same as above |
| **Safari** | Not planned for now (needs a different extension format) |

Brave, Edge and Opera all run on Chromium, so the Chrome build will very likely install and work today. We haven't verified them properly yet, so they aren't listed as supported — testing and official support for these is on the roadmap. If you try one, [open an issue](https://github.com/JuicyLies/crumb-control/issues) and tell us how it went.

---

## Is it safe?

**Yes, and you can verify it yourself.** This add-on:

- ✅ **Collects no data.** No analytics, no telemetry, no accounts, no servers you don't control.
- ✅ **Stays local.** Everything is in your browser's own storage. It never phones home.
- ✅ **Open source.** Every line of code is public. Read it, audit it, fork it.
- ✅ **No hidden network requests.** The only thing it sends is a `Sec-GPC: 1` header (the privacy signal) to sites you're already visiting. If you turn on sync, it talks *only* to the endpoint you configure.

Full details: see [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

---

## What it does NOT do

Important, so we're clear:

- ❌ **It doesn't bypass paywalls.** If a site requires a subscription, this add-on won't get you around that.
- ❌ **It doesn't fake consent.** If you say "reject," it clicks reject. It never lies to sites on your behalf.
- ❌ **It doesn't break "strictly necessary" cookies.** Sites need those to log you in, remember your cart, etc. Those stay on.
- ❌ **It's not magic.** Some cookie banners it doesn't recognise yet. Those it leaves alone (safer than guessing wrong).
- ❌ **It's not legal advice.** Sending a signal doesn't force a site to obey it, especially outside the EU/California.

---

## Compared to what's already out there

| | I Don't Care About Cookies | Consent-O-Matic | **This add-on** |
|---|:---:|:---:|:---:|
| Makes banners disappear | ✅ | ✅ | ✅ |
| Lets you choose what to reject | ❌ | ✅ | ✅ |
| Portable settings file | ❌ | ❌ | ✅ |
| Different rules for different sites | ❌ | on/off only | ✅ |
| Sends the Global Privacy Control signal | ❌ | ❌ | ✅ |
| Keeps a searchable log | ❌ | ❌ | ✅ |
| Encrypted sync across devices | ❌ | ❌ | ✅ |

**Credit where it's due:** this is built on top of [Consent-O-Matic](https://github.com/cavi-au/Consent-O-Matic) (Aarhus University, MIT licensed). They wrote the cookie-banner detection engine and maintain a database of 500+ banner types. This project adds the preferences layer, privacy signal, and simplified UI on top.

---

## Help / bug reports

- **Something not working?** Open an [issue on GitHub](https://github.com/JuicyLies/crumb-control/issues) — say which website and what happened
- **Cookie banner not being handled?** That means it's a new one. Same link, tell us the site.
- **Want to help?** See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Security bug?** See [SECURITY.md](SECURITY.md)

---

## License

MIT. Free to use, modify, distribute. Full text: [LICENSE](LICENSE).

Built on Consent-O-Matic (also MIT). Their copyright is preserved in the submodule.

---

<div align="center">

**Your privacy is a right, not a checkbox buried three clicks deep.**

</div>
