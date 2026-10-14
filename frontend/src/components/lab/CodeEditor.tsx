import { useEffect, useRef, useState } from 'react';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { Typo } from '../ui/Typo';
import { codeEditorTheme } from './codeEditorTheme';

type CodeEditorProps = {
  /** Fichiers au montage ; pour revenir au code d'origine, l'appelant remonte le composant (`key`). */
  files: Record<string, string>;
  onChange: (name: string, code: string) => void;
};

/** `main.py` d'abord (le script exécuté), puis les modules dans l'ordre alphabétique. */
function orderedNames(files: Record<string, string>): string[] {
  return Object.keys(files).sort((a, b) =>
    a === 'main.py' ? -1 : b === 'main.py' ? 1 : a.localeCompare(b),
  );
}

/**
 * Éditeur de l'atelier Python : CodeMirror 6, un onglet par fichier.
 *
 * Un `EditorState` est gardé par fichier : changer d'onglet ne perd ni le
 * texte ni l'historique d'annulation. Tab indente (`indentWithTab`) ; Échap
 * puis Tab sort de l'éditeur (comportement de CodeMirror, rappelé à l'écran).
 */
export function CodeEditor({ files, onChange }: CodeEditorProps) {
  const names = orderedNames(files);
  const [active, setActive] = useState(names[0]);
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const states = useRef(new Map<string, EditorState>());
  // Le dernier `onChange` reçu, lu par l'écouteur créé une seule fois.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const stateFor = (name: string) => {
    let state = states.current.get(name);
    if (!state) {
      state = EditorState.create({
        doc: files[name] ?? '',
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          indentOnInput(),
          bracketMatching(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          python(),
          codeEditorTheme,
          EditorView.contentAttributes.of({ 'aria-label': `Code de ${name}` }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(name, update.state.doc.toString());
          }),
        ],
      });
      states.current.set(name, state);
    }
    return state;
  };

  useEffect(() => {
    if (!host.current || active === undefined) return;
    if (!view.current) {
      view.current = new EditorView({ state: stateFor(active), parent: host.current });
    } else {
      view.current.setState(stateFor(active));
    }
    // `stateFor` lit des refs et `files` du montage : seul l'onglet compte ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(
    () => () => {
      view.current?.destroy();
      view.current = null;
    },
    [],
  );

  const switchTo = (name: string) => {
    if (view.current && active !== undefined) states.current.set(active, view.current.state);
    setActive(name);
  };

  return (
    <div className="flex flex-col">
      <div
        role="group"
        aria-label="Fichiers de l’atelier"
        className="bg-surface flex flex-wrap gap-1 px-2 pt-2"
      >
        {names.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={name === active}
            onClick={() => switchTo(name)}
            className={`rounded-t-md px-3 py-1.5 font-mono text-xs focus-visible:outline-2 focus-visible:outline-(--focus) ${
              name === active
                ? 'bg-blacksea-dark text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <div ref={host} />
      <Typo variant="caption" className="bg-surface px-3 py-1.5">
        Tab indente le code ; Échap puis Tab pour sortir de l’éditeur.
      </Typo>
    </div>
  );
}
