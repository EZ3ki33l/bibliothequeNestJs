import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { getAdminEntryById, type AdminEntryDetail } from '../../lib/admin';
import { jsonToStringRecord } from '../../lib/stacks';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminEntryForm } from './AdminEntryForm';

export function AdminEntryEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<AdminEntryDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getAdminEntryById(id)
      .then((data) => {
        if (!cancelled) setEntry(data);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger la fiche');
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (entry === undefined) return <AdminFormSkeleton />;
  if (entry === null) return <EmptyMessage>Cette fiche n’existe pas.</EmptyMessage>;

  return (
    <>
      <Breadcrumbs items={[{ label: 'Fiches', to: '/admin/entries' }, { label: entry.title }]} />
      <PageHeader title={`Modifier ${entry.title}`} />
      <AdminEntryForm
        mode="edit"
        entryId={entry.id}
        categoryLabel={`${entry.category.stack.name} / ${entry.category.name}`}
        initialTitle={entry.title}
        initialKind={entry.kind}
        initialSummary={entry.summary}
        initialBodyMdx={entry.bodyMdx}
        initialDifficulty={entry.difficulty}
        initialTags={entry.tags.join(', ')}
        initialPublished={entry.published}
        initialTemplate={entry.template}
        initialFiles={jsonToStringRecord(entry.files) ?? {}}
        initialDependencies={jsonToStringRecord(entry.dependencies) ?? {}}
        onSuccess={() => navigate('/admin/entries')}
      />
    </>
  );
}
