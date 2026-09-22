import { Link, NavLink, Outlet } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';

/** Chrome for the signed-in app: top bar + full-height content area. */
export function AppLayout() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-15 shrink-0 items-center justify-between border-b border-subtle px-4 sm:px-6">
        <Link to={paths.designs} aria-label="My designs">
          <Logo className="text-sm" markClassName="size-6" />
        </Link>
        <nav aria-label="App" className="flex items-center gap-4">
          <NavLink
            to={paths.designs}
            end
            className={({ isActive }) =>
              cn(
                'text-sm transition-colors hover:text-foreground',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )
            }
          >
            My designs
          </NavLink>
          {/* Placeholder avatar until auth provides the real user (Phase 4). */}
          <span
            aria-hidden="true"
            className="size-7.5 rounded-full bg-linear-to-br from-warning to-danger"
          />
        </nav>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
