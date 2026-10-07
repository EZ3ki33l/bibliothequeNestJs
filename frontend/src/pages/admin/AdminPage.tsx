import { Link } from 'react-router';
import { Alert, Card, Skeleton } from '@heroui/react';
import {
  ArticleIcon,
  FoldersIcon,
  PathIcon,
  PencilSimpleLineIcon,
  StackIcon,
} from '@phosphor-icons/react';
import { getAdminDashboardCounts } from '../../lib/admin';
import { getAccessSummary } from '../../lib/entryAccess';
import { useAsyncData } from '../../lib/useAsyncData';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
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

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Fiches, parcours, leçons et catégories du catalogue."
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <Skeleton key={card.to} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;

            return (
              <li key={card.to}>
                <Link to={card.to} className="block h-full no-underline">
                  <Card className="hover:bg-surface-hover h-full transition-colors duration-150">
                    <Card.Header>
                      <Icon className="text-muted size-4" />
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
    </>
  );
}
