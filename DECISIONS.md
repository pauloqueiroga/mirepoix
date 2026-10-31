# Mirepoix Decision Log

The decisions that shape the app: what we chose, why, and what it costs us. They're derived from [USER-MIND.md](USER-MIND.md).

- **Accepted**: agreed with the user.
- **Proposed**: recommended, waiting for the user to accept or change it.

To change a decision, add a new entry and mark the old one **Superseded by Dn**. That way the reasoning stays traceable.

---

## D1. An installable web app, not native binaries

**Accepted** · 2026-10-19

- **Context:** The app must work on macOS, Windows and iOS without costing money or being clunky to use. Distributing a native iOS app needs a paid Apple Developer membership, or re-signing the app every 7 days.
- **Decision:** One Progressive Web App (PWA): a single-page app served over HTTPS. It can be installed to the home screen or dock, and a service worker lets it work offline.
- **Consequences:** One codebase, free distribution, and updates by redeploying. We're limited to what Safari allows web apps to do (storage quotas, no background sync while closed). That's enough for a recipe box.

## D2. Zero runtime dependencies: no framework, no bundler

**Accepted** · 2026-10-19

- **Decision:** Plain modern JavaScript in ES modules, served exactly as written. HTML and CSS are written by hand. Types are written in JSDoc comments and checked by TypeScript. TypeScript is a development tool and never ships.
- **Why:** This answers "No bloating" and "no hundreds of packages" directly. Deploying means copying files. The shipped app contains only our own code, so there's no third-party code to patch.
- **Consequences:** Views are written by hand with small DOM helpers. If UI state ever gets unwieldy, the escape hatch is to add one tiny library as a single file (e.g. Preact + htm, ~5 KB). That would need a new decision entry.

## D3. Tooling: Node.js LTS and a very short dev-dependency list

**Accepted** · 2026-10-19

- **Unit and integration tests:** Node's built-in test runner (`node --test`). No test framework.
- **End-to-end tests:** Playwright drives real **Chromium** and **WebKit**. WebKit is Safari's engine, so it stands in for iPhone and iPad.
- **Type checking:** TypeScript with `checkJs` and `strict`, run with `--noEmit`.
- **Dev server:** a small script on `node:http`. No package.
- **Budget:** at most 3 direct dev dependencies (expected: `typescript`, `@playwright/test`). Adding one needs a decision entry.

## D4. Local-first: every device keeps a full copy

**Accepted** · 2026-10-19

- **Decision:** The UI reads from and writes to a local store (IndexedDB) only. A sync engine exchanges changes with the remote store in the background.
- **Why:** Returning users get an instant start: the app shell comes from the service-worker cache, recipes come from IndexedDB, and nothing waits on the network. Cooking works offline. The remote store can stay a simple file store.
- **Consequences:** We own syncing and conflicts, kept deliberately simple (D6). Browsers can evict storage, so we ask for persistent storage. The remote copy and Export are the safety net.

## D5. Remote storage: a private GitHub repository

**Accepted** · 2026-10-19

