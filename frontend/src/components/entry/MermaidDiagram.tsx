import { useEffect, useState } from 'react';
import { renderDiagram } from '../../lib/diagram';
import { Typo } from '../ui/Typo';

type MermaidDiagramProps = {
  /** Texte du schéma, tel qu'écrit dans le bloc `mermaid`. */
  source: string;
  /** Appelé si le schéma ne peut pas être dessiné (l'aperçu en fait un manque). */
  onError?: () => void;
};

type State = { status: 'loading' } | { status: 'ready'; svg: string } | { status: 'failed' };

/**
 * Un schéma d'une fiche (spec 016, story 2).
 *
 * Le moteur n'est chargé qu'ici, donc seulement sur une page dont le corps
 * contient un schéma. Pendant le dessin, une place est réservée ; en cas
 * d'échec, un message et le texte du schéma la remplacent, et le reste de la
 * fiche ne bouge pas.
 */
export function MermaidDiagram({ source, onError }: MermaidDiagramProps) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    void renderDiagram(source).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: 'ready', svg: result.svg } : { status: 'failed' });
      if (!result.ok) onError?.();
    });

    return () => {
      cancelled = true;
    };
    // `onError` n'est pas une dépendance : un nouveau rappel ne doit pas
    // relancer le dessin d'un texte inchangé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  if (state.status === 'failed') {
    return (
      <div className="entry-diagram entry-diagram-failed">
        <Typo variant="small">Ce schéma n’a pas pu être dessiné.</Typo>
        <pre>
          <code>{source}</code>
        </pre>
      </div>
    );
  }

  if (state.status === 'loading') {
    return <div className="entry-diagram entry-diagram-loading" aria-busy="true" />;
  }

  return (
    <div
      role="figure"
      className="entry-diagram"
      // Seule insertion de HTML du projet : la sortie du moteur de schémas,
      // assainie par DOMPurify (`lib/diagram.ts`), jamais le corps d'une fiche.
      // Le SVG porte son titre et sa description (`accTitle`, `accDescr`).
      dangerouslySetInnerHTML={{ __html: state.svg }}
    />
  );
}
