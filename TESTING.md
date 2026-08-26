# Testing the Extension

Two goals: **(1) make sure it loads without errors** and **(2) verify it actually handles cookie banners**.

---

## 1. Install it in Chrome (2 minutes)

You have two ways to get the files.

### If you're on the same machine as your Unraid server (SMB access):
The freshly-built zips are sitting at:
```
\\<your-unraid-hostname>\data\Shared\VibeCode\udp-chrome-v0.1.0.zip
```
Copy that to your desktop, unzip it.

### If you're anywhere else:
1. Go to https://github.com/JuicyLies/crumb-control
2. Green "Code" button → Download ZIP → unzip
3. Or wait until we tag a release and download `udp-chrome-v0.1.0.zip` from the Releases page

### Load it into Chrome:
1. Open `chrome://extensions` in a new tab
2. Top right — flip on **Developer mode**
3. Top left — click **Load unpacked**
4. Pick the **unzipped folder** (the one containing `manifest.json` — for the built version that's `dist/chrome/`, for the release zip that's just the unzipped folder itself)
5. You should see **"Crumb Control"** appear with its icon

**If it fails to load:** the error will show inline in the extensions page — screenshot it or copy the text and we'll debug.

---

## 2. Sanity checks (30 seconds each)

### Check A: The icon appears
Look in the toolbar (top right, may be under the puzzle-piece menu). Click it → the popup should open showing the current tab's info.

### Check B: The dashboard opens
Right-click the icon → **Options**. A full dark-themed dashboard should load with 8 tabs down the left (Dashboard / Policy Engine / Audit Log / Site Overrides / Cloud Sync / Statistics / CMP Adapters / About).

### Check C: The service worker is alive
On `chrome://extensions`, find the extension → click **service worker** (the blue link under "Inspect views"). DevTools opens. In the Console tab you should see startup logs like:
```
[UDP] Background service initializing...
[UDP] Policy loaded from sync storage
[UDP] GPC header injection active: Sec-GPC 1
[UDP] Background service ready
```
No red errors = healthy.

### Check D: GPC header is actually being sent
1. Open **DevTools** on any website (F12)
2. Go to the **Network** tab
3. Refresh the page
4. Click any request → **Headers** tab → scroll to **Request Headers**
5. You should see: **`Sec-GPC: 1`**

If that header appears on outgoing requests, your privacy signal is working.

---

## 3. Live cookie-banner test (the real test)

Visit sites that are known to have cookie banners and watch what happens.

### Good test sites (all have Consent-O-Matic rules):

| Site | Expected behaviour |
|---|---|
| https://www.theguardian.com | Banner auto-dismissed, "Reject All" style |
| https://www.bbc.co.uk | Banner handled |
| https://www.spiegel.de | German CMP handled |
| https://www.repubblica.it | Italian publisher CMP |
| https://www.independent.co.uk | Quantcast CMP |
| https://www.nytimes.com | OneTrust CMP |
| https://cnn.com | OneTrust variant |

**What "working" looks like:**
- Banner briefly appears then vanishes (or never appears at all)
- A small progress dialog may flash bottom-right saying "Handling <CMP name>…"
- Click the extension icon → popup shows: **Protection: 🛡 Fully Protected**, CMPs Blocked: 1+

**What "not working" looks like:**
- Banner stays on screen and you have to click it manually → means the CMP isn't in the rule set yet (open a GitHub issue with the site URL and CMP name)

### Verify in the dashboard:
1. After visiting a few of the sites above, right-click the icon → **Options**
2. **Dashboard tab** — you should see the count of CMPs handled tick up
3. **Audit Log tab** — every decision listed with timestamp, site, CMP, category, decision, action, status
4. **Statistics tab** — top sites and top CMPs encountered

---

## 4. Test your policy actually applies

1. Options → **Policy Engine** tab
2. Change something obvious — set `analytics: allow` in the global section
3. Click **Save Policy**
4. Visit a cookie-banner site → refresh
5. Audit log should now show `analytics: allow` for that site's decisions

Change it back to `reject` after — this is the safer default.

---

## 5. Test per-site overrides

1. Options → **Site Overrides** tab → **Add Site Override**
2. Site: `wikipedia.org`
3. Category: `preferences`
4. Decision: `allow`
5. Save
6. Visit wikipedia.org — that override kicks in for wikipedia only

---

## 6. Test DSR export

1. Options → header top-right → **download icon** (Export My Data)
2. A JSON file downloads containing your policy, audit log, and statistics
3. Open it in a text editor — every consent decision, timestamped, exportable

---

## 7. Test cloud sync (optional, only if you want to try it)

You need a simple HTTP endpoint that accepts POST with JSON. For quick testing use https://webhook.site — it gives you a temporary URL that shows every incoming request.

1. Open webhook.site, copy your unique URL
2. Options → **Cloud Sync** tab → toggle on
3. Endpoint: paste the webhook.site URL
4. Passphrase: any 12+ character string
5. Device name: whatever
6. Save & Sync Now
7. Refresh webhook.site — you should see a POST with `{"data": "<base64 ciphertext>", "deviceId": "..."}`

The data being encrypted (base64 garbage, not readable JSON) confirms end-to-end encryption is working.

---

## Common issues

| Symptom | Fix |
|---|---|
| Extension won't load, "manifest is not valid" error | Report as bug — this shouldn't happen with the built zip |
| Icon appears but popup is blank | Check DevTools console on the popup (right-click popup → Inspect) |
| Service worker keeps stopping | Normal MV3 behaviour — it wakes up on demand |
| A specific site's banner stays visible | Not all CMPs are covered yet; report the site name |
| GPC header not appearing in Network tab | Check `chrome://extensions` → the extension is enabled |

---

## Firefox

Same idea:
1. `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on**
3. Pick any file inside the unzipped Firefox folder (`manifest.json` works)

Note: temporary add-ons in Firefox disappear when you restart the browser. For permanent install we'd need to sign it and put it on Mozilla's AMO store (free but needs a submission).

---

## When to file a bug

Open an issue at https://github.com/JuicyLies/crumb-control/issues if:

- Extension fails to load at all
- Dashboard tab is broken / doesn't render
- A well-known site (BBC, Guardian, NYT) isn't being handled
- Service worker throws unhandled errors in the console
- Policy changes don't take effect after Save

**Include:** browser version, site URL, screenshot of the error, and copy the service worker console log.