- **Decision:** Recipes sync to a dedicated private repo (e.g. `pauloqueiroga/mirepoix-data`) that is separate from this code repo. The app talks to it through GitHub's REST API, which can be called from a browser. Each device authenticates with a fine-grained personal access token that is limited to that one repository, with Contents read and write.
- **Layout:** one encrypted file per recipe under `recipes/`, named by a random id. A `vault.json` file holds the format version, the key-derivation salt and a key-check value. None of these are secret.
- **Cost of a sync:** a returning device asks for the branch head, which is one small request. Only if the head moved does it list the tree and download the files that changed.
- **Consequences:** There's no server to run or patch, it's free, and the data stays portable (it's a Git repo). Every save is a commit, so full history comes for free. Each device holds its own token, protected as described in D7. GitHub's API limit (5,000 requests per hour per token) is far above what we need.

## D6. Conflicts never lose data

**Accepted** · 2026-10-19

- Because each recipe is its own file, a conflict needs the same recipe to be edited on two devices between syncs. That's rare.
- Recipes captured separately on several people's devices before they connect (R1) never conflict. Ids are random, so connecting merges them as a union (2026-10-20).
- Writes only succeed if the remote file is still the version we last saw; GitHub rejects stale writes. On a conflict, the remote version stays, and the local version is saved as a separate recipe, "Title (conflict, device, date)", to merge by hand.
- Cook's notes are append-only, so they merge automatically (R3).
- Deleting a recipe deletes its file. The data repo's history keeps it recoverable.

## D7. End-to-end encryption with a passphrase

**Accepted** · 2026-10-19

- **At rest, remotely:** each recipe file is encrypted on the device before upload with **AES-256-GCM**, using a fresh random IV for every write. The key is derived from the user's passphrase with **PBKDF2-SHA-256**: 600,000 iterations and a random salt, both stored in `vault.json` so they can be raised later. Everything uses the browser's built-in Web Crypto API, with no crypto libraries.
- **Wrong passphrase:** the key-check value in `vault.json` tells a wrong passphrase apart from corrupt data, before anything downloads.
- **Per device:** the derived key is stored as a *non-extractable* `CryptoKey` in IndexedDB. The passphrase is typed once per device and never stored.
- **In transit:** HTTPS everywhere, both for the app host and for the GitHub API.
- **On the device:** the local copy is readable inside the browser's storage and relies on the operating system's disk encryption (FileVault, BitLocker or Device Encryption, iOS Data Protection). Encrypting it with a key stored right next to it would add ceremony, not protection.
- **Hardening:** a strict Content-Security-Policy that allows only our own scripts and no inline scripts, and lets the network reach only `api.github.com`. No third-party code at runtime. **Superseded in part by D14:** the CSP also allows Google Analytics' domains, used only after a visitor opts in.
- **Consequences:** If the passphrase is lost, the synced data can't be read. Export (plain JSON) and a clear warning at setup mitigate this. Random file names keep even the titles private. Changing the passphrase means re-encrypting everything; that's in the Wish List.

## D8. Recipe data model, schema v1

**Accepted** · 2026-10-19

```json
{
  "schema": 1,
  "id": "0c9f8e4a-…",
  "lang": "en",
  "title": "Brown butter cookies",
  "source": "The Flour Diaries, p. 88",
  "yield": "24 cookies",
  "ingredients": [
    { "heading": "", "items": [
      { "quantity": "1 1/2", "unit": "cup", "name": "light brown sugar", "note": "packed",
        "alternatives": [{ "quantity": "300", "unit": "g" }] },
      { "quantity": "2", "unit": "count", "name": "large eggs", "note": "", "alternatives": [] },
      { "quantity": "", "unit": "", "name": "flaky salt", "note": "to taste", "alternatives": [] }
    ]}
  ],
  "preparation": [{ "heading": "", "steps": ["Brown the butter until it smells nutty."] }],
  "variations": ["Swap 1/2 cup of the flour for rye."],
  "notes": ["Dough keeps 3 days in the fridge."],
  "cooksNotes": [{ "id": "…", "at": "2026-10-12T19:40:00Z", "text": "Rested the dough overnight." }],
  "createdAt": "2026-10-01T10:00:00Z",
  "updatedAt": "2026-10-12T19:40:00Z"
}
```

- **Quantity** is text in a canonical form (`"2"`, `"1 1/2"`, `"0.5"`, `"2-3"`) and never a float, so ⅓ stays ⅓. The domain layer turns it into exact fractions when it needs to do math.
- **Unit** is a canonical key for known units (`cup`, `tbsp`, `tsp`, `g`, `kg`, `ml`, `l`, `oz`, `fl oz`, `lb`, `pinch`, `count`, …). It's displayed in the recipe's language, so `cup` shows as "xícara" in a Portuguese recipe. Anything else is kept as written, e.g. "tablete". Countable items use `count`, which is displayed as nothing. Lines like "to taste" have no quantity and no unit.
- **Alternatives** are *equivalent* amounts of the same ingredient, shown as "or 300 g". They're never extra. All of an ingredient's measures are always shown together; there's no volume/weight switch (2026-10-20).
- **Sections:** the four sections the user asked for (Ingredients, Preparation, Variations, Notes), plus `cooksNotes`, the dated notes added while cooking. Ingredients and steps can be grouped under headings ("For the sauce").
- **Text-first:** every ingredient renders to one line and parses back to the same structure. Tests enforce this round trip.
- **Evolution:** fields can be added without bumping `schema`. Any other change ships with a migration and tests.
- **Extended by D18 and D19:**.

## D9. Text-first capture with live parsing, in English and Portuguese

**Accepted** · 2026-10-19 (languages **Accepted**: English, Portuguese)

- Each section is a plain text box, so you paste chunks or type, in whatever order they come. Ingredient lines are parsed as you go and shown next to the text as quantity / unit / name / note / equivalents.
- Doubtful lines are **flagged, not silently guessed**. There's an explicit escape hatch: `2 | punhado | salsinha` sets quantity | unit | name directly.
- The parser understands decimals with `.` or `,`, fractions (`1/2`, `½`, `1 1/2`), ranges (`2-3`, `2 a 3`, `2 to 3`), units with abbreviations and plurals (`cups`, `tbsp`, `xícara`, `xíc.`, `colher (sopa)`, `c. de chá`, …), the Portuguese connector "de" ("2 xícaras de farinha"), notes after a comma, "to taste" / "a gosto", and equivalents in parentheses ("2 cups (437 g)").
- Quantities written as words are read too (R1.16, 2026-10-21): "two", "dois", "vinte e cinco", "twenty-five", "three quarters", "um terço", "half an onion", "dois ou três". They're saved as numbers. Look-alikes stay text: "five-spice powder", "um pouco de sal".
- Each recipe has a language (`en` or `pt`), which picks the vocabulary for parsing and display. The UI itself is in English. **Superseded in part by D15:** the screens are in English or Portuguese.
- Parser cases live in fixture files. They grow with every real-world line that surprised us.

## D10. Reading never edits; editing is deliberate

**Accepted** · 2026-10-19

- The recipe screen is read-only: no inline editing and no autosave. Recipes change only on the Edit screen, with explicit Save and Cancel. Leaving with unsaved changes asks first.
- Cook mode (R3) has no editing controls at all. The only thing it writes is a dated cook's note appended to the recipe. Ticking off ingredients and steps is temporary and never saved.
- Cook mode keeps the screen awake (Screen Wake Lock API) where the device supports it.

## D11. Hosting: static files on the existing web host

**Accepted** · 2026-10-19

- The app is only static files. They're served over HTTPS from the user's web host; HTTPS is required for service workers and Web Crypto. Deploying means copying the `app/` folder. The service worker picks up the new version on the next launch.
- A public app URL is fine. Without the token and passphrase, it's an empty recipe box.
- Security headers (CSP, caching) go in the host's configuration (e.g. `.htaccess` on Apache). The details get confirmed when R1 is deployed.
- Confirmed 2026-10-20: Apache shared hosting at https://pauloq.com/mirepoix/, uploaded over FTP/SFTP, with its own domain later. `app/.htaccess` carries the headers; a unit test keeps them equal to the dev server's. It doesn't set HSTS, which would bind the whole domain. Moving to a new address means exporting and importing, because browser storage belongs to each address.

## D12. Testing: every released behavior stays protected

**Accepted** · 2026-10-19

- **Shape:** most logic lives in pure `domain/` modules with fast unit tests: parser, quantities, rendering, model validation, crypto round trips, and sync rules against an in-memory fake remote. On top of that sits a thin layer of Playwright journeys, one set per release, on Chromium and WebKit. They run against the real app with a fake remote. Tests never touch real GitHub.
- **Rules:** a behavior isn't done until a test covers it. Every bug fix starts as a failing test. The full suite passes before changes are handed over, and CI (GitHub Actions) runs it on every push.

## D13. Look and feel

**Accepted** · 2026-10-19

- Mobile-first and responsive. Light and dark follow the system.
- System fonts only, with nothing to download: a bookish serif for recipe text (Iowan Old Style on Apple, Palatino on Windows) and the platform UI font for controls.
- The logo carries the name: lowercase "mirepoix" lettered in Fredoka and drawn as shapes inside the logo images (`app/icons/logo-*.svg`). `npm run logos` regenerates them; the font is used only by that tool and never ships (2026-10-20).
- The palette comes from the mirepoix itself: **onion** for paper, **carrot** for actions and headings, **celery** for "all good" (sync, ticks, cook's notes). Contrast meets WCAG AA in both themes.
- Touch targets are at least 44 px. Cook-mode type is readable at arm's length.
- See [docs/mockups/index.html](docs/mockups/index.html).

## D14. Google Analytics, opt-in, screen names only

**Accepted** · 2026-10-21

- **Context:** The maintainer wants to know how Mirepoix is used. D7 allowed no third-party code, and the app promises to be private by default.
- **Decision:** Use Google Analytics, but only after a visitor says yes. A banner asks once per device, and the answer can be changed on the privacy page. Until then, nothing loads and nothing is sent. The Measurement ID lives in `app/config.js` (set to `G-H72PWB3YHW` on 2026-10-21); an empty string switches analytics off entirely.
- **What's sent:** the name of each screen ("recipes", "recipe", "new recipe", "edit recipe", "keep a copy", "privacy", "not found"). Each hit's address is rewritten to carry only that name. **Extended by D17:** "sync" joins the list. Recipe titles, ingredients, notes and searches are never sent:
  - The search lives in browser history state, not in the address.
  - While analytics is on, tab titles are generic ("Recipe · Mirepoix").
  - Google signals and ad personalization are switched off.
- **In Google Analytics' settings:** turn off Enhanced measurement's "page changes based on browser history events" and "site search", so Google doesn't collect page views on its own.
- **Consequences:** the CSP gains `https://*.googletagmanager.com` for scripts, plus Google's analytics domains for images and connections (D7 superseded in part). The privacy page (R1.13) explains all of this. Saying no, or later stopping, deletes Google's `_ga` cookies.
- **Extended by D18 and D19:**.

## D15. Screens in English or Portuguese

**Accepted** · 2026-10-21

- **Context:** Some of the people sharing the recipe box don't read English. D9 kept the screens in English.
- **Decision:** Every word Mirepoix puts on screen comes in English and in Brazilian Portuguese. The language follows the browser (Portuguese for any `pt-*`, English for anything else) until someone picks one with the switch at the bottom of the recipe list. That choice is remembered on the device, and switching reloads the page.
- **What follows the screens, and what doesn't:** Mirepoix's own words follow the screens: labels, buttons, hints, the preview's doubts, "or 200 g", "Makes …". What you typed, and its units, follow the recipe's language (D9), so a Portuguese recipe still shows "xícaras" on English screens. A new recipe starts in the screens' language.
- **How:** All the words live in one file, `app/ui/i18n.js`, as two objects of the same shape. Type-checking and a unit test make sure Portuguese has everything English has. The domain returns codes (`no-title`, `unknown-unit`, `too-new`…) instead of sentences, and the screens put them into words. No library and no build step (D2).
- **Privacy page:** one static page per language, `privacy.html` and `privacy.pt.html`, linked to each other. The app links to the one in its language.
- **Not translated:** the screen names sent to analytics (D14) stay in English, so the numbers don't split by language. The search-engine description in `index.html` and the install manifest stay in English for now.
- **Consequences:** every new piece of text needs both languages in the same change. A third language would be one more object in `i18n.js` and one more privacy page.

## D16. Ko-fi: a plain link, not Ko-fi's widget

**Accepted** · 2026-10-23

- **Context:** The maintainer wants a way for people to support Mirepoix on Ko-fi (R2.0.1). Ko-fi offers a button widget and badge images, but both load from Ko-fi's servers, which D7 rules out.
- **Decision:** One ordinary link to https://ko-fi.com/pqstudio at the bottom of the list, Keep a copy and Sync screens, "Support Mirepoix on Ko-fi" / "Apoie o Mirepoix no Ko-fi", with a cup drawn in our own CSS. It opens in a new tab. The address lives in `app/config.js` (`KOFI_URL`); an empty string hides the link.
- **Consequences:** Nothing from Ko-fi loads until someone follows the link, so the CSP stays as it is and the privacy promise holds. A unit test keeps the setting a `https://ko-fi.com/…` address or empty.

## D17. Syncing, as built (R2)

**Accepted** · 2026-10-23

How D4–D7 came out in code (`app/store/`), and the choices made on the way.

- **Files in the data repository:** `vault.json`, and one `recipes/<id>.json` per recipe (the id URL-encoded). Any other file (a README, say) is left alone.
- **The vault:** `{ format: "mirepoix-vault", version: 1, kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt }, check }`. `check` is a known text sealed with the key, so a wrong passphrase is caught before anything downloads. Passphrases are NFC-normalized first, so accents typed on any keyboard give the same key. A new vault needs at least 8 characters.
- **Sealed files:** `{ format: "mirepoix-sealed", version: 1, iv, data }`, AES-256-GCM with a fresh 12-byte IV per write. What the file holds (`recipe:<id>`, or `vault-check`) goes in as authenticated data, so a file that was edited, or renamed to pass for another recipe, fails to open. It's reported as damaged and left alone; the rest keeps syncing. A wrong passphrase and a damaged file are told apart.
- **No queue: a base per recipe.** For each recipe the device keeps its *base*: the remote file's version (GitHub's blob SHA) and the recipe's fingerprint when the two last matched. Changed here = fingerprint moved off the base; changed there = version moved off the base. Changes waiting to go up are worked out from what's stored, so they survive going offline and reloading without a queue that could get out of step. IndexedDB went to version 2 to hold the bases and the settings; R1 recipes carry over untouched.
- **Rules per recipe:** changed on one side, that side wins. Changed on both, the remote version keeps the id and this device's version is saved beside it as "Title (conflict, device, date)" (D6); the same change on both sides is no conflict. A change beats a deletion, whichever side made which. A recipe the remote has never seen goes up as a new file, so connecting merges devices as a union (R2.6). Saving in the editor after the recipe changed underneath (synced from elsewhere) also keeps both.
- **Never lose data to a race:** every local write is checked, in the same IndexedDB transaction, against the recipe as it was when the decision was made; if someone saved meanwhile, nothing is written and the next pass sees to it. Uploads go one at a time, since GitHub refuses racing commits on a branch, and a refusal for that reason is retried rather than taken for a conflict. A listing without `vault.json` is never read as "every recipe was deleted".
- **Cheap when nothing changed:** the device remembers the commit its bases reflect and follows its own writes, so a returning device makes one request (the branch head, asked with `cache: no-cache`, so an unchanged answer can come back as a small 304) and its own saves don't cost a listing. Downloads run six at a time.
- **When it syncs:** at start, a moment after each save, when the network comes back, when the app comes into view, every five minutes while it's open, and on "Sync now". Never while the screens wait: they read only IndexedDB (D4).
- **Connecting:** "Join my recipes" or "Start fresh", with the repository (`owner/name` or its address), a token and the passphrase. A public repository is refused. Start fresh refuses a repository that already has a vault; Join refuses one without. Connecting never touches the device's recipes; the first sync does the merging. The device keeps the repository, branch, token, a non-extractable key and a device name ("iPhone", "Mac"… for conflict copies), never the passphrase. Disconnecting forgets all of that and the bases, and keeps every recipe.
- **Secure pages only:** browsers offer Web Crypto only on `https://` pages (and `localhost`). On a plain `http://` page the Sync screen says so instead of offering to connect. Recipe ids fall back from `crypto.randomUUID` to `crypto.getRandomValues`, so adding recipes still works there.
- **First contact:** a recipe that exists on both sides with no base (e.g. after disconnecting and joining again, or after an import) is compared by content: the same, it's just recorded; different, D6 applies.
- **When it's stuck:** the chip and the Sync screen name the problem. An expired, revoked or under-powered token, or a repository the token can't see, gets a field for a new token. A vault made anew with another passphrase gets a field for it. Everything else (offline, GitHub unwell) retries on its own.
- **Tests:** `test/support/fake-github.js` stands in for the part of GitHub's REST API Mirepoix uses, answering the way GitHub does (versions are git blob SHAs, 409/422 on stale writes, 401/403/404 for token trouble). Unit tests reach it through `fetch`; browser tests route `api.github.com` to it, so several browser contexts can be devices sharing one repository (D12).
- **Consequences:** the sync engine, GitHub remote and crypto are about 1,100 lines of our own code, with no dependency. Each device needs its own fine-grained token. Analytics hears one more screen name, "sync" (D14).

## D18. Cook mode, and cook's notes that merge

**Accepted** · 2026-10-31

- **Context:** from D10: cook from a recipe without being able to change it, and leave notes for next time. Recipes travel between devices by syncing (D17) and by export and import, and cook's notes have to survive both without conflicts (D6).
- **The screen:** cook mode has its own address (`#/recipes/:id/cook`) and opens from **Start cooking**, a bar at the bottom of every recipe. It shows the newest note as "Last time", the ingredients and steps to tick off, and Variations and Notes as they are, in bigger type. Everything needed while cooking is there, so there's no reason to leave halfway. There's no Edit link. **Done** goes back to the recipe.
- **Ticks** live on the screen only. Done, Back or a reload clears them, and nothing about them is ever stored. The first step not ticked is the one to do now; it's highlighted, and ticking a step brings the next one into view. Steps can be ticked out of order, and unticked.
- **The screen stays on** through the Screen Wake Lock API. The lock is asked for on the way in, again each time the page comes back into view (browsers let go when it's hidden), and released on the way out. A "Screen on" chip shows while it's held. Devices without the API get no chip and no warning.
- **Notes are written only in cook mode,** in a sheet over the recipe. They're dated with the moment they're saved, and line breaks are kept. Cancel or Escape asks before throwing away typed text, and so does leaving cook mode with a note half-written. After saving, the ticks are still there.
- **Append-only:** a note can't be changed or removed, not even in the editor, which keeps notes exactly as they are. For now.
- **A note doesn't change the recipe's `updatedAt`.** That time says whose copy of the recipe's text is newest when two copies merge. If a note moved it, a note added to an old copy would make that old text win over a newer edit.
- **Copies merge, notes always survive:** two copies of a recipe keep the notes of both, once each by id, oldest first. The rules live in `domain/cooks-notes.js`.
  - **Syncing (D17):** when a recipe changed on both devices, the text of the side that changed it stays, and the merged recipe goes back up. A note on one device and an edit on the other never make a conflict copy. Only when both changed the text, differently, does D6 keep both: the copy that keeps the id gets every note, and the conflict copy gets none, so no note shows twice. To tell which side changed the text, each base also keeps the fingerprint of the recipe without its notes. Bases kept by 0.4.0 lack it, and get it on the next pass for every recipe not changed since.
  - **Saving in the editor** after notes alone came in meanwhile keeps the edit and adds the notes. A change to the text meanwhile still means a conflict copy (D17), without notes, for the same reason.
  - **Importing** takes the text of whichever copy was edited last, by `updatedAt`.
- **Reading:** the recipe shows the newest note as "Last time" near the top. Once there's more than one, a "Cook's notes" section at the bottom lists them all, newest first, with their dates.
- **Analytics** hears "cook mode", and while it's on, the tab title is "Cook mode" (D14).
- **Consequences:** a note saved by mistake stays. If that turns out to matter, a note could be hidden later with a marker that merges just like a note does. An accidental Back loses the ticks.

## D19. Tags, and filtering the list by tag

**Accepted** · 2026-10-31

- **Context:** "Tags, and filtering by tag" was in Someday; it ships with R3.
- **Data:** an optional `tags` list on the recipe, so no schema change (D8). New recipes start with an empty list, and recipes saved before tags existed read as having none. A tag isn't blank, has no commas and no spaces around it, so it always reads back from the editor as itself.
- **Typing them:** one Tags box in the editor, commas between tags, text-first like everything else (D9). A leading "#" is dropped, spaces are squashed, and a tag given twice is kept once. The tags already in use sit under the box, and a tap adds or removes one, so one tag doesn't get typed three ways.
- **Same tag, any spelling:** tags are kept as typed and compared the way search compares words, ignoring case and accents, so "Natal" and "natal" are one tag. The list shows each tag the way most recipes write it.
- **Filtering:** the list shows every tag in use, alphabetically, under the search box: one row that scrolls sideways on a phone, wrapping on wider screens. Picking several shows the recipes that have **all** of them, and the search words narrow the list further. The search box matches tags too, and says which tag matched ("tagged sobremesa").
- **From a recipe:** its tags show under the title, and tapping one opens the list showing just the recipes with that tag.
- **Privacy:** like the search, the picked tags live in the browser's history entry, not the address, so Back returns to them and analytics never sees them (D14).
- **Words:** "Tags" in English, "Etiquetas" in Portuguese (D15).
- **Consequences:** renaming a tag means editing each recipe that has it; there's no tag manager. Older Mirepoix versions keep a recipe's tags when they edit it, because unknown fields survive (D8).
