# Mirepoix Kanban-in-a-file

Update this file with Wish List items, To-Do items and In Progress items. Done items disappear from here (check history if you need that).

Commit changes to this file together with the changes being implemented.

Items have IDs (e.g. `R1.5`) so that commits, tests and decisions can refer to them. `Dn` points to an entry in [DECISIONS.md](DECISIONS.md). An item is done only when its behavior is covered by tests (see README › Working agreements).

## Wish List

### Planned releases, in order

**R2 · Every device.** The same recipes everywhere, end-to-end encrypted. (D5, D6, D7)

- **R2.1 Crypto envelope.** PBKDF2 → AES-256-GCM, plus a `vault.json` holding the salt, iterations and a key check. A wrong passphrase and a tampered file are both detected and reported differently.
- **R2.2 GitHub remote.** Branch-head check, tree listing, and get/put/delete of a file guarded by its last-seen version. Comes with a fake remote for tests.
- **R2.3 Sync engine.** First download, incremental pull, a push queue that survives going offline and reloading, deletions, and conflict copies (D6).
- **R2.4 Connect this device.** Start fresh (create the vault), join an existing vault, and disconnect. The key is remembered on the device; the passphrase never is.
- **R2.5 Sync status and errors.** A status chip, plus clear states for offline, an expired or revoked token, and a wrong passphrase.
- **R2.6 Bring R1 recipes along.** On first connect, recipes created on the device before R2 are uploaded.

**R3 · Cook mode.** (D10)

- **R3.1 Cook view.** Large type, no editing controls, and the screen kept awake.
- **R3.2 Ticks.** Tap to tick ingredients and steps, with the current step highlighted. Ticks are temporary and never saved.
- **R3.3 Note for next time.** Dated, append-only cook's notes. The newest shows as "Last time" on the recipe. They merge across devices without conflicts.

**R4 · Smart paste.**

- **R4.1 Whole-recipe paste.** One box. Sections are found by their headings in English or Portuguese (Ingredients/Ingredientes, Preparation/Method/Modo de preparo, Variations/Variações, Notes/Notas/Dicas).
- **R4.2 Steps and stray ingredients.** Split steps on numbered lines and paragraphs, and spot ingredient-looking lines that have no heading.
- **R4.3 Paste into an existing recipe.** The pasted text is appended to the section you choose.

**R5 · Measures your way.**

- **R5.1 Volume or weight first.** A per-device preference for which measure leads.
- **R5.2 More ways to write equivalents.** `2 cups / 437 g`, `2 cups or 437 g`, `2 xícaras ou 437 g`.
- **R5.3 My units.** Accept a new unit once ("copo americano") and it's recognized from then on.

### Someday, maybe

- Tags, and filtering by tag
- Scale a recipe (×½, ×2, custom servings)
- Print-friendly view
- Export as Markdown (a human-readable backup)
- Change the passphrase (re-encrypts everything)
- Link a new device with a QR code
- Recipe history and restore, using the data repo's commits
- Portuguese UI
- Links between recipes ("see Pâte brisée")
- Photos of the dish or the book page, encrypted
- Timers from step text ("bake 10–12 minutes")

## To-Do

**R1 · Recipe box (this device).** Capture, read and find recipes on one device. It's useful from day one and becomes the base for everything else. (D1–D4, D8–D13)

- **R1.1 Tooling.** Install Node.js LTS. Add `package.json` scripts (`dev`, `check`, `test`, `test:e2e`), a `tsconfig.json` (`checkJs`, `strict`, `noEmit`), a tiny dev server on `node:http`, and Playwright set up for Chromium and WebKit. *Done when* a smoke unit test and a smoke browser test pass locally.
- **R1.2 CI.** A GitHub Actions workflow runs check, unit and e2e tests on every push and pull request.
- **R1.3 App shell.** `index.html`, base CSS (tokens, light and dark, from the mockups), a hash router, the empty recipe list, a web app manifest and icon, and a service worker. *Done when* e2e shows the app installs and reopens offline.
- **R1.4 Recipe model and local store.** Schema v1 as JSDoc types with validation (D8). An IndexedDB store, plus an in-memory twin with the same contract tests. Ask the browser for persistent storage.
- **R1.5 Ingredient parser v1 (English + Portuguese).** It reads quantities (integers, `.` and `,` decimals, fractions, unicode fractions, mixed numbers, ranges), a unit vocabulary with abbreviations and plurals, `count`, the Portuguese "de", a note after a comma, "to taste" / "a gosto", equivalents in parentheses `(437 g)`, and the `qty | unit | name` override. Doubtful lines are flagged. Tests are fixture-driven, plus a render ↔ parse round trip (D9).
- **R1.6 Editor.** Title, source, yield and language. Four section text boxes. A live ingredient preview with flags. Save and Cancel, with a prompt before leaving with unsaved changes (D10).
- **R1.7 Recipe view.** Read-only. Ingredients show as amount and name, with "or …" equivalents, and the sections appear in order. Edit is the only way to change anything (D10).
- **R1.8 List and search.** Alphabetical. Search covers titles and ingredient names and ignores case and accents ("pao" finds "Pão de queijo").
- **R1.9 Delete.** Asks for confirmation first.
- **R1.10 Export and import.** All recipes as one versioned JSON file; import merges by id. Until R2, a "this device only" reminder points to Export.
- **R1.11 Deploy.** Confirm the host details (HTTPS, server type, how files get there). Add security headers (CSP), write the deploy steps in the README, and tag the first release.

## In Progress

- **Review the first-pass plan.** Maintainer: look over [docs/mockups/index.html](docs/mockups/index.html) and the **Proposed** entries in [DECISIONS.md](DECISIONS.md), then accept or change them. R1.1 starts after that.
