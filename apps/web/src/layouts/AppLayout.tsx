import { LogOut } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '@/auth/useAuth';
import { Logo } from '@/components/brand/Logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
          <UserMenu />
        </nav>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const email = user?.email ?? 'Account';

  async function handleSignOut() {
    await signOut();
    await navigate(paths.home);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-7.5 items-center justify-center rounded-full bg-linear-to-br from-warning to-danger text-xs font-semibold text-background uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {email.charAt(0)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleSignOut()}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
