import { formatLongDay, isHttpsUrl, type EntrySource } from '../../lib/entrySources';
import { Typo } from '../ui/Typo';

type EntrySourcesProps = { sources: EntrySource[] };

/**
 * Même signal que les liens du corps (`.entry-mdx a` dans `index.css`) : un
 * soulignement permanent, pas la couleur seule, et un contour au clavier.
 */
const LINK_CLASS =
  'text-blueberry-light rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)';

/**
 * Bloc « Sources » d'une fiche : d'où vient le contenu, et sous quelle licence.
 *
 * Composant de **présentation** : il reçoit la liste et l'affiche, dans l'ordre
 * reçu. Il sert à la page publique et à l'aperçu de l'administration, qui
 * montrent donc exactement le même bloc.
 *
 * Titre, éditeur et licence sont du **texte** : React les échappe, un
 * balisage collé dans un champ s'affiche tel quel et ne s'exécute pas. Un lien
 * n'est rendu que si son adresse est en `https:` ; sinon le titre reste du
 * texte.
 */
export function EntrySources({ sources }: EntrySourcesProps) {
  // Aucune source : ni titre vide, ni espace réservé.
  if (sources.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="entry-sources-title" className="border-border border-t pt-6">
      <Typo variant="h4" as="h2" id="entry-sources-title">
        Sources
      </Typo>
      {/* `wrap-break-word` : un titre ou une adresse sans espace passe à la ligne
          au lieu d'élargir la page sur un écran étroit. */}
      <ul className="text-muted mt-3 flex flex-col gap-3 text-sm wrap-break-word">
        {sources.map((source, index) => (
          // L'ordre est fixe et la liste n'est jamais modifiée ici : l'index
          // suffit comme clé (deux sources peuvent porter le même titre).
          <li key={index}>
            {source.adapted ? 'Adapté de ' : null}
            {isHttpsUrl(source.url) ? (
              // `noopener` : la page ouverte n'obtient aucune référence vers
              // cet onglet. `noreferrer` : l'adresse de la fiche ne lui est
              // pas transmise.
              <a href={source.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                {source.title}
              </a>
            ) : (
              <span className="text-foreground">{source.title}</span>
            )}
            {source.publisher ? <>, {source.publisher}</> : null}
            {source.consultedOn ? <> · consulté le {formatLongDay(source.consultedOn)}</> : null}
            {source.licenseName ? (
              <>
                {' · licence '}
                {isHttpsUrl(source.licenseUrl) ? (
                  <a
                    href={source.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK_CLASS}
                  >
                    {source.licenseName}
                  </a>
                ) : (
                  source.licenseName
                )}
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
