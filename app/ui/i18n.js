// Mirepoix's own words, in English and Portuguese (R1.17, D15). The language
// follows the browser until someone picks one in the footer, and that choice
// is remembered on this device. Recipes keep their own language (D9): what
// you typed, units included, never changes with the screens around it.

/** @typedef {import('../domain/recipe.js').Lang} Lang */
/** @typedef {import('../domain/ingredients.js').DoubtCode} DoubtCode */
/** @typedef {import('../domain/draft.js').Problem} Problem */
/** @typedef {import('../domain/backup.js').ExportError} ExportError */
/** @typedef {{ added: number, updated: number, unchanged: number, skipped: number }} ImportResult */

const KEY = 'mirepoix.lang';

const en = {
  // This language's name, in itself, for the switch in the footer.
  langName: 'English',
  recipes: 'Recipes',
  recipe: 'Recipe',
  edit: 'Edit',
  privacy: 'Privacy',
  privacyPage: 'privacy.html',
  recipeCount: (/** @type {number} */ n) => `${n} ${n === 1 ? 'recipe' : 'recipes'}`,

  // The app around the screens
  noStorage: 'This browser can’t keep recipes',
  noStorageText: 'Private browsing or blocked site data stops Mirepoix from saving. Try a regular window, or allow this site to store data.',
  recipeNotFound: 'Recipe not found',
  recipeNotFoundText: 'It may have been deleted, or the address is wrong.',
  pageNotFound: 'Page not found',
  pageNotFoundText: 'That address doesn’t match anything in Mirepoix.',
  leaveUnsaved: 'Leave without saving? Your changes will be lost.',
  editNamed: (/** @type {string} */ title) => `Edit ${title}`,

  // The list
  thisDeviceOnly: 'This device only',
  thisDeviceOnlyTip: 'Recipes are saved in this browser, on this device. Tap to keep a copy.',
  noRecipes: 'No recipes yet',
  noRecipesText: 'Tap + to add your first one. Recipes are kept in this browser, on this device.',
  haveExport: 'Have an export from another device? ',
  importIt: 'Import it',
  searchPlaceholder: 'Search recipes or ingredients',
  searchLabel: 'Search recipes',
  foundOf: (/** @type {number} */ found, /** @type {string} */ total) => `${found} of ${total}`,
  noMatches: 'No matches',
  noMatchesText: (/** @type {string} */ words) => `No title, ingredient or tag matches “${words}”.`,
  /** Nothing has every tag picked, and every word typed, if any. */
  noMatchesTagged: (/** @type {string} */ words) =>
    (words ? `Nothing with the tags you picked matches “${words}”.` : 'No recipe has all the tags you picked.'),
  withIngredients: (/** @type {string[]} */ names) => `with ${names.join(', ')}`,
  tagged: (/** @type {string[]} */ tags) => `tagged ${tags.join(', ')}`,
  filterByTag: 'Filter by tag',

  // A recipe
  makes: (/** @type {string} */ amount) => `Makes ${amount}`,
  ingredients: 'Ingredients',
  preparation: 'Preparation',
  variations: 'Variations',
  notes: 'Notes',
  steps: 'Steps',
  noIngredients: 'No ingredients yet.',
  or: (/** @type {string} */ amount) => `or ${amount}`,
  tags: 'Tags',
  seeTagged: (/** @type {string} */ tag) => `Every recipe tagged “${tag}”`,
  lastTime: 'Last time',
  cooksNotes: 'Cook’s notes',
  startCooking: 'Start cooking',

  // Cook mode
  cookMode: 'Cook mode',
  cookingNamed: (/** @type {string} */ title) => `Cooking ${title}`,
  done: 'Done',
  screenOn: 'Screen on',
  screenOnTip: 'The screen stays on while you cook.',
  ready: (/** @type {number} */ n, /** @type {number} */ total) => (n === total ? 'All ready' : `${n} of ${total} ready`),
  stepOf: (/** @type {number} */ n, /** @type {number} */ total) => `Step ${n} of ${total}`,
  allStepsDone: 'All steps done',
  noteForNextTime: 'Note for next time',
  noteAbout: (/** @type {Node} */ title) => ['This is added to ', title, ' with today’s date. The recipe itself stays as it is.'],
  yourNote: 'Your note',
  notePlaceholder: 'What worked, what you’d change…',
  saveNote: 'Save note',
  discardNote: 'Discard this note?',
  noteSaved: 'Note saved. It shows as “Last time” when you open this recipe.',
  couldntSaveNote: (/** @type {string} */ reason) => `Couldn’t save the note: ${reason}`,

  // The editor
  newRecipe: 'New recipe',
  editRecipe: 'Edit recipe',
  cancel: 'Cancel',
  save: 'Save',
  title: 'Title',
  language: 'Language',
  /** @type {Record<Lang, string>} */
  langNames: { en: 'English', pt: 'Português' },
  source: 'Source',
  sourcePlaceholder: 'Book and page, website, family notebook…',
  makesLabel: 'Makes',
  tagsPlaceholder: 'dessert, weeknight, Christmas',
  tagsHint: 'Separate tags with commas.',
  tagsHintKnown: 'Separate tags with commas, or tap the ones you already use.',
  yourTags: 'Your tags',
  ingredientsLabel: 'Ingredients · paste or type, one per line',
  ingredientsHint: (/** @type {Node} */ example) =>
    ['A line ending in “:” starts a group. To set the parts yourself, write ', example, ' for quantity | unit | name.'],
  preparationHint: 'One step per line, blank lines between steps, or numbered steps. A short line ending in “:” starts a group.',
  readsIngredients: 'How Mirepoix reads the ingredients',
  readsPreparation: 'How Mirepoix reads the preparation',
  readsIt: 'How Mirepoix reads it',
  toCheck: (/** @type {number} */ n) => `${n} to check`,
  ingredientsPlaceholder: 'As you type, each ingredient shows here as quantity, unit and name.',
  stepsPlaceholder: 'As you type, each step shows here, numbered, the way the recipe will show it.',
  qty: 'Qty',
  unit: 'Unit',
  ingredient: 'Ingredient',
  noName: 'no name',
  count: 'count',
  stepCount: (/** @type {number} */ steps, /** @type {number} */ groups) =>
    `${steps} ${steps === 1 ? 'step' : 'steps'}${groups > 1 ? ` in ${groups} groups` : ''}`,
  discardChanges: 'Discard your changes?',
  discardRecipe: 'Discard this recipe?',
  couldntSave: (/** @type {string} */ reason) => `Couldn’t save this recipe: ${reason}`,
  confirmDelete: (/** @type {string} */ title) => `Delete “${title}”? This can’t be undone.`,
  deleteRecipe: 'Delete recipe',
  problem: (/** @type {Problem} */ problem) =>
    problem.code === 'no-title' ? 'Give the recipe a title.' : `Line ${problem.line} has no ingredient name.`,
  /** @type {Record<DoubtCode, (detail: string) => string>} */
  doubts: {
    'unknown-unit': (unit) => `New unit “${unit}”. It’s kept as written, so check it’s right.`,
    'assumed-quantity': () => 'No amount was given, so it reads as 1.',
    'unclear-quantity': () => 'The amount is unclear. Check it, or write it as quantity | unit | name.',
    'no-name': () => 'There’s no ingredient name.',
    'unclear-override': () => 'Write exactly three parts: quantity | unit | name.',
  },

  // Keep a copy
  keepACopy: 'Keep a copy',
  keepACopyLead: 'Your recipes live in this browser, on this device. Until syncing arrives, export them now and then and keep the file somewhere safe. If this browser’s data is ever cleared, the file brings them back.',
  export: 'Export',
  exportCount: (/** @type {number} */ n) => `Saves all ${n} ${n === 1 ? 'recipe' : 'recipes'} in one file.`,
  nothingToExport: 'Nothing to export yet.',
  exportAll: 'Export all recipes',
  saved: (/** @type {string} */ file) => `Saved ${file}. Keep it somewhere safe, like your cloud drive or your email.`,
  import: 'Import',
  importText: 'Adds the recipes from an export file, made on this device or another one. Nothing here is removed, and a recipe already here is only replaced by a newer version of itself, keeping the cook’s notes from both. Moving Mirepoix to a new address? Export there, import here.',
  importFromFile: 'Import from a file',
  seeRecipes: 'See your recipes',
  /** @type {Record<ExportError, string>} */
  exportErrors: {
    'not-an-export': 'That file isn’t a Mirepoix export.',
    'too-new': 'That export comes from a newer Mirepoix. Update this one, then try again.',
    'no-recipes': 'That export has no recipes in it.',
  },
  /** "Added 3 recipes and updated 1. 2 were already here." and so on. */
  imported: (/** @type {ImportResult} */ { added, updated, unchanged, skipped }) => {
    const changes = [added > 0 && `added ${added} ${added === 1 ? 'recipe' : 'recipes'}`, updated > 0 && `updated ${updated}`].filter(Boolean).join(' and ');
    return [
      changes ? `${changes[0]?.toUpperCase()}${changes.slice(1)}.` : 'Nothing new to add.',
      unchanged > 0 && `${unchanged === 1 ? '1 was' : `${unchanged} were`} already here.`,
      skipped > 0 && `${skipped} couldn’t be read and ${skipped === 1 ? 'was' : 'were'} skipped.`,
    ].filter(Boolean).join(' ');
  },

  // Usage statistics (D14)
  statistics: 'Usage statistics',
  statisticsAsk: 'Help improve Mirepoix? Allow anonymous usage statistics from Google Analytics: which screens get used, never your recipes. ',
  noThanks: 'No thanks',
  allow: 'Allow',
  statisticsOff: 'Usage statistics are switched off on this site, so nothing is sent.',
  statisticsAllowed: 'On this device, you allow usage statistics.',
  statisticsNotAllowed: 'On this device, usage statistics are not allowed, so nothing is sent.',
  stopStatistics: 'Stop sharing usage statistics',
  allowStatistics: 'Allow usage statistics',
};

