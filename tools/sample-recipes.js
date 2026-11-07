// The sample recipe box behind the website's screenshots (tools/make-screenshots.js).
// Each recipe is written the way someone would paste it into the editor, and
// goes through the app's own parser (readDraft), so the screenshots show what
// Mirepoix really makes of it. The recipes and their sources are made up.

/** @typedef {import('../app/domain/draft.js').Draft} Draft */
/** @typedef {Draft & { cooksNotes?: { at: string, text: string }[] }} Sample */

/** @type {Sample[]} */
export const BOX = [
  {
    title: 'Brown butter chocolate chip cookies',
    lang: 'en',
    source: 'Aunt Rita’s recipe card',
    yield: '24 cookies',
    tags: 'dessert, baking',
    ingredients: `1 cup (227 g) unsalted butter
1 1/2 cups (300 g) light brown sugar, packed
1/2 cup (100 g) granulated sugar
2 large eggs
2 tsp vanilla extract
2 1/4 cups (280 g) all-purpose flour
1 tsp baking soda
1 tsp fine salt
2 cups (340 g) dark chocolate, chopped
flaky salt, to taste`,
    preparation: `Brown the butter in a light-colored pan over medium heat, swirling, until it smells nutty. Let it cool for 15 minutes.

Whisk in both sugars, then the eggs and vanilla, until glossy.

Fold in the flour, baking soda and salt, then the chocolate.

Rest the dough in the fridge for at least 2 hours.

Scoop into balls and bake at 180 °C for 10 to 12 minutes, until the edges are golden. Finish with flaky salt.`,
    variations: 'Swap ½ cup of the flour for rye flour.\n\nUse half milk chocolate for a sweeter cookie.',
    notes: 'The dough keeps 3 days in the fridge, or 3 months in the freezer.',
    cooksNotes: [
      { at: '2026-09-20T21:10:00Z', text: 'Took them out at 10 minutes. Perfect chew.' },
      { at: '2026-10-24T22:40:00Z', text: 'Rested the dough overnight. Deeper, toffee-like flavor. Worth the wait.' },
    ],
  },
  {
    title: 'Bolo de cenoura',
    lang: 'pt',
    source: 'Caderno da vovó',
    yield: '1 bolo',
    tags: 'sobremesa, café da tarde',
    ingredients: `Massa:
3 cenouras médias, picadas
4 ovos
1 xícara (240 ml) de óleo
2 xícaras de açúcar
2 1/2 xícaras de farinha de trigo
1 colher (sopa) de fermento em pó

Cobertura:
4 colheres (sopa) de chocolate em pó
1 colher (sopa) de manteiga
1/2 xícara de leite
1 xícara de açúcar`,
    preparation: `Massa:

Preaqueça o forno a 180 °C e unte uma forma com furo no meio.

Bata no liquidificador as cenouras, os ovos e o óleo até ficar bem liso.

Numa tigela, misture o açúcar e a farinha. Junte o creme do liquidificador e mexa só até incorporar.

Por último, misture o fermento delicadamente e asse por 40 minutos, até o palito sair limpo.

Cobertura:

Leve tudo ao fogo baixo, mexendo sempre, até engrossar. Espalhe sobre o bolo ainda quente.`,
    variations: 'Troque meia xícara da farinha por fubá.',
    notes: 'Fica ainda melhor no dia seguinte.',
    cooksNotes: [
      { at: '2026-10-05T18:30:00Z', text: 'Usei 1 xícara e meia de açúcar na massa. Ficou no ponto.' },
      { at: '2026-10-26T19:15:00Z', text: 'Dobrei a cobertura. As crianças aprovaram!' },
    ],
  },
  {
    title: 'Weeknight tomato soup',
    lang: 'en',
    source: 'Saturday paper, clipped',
    yield: '4 bowls',
    tags: 'weeknight, soup, vegetarian',
    ingredients: `2 tbsp olive oil
1 onion, diced
2 carrots, diced
2 stalks celery, diced
3 cloves garlic, sliced
2 cans (800 g) whole tomatoes
2 cups (480 ml) vegetable stock
1 tsp sugar
salt and pepper, to taste`,
    preparation: `Soften the onion, carrots and celery in the oil for 10 minutes. Add the garlic for one more.

Add the tomatoes, stock and sugar. Simmer for 20 minutes.

Blend until smooth, and season.`,
    variations: 'Stir in a splash of cream at the end.',
  },
  {
    title: 'Pão de queijo',
    lang: 'pt',
    source: 'Tia Cida',
    yield: '30 unidades',
    tags: 'lanche, sem glúten',
    ingredients: `500 g de polvilho azedo
1 copo americano de leite
1/2 copo americano de óleo
2 ovos
2 xícaras (200 g) de queijo meia-cura, ralado
1 colher (chá) de sal`,
    preparation: `Ferva o leite com o óleo e o sal, e escalde o polvilho.

Deixe amornar, junte os ovos um a um e depois o queijo.

Faça bolinhas e asse a 200 °C por 25 minutos.`,
    notes: 'Congela bem cru: asse direto do congelador.',
  },
  {
    title: 'Shakshuka',
    lang: 'en',
    source: 'Café on the corner',
    yield: '2 servings',
    tags: 'brunch, weeknight, vegetarian',
    ingredients: `2 tbsp olive oil
1 onion, sliced
1 red bell pepper, sliced
2 cloves garlic
1 tsp ground cumin
1 tsp smoked paprika
1 can (400 g) crushed tomatoes
4 eggs
a handful of cilantro, chopped`,
    preparation: `Soften the onion and pepper in the oil. Add the garlic and spices.

Pour in the tomatoes and simmer until thick.

Make four wells, crack in the eggs, cover and cook until the whites set.`,
  },
  {
    title: 'Brigadeiro',
    lang: 'pt',
    source: 'Festa da Júlia',
    yield: '25 docinhos',
    tags: 'sobremesa, festa',
    ingredients: `1 lata (395 g) de leite condensado
2 colheres (sopa) de chocolate em pó
1 colher (sopa) de manteiga
chocolate granulado, para decorar`,
    preparation: `Leve tudo ao fogo baixo, mexendo sem parar, até desgrudar do fundo da panela.

Deixe esfriar, enrole e passe no granulado.`,
  },
  {
    title: 'Lemon roast chicken',
    lang: 'en',
    source: 'Sunday lunches',
    yield: '4 servings',
    tags: 'sunday',
    ingredients: `1 whole chicken (1.6 kg)
2 lemons, halved
1 head garlic, halved
4 sprigs thyme
3 tbsp butter, soft
salt and pepper, to taste`,
    preparation: `Rub the chicken with butter, salt and pepper, and fill it with lemon, garlic and thyme.

Roast at 200 °C for 1 hour 15 minutes, until the juices run clear. Rest for 15 minutes.`,
  },
  {
    title: 'Feijoada',
    lang: 'pt',
    source: 'Almoço de sábado',
    yield: '8 pratos',
    tags: 'domingo',
    ingredients: `1 kg de feijão preto
500 g de carne-seca
300 g de linguiça calabresa
2 folhas de louro
1 cebola, picada
4 dentes de alho`,
    preparation: `Deixe a carne-seca de molho de véspera, trocando a água.

Cozinhe o feijão com o louro e as carnes até ficar macio.

Refogue a cebola e o alho, junte uma concha de feijão, amasse e volte tudo para a panela.`,
  },
  {
    title: 'Banana bread',
    lang: 'en',
    source: 'Neighbor’s card',
    yield: '1 loaf',
    tags: 'baking, breakfast',
    ingredients: `3 ripe bananas, mashed
1/3 cup (75 g) butter, melted
3/4 cup (150 g) brown sugar
1 egg
1 tsp vanilla extract
1 tsp baking soda
a pinch of salt
1 1/2 cups (190 g) all-purpose flour`,
    preparation: `Mix the bananas and butter, then the sugar, egg and vanilla.

Stir in the baking soda, salt and flour.

Bake at 175 °C for 1 hour.`,
  },
  {
    title: 'Moqueca de peixe',
    lang: 'pt',
    source: 'Viagem a Vitória',
    yield: '4 pratos',
    tags: 'domingo',
    ingredients: `1 kg de peixe branco, em postas
2 tomates, em rodelas
1 cebola, em rodelas
1 pimentão vermelho, em rodelas
1 maço de coentro
200 ml de leite de coco
2 colheres (sopa) de azeite de dendê`,
    preparation: `Tempere o peixe com sal e limão.

Monte camadas de cebola, tomate, pimentão e peixe na panela de barro.

Junte o leite de coco e o dendê, tampe e cozinhe por 20 minutos.`,
  },
  {
    title: 'Mushroom risotto',
    lang: 'en',
    source: 'Cooking class notes',
    yield: '4 servings',
    tags: 'vegetarian',
    ingredients: `1 1/2 cups (300 g) arborio rice
300 g mushrooms, sliced
1 onion, finely chopped
1/2 cup (120 ml) dry white wine
5 cups (1.2 l) hot vegetable stock
3 tbsp butter
1/2 cup (50 g) parmesan, grated`,
    preparation: `Brown the mushrooms in a tablespoon of butter and set aside.

Soften the onion, toast the rice, and add the wine.

Add the stock a ladle at a time, stirring, for about 18 minutes.

Stir in the mushrooms, the rest of the butter and the parmesan.`,
  },
];

/** What each language's screenshots open, search for, and type into a new recipe. */
export const SCENES = {
  en: {
    featured: 'Brown butter chocolate chip cookies',
    search: 'chocolate',
    note: 'Doubled the chocolate. No regrets.',
    draft: {
      title: 'Buttermilk pancakes',
      ingredients: `2 cups (250 g) all-purpose flour
2 tbsp sugar
1 1/2 tsp baking powder
a pinch of salt
2 cups (480 ml) buttermilk
2 eggs
3 tbsp butter, melted
1 knob of butter, for the pan`,
    },
  },
  pt: {
    featured: 'Bolo de cenoura',
    search: 'chocolate',
    note: 'Assei 5 minutos a menos. Ficou mais fofinho.',
    draft: {
      title: 'Pudim de leite',
      ingredients: `1 lata de leite condensado
2 medidas (da lata) de leite
3 ovos
1 xícara (200 g) de açúcar, para a calda`,
    },
  },
};
