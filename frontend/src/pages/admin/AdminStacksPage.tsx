import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { buttonVariants, toast } from '@heroui/react';
import { StackIcon } from '@phosphor-icons/react';
import { type AdminStacksListPage, deleteAdminStack, listAdminStacks } from '../../lib/admin';
import { AdminListRow, AdminListSkeleton, AdminPagination } from '../../components/admin/AdminList';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';

export function AdminStacksPage() {
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<AdminStacksListPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminStacks(page)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les stacks');
      });

    return () => {
      cancelled = true;
    };
  }, [page, reloadToken]);

  async function onDelete(stackId: string) {
    const confirmed = window.confirm('Supprimer ce stack et toutes ses catégories / fiches ?');

    if (!confirmed) {
      return;
    }

    try {
      await deleteAdminStack(stackId);
      toast.success('Stack supprimé');
      if (data !== null && data.items.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        setReloadToken((token) => token + 1);
      }
    } catch {
      toast.danger('Impossible de supprimer le stack');
    }
  }

  return (
    <>
      <PageHeader
        title="Stacks"
        description="Techno / contexte (React, Prisma, HeroUI…)."
        action={
          <Link
            to="/admin/stacks/new"
            className={`${buttonVariants({ variant: 'primary' })} no-underline`}
          >
            Nouveau stack
          </Link>
        }
      />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === null ? (
        <AdminListSkeleton />
      ) : data.items.length === 0 ? (
        <EmptyMessage>
          Aucun stack pour le moment.{' '}
          <Link to="/admin/stacks/new" className="text-foreground underline">
            Créer le premier
          </Link>
        </EmptyMessage>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {data.items.map((stack) => (
              <AdminListRow
                key={stack.id}
                icon={StackIcon}
                title={stack.name}
                subtitle={`${stack.slug} · ${stack._count.categories} ${
                  stack._count.categories > 1 ? 'catégories' : 'catégorie'
                }`}
                editTo={`/admin/stacks/${stack.id}/edit`}
                onDelete={() => void onDelete(stack.id)}
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
