# Mirepoix Kanban-in-a-file

Update this file with Wish List items, To-Do items and In Progress items. Done items disappear from here (check history if you need that).

Commit changes to this file together with the changes being implemented.

Items have IDs (e.g. `R1.5`) so that commits, tests and decisions can refer to them. `Dn` points to an entry in [DECISIONS.md](DECISIONS.md). An item is done only when its behavior is covered by tests (see README › Working agreements).

## Wish List

### Planned releases, in order

**R3 · Cook mode.** (D10)

- **R3.1 Cook view.** Large type, no editing controls, and the screen kept awake.
- **R3.2 Ticks.** Tap to tick ingredients and steps, with the current step highlighted. Ticks are temporary and never saved.
- **R3.3 Note for next time.** Dated, append-only cook's notes. The newest shows as "Last time" on the recipe. They merge across devices without conflicts.

**R4 · Smart paste.**

- **R4.1 Whole-recipe paste.** One box. Sections are found by their headings in English or Portuguese (Ingredients/Ingredientes, Preparation/Method/Modo de preparo, Variations/Variações, Notes/Notas/Dicas).
- **R4.2 Steps and stray ingredients.** Split steps on numbered lines and paragraphs, and spot ingredient-looking lines that have no heading.
- **R4.3 Paste into an existing recipe.** The pasted text is appended to the section you choose.

**R5 · Your measures.**

- **R5.1 More ways to write equivalents.** `2 cups / 437 g`, `2 cups or 437 g`, `2 xícaras ou 437 g`.
- **R5.2 My units.** Accept a new unit once ("copo americano") and it's recognized from then on.

### Someday, maybe

- Tags, and filtering by tag
- Scale a recipe (×½, ×2, custom servings)
- Print-friendly view
- Export as Markdown (a human-readable backup)
- Change the passphrase (re-encrypts everything)
- Link a new device with a QR code
- Recipe history and restore, using the data repo's commits
- Links between recipes ("see Pâte brisée")
- Photos of the dish or the book page, encrypted
- Timers from step text ("bake 10–12 minutes")

## To-Do

**R2 · Every device.** The same recipes everywhere, end-to-end encrypted. (D5, D6, D7)

- **R2.1 Crypto envelope.** PBKDF2 → AES-256-GCM, plus a `vault.json` holding the salt, iterations and a key check. A wrong passphrase and a tampered file are both detected and reported differently.
- **R2.2 GitHub remote.** Branch-head check, tree listing, and get/put/delete of a file guarded by its last-seen version. Comes with a fake remote for tests.
- **R2.3 Sync engine.** First download, incremental pull, a push queue that survives going offline and reloading, deletions, and conflict copies (D6).
- **R2.4 Connect this device.** Start fresh (create the vault), join an existing vault, and disconnect. None of these ever discard recipes already on the device. The key is remembered on the device; the passphrase never is.
- **R2.5 Sync status and errors.** A status chip, plus clear states for offline, an expired or revoked token, and a wrong passphrase.
- **R2.6 Merge everyone's R1 recipes.** During R1, two or three people capture recipes on their own devices. When a device connects, the shared base becomes the union: the device uploads its recipes and downloads everyone else's. Ids are random (D8), so nothing collides or overwrites. If two people typed the same dish, both recipes are kept side by side for someone to merge or delete. *Done when* an e2e test with three devices (A starts fresh, B and C join, each with its own R1 recipes) ends with all three holding the same union.

Every item ends with something you can do in the running app (`npm run dev`), not just new code.

## In Progress

(nothing right now)
