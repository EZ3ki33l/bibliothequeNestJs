import { Outlet } from 'react-router';

export function AuthLayout() {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
