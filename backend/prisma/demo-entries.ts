import { Difficulty } from '../src/generated/prisma/client';

/**
 * Contenu des fiches de démonstration (catalogue React, hooks de base).
 *
 * Le contenu vit ici, hors de `seed.ts`, parce que deux commandes le lisent :
 * - `pnpm db:seed` (développement) : crée ou réécrit les fiches, les publie,
 *   recrée le parcours de démonstration ;
 * - `pnpm db:demo-content` (production) : met à jour le texte et les sources
 *   des fiches déjà présentes, sans rien créer ni publier.
 *
 * Écrit une seule fois, le texte ne peut pas différer d'une commande à l'autre.
 */

/**
 * Document d'origine d'une fiche de démonstration.
 *
 * Ni date de consultation ni date de vérification ici : ce sont des
 * déclarations de l'administrateur, faites après une relecture réelle. Un
 * script ne les invente pas ; elles se renseignent dans le formulaire.
 */
export type DemoSource = {
  title: string;
  url: string;
  publisher: string;
  licenseName: string;
  licenseUrl: string;
  /** true : la fiche est une adaptation de ce document. */
  adapted: boolean;
};

/**
 * Une fiche du catalogue React, telle que Prisma l'attend.
 *
 * `files` alimente Sandpack (`/App.tsx` obligatoire).
 */
export type DemoEntry = {
  slug: string;
  title: string;
  summary: string;
  bodyMdx: string;
  difficulty: Difficulty;
  tags: string[];
  position: number;
  files: Record<string, string>;
  sources: DemoSource[];
};

/**
 * Début de l'ancienne ligne de source, autrefois écrite dans le corps de
 * chaque fiche. Sa présence désigne une fiche pas encore convertie : c'est le
 * critère de `db:demo-content` pour ne pas réécrire une fiche déjà à jour, ou
 * corrigée à la main depuis.
 */
export const LEGACY_SOURCE_MARKER = 'Source : [react.dev';

