import { Link } from 'react-router';
import { Alert, Card, Label, Meter, Skeleton } from '@heroui/react';
import {
  ArticleIcon,
  FoldersIcon,
  PathIcon,
  PencilSimpleLineIcon,
  StackIcon,
} from '@phosphor-icons/react';
import { getAdminDashboardCounts } from '../../lib/admin';
import { getAccessSummary } from '../../lib/entryAccess';
import { formatBytes, getImageUsage } from '../../lib/entryImages';
import { useAsyncData } from '../../lib/useAsyncData';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { CtaLink } from '../../components/ui/CtaLink';
import { PageHeader } from '../../components/ui/PageHeader';

/**
 * Raccourcis du tableau de bord. `key` pointe vers son compteur.
 *
 * Les brouillons viennent en premier : c'est le travail en attente. La carte
 * mène à la liste des fiches déjà filtrée, d'où chaque fiche se publie.
 */
const CARDS = [
  {
    to: '/admin/entries?status=draft',
    label: 'Brouillons',
    key: 'drafts' as const,
    icon: PencilSimpleLineIcon,
  },
  { to: '/admin/entries', label: 'Fiches', key: 'entries' as const, icon: ArticleIcon },
  { to: '/admin/parcours', label: 'Parcours', key: 'paths' as const, icon: PathIcon },
  { to: '/admin/stacks', label: 'Leçons', key: 'stacks' as const, icon: StackIcon },
  { to: '/admin/categories', label: 'Catégories', key: 'categories' as const, icon: FoldersIcon },
];

/**
 * Tableau de bord de l'administration : compteurs du catalogue, et alerte
 * quand **aucune fiche ne se lit sans compte**.
 *
 * Un visiteur ne lit en entier que les fiches du premier module des parcours
 * publiés. Sans parcours publié (ou avec des premiers modules vides), il ne
 * voit que des titres et des résumés : la situation est signalée ici, elle
 * n'est pas corrigée d'office.
 */
/** Au-delà de cette part de la limite, le tableau de bord prévient. */
const IMAGE_STORAGE_WARNING_RATIO = 0.8;

export function AdminPage() {
  const { data: counts, error } = useAsyncData(
    getAdminDashboardCounts,
    [],
    'Impossible de charger le tableau de bord',
  );

  // Lecture publique, indépendante des compteurs : si elle échoue, l'alerte
  // n'apparaît pas et le tableau de bord reste entier (l'erreur est ignorée).
  const { data: access } = useAsyncData(
    getAccessSummary,
    [],
    'Impossible de charger l’accès des fiches',
  );

  // Volume des images (spec 016). Un échec n'affiche rien : la jauge est une
  // information, pas une condition du tableau de bord.
  const { data: imageUsage } = useAsyncData(
    getImageUsage,
    [],
    'Impossible de charger le stockage des images',
  );
  const imageStorageNearlyFull =
    imageUsage != null &&
    imageUsage.usedBytes >= imageUsage.limitBytes * IMAGE_STORAGE_WARNING_RATIO;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Fiches, parcours, leçons et catégories du catalogue."
        action={<CtaLink to="/admin/entries/new">Nouvelle fiche</CtaLink>}
      />

      {access?.freeEntryCount === 0 ? (
        <Alert status="warning" className="mb-6 max-w-2xl">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Aucune fiche ne se lit sans compte</Alert.Title>
            <Alert.Description>
              Aucun parcours publié n’a de premier module visible. Un visiteur ne lit que les titres
              et les résumés : publier un parcours dont le premier module contient au moins une
              fiche publiée ouvre ces fiches à tous.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : counts === undefined ? (
        <div className="card-grid grid gap-3 [--card-min:17rem]">
          {CARDS.map((card) => (
            <Skeleton key={card.to} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="card-grid grid gap-3 [--card-min:17rem]">
          {CARDS.map((card) => {
            const Icon = card.icon;

            return (
              <li key={card.to}>
                <Link to={card.to} className="block h-full no-underline">
                  <Card className="card-interactive h-full">
                    <Card.Header>
                      <Icon className="text-blueberry-light size-4" />
                      <Card.Title>{card.label}</Card.Title>
                      <Card.Description>{counts[card.key]}</Card.Description>
                    </Card.Header>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {imageUsage == null ? null : (
        <div className="mt-6 flex max-w-2xl flex-col gap-3">
          <Meter
            value={imageUsage.usedBytes}
            minValue={0}
            maxValue={imageUsage.limitBytes}
            valueLabel={`${formatBytes(imageUsage.usedBytes)} sur ${formatBytes(imageUsage.limitBytes)}`}
            color={imageStorageNearlyFull ? 'warning' : 'accent'}
          >
            <Label>Stockage des images ({imageUsage.imageCount})</Label>
            <Meter.Output />
            <Meter.Track>
              <Meter.Fill />
            </Meter.Track>
          </Meter>
          {imageStorageNearlyFull ? (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Stockage des images bientôt plein</Alert.Title>
                <Alert.Description>
                  Au-delà de la limite, tout nouvel envoi d’image est refusé. Retirer des images
                  inutiles, ou lancer « pnpm images:reconcile » pour repérer les fichiers orphelins.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
        </div>
      )}
    </>
  );
}
