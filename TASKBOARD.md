# Mirepoix Kanban-in-a-file

Update this file with Wish List items, To-Do items and In Progress items. Done items disappear from here (check history if you need that).

Commit changes to this file together with the changes being implemented.

Items have IDs (e.g. `R1.5`) so that commits, tests and decisions can refer to them. `Dn` points to an entry in [DECISIONS.md](DECISIONS.md). An item is done only when its behavior is covered by tests (see README › Working agreements).

## Wish List

### Planned releases, in order

**R4 · Smart paste.**

- **R4.1 Whole-recipe paste.** One box. Sections are found by their headings in English or Portuguese (Ingredients/Ingredientes, Preparation/Method/Modo de preparo, Variations/Variações, Notes/Notas/Dicas).
- **R4.2 Steps and stray ingredients.** Split steps on numbered lines and paragraphs, and spot ingredient-looking lines that have no heading.
- **R4.3 Paste into an existing recipe.** The pasted text is appended to the section you choose.

**R5 · Your measures.**

- **R5.1 More ways to write equivalents.** `2 cups / 437 g`, `2 cups or 437 g`, `2 xícaras ou 437 g`.
- **R5.2 My units.** Accept a new unit once ("copo americano") and it's recognized from then on.

### Someday, maybe

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

(nothing right now)

Every item ends with something you can do in the running app (`npm run dev`), not just new code.

## In Progress

**W1 · Website (D20).** A page that says what Mirepoix is and does, a highlight at a time, for anyone who keeps recipes. On `feature/features-highlight`, waiting for review.

- **W1.1 The pages.** `about/` in English and `about/index.pt.html` in Portuguese: capture, find and read, cook, every device, your copy, the releases, questions. Open http://localhost:5173/about/ with `npm run dev`.
- **W1.2 Try a line.** Type an ingredient line on the website and see the app's own reading of it.
- **W1.3 Real screens.** `npm run screenshots` takes them from the app, with sample recipes, in both languages and themes.
- **W1.4 The app leaves the website alone.** With the app installed, `about/` still opens the website, and isn't kept offline.
- **W1.5 From the app.** "New to Mirepoix? See what it can do" on the empty recipe list, and "About" in the footer. Open http://localhost:5173/ with an empty recipe box.