/** @type {typeof en} */
const pt = {
  langName: 'Português',
  recipes: 'Receitas',
  recipe: 'Receita',
  edit: 'Editar',
  privacy: 'Privacidade',
  privacyPage: 'privacy.pt.html',
  recipeCount: (n) => `${n} ${n === 1 ? 'receita' : 'receitas'}`,

  noStorage: 'Este navegador não consegue guardar receitas',
  noStorageText: 'A navegação privada ou o bloqueio de dados do site impedem o Mirepoix de salvar. Tente uma janela normal, ou permita que este site guarde dados.',
  recipeNotFound: 'Receita não encontrada',
  recipeNotFoundText: 'Talvez ela tenha sido apagada, ou o endereço esteja errado.',
  pageNotFound: 'Página não encontrada',
  pageNotFoundText: 'Esse endereço não leva a nada no Mirepoix.',
  leaveUnsaved: 'Sair sem salvar? Suas alterações serão perdidas.',
  editNamed: (title) => `Editar ${title}`,

  thisDeviceOnly: 'Só neste aparelho',
  thisDeviceOnlyTip: 'As receitas ficam salvas neste navegador, neste aparelho. Toque para guardar uma cópia.',
  noRecipes: 'Nenhuma receita ainda',
  noRecipesText: 'Toque em + para adicionar a primeira. As receitas ficam guardadas neste navegador, neste aparelho.',
  haveExport: 'Tem um arquivo exportado de outro aparelho? ',
  importIt: 'Importe aqui',
  searchPlaceholder: 'Buscar receitas ou ingredientes',
  searchLabel: 'Buscar receitas',
  foundOf: (found, total) => `${found} de ${total}`,
  noMatches: 'Nada encontrado',
  noMatchesText: (words) => `Nenhum título, ingrediente ou etiqueta combina com “${words}”.`,
  noMatchesTagged: (words) =>
    (words ? `Nada com as etiquetas escolhidas combina com “${words}”.` : 'Nenhuma receita tem todas as etiquetas escolhidas.'),
  withIngredients: (names) => `com ${names.join(', ')}`,
  tagged: (tags) => `${tags.length === 1 ? 'etiqueta' : 'etiquetas'} ${tags.join(', ')}`,
  filterByTag: 'Filtrar por etiqueta',

  makes: (amount) => `Rende ${amount}`,
  ingredients: 'Ingredientes',
  preparation: 'Modo de preparo',
  variations: 'Variações',
  notes: 'Notas',
  steps: 'Passos',
  noIngredients: 'Nenhum ingrediente ainda.',
  or: (amount) => `ou ${amount}`,
  tags: 'Etiquetas',
  seeTagged: (tag) => `Todas as receitas com a etiqueta “${tag}”`,
  lastTime: 'Da última vez',
  cooksNotes: 'Notas de cozinha',
  startCooking: 'Começar a cozinhar',

  cookMode: 'Modo cozinha',
  cookingNamed: (title) => `Cozinhando ${title}`,
  done: 'Fechar',
  screenOn: 'Tela ligada',
  screenOnTip: 'A tela fica ligada enquanto você cozinha.',
  ready: (n, total) => (n === total ? 'Tudo separado' : `${n} de ${total} separados`),
  stepOf: (n, total) => `Passo ${n} de ${total}`,
  allStepsDone: 'Todos os passos feitos',
  noteForNextTime: 'Nota para a próxima vez',
  noteAbout: (title) => ['Ela entra em ', title, ' com a data de hoje. A receita em si fica como está.'],
  yourNote: 'Sua nota',
  notePlaceholder: 'O que deu certo, o que você mudaria…',
  saveNote: 'Salvar nota',
  discardNote: 'Descartar esta nota?',
  noteSaved: 'Nota salva. Ela aparece como “Da última vez” quando você abrir esta receita.',
  couldntSaveNote: (reason) => `Não foi possível salvar a nota: ${reason}`,

  newRecipe: 'Nova receita',
  editRecipe: 'Editar receita',
  cancel: 'Cancelar',
  save: 'Salvar',
  title: 'Título',
  language: 'Idioma',
  langNames: { en: 'Inglês', pt: 'Português' },
  source: 'Fonte',
  sourcePlaceholder: 'Livro e página, site, caderno da família…',
  makesLabel: 'Rende',
  tagsPlaceholder: 'sobremesa, dia a dia, Natal',
  tagsHint: 'Separe as etiquetas com vírgulas.',
  tagsHintKnown: 'Separe as etiquetas com vírgulas, ou toque nas que você já usa.',
  yourTags: 'Suas etiquetas',
  ingredientsLabel: 'Ingredientes · cole ou digite, um por linha',
  ingredientsHint: (example) =>
    ['Uma linha terminada em “:” começa um grupo. Para separar as partes do seu jeito, escreva ', example, ' para quantidade | unidade | nome.'],
  preparationHint: 'Um passo por linha, linhas em branco entre os passos, ou passos numerados. Uma linha curta terminada em “:” começa um grupo.',
  readsIngredients: 'Como o Mirepoix lê os ingredientes',
  readsPreparation: 'Como o Mirepoix lê o modo de preparo',
  readsIt: 'Como o Mirepoix lê',
  toCheck: (n) => `${n} para conferir`,
  ingredientsPlaceholder: 'Enquanto você digita, cada ingrediente aparece aqui como quantidade, unidade e nome.',
  stepsPlaceholder: 'Enquanto você digita, cada passo aparece aqui, numerado, do jeito que a receita vai mostrar.',
  qty: 'Qtd.',
  unit: 'Unidade',
  ingredient: 'Ingrediente',
  noName: 'sem nome',
  count: 'unidade',
  stepCount: (steps, groups) => `${steps} ${steps === 1 ? 'passo' : 'passos'}${groups > 1 ? ` em ${groups} grupos` : ''}`,
  discardChanges: 'Descartar suas alterações?',
  discardRecipe: 'Descartar esta receita?',
  couldntSave: (reason) => `Não foi possível salvar esta receita: ${reason}`,
  confirmDelete: (title) => `Apagar “${title}”? Não dá para desfazer.`,
  deleteRecipe: 'Apagar receita',
  problem: (problem) =>
    problem.code === 'no-title' ? 'Dê um título à receita.' : `A linha ${problem.line} não tem nome de ingrediente.`,
  doubts: {
    'unknown-unit': (unit) => `Unidade nova, “${unit}”. Ela fica como foi escrita, então confira se está certa.`,
    'assumed-quantity': () => 'Nenhuma quantidade foi escrita, então vale 1.',
    'unclear-quantity': () => 'A quantidade não está clara. Confira, ou escreva como quantidade | unidade | nome.',
    'no-name': () => 'Falta o nome do ingrediente.',
    'unclear-override': () => 'Escreva exatamente três partes: quantidade | unidade | nome.',
  },

  keepACopy: 'Guardar uma cópia',
  keepACopyLead: 'Suas receitas ficam neste navegador, neste aparelho. Até a sincronização chegar, exporte de vez em quando e guarde o arquivo num lugar seguro. Se os dados deste navegador forem apagados, o arquivo traz as receitas de volta.',
  export: 'Exportar',
  exportCount: (n) => (n === 1 ? 'Salva a receita num arquivo.' : `Salva todas as ${n} receitas num arquivo.`),
  nothingToExport: 'Nada para exportar ainda.',
  exportAll: 'Exportar todas as receitas',
  saved: (file) => `${file} foi salvo. Guarde num lugar seguro, como na nuvem ou no seu e-mail.`,
  import: 'Importar',
  importText: 'Adiciona as receitas de um arquivo exportado, feito neste aparelho ou em outro. Nada daqui é apagado, e uma receita que já está aqui só é trocada por uma versão mais nova dela mesma, com as notas de cozinha das duas. Mudando o Mirepoix de endereço? Exporte lá, importe aqui.',
  importFromFile: 'Importar de um arquivo',
  seeRecipes: 'Ver suas receitas',
  exportErrors: {
    'not-an-export': 'Esse arquivo não é uma exportação do Mirepoix.',
    'too-new': 'Essa exportação vem de um Mirepoix mais novo. Atualize este e tente de novo.',
    'no-recipes': 'Essa exportação não tem nenhuma receita.',
  },
  imported: ({ added, updated, unchanged, skipped }) => {
    const plural = (/** @type {number} */ n, /** @type {string} */ one, /** @type {string} */ many) => `${n} ${n === 1 ? one : many}`;
    const changes = [
      added > 0 && plural(added, 'receita adicionada', 'receitas adicionadas'),
      updated > 0 && (added > 0 ? plural(updated, 'atualizada', 'atualizadas') : plural(updated, 'receita atualizada', 'receitas atualizadas')),
    ].filter(Boolean).join(' e ');
    return [
      changes ? `${changes}.` : 'Nada de novo para adicionar.',
      unchanged > 0 && `${plural(unchanged, 'já estava', 'já estavam')} aqui.`,
      skipped > 0 && `${plural(skipped, 'não pôde ser lida e foi ignorada', 'não puderam ser lidas e foram ignoradas')}.`,
    ].filter(Boolean).join(' ');
  },

  statistics: 'Estatísticas de uso',
  statisticsAsk: 'Quer ajudar a melhorar o Mirepoix? Permita estatísticas de uso anônimas do Google Analytics: quais telas são usadas, nunca as suas receitas. ',
  noThanks: 'Não permitir',
  allow: 'Permitir',
  statisticsOff: 'As estatísticas de uso estão desligadas neste site, então nada é enviado.',
  statisticsAllowed: 'Neste aparelho, você permite estatísticas de uso.',
  statisticsNotAllowed: 'Neste aparelho, as estatísticas de uso não são permitidas, então nada é enviado.',
  stopStatistics: 'Parar de enviar estatísticas de uso',
  allowStatistics: 'Permitir estatísticas de uso',
};

