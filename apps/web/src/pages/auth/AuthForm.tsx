import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AuthFormProps {
  mode: 'login' | 'signup';
  heading: string;
  subheading: string;
  submitLabel: string;
  footerPrompt: string;
  footerLinkLabel: string;
  footerLinkTo: string;
}

/** Shared email/password form for sign in and sign up. */
export function AuthForm({
  mode,
  heading,
  subheading,
  submitLabel,
  footerPrompt,
  footerLinkLabel,
  footerLinkTo,
}: AuthFormProps) {
  const [notice, setNotice] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Replaced by Supabase Auth in Phase 4.
    setNotice('Accounts are not available yet. Sign-in is being built next.');
  }

  return (
    <div className="rounded-2xl border bg-card p-8 shadow-[0_20px_60px_-10px_rgb(0_0_0/0.45)]">
      <h1 className="text-center text-2xl font-semibold tracking-tight">{heading}</h1>
      <p className="mt-1.5 text-center text-sm text-muted-foreground">{subheading}</p>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            className="h-10"
          />
        </div>
        <Button type="submit" size="lg" className="mt-2 h-10 font-semibold">
          {submitLabel}
        </Button>
        {notice && (
          <p role="status" className="text-center text-sm text-warning">
            {notice}
          </p>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-tertiary">
        {footerPrompt}{' '}
        <Link to={footerLinkTo} className="text-brand-soft hover:underline">
          {footerLinkLabel}
        </Link>
      </p>
    </div>
  );
}
