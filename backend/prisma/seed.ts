import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient, EntryKind, Difficulty, AdminRole } from '../src/generated/prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * Une fiche du catalogue React, telle que Prisma l'attend au seed.
 *
 * `files` alimente Sandpack (`/App.tsx` obligatoire). On répète le même objet
 * en `update` et en `create` : relancer le seed rafraîchit le contenu pédagogique
 * sans créer de doublon (le slug est unique).
 */
type SeedEntry = {
  slug: string;
  title: string;
  summary: string;
  bodyMdx: string;
  difficulty: Difficulty;
  tags: string[];
  position: number;
  files: Record<string, string>;
};

const HOOK_ENTRIES: SeedEntry[] = [
  {
    slug: 'use-state-compteur',
    title: 'useState',
    summary: 'Déclare une variable d’état que tu mets à jour directement.',
    bodyMdx: `## Idée

\`useState\` est le hook d’état de base : il donne à un composant une **mémoire** entre deux rendus. Tu déclares une variable et un *setter* ; appeler le setter déclenche un nouveau rendu avec la nouvelle valeur.

Source : [react.dev — useState](https://react.dev/reference/react/useState).

## Signature

\`const [state, setState] = useState(valeurInitiale)\`

- \`state\` : la valeur actuelle (au premier rendu, c’est \`valeurInitiale\`)
- \`setState\` : la fonction qui programme la mise à jour et le re-render

## À retenir

- Appelle \`useState\` **en haut** du composant, jamais dans une boucle ou un \`if\`.
- Si la nouvelle valeur **dépend** de l’ancienne, passe une fonction : \`setCount((c) => c + 1)\`. Sinon React peut partir d’une valeur déjà périmée.
- \`valeurInitiale\` n’est lue qu’une fois. Pour un calcul coûteux, passe une fonction (\`useState(() => createTodos())\`) : React ne l’appelle qu’à l’initialisation.
`,
    difficulty: Difficulty.BEGINNER,
    tags: ['react', 'hooks', 'state', 'useState'],
    position: 0,
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

\`useReducer\` déclare aussi une variable d’état. La différence : tu n’écris pas le prochain état à la main. Tu envoies une **action** (\`dispatch\`), et une fonction pure — le *reducer* — calcule le nouvel état à partir de l’ancien et de cette action.

Utile quand plusieurs champs bougent ensemble, ou quand la prochaine valeur dépend d’une logique trop dense pour un \`setState\`.

Source : [react.dev — useReducer](https://react.dev/reference/react/useReducer).

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

Source : [react.dev — useContext](https://react.dev/reference/react/useContext).

## Signature

\`const valeur = useContext(MonContexte)\`

1. \`createContext(valeurParDefaut)\` — une fois, **hors** du composant
2. \`<MonContexte.Provider value={…}>\` autour des enfants concernés
3. \`useContext(MonContexte)\` dans le descendant

## À retenir

- Sans \`Provider\` au-dessus, tu reçois la **valeur par défaut** du \`createContext\`.
- Changer \`value\` re-rend **tous** les consommateurs de ce contexte. Ne mets pas un objet recréé à chaque rendu si tu peux l’éviter.
- Pour un thème ou une locale, le contexte est le bon outil. Pour un compteur local, \`useState\` suffit.
`,
    difficulty: Difficulty.BEGINNER,
    tags: ['react', 'hooks', 'context', 'useContext'],
    position: 2,
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

Source : [react.dev — useRef](https://react.dev/reference/react/useRef).

## Signature

\`const ref = useRef(valeurInitiale)\`

- \`ref.current\` : lisible et **mutable**
- Passe \`ref\` à un élément JSX (\`<input ref={inputRef} />\`) : React y met le nœud DOM après l’affichage

## À retenir

- Si l’écran doit changer, c’est de l’**état** (\`useState\`), pas une ref. Afficher \`{ref.current}\` dans le JSX ne se mettra pas à jour au clic.
- Ne lis **ni n’écris** \`ref.current\` pendant le rendu — seulement dans un gestionnaire d’événement ou un effet.
- Cas typique : \`inputRef.current.focus()\` après un clic.
`,
    difficulty: Difficulty.BEGINNER,
    tags: ['react', 'hooks', 'ref', 'useRef'],
    position: 3,
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

Un *effet* connecte React à quelque chose que React ne contrôle pas : une socket, \`document.title\`, \`setInterval\`, une librairie tierce. Au commit, React exécute le *setup* ; quand les dépendances changent ou que le composant part, il exécute le **nettoyage** (si tu en as rendu un).

Ce n’est pas « du code à lancer au montage ». Si tu n’as pas de système externe, [tu n’as probablement pas besoin d’un effet](https://react.dev/learn/you-might-not-need-an-effect).

Source : [react.dev — useEffect](https://react.dev/reference/react/useEffect).

## Signature

\`useEffect(setup, dependances?)\`

- \`setup\` : peut retourner une fonction de **cleanup** qui annule ce que le setup a commencé
- \`[roomId]\` : relance l’effet quand \`roomId\` change (cleanup de l’ancienne valeur, puis nouveau setup)
- \`[]\` : une fois après le montage, cleanup au démontage
- omis : après **chaque** rendu — rarement ce que tu veux

## À retenir

- Le cleanup doit **miroiter** le setup (\`connect\` / \`disconnect\`, \`setInterval\` / \`clearInterval\`). En développement, React le joue une fois en trop exprès pour détecter les fuites.
- Liste **toutes** les valeurs réactives lues dans l’effet (props, state, variables du composant).
- Ne te sers pas d’un effet pour enchaîner tes propres \`setState\` : ça, c’est le flux de données React, pas un système externe.
`,
    difficulty: Difficulty.BEGINNER,
    tags: ['react', 'hooks', 'effect', 'useEffect'],
    position: 4,
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
        Connecté à « {roomId} ». Change de salon : la console montre le
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

Source : [react.dev — useMemo](https://react.dev/reference/react/useMemo).

## Signature

\`const cache = useMemo(() => calculer(), [dep1, dep2])\`

- au premier rendu, React appelle \`calculer()\` et stocke le retour
- aux rendus suivants, si chaque dépendance est encore \`Object.is\`-égale, il **rend le même** résultat sans rappeler \`calculer\`

## À retenir

- La fonction passée doit être **pure** (mêmes entrées → même sortie, sans effet de bord).
- Une dépendance oubliée = un résultat périmé à l’écran. Une dépendance trop large (un objet recréé à chaque rendu) = le mémo ne sert à rien.
- Changer un thème ne doit pas recalculer un filtre de tâches : mets le filtre dans \`useMemo\` avec \`[taches, onglet]\`, pas \`theme\`.
`,
    difficulty: Difficulty.INTERMEDIATE,
    tags: ['react', 'hooks', 'performance', 'useMemo'],
    position: 5,
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

À chaque rendu, \`const handleClick = () => …\` crée une **nouvelle** fonction. Si tu la passes à un enfant enveloppé dans \`memo\`, React croit que les props ont changé et re-rend l’enfant. \`useCallback\` garde **la même** fonction tant que ses dépendances n’ont pas changé.

C’est le jumeau de \`useMemo\` pour les fonctions : \`useCallback(fn, deps)\` ≡ \`useMemo(() => fn, deps)\`.

Source : [react.dev — useCallback](https://react.dev/reference/react/useCallback).

## Signature

\`const fn = useCallback((…args) => { … }, [dep1])\`

## À retenir

- Sans enfant \`memo\` (ou sans dépendance d’effet), \`useCallback\` ne change rien à l’écran : tu complexifies pour rien.
- Inclus dans \`deps\` tout ce que la fonction **lit** (state, props). Une fermeture périmée, c’est le piège classique.
- Ne wrappe pas « toutes les fonctions du fichier ». Optimise le callback **qui traverse** une frontière \`memo\`.
`,
    difficulty: Difficulty.INTERMEDIATE,
    tags: ['react', 'hooks', 'performance', 'useCallback'],
    position: 6,
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

async function upsertHookEntry(categoryId: string, entry: SeedEntry) {
  const data = {
    categoryId,
    title: entry.title,
    summary: entry.summary,
    bodyMdx: entry.bodyMdx,
    kind: EntryKind.FUNCTION,
    difficulty: entry.difficulty,
    tags: entry.tags,
    published: true,
    position: entry.position,
    template: 'react-ts',
    files: entry.files,
  };

  await prisma.entry.upsert({
    where: { slug: entry.slug },
    update: data,
    create: { ...data, slug: entry.slug },
  });
}

async function main() {
  const stack = await prisma.stack.upsert({
    where: { slug: 'react' },
    update: {
      name: 'React',
      description: 'Hooks, composants et patterns React',
    },
    create: {
      name: 'React',
      slug: 'react',
      description: 'Hooks, composants et patterns React',
      position: 0,
    },
  });

  const category = await prisma.category.upsert({
    where: {
      stackId_slug: { stackId: stack.id, slug: 'hooks' },
    },
    update: {
      name: 'Hooks',
      description: 'Les hooks de base : état, contexte, refs, effets et performance (react.dev).',
    },
    create: {
      stackId: stack.id,
      name: 'Hooks',
      slug: 'hooks',
      description: 'Les hooks de base : état, contexte, refs, effets et performance (react.dev).',
      position: 0,
    },
  });

  for (const entry of HOOK_ENTRIES) {
    await upsertHookEntry(category.id, entry);
  }

  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    console.warn('ADMIN_EMAIL manquant : aucun admin promu');
  } else {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.warn(
        `Aucun compte pour ${email}. Inscris-toi sur /register puis relance : pnpm exec prisma db seed`,
      );
    } else {
      await prisma.admin.upsert({
        where: { userId: user.id },
        update: { role: AdminRole.SUPER_ADMIN },
        create: { userId: user.id, role: AdminRole.SUPER_ADMIN },
      });
      console.log(`Admin : ${email} - SUPER_ADMIN`);
    }
  }
  console.log(
    `SEED OK : stack React / catégorie Hooks / ${HOOK_ENTRIES.length} fiches (hooks de base)`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
