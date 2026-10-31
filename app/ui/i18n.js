// Mirepoix's own words, in English and Portuguese (R1.17, D15). The language
// follows the browser until someone picks one in the footer, and that choice
// is remembered on this device. Recipes keep their own language (D9): what
// you typed, units included, never changes with the screens around it.

/** @typedef {import('../domain/recipe.js').Lang} Lang */
/** @typedef {import('../domain/ingredients.js').DoubtCode} DoubtCode */
/** @typedef {import('../domain/draft.js').Problem} Problem */
/** @typedef {import('../domain/backup.js').ExportError} ExportError */
/** @typedef {import('../store/sync.js').SyncProblem} SyncProblem */
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
  supportOnKofi: 'Support Mirepoix on Ko-fi',
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
  thisDeviceOnlyTip: 'Recipes are saved in this browser, on this device. Tap to sync them with your other devices.',
  noRecipes: 'No recipes yet',
  noRecipesText: 'Tap + to add your first one. Recipes are kept in this browser, on this device.',
  noRecipesSyncedText: 'Tap + to add your first one. It syncs to your other devices.',
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
  keepACopyLead: 'An export is one file with every recipe in it, readable without Mirepoix, GitHub or your passphrase. Make one now and then and keep it somewhere safe. If this browser’s data is ever cleared, the file brings the recipes back.',
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

  // Sync (R2): the chip on the list, connecting a device, and its status
  sync: 'Sync',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline',
  syncTip: 'Sync with your other devices. Tap for details.',
  /** The chip's word for each problem that stops syncing; anything else is "Sync problem". */
  chipProblems: /** @type {Partial<Record<SyncProblem, string>>} */ ({
    unauthorized: 'Token expired',
    forbidden: 'Token can’t write',
    'not-found': 'Repository not found',
    'wrong-passphrase': 'Passphrase needed',
  }),
  syncProblem: 'Sync problem',
  connectThisDevice: 'Connect this device',
  connectLead: 'Recipes are encrypted here, on this device, before they travel. GitHub only ever stores scrambled files.',
  joinMine: 'Join my recipes',
  startFresh: 'Start fresh',
  modeHint: 'Use Start fresh once, on the first device. Every other device joins with the same repository and passphrase, and a token of its own.',
  repository: 'Private repository',
  repositoryPlaceholder: 'you/mirepoix-data',
  token: 'GitHub token',
  tokenHint: 'Fine-grained, for this repository only, with Contents: Read and write.',
  howTo: 'How do I get these?',
  // GitHub's own menus are in English, so their names stay in English in both languages.
  howToSteps: [
    'Create the repository: on github.com, open the + menu at the top right and choose “New repository”. Name it something like mirepoix-data, pick “Private”, and create it. It can start empty.',
    'Make a token: click your profile picture at the top right, then “Settings”. At the bottom of the menu on the left, open “Developer settings” → “Personal access tokens” → “Fine-grained tokens”, and choose “Generate new token”.',
    'Name it after the device (“Mirepoix on my iPhone”) and pick an expiration. When a token runs out, Mirepoix asks for a new one, and the recipes stay put.',
    'Under “Repository access”, choose “Only select repositories”, and pick the recipes repository.',
    'Under “Permissions”, find “Contents” among the repository permissions and give it “Read and write”. Leave the rest as it is.',
    'Generate the token and copy it straight away: GitHub shows it only once. Paste it in the token box above.',
    'Make one token per device, so a lost phone can be cut off on its own.',
  ],
  howToCaveat: 'GitHub moves its menus around now and then, so these names may have changed since this was written. If something doesn’t match, look for “Developer settings” and “Fine-grained tokens”, or search GitHub’s help for “fine-grained personal access token”.',
  createRepository: 'Create a repository on GitHub',
  createToken: 'Make a token on GitHub',
  passphrase: 'Passphrase',
  passphraseAgain: 'Passphrase again',
  passphraseWarn: 'It can’t be recovered. Keep a copy somewhere safe.',
  passphraseJoinHint: 'The one chosen when these recipes first synced.',
  connect: 'Connect',
  connecting: 'Connecting…',
  fillIn: 'Fill in the repository, the token and the passphrase.',
  passphrasesDiffer: 'The two passphrases don’t match.',
  stepRepository: 'Repository found',
  stepPassphraseJoin: 'Passphrase opens your recipes',
  stepPassphraseFresh: 'Vault created, locked with your passphrase',
  stepSyncing: (/** @type {number} */ done, /** @type {number} */ total) => `Syncing: ${done} of ${total}…`,
  stepDone: 'All synced',
  /** @type {Record<SyncProblem, string>} */
  problems: {
    offline: 'GitHub can’t be reached. Check the connection.',
    unauthorized: 'GitHub doesn’t accept this token. It may be mistyped, expired or revoked.',
    forbidden: 'This token can’t write to the repository. It needs Contents: Read and write.',
    'not-found': 'There’s no such repository, or this token can’t see it. A fine-grained token only sees the repositories picked for it.',
    conflict: 'Someone changed the repository at the same moment. Try again.',
    'rate-limited': 'GitHub asks to slow down. Try again in a few minutes.',
    unavailable: 'GitHub isn’t answering properly right now. Try again later.',
    'not-a-vault': 'The repository’s vault.json is missing or damaged, so its recipes can’t be opened. Nothing was deleted here.',
    'too-new': 'The recipes there come from a newer Mirepoix. Update this one, then try again.',
    'wrong-passphrase': 'That passphrase doesn’t open these recipes.',
    tampered: 'A file in the repository was changed outside Mirepoix and can’t be trusted.',
    'bad-repository': 'Write the repository as owner/name, like you/mirepoix-data, or paste its address.',
    'public-repository': 'That repository is public. Recipes only sync to a private one.',
    'has-vault': 'That repository already has recipes. Use Join my recipes instead.',
    'no-vault': 'There are no recipes there yet. Use Start fresh on your first device.',
    'short-passphrase': 'Use a passphrase of at least 8 characters. A few words work well.',
    insecure: 'Syncing needs a secure page. Browsers only encrypt on https:// addresses (or on localhost, on the same computer), so open Mirepoix at its https:// address to connect this device.',
  },
  openedAt: (/** @type {Node} */ address) => ['This page was opened at ', address, '. Recipes can still be added and read here; they just stay on this device.'],
  syncedWith: (/** @type {Node} */ repository) => ['Recipes sync with ', repository, ' on GitHub, end-to-end encrypted.'],
  lastSynced: (/** @type {string} */ when) => `Last synced ${when}.`,
  notSyncedYet: 'Not synced yet.',
  pendingChanges: (/** @type {number} */ n) => `${n} ${n === 1 ? 'change is' : 'changes are'} waiting to go up.`,
  unreadable: (/** @type {number} */ n) =>
    `${n === 1 ? '1 recipe' : `${n} recipes`} on GitHub couldn’t be opened here: damaged, or from a newer Mirepoix. ${n === 1 ? 'It’s' : 'They’re'} left as ${n === 1 ? 'it is' : 'they are'}.`,
  offlineNote: 'You’re offline. Changes wait on this device and go up when you’re back.',
  tokenProblem: 'Paste a new token to keep syncing. Recipes and the passphrase stay as they are.',
  passphraseChanged: 'The recipes on GitHub now open with a different passphrase. Type it to keep syncing.',
  newToken: 'New GitHub token',
  useToken: 'Use this token',
  unlock: 'Unlock',
  syncNow: 'Sync now',
  disconnect: 'Disconnect this device',
  confirmDisconnect: (/** @type {number} */ pending) => (pending > 0
    ? `Disconnect? ${pending === 1 ? '1 change hasn’t' : `${pending} changes haven’t`} reached GitHub yet, and will stay on this device only. Every recipe stays here either way.`
    : 'Stop syncing on this device? Every recipe stays here, and GitHub keeps its copy.'),
  keepACopyLink: 'Export or import a copy',
  /** The copy kept when a recipe changed on two devices at once (D6). */
  conflictTitle: (/** @type {string} */ title, /** @type {string} */ device, /** @type {Date} */ at) => `${title} (conflict, ${device}, ${day(at)})`,

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
  supportOnKofi: 'Apoie o Mirepoix no Ko-fi',
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
  thisDeviceOnlyTip: 'As receitas ficam salvas neste navegador, neste aparelho. Toque para sincronizar com seus outros aparelhos.',
  noRecipes: 'Nenhuma receita ainda',
  noRecipesText: 'Toque em + para adicionar a primeira. As receitas ficam guardadas neste navegador, neste aparelho.',
  noRecipesSyncedText: 'Toque em + para adicionar a primeira. Ela vai para os seus outros aparelhos.',
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
  keepACopyLead: 'Uma exportação é um arquivo com todas as receitas, que dá para ler sem o Mirepoix, sem o GitHub e sem a sua frase secreta. Faça uma de vez em quando e guarde num lugar seguro. Se os dados deste navegador forem apagados, o arquivo traz as receitas de volta.',
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

  sync: 'Sincronização',
  syncing: 'Sincronizando…',
  synced: 'Sincronizado',
  offline: 'Sem conexão',
  syncTip: 'Sincronize com seus outros aparelhos. Toque para ver os detalhes.',
  chipProblems: {
    unauthorized: 'Token expirado',
    forbidden: 'Token sem permissão',
    'not-found': 'Repositório não encontrado',
    'wrong-passphrase': 'Falta a frase secreta',
  },
  syncProblem: 'Problema na sincronização',
  connectThisDevice: 'Conectar este aparelho',
  connectLead: 'As receitas são criptografadas aqui, neste aparelho, antes de saírem dele. O GitHub só guarda arquivos embaralhados.',
  joinMine: 'Juntar às minhas receitas',
  startFresh: 'Começar do zero',
  modeHint: 'Use Começar do zero uma vez só, no primeiro aparelho. Os outros se juntam com o mesmo repositório e a mesma frase secreta, cada um com o seu próprio token.',
  repository: 'Repositório privado',
  repositoryPlaceholder: 'voce/mirepoix-data',
  token: 'Token do GitHub',
  tokenHint: 'Do tipo fine-grained, só para este repositório, com Contents: Read and write.',
  howTo: 'Como consigo isso?',
  howToSteps: [
    'Crie o repositório: no github.com, abra o menu + no canto superior direito e escolha “New repository”. Dê um nome como mirepoix-data, marque “Private” e crie. Ele pode começar vazio.',
    'Crie um token: clique na sua foto de perfil no canto superior direito e depois em “Settings”. No fim do menu da esquerda, abra “Developer settings” → “Personal access tokens” → “Fine-grained tokens” e escolha “Generate new token”.',
    'Dê ao token o nome do aparelho (“Mirepoix no meu iPhone”) e escolha uma validade. Quando um token vence, o Mirepoix pede um novo, e as receitas continuam onde estão.',
    'Em “Repository access”, escolha “Only select repositories” e selecione o repositório das receitas.',
    'Em “Permissions”, procure “Contents” entre as permissões do repositório e escolha “Read and write”. Deixe o resto como está.',
    'Gere o token e copie na hora: o GitHub só mostra uma vez. Cole no campo do token, mais acima.',
    'Faça um token para cada aparelho, assim um celular perdido pode ser desligado sozinho.',
  ],
  howToCaveat: 'O GitHub muda os menus de lugar de vez em quando, então esses nomes podem ter mudado desde que isto foi escrito. Os menus dele aparecem em inglês. Se algo não bater, procure “Developer settings” e “Fine-grained tokens”, ou busque na ajuda do GitHub por “fine-grained personal access token”.',
  createRepository: 'Criar um repositório no GitHub',
  createToken: 'Criar um token no GitHub',
  passphrase: 'Frase secreta',
  passphraseAgain: 'Frase secreta de novo',
  passphraseWarn: 'Não dá para recuperá-la. Guarde uma cópia num lugar seguro.',
  passphraseJoinHint: 'A que foi escolhida quando estas receitas foram sincronizadas pela primeira vez.',
  connect: 'Conectar',
  connecting: 'Conectando…',
  fillIn: 'Preencha o repositório, o token e a frase secreta.',
  passphrasesDiffer: 'As duas frases secretas não são iguais.',
  stepRepository: 'Repositório encontrado',
  stepPassphraseJoin: 'A frase secreta abre suas receitas',
  stepPassphraseFresh: 'Cofre criado, trancado com a sua frase secreta',
  stepSyncing: (done, total) => `Sincronizando: ${done} de ${total}…`,
  stepDone: 'Tudo sincronizado',
  problems: {
    offline: 'Não foi possível falar com o GitHub. Confira a conexão.',
    unauthorized: 'O GitHub não aceita este token. Talvez esteja digitado errado, vencido ou revogado.',
    forbidden: 'Este token não pode gravar no repositório. Ele precisa de Contents: Read and write.',
    'not-found': 'Esse repositório não existe, ou este token não consegue vê-lo. Um token fine-grained só vê os repositórios escolhidos para ele.',
    conflict: 'Alguém mudou o repositório no mesmo instante. Tente de novo.',
    'rate-limited': 'O GitHub pediu para ir mais devagar. Tente de novo daqui a alguns minutos.',
    unavailable: 'O GitHub não está respondendo direito agora. Tente mais tarde.',
    'not-a-vault': 'O vault.json do repositório sumiu ou está danificado, então as receitas de lá não podem ser abertas. Nada foi apagado aqui.',
    'too-new': 'As receitas de lá vêm de um Mirepoix mais novo. Atualize este e tente de novo.',
    'wrong-passphrase': 'Essa frase secreta não abre estas receitas.',
    tampered: 'Um arquivo do repositório foi mudado fora do Mirepoix e não é confiável.',
    'bad-repository': 'Escreva o repositório como dono/nome, por exemplo voce/mirepoix-data, ou cole o endereço dele.',
    'public-repository': 'Esse repositório é público. As receitas só sincronizam com um privado.',
    'has-vault': 'Esse repositório já tem receitas. Use Juntar às minhas receitas.',
    'no-vault': 'Ainda não há receitas lá. Use Começar do zero no seu primeiro aparelho.',
    'short-passphrase': 'Use uma frase secreta com pelo menos 8 caracteres. Algumas palavras funcionam bem.',
    insecure: 'A sincronização precisa de uma página segura. Os navegadores só criptografam em endereços https:// (ou em localhost, no mesmo computador), então abra o Mirepoix pelo endereço https:// para conectar este aparelho.',
  },
  openedAt: (address) => ['Esta página foi aberta em ', address, '. Dá para adicionar e ler receitas aqui; elas só ficam neste aparelho.'],
  syncedWith: (repository) => ['As receitas sincronizam com ', repository, ' no GitHub, criptografadas de ponta a ponta.'],
  lastSynced: (when) => `Última sincronização: ${when}.`,
  notSyncedYet: 'Ainda não sincronizou.',
  pendingChanges: (n) => (n === 1 ? '1 mudança está esperando para subir.' : `${n} mudanças estão esperando para subir.`),
  unreadable: (n) => (n === 1
    ? '1 receita no GitHub não pôde ser aberta aqui: está danificada, ou vem de um Mirepoix mais novo. Ela fica como está.'
    : `${n} receitas no GitHub não puderam ser abertas aqui: estão danificadas, ou vêm de um Mirepoix mais novo. Elas ficam como estão.`),
  offlineNote: 'Você está sem conexão. As mudanças esperam neste aparelho e sobem quando a conexão voltar.',
  tokenProblem: 'Cole um token novo para continuar sincronizando. As receitas e a frase secreta continuam como estão.',
  passphraseChanged: 'As receitas no GitHub agora abrem com outra frase secreta. Digite-a para continuar sincronizando.',
  newToken: 'Novo token do GitHub',
  useToken: 'Usar este token',
  unlock: 'Desbloquear',
  syncNow: 'Sincronizar agora',
  disconnect: 'Desconectar este aparelho',
  confirmDisconnect: (pending) => (pending > 0
    ? `Desconectar? ${pending === 1 ? '1 mudança ainda não chegou' : `${pending} mudanças ainda não chegaram`} ao GitHub e ${pending === 1 ? 'vai ficar' : 'vão ficar'} só neste aparelho. Todas as receitas continuam aqui de qualquer jeito.`
    : 'Parar de sincronizar neste aparelho? Todas as receitas continuam aqui, e o GitHub guarda a cópia dele.'),
  keepACopyLink: 'Exportar ou importar uma cópia',
  conflictTitle: (title, device, at) => `${title} (conflito, ${device}, ${day(at)})`,

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

/**
 * A date as year-month-day, in local time: the same in both languages, and
 * free of the commas that separate the parts of a conflict copy's title.
 * @param {Date} at
 */
function day(at) {
  return [at.getFullYear(), at.getMonth() + 1, at.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
}

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
const dayFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
const momentFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

/** "Oct 12, 2026", for a cook's note. @param {Date} date */
export const formatDay = (date) => dayFormat.format(date);

/** "Oct 12, 2026, 7:40 PM", for a note about to be written. @param {Date} date */
export const formatMoment = (date) => momentFormat.format(date);

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