/** Every language's words, for pages written in one language (privacy.pt.html). */
export const messages = { en, pt };

/**
 * The language for Mirepoix's screens: the one picked on this device, if
 * any, or else Portuguese for browsers set to Portuguese and English for the rest.
 * @param {string | null} picked
 * @param {string} browser e.g. navigator.language, "pt-BR"
 * @returns {Lang}
 */
export function chooseLang(picked, browser) {
  if (picked === 'en' || picked === 'pt') return picked;
  return browser.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

/** The language of the screens, settled once as the page loads. */
export const uiLang = chooseLang(pickedLang(), navigator.language);

/** The words of the screens, in uiLang. */
export const t = messages[uiLang];

/**
 * How dates are written: the browser's own way when it speaks the screens'
 * language (so en-GB reads "12 Oct 2026"), or else the screens' language,
 * Brazilian for Portuguese.
 * @param {Lang} lang the screens' language
 * @param {string} browser e.g. navigator.language, "en-GB"
 */
export function dateLocale(lang, browser) {
  return browser.toLowerCase().split('-')[0] === lang ? browser : { en: 'en', pt: 'pt-BR' }[lang];
}

const locale = dateLocale(uiLang, navigator.language);
const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
const moment = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

/** "Oct 12, 2026", for a cook's note. @param {Date} date */
export const formatDay = (date) => day.format(date);

/** "Oct 12, 2026, 7:40 PM", for a note about to be written. @param {Date} date */
export const formatMoment = (date) => moment.format(date);

/**
 * Remembers a language on this device and reloads, so every screen shows it.
 * @param {Lang} lang
 */
export function pickLang(lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Without storage the browser's language comes back next time.
  }
  location.reload();
}

function pickedLang() {
  // Node has a navigator but no storage of its own, and warns when asked.
  if (typeof document === 'undefined') return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
