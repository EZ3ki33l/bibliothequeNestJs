import { useMemo, type MouseEvent } from 'react';
import { Alert } from '@heroui/react';
import { playgroundStatus, publicationGaps } from '../../lib/entryChecks';
import { toDisplayedSource } from '../../lib/entrySources';
import { jsonToStringRecord } from '../../lib/stacks';
import { EntryArticle } from '../entry/EntryArticle';
import type { EntryFormFields } from './entryFormFields';

type AdminEntryPreviewProps = { fields: EntryFormFields };

/**
 * Protocoles qu'un lien de l'aperçu a le droit d'ouvrir.
 *
 * `react-markdown` neutralise déjà les adresses `javascript:` ou `data:` à la
 * source. Cette liste est une seconde barrière, propre à l'aperçu : le
 * brouillon d'un `ADMIN` est relu par un `SUPER_ADMIN`, et rien de ce qu'il
 * contient ne doit pouvoir s'exécuter (FR-011). Tout ce qui n'est pas listé est
 * refusé, sans chercher à énumérer ce qui est dangereux (fail closed).
 */
const OPENABLE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Aperçu d'une fiche dans l'administration.
 *
 * Le rendu vient d'`EntryArticle`, le composant de la page publique : l'aperçu
 * ne peut donc pas diverger de ce que verra un lecteur. Ce fichier n'ajoute que
 * ce qui est propre à l'administration : dire qu'il s'agit d'un aperçu,
 * rappeler ce qui manque à la fiche, et empêcher un lien de faire quitter le
 * formulaire.
 *
 * `fields` est une photographie de la saisie, jamais modifiée ici, et rien
 * n'est envoyé à l'API.
 */
export function AdminEntryPreview({ fields }: AdminEntryPreviewProps) {
  /**
   * `jsonToStringRecord` est la fonction que la page publique applique à la
   * réponse de l'API : un objet vide devient `undefined` des deux côtés, donc
   * la même règle décide si un playground existe.
   *
   * `useMemo` : la photographie ne change pas tant que l'aperçu est affiché.
   * Les deux objets gardent ainsi leur identité d'un rendu à l'autre (bouton
   * d'enregistrement qui se désactive, par exemple) et le playground n'a
   * aucune raison de relancer une installation.
   */
  const files = useMemo(() => jsonToStringRecord(fields.files), [fields.files]);
  const dependencies = useMemo(
    () => jsonToStringRecord(fields.dependencies),
    [fields.dependencies],
  );

  // La saisie omet les champs facultatifs vides ; l'API les renvoie vides.
  // L'aperçu affiche la seconde forme, celle que la page publique recevra.
  const sources = useMemo(() => fields.sources.map(toDisplayedSource), [fields.sources]);

  // Rappel permanent, brouillon ou publiée : c'est la même liste que celle de
  // la confirmation du formulaire, donc les mêmes messages. L'absence de
  // fichier y figure déjà (« Aucun fichier… »).
  const gaps = publicationGaps({ ...fields, files, sourceCount: sources.length });

  // Seul cas qui n'est pas un manque mais mérite une explication : des fichiers
  // ont été renseignés et ne serviront pas. Un concept sans fichier n'affiche
  // rien : c'est son état normal, rien n'est ignoré.
  const ignoredFiles = playgroundStatus(fields.kind, files) === 'concept' && files !== undefined;

  /**
   * Le formulaire est non contrôlé : sa saisie vit dans le DOM. Une navigation
   * dans l'onglet courant le démonterait, et tout ce qui n'est pas enregistré
   * serait perdu (FR-012). Les liens sont donc interceptés ici, en phase de
   * capture, avant que le lien lui-même ne réagisse : `EntryMdx` n'a pas à
   * savoir qu'il est affiché dans un aperçu.
   */
  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const anchor = event.target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }

    event.preventDefault();

    // Adresse vide : c'est ce que laisse `react-markdown` après avoir retiré
    // une adresse dangereuse. Il n'y a rien à ouvrir.
    const href = anchor.getAttribute('href') ?? '';
    if (href === '') {
      return;
    }

    // Ancre interne (note de bas de page) : la cible est dans l'aperçu. Le
    // défilement se fait à la main, sans toucher à l'adresse de la page.
    if (href.startsWith('#')) {
      const target = document.getElementById(href.slice(1));
      if (target !== null && event.currentTarget.contains(target)) {
        target.scrollIntoView({ block: 'nearest' });
      }
      return;
    }

    // `anchor.href` est l'adresse absolue calculée par le navigateur : un lien
    // relatif (`/entries/use-effect`) s'ouvre donc sur l'application.
    if (!OPENABLE_PROTOCOLS.has(anchor.protocol)) {
      return;
    }

    // `noopener` : la page ouverte n'obtient aucune référence vers l'onglet
    // d'administration. `noreferrer` : l'adresse du formulaire ne lui est pas
    // transmise.
    window.open(anchor.href, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="flex flex-col gap-6" onClickCapture={handleClickCapture}>
      {/* `role="status"` : un lecteur d'écran annonce le passage en aperçu,
          sans interrompre la lecture en cours. */}
      <Alert status="accent" role="status">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Aperçu de la saisie en cours. Rien n’est enregistré.</Alert.Title>
        </Alert.Content>
      </Alert>

      {gaps.length > 0 ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Avant publication</Alert.Title>
            {/* Liste placée à côté du titre, pas dans `Alert.Description` :
                celui-ci rend un `<span>`, qui ne peut pas contenir de `<ul>`. */}
            <ul className="mt-1 list-disc pl-5 text-sm">
              {gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </Alert.Content>
        </Alert>
      ) : null}

      {ignoredFiles ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              Fiche de type concept : le playground n’est pas affiché, même si des fichiers sont
              renseignés.
            </Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {/* Ni `lead`, ni `headerActions`, ni `footer` : fil d'Ariane, favori,
          examen, note, étapes d'un parcours et signalement dépendent du
          lecteur, pas du contenu de la fiche. Sources et mention de
          vérification, elles, décrivent la fiche : elles s'affichent comme sur
          la page publique. Les étiquettes restent du texte
          (`linkTags={false}`). */}
      <EntryArticle
        title={fields.title}
        summary={fields.summary}
        kind={fields.kind}
        difficulty={fields.difficulty}
        tags={fields.tags}
        bodyMdx={fields.bodyMdx}
        template={fields.template}
        files={files}
        dependencies={dependencies}
        sources={sources}
        verifiedOn={fields.verifiedOn}
        verifiedVersion={fields.verifiedVersion}
        linkTags={false}
      />
    </div>
  );
}
