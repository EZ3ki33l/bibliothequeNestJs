import type { ReactNode } from 'react';

export function EmptyMessage({ children }: { children: ReactNode }) {
  return (
    <div className="border-border text-muted rounded-xl border border-dashed px-6 py-12 text-center text-sm">
      {children}
    </div>
  );
}
