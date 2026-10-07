import { Link, useSearchParams } from 'react-router';
import { getAdminEntryById, listAllAdminCategories, type AdminEntryDetail } from '../../lib/admin';
import { jsonToStringRecord } from '../../lib/stacks';
import { useAsyncData } from '../../lib/useAsyncData';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { useReturnToList } from '../../components/admin/useReturnToList';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminEntryForm, type AdminEntryFormSource } from './AdminEntryForm';

/**
 * Fiche existante → valeurs de départ du formulaire de création.
 *
 * Le titre reçoit « (copie) » : le slug est calculé depuis le titre et il est
 * unique dans tout le catalogue, un titre identique serait refusé (409). Le
 * suffixe rappelle aussi que le titre reste à écrire.
 */
function toSource(entry: AdminEntryDetail): AdminEntryFormSource {
  return {
    categoryId: entry.category.id,
    title: `${entry.title} (copie)`,
    kind: entry.kind,
    summary: entry.summary,
    bodyMdx: entry.bodyMdx,
    difficulty: entry.difficulty,
    tags: entry.tags.join(', '),
    template: entry.template,
    // Colonnes JSON : validées avant d'être données au formulaire.
    files: jsonToStringRecord(entry.files) ?? {},
    dependencies: jsonToStringRecord(entry.dependencies) ?? {},
    // Reprises : la copie part du même document d'origine. La date de
    // vérification, elle, n'est pas copiée (voir `AdminEntryFormSource`).
    sources: entry.sources,
  };
}

/**
 * Création d'une fiche, vierge ou **dupliquée**.
 *
 * La duplication n'est pas un endpoint : `?from=<id>` charge une fiche et
 * préremplit le formulaire de création avec sa saisie (type, modèle Sandpack,
 * fichiers, dépendances, corps…). Rien n'est écrit en base avant
 * l'enregistrement, donc abandonner ne laisse aucun brouillon orphelin, et la
 * création passe par le même `POST /admin/entries`, avec les mêmes contrôles.
 */
export function AdminEntryNewPage() {
  const returnToList = useReturnToList('/admin/entries');
  const [searchParams] = useSearchParams();
  const sourceId = searchParams.get('from');

  // Une fiche doit choisir sa catégorie parente : la liste **entière** alimente
  // le select (une seule page en cacherait une partie). `source` vaut
  // `undefined` sans duplication, `null` si la fiche à copier n'existe plus.
  const { data, error } = useAsyncData(
    async () => {
      const [categories, source] = await Promise.all([
        listAllAdminCategories(),
        sourceId ? getAdminEntryById(sourceId) : Promise.resolve(undefined),
      ]);

      return { categories, source };
    },
    [sourceId],
    'Impossible de charger le formulaire',
  );

  const source = data?.source;

  return (
    <>
      <Breadcrumbs items={[{ label: 'Fiches', to: '/admin/entries' }, { label: 'Nouveau' }]} />
      <PageHeader
        title={source ? `Dupliquer ${source.title}` : 'Nouvelle fiche'}
        description={
          source
            ? 'Saisie reprise de la fiche d’origine. Rien n’est créé avant l’enregistrement, et la copie naît en brouillon.'
            : undefined
        }
      />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === undefined ? (
        <AdminFormSkeleton />
      ) : data.categories.length === 0 ? (
        <EmptyMessage>
          Une fiche appartient à une catégorie : aucune n’existe encore.{' '}
          <Link
            to="/admin/categories/new"
            className="text-blueberry-light underline underline-offset-2"
          >
            Nouvelle catégorie
          </Link>
        </EmptyMessage>
      ) : source === null ? (
        <EmptyMessage>
          La fiche à dupliquer n’existe plus.{' '}
          <Link
            to="/admin/entries/new"
            className="text-blueberry-light underline underline-offset-2"
          >
            Créer une fiche vierge
          </Link>
        </EmptyMessage>
      ) : (
        <AdminEntryForm
          // Le formulaire est non contrôlé : ses valeurs de départ ne sont lues
          // qu'au montage. Changer de source doit donc le remonter.
          key={sourceId ?? 'blank'}
          mode="create"
          categories={data.categories}
          source={source ? toSource(source) : undefined}
          onSuccess={returnToList}
        />
      )}
    </>
  );
}
