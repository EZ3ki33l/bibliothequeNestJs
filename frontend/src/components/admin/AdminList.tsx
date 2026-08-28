import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router';
import { Button, Skeleton } from '@heroui/react';

type AdminListRowProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: ReactNode;
  editTo: string;
  onDelete: () => void;
};

export function AdminListRow({ icon: Icon, title, subtitle, editTo, onDelete }: AdminListRowProps) {
  return (
    <li className="border-border flex items-center gap-3 rounded-xl border p-4">
      <Icon className="text-muted size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted text-xs">{subtitle}</p>
      </div>
      <Link
        to={editTo}
        className="text-muted hover:text-foreground text-sm no-underline transition-colors duration-150"
      >
        Modifier
      </Link>
      <Button type="button" variant="danger-soft" size="sm" onPress={onDelete}>
        Supprimer
      </Button>
    </li>
  );
}

export function AdminListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

type AdminPaginationProps = {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function AdminPagination({ page, limit, total, onPageChange }: AdminPaginationProps) {
  if (total <= limit) return null;

  return (
    <div className="text-muted mt-6 flex items-center gap-3 text-sm">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        isDisabled={page <= 1}
        onPress={() => onPageChange(page - 1)}
      >
        Précédent
      </Button>
      <span>
        Page {page} · {total} au total
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        isDisabled={page * limit >= total}
        onPress={() => onPageChange(page + 1)}
      >
        Suivant
      </Button>
    </div>
  );
}
