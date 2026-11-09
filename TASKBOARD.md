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

### Someday, maybe

- Print-friendly view
- Change the passphrase (re-encrypts everything)
- Link a new device with a QR code
- Recipe history and restore, using the data repo's commits
- Links between recipes ("see Pâte brisée")
- Photos of the dish or the book page, encrypted

## To-Do

Every item ends with something you can do in the running app (`npm run dev`), not just new code.

- **W1.8 The website catches up with R5.** "Your measures" moves from Coming to what Mirepoix does, with scaling, timers and Markdown, in both pages, and screenshots of cook mode scaled and with a timer (`npm run screenshots`). The "Try a line" flag already speaks the new words (D21). Open http://localhost:5173/about/.

## In Progress

**R5 · Your measures, and more for cooking (D21–D24).** On `feature/scale-export-measures`, waiting for review. Version 0.6.0.

- **R5.1 More ways to write equivalents.** In the editor, type `2 cups / 437 g butter`, `2 xícaras ou 437 g de manteiga` or `2 1/4 cups flour or 280 g`: the preview shows "or 437 g", not a name starting with "or".
- **R5.2 Your units.** Type `1 tablete de fermento` in a Portuguese recipe: it's flagged as a new unit. Save, start another recipe and type `2 tabletes de fermento`: no flag.
- **R5.3 Scale while cooking.** In cook mode, tap ×2, or type how many it makes: every amount and Makes change, the ticks stay, and Done brings back ×1.
- **R5.4 Recipes as Markdown.** At the end of a recipe, Save as Markdown; on Keep a copy, Export all as Markdown. Paste a section of the file back into the editor and it reads the same.
- **R5.5 Timers from steps.** In cook mode, a step with "Bake 10–12 minutes" has a timer button. Tap it, adjust with − and +, Start, Pause; at zero it beeps. Done asks first while a timer is set.
