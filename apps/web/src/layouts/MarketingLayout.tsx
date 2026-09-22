import { Link, Outlet } from 'react-router';
import { useAuth } from '@/auth/useAuth';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { paths } from '@/lib/paths';

const sectionLinks = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#grounding', label: 'Grounding' },
];

export function MarketingLayout() {
  const { session, loading } = useAuth();

  return (
    <div className="bg-blueprint min-h-dvh">
      <header className="sticky top-0 z-50 border-b border-subtle bg-background/85 backdrop-blur-md">
        <nav
          aria-label="Main"
          className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8"
        >
          <Link to={paths.home} aria-label="Trestle home">
            <Logo />
          </Link>
          <ul className="hidden gap-8 text-sm text-muted-foreground md:flex">
            {sectionLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="transition-colors hover:text-foreground">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* While the stored session is still loading, reserve the space instead
                of flashing "Sign in" at someone who is already signed in. */}
            {loading ? (
              <span aria-hidden="true" className="h-9 w-32" />
            ) : session ? (
              <Button asChild size="lg" className="font-semibold">
                <Link to={paths.designs}>My designs</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="lg" className="text-muted-foreground">
                  <Link to={paths.login}>Sign in</Link>
                </Button>
                <Button asChild size="lg" className="font-semibold">
                  <Link to={paths.signup}>Start designing</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-subtle py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-tertiary sm:flex-row sm:px-8">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <LogoMark className="size-5" />
            Trestle
          </span>
          <span>© {new Date().getFullYear()} Trestle. Design systems, not diagrams.</span>
        </div>
      </footer>
    </div>
  );
}
