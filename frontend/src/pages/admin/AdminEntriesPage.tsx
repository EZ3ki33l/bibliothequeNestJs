import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { buttonVariants, toast } from '@heroui/react';
import { ArticleIcon } from '@phosphor-icons/react';
import { type AdminEntriesListPage, deleteAdminEntry, listAdminEntries } from '../../lib/admin';
import { KIND_LABEL } from '../../lib/labels';
import { AdminListRow, AdminListSkeleton, AdminPagination } from '../../components/admin/AdminList';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';

export function AdminEntriesPage() {
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<AdminEntriesListPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminEntries(page)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les fiches');
      });

    return () => {
      cancelled = true;
    };
  }, [page, reloadToken]);

  async function onDelete(entryId: string) {
    const confirmed = window.confirm('Supprimer cette fiche et les révisions / quiz liés ?');

    if (!confirmed) {
      return;
    }

    try {
      await deleteAdminEntry(entryId);
      toast.success('Fiche supprimée');
      if (data !== null && data.items.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        setReloadToken((token) => token + 1);
      }
    } catch {
      toast.danger('Impossible de supprimer la fiche');
    }
  }

  return (
    <>
      <PageHeader
        title="Fiches"
        description="Gère les fiches du catalogue (brouillons inclus)."
        action={
          <Link
            to="/admin/entries/new"
            className={`${buttonVariants({ variant: 'primary' })} no-underline`}
          >
            Nouvelle fiche
          </Link>
        }
      />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === null ? (
        <AdminListSkeleton />
      ) : data.items.length === 0 ? (
        <EmptyMessage>
          Aucune fiche pour le moment.{' '}
          <Link to="/admin/entries/new" className="text-foreground underline">
            Créer la première
          </Link>
        </EmptyMessage>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {data.items.map((entry) => (
              <AdminListRow
                key={entry.id}
                icon={ArticleIcon}
                title={entry.title}
                subtitle={`${entry.category.stack.name} · ${entry.category.name} · ${KIND_LABEL[entry.kind]} · ${
                  entry.published ? 'publié' : 'brouillon'
                }`}
                editTo={`/admin/entries/${entry.id}/edit`}
                onDelete={() => void onDelete(entry.id)}
              />
            ))}
          </ul>
          <AdminPagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
