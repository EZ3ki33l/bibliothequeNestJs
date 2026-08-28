import { Skeleton } from '@heroui/react';

export function AdminFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64 rounded-lg" />
      <Skeleton className="h-48 max-w-md rounded-xl" />
    </div>
  );
}
