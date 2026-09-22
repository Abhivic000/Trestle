import { Link, Outlet } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { paths } from '@/lib/paths';

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(1200px_600px_at_50%_20%,#14121f_0%,var(--background)_60%)] px-4 py-12">
      <Link to={paths.home} aria-label="Trestle home" className="mb-8">
        <Logo />
      </Link>
      <main className="w-full max-w-sm">
        <Outlet />
      </main>
    </div>
  );
}