/** La documentation de react.dev est publiée sous licence CC BY 4.0. */
const REACT_DEV = {
  publisher: 'react.dev',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

/** Page de référence d'un hook, dont la fiche est une adaptation. */
function reference(hook: string): DemoSource {
  return {
    ...REACT_DEV,
    title: hook,
    url: `https://react.dev/reference/react/${hook}`,
    adapted: true,
  };
}

/**
 * Sources → lignes `EntrySource` à créer. Le rang est l'index du tableau,
 * comme dans `EntriesService`.
 */
export function demoSourceRows(sources: DemoSource[]) {
  return sources.map((source, position) => ({ ...source, position }));
}

export const HOOK_ENTRIES: DemoEntry[] = [
  {
    slug: 'use-state-compteur',
    title: 'useState',
    summary: 'Déclare une variable d’état, mise à jour directement par son setter.',
    bodyMdx: `## Idée

\`useState\` est le hook d’état de base : il donne à un composant une **mémoire** entre deux rendus. Le composant déclare une variable et un *setter* ; appeler le setter déclenche un nouveau rendu avec la nouvelle valeur.

## Signature

\`const [state, setState] = useState(valeurInitiale)\`

- \`state\` : la valeur actuelle (au premier rendu, c’est \`valeurInitiale\`)
- \`setState\` : la fonction qui programme la mise à jour et le re-render

## À retenir

- \`useState\` s’appelle **en haut** du composant, jamais dans une boucle ou un \`if\`.
- Si la nouvelle valeur **dépend** de l’ancienne, le setter reçoit une fonction : \`setCount((c) => c + 1)\`. Sinon React peut partir d’une valeur déjà périmée.
- \`valeurInitiale\` n’est lue qu’une fois. Pour un calcul coûteux, une fonction convient mieux (\`useState(() => createTodos())\`) : React ne l’appelle qu’à l’initialisation.
`,
    difficulty: Difficulty.BEGINNER,
    tags: ['react', 'hooks', 'state', 'useState'],
    position: 0,
    sources: [reference('useState')],
    files: {
      '/App.tsx': `import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount((c) => c + 1)}>
      Cliqué {count} fois
    </button>
  );
}
`,
    },
  },
  {
    slug: 'use-reducer',
    title: 'useReducer',
    summary: 'Même mémoire que useState, mais la logique de mise à jour vit dans un reducer.',
    bodyMdx: `## Idée

\`useReducer\` déclare aussi une variable d’état. La différence : le prochain état ne s’écrit pas à la main. Le composant envoie une **action** (\`dispatch\`), et une fonction pure — le *reducer* — calcule le nouvel état à partir de l’ancien et de cette action.

Utile quand plusieurs champs bougent ensemble, ou quand la prochaine valeur dépend d’une logique trop dense pour un \`setState\`.

## Signature

\`const [state, dispatch] = useReducer(reducer, etatInitial)\`

- \`reducer(state, action)\` : **pure**, prend l’état actuel et l’action, **retourne** le prochain état (sans le muter)
- \`dispatch(action)\` : décrit *ce qui s’est passé* (souvent \`{ type: "…" }\`), pas le nouvel état

## À retenir

- Le reducer ne doit **pas** modifier \`state\` : il renvoie un **nouvel** objet.
- Une action inconnue : \`throw\` plutôt que de renvoyer l’état par accident (fail closed).
- Si un seul compteur suffit, \`useState\` reste le bon choix. \`useReducer\` n’est pas « plus React », c’est un autre *endroit* pour la logique.
`,
    difficulty: Difficulty.INTERMEDIATE,
    tags: ['react', 'hooks', 'state', 'useReducer'],
    position: 1,
    sources: [reference('useReducer')],
    files: {
      '/App.tsx': `import { useReducer } from "react";

function reducer(state: { age: number }, action: { type: string }) {
  if (action.type === "incremented_age") {
    return { age: state.age + 1 };
  }
  throw new Error("Action inconnue");
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, { age: 42 });

  return (
    <>
      <p>Âge : {state.age}</p>
      <button onClick={() => dispatch({ type: "incremented_age" })}>
        Anniversaire
      </button>
    </>
  );
}
`,
    },
  },
  {
    slug: 'use-context',
    title: 'useContext',
    summary:
      'Lit une information fournie par un parent lointain, sans la faire passer en props à chaque étage.',
    bodyMdx: `## Idée

Le *context* évite le *prop drilling* : un parent haut dans l’arbre fournit une valeur (thème, locale, session…), et un descendant la lit avec \`useContext\`, même s’il y a dix composants entre les deux.

Ce n’est pas un magasin d’état global. C’est un tuyau : quelqu’un **fournit**, quelqu’un **consomme**.

## Signature

\`const valeur = useContext(MonContexte)\`

1. \`createContext(valeurParDefaut)\` — une fois, **hors** du composant
2. \`<MonContexte.Provider value={…}>\` autour des enfants concernés
3. \`useContext(MonContexte)\` dans le descendant

## À retenir

- Sans \`Provider\` au-dessus, le composant reçoit la **valeur par défaut** du \`createContext\`.
- Changer \`value\` re-rend **tous** les consommateurs de ce contexte. Un objet recréé à chaque rendu est à éviter quand c’est possible.
- Pour un thème ou une locale, le contexte est le bon outil. Pour un compteur local, \`useState\` suffit.
`,
    difficulty: Difficulty.BEGINNER,
    tags: ['react', 'hooks', 'context', 'useContext'],
    position: 2,
    sources: [reference('useContext')],
    files: {
      '/App.tsx': `import { createContext, useContext, useState } from "react";

const ThemeContext = createContext("clair");

function Bouton() {
  const theme = useContext(ThemeContext);
  const sombre = theme === "sombre";

  return (
    <button
      style={{
        background: sombre ? "#222" : "#eee",
        color: sombre ? "#fff" : "#111",
      }}
    >
      Thème lu via le contexte : {theme}
    </button>
  );
}

export default function App() {
  const [theme, setTheme] = useState("clair");

  return (
    <ThemeContext.Provider value={theme}>
      <label>
        <input
          type="checkbox"
          checked={theme === "sombre"}
          onChange={(e) => setTheme(e.target.checked ? "sombre" : "clair")}
        />{" "}
        Mode sombre
      </label>
      <p>
        <Bouton />
      </p>
    </ThemeContext.Provider>
  );
}
`,
    },
  },
  {
    slug: 'use-ref',
    title: 'useRef',
    summary: 'Garde une valeur entre les rendus sans re-rendre — souvent un nœud DOM.',
    bodyMdx: `## Idée

Une *ref* est une boîte (\`{ current: … }\`) qui survit aux rendus. Contrairement à l’état, **écrire dans \`ref.current\` ne déclenche pas de re-render**. C’est la sortie de secours pour parler au DOM ou stocker un identifiant de timer.

## Signature

\`const ref = useRef(valeurInitiale)\`

- \`ref.current\` : lisible et **mutable**
- \`ref\` passée à un élément JSX (\`<input ref={inputRef} />\`) : React y met le nœud DOM après l’affichage

## À retenir

- Si l’écran doit changer, c’est de l’**état** (\`useState\`), pas une ref. Afficher \`{ref.current}\` dans le JSX ne se mettra pas à jour au clic.
- \`ref.current\` ne se lit **ni ne s’écrit** pendant le rendu — seulement dans un gestionnaire d’événement ou un effet.
- Cas typique : \`inputRef.current.focus()\` après un clic.
`,
    difficulty: Difficulty.BEGINNER,
    tags: ['react', 'hooks', 'ref', 'useRef'],
    position: 3,
    sources: [reference('useRef')],
    files: {
      '/App.tsx': `import { useRef } from "react";

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClick() {
    inputRef.current?.focus();
  }

  return (
    <>
      <input ref={inputRef} placeholder="Clique le bouton pour me donner le focus" />
      <button onClick={handleClick}>Focus le champ</button>
    </>
  );
}
`,
    },
  },
  {
    slug: 'use-effect',
    title: 'useEffect',
    summary: 'Synchronise le composant avec un système extérieur (réseau, DOM, timer…).',
    bodyMdx: `## Idée

Un *effet* connecte React à quelque chose que React ne contrôle pas : une socket, \`document.title\`, \`setInterval\`, une librairie tierce. Au commit, React exécute le *setup* ; quand les dépendances changent ou que le composant part, il exécute le **nettoyage** (si le setup en a retourné un).

Ce n’est pas « du code à lancer au montage ». Sans système externe, [un effet n’est probablement pas nécessaire](https://react.dev/learn/you-might-not-need-an-effect).

## Signature

\`useEffect(setup, dependances?)\`

- \`setup\` : peut retourner une fonction de **cleanup** qui annule ce que le setup a commencé
- \`[roomId]\` : relance l’effet quand \`roomId\` change (cleanup de l’ancienne valeur, puis nouveau setup)
- \`[]\` : une fois après le montage, cleanup au démontage
- omis : après **chaque** rendu — rarement l’effet recherché

## À retenir

- Le cleanup doit **miroiter** le setup (\`connect\` / \`disconnect\`, \`setInterval\` / \`clearInterval\`). En développement, React le joue une fois en trop exprès pour détecter les fuites.
- **Toutes** les valeurs réactives lues dans l’effet (props, state, variables du composant) figurent dans les dépendances.
- Un effet ne sert pas à enchaîner des \`setState\` : ça, c’est le flux de données React, pas un système externe.
`,
    difficulty: Difficulty.BEGINNER,
    tags: ['react', 'hooks', 'effect', 'useEffect'],
    position: 4,
    sources: [
      reference('useEffect'),
      {
        ...REACT_DEV,
        title: 'You Might Not Need an Effect',
        url: 'https://react.dev/learn/you-might-not-need-an-effect',
        adapted: false,
      },
    ],
    files: {
      '/App.tsx': `import { useEffect, useState } from "react";

function createConnection(roomId: string) {
  return {
    connect() {
      console.log("Connecté à", roomId);
    },
    disconnect() {
      console.log("Déconnecté de", roomId);
    },
  };
}

export default function App() {
  const [roomId, setRoomId] = useState("général");

  useEffect(() => {
    const connection = createConnection(roomId);
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]);

  return (
    <>
      <label>
        Salon{" "}
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="général">général</option>
          <option value="voyage">voyage</option>
          <option value="musique">musique</option>
        </select>
      </label>
      <p>
        Connecté à « {roomId} ». Au changement de salon, la console montre le
        nettoyage puis la nouvelle connexion.
      </p>
    </>
  );
}
`,
    },
  },
  {
    slug: 'use-memo',
    title: 'useMemo',
    summary: 'Mémorise le résultat d’un calcul coûteux tant que ses dépendances n’ont pas changé.',
    bodyMdx: `## Idée

À chaque rendu, le corps du composant se réexécute. Si un calcul est lourd (filtrer 10 000 lignes) et que ses **entrées** n’ont pas bougé, \`useMemo\` réutilise le résultat déjà calculé.

Ce n’est pas un cache magique pour « rendre plus React ». C’est une **optimisation** : d’abord un calcul correct, ensuite le mémo si un profiler le justifie.

## Signature

\`const cache = useMemo(() => calculer(), [dep1, dep2])\`

- au premier rendu, React appelle \`calculer()\` et stocke le retour
- aux rendus suivants, si chaque dépendance est encore \`Object.is\`-égale, il **rend le même** résultat sans rappeler \`calculer\`

## À retenir

- La fonction passée doit être **pure** (mêmes entrées → même sortie, sans effet de bord).
- Une dépendance oubliée = un résultat périmé à l’écran. Une dépendance trop large (un objet recréé à chaque rendu) = le mémo ne sert à rien.
- Changer un thème ne doit pas recalculer un filtre de tâches : le filtre va dans \`useMemo\` avec \`[taches, onglet]\`, pas \`theme\`.
`,
    difficulty: Difficulty.INTERMEDIATE,
    tags: ['react', 'hooks', 'performance', 'useMemo'],
    position: 5,
    sources: [reference('useMemo')],
    files: {
      '/App.tsx': `import { useMemo, useState } from "react";

const TACHES = [
  { id: 1, texte: "Lire la fiche useMemo", faite: true },
  { id: 2, texte: "Essayer le filtre", faite: false },
  { id: 3, texte: "Changer de thème", faite: false },
];

function filtrer(taches: typeof TACHES, onglet: string) {
  console.log("Filtrage recalculé");
  if (onglet === "faites") return taches.filter((t) => t.faite);
  if (onglet === "ouvertes") return taches.filter((t) => !t.faite);
  return taches;
}

export default function App() {
  const [onglet, setOnglet] = useState("toutes");
  const [theme, setTheme] = useState("clair");
  const visibles = useMemo(() => filtrer(TACHES, onglet), [onglet]);
  const sombre = theme === "sombre";

  return (
    <div
      style={{
        background: sombre ? "#222" : "#fff",
        color: sombre ? "#fff" : "#111",
        padding: 16,
      }}
    >
      <button onClick={() => setTheme((t) => (t === "clair" ? "sombre" : "clair"))}>
        Thème : {theme}
      </button>
      <p>
        {["toutes", "ouvertes", "faites"].map((id) => (
          <button key={id} onClick={() => setOnglet(id)} style={{ marginRight: 8 }}>
            {id}
          </button>
        ))}
      </p>
      <ul>
        {visibles.map((t) => (
          <li key={t.id}>{t.texte}</li>
        ))}
      </ul>
      <p>Changer le thème ne doit pas relancer le filtre (console).</p>
    </div>
  );
}
`,
    },
  },
  {
    slug: 'use-callback',
    title: 'useCallback',
    summary:
      'Mémorise une fonction pour la passer à un enfant optimisé sans le re-rendre pour rien.',
    bodyMdx: `## Idée

À chaque rendu, \`const handleClick = () => …\` crée une **nouvelle** fonction. Passée à un enfant enveloppé dans \`memo\`, elle fait croire à React que les props ont changé, et l’enfant est re-rendu. \`useCallback\` garde **la même** fonction tant que ses dépendances n’ont pas changé.

C’est le jumeau de \`useMemo\` pour les fonctions : \`useCallback(fn, deps)\` ≡ \`useMemo(() => fn, deps)\`.

## Signature

\`const fn = useCallback((…args) => { … }, [dep1])\`

## À retenir

- Sans enfant \`memo\` (ou sans dépendance d’effet), \`useCallback\` ne change rien à l’écran : le code se complique pour rien.
- \`deps\` contient tout ce que la fonction **lit** (state, props). Une fermeture périmée, c’est le piège classique.
- Inutile d’envelopper « toutes les fonctions du fichier » : seul compte le callback **qui traverse** une frontière \`memo\`.
`,
    difficulty: Difficulty.INTERMEDIATE,
    tags: ['react', 'hooks', 'performance', 'useCallback'],
    position: 6,
    sources: [reference('useCallback')],
    files: {
      '/App.tsx': `import { memo, useCallback, useState } from "react";

const Item = memo(function Item({
  name,
  onSelect,
}: {
  name: string;
  onSelect: (name: string) => void;
}) {
  console.log("rendu de", name);
  return <button onClick={() => onSelect(name)}>{name}</button>;
});

export default function App() {
  const [selected, setSelected] = useState("aucun");
  const [theme, setTheme] = useState("clair");

  const handleSelect = useCallback((name: string) => {
    setSelected(name);
  }, []);

  return (
    <div>
      <p>Sélection : {selected}</p>
      <button onClick={() => setTheme((t) => (t === "clair" ? "sombre" : "clair"))}>
        Thème : {theme}
      </button>
      <p>
        {["Alice", "Bob", "Chloé"].map((name) => (
          <Item key={name} name={name} onSelect={handleSelect} />
        ))}
      </p>
      <p>
        Changer le thème ne doit pas re-rendre les Item (console) : handleSelect
        est stable grâce à useCallback.
      </p>
    </div>
  );
}
`,
    },
  },
];
