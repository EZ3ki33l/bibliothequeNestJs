import { Outlet } from 'react-router';
import { Toast } from '@heroui/react';
import { AppSidebar } from '../components/layout/AppSidebar';

export function AppLayout() {
  return (
    <div className="flex h-full">
      <Toast.Provider placement="top" />
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
