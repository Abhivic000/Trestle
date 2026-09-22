import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import type { RedirectState } from '@/auth/route-guards';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { paths } from '@/lib/paths';

const MIN_PASSWORD_LENGTH = 8; // keep in sync with Supabase → Auth → minimum password length

const credentialsSchema = (mode: AuthFormProps['mode']) =>
  z.object({
    email: z.email('Enter a valid email address.'),
    password:
      mode === 'signup'
        ? z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
        : z.string().min(1, 'Enter your password.'),
  });

type FieldErrors = Partial<Record<'email' | 'password', string>>;

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
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Set by RequireAuth when it redirected here; passed along if the user switches forms.
  const redirectState = location.state as RedirectState | null;
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    const parsed = credentialsSchema(mode).safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === 'email' || field === 'password') && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      const { email, password } = parsed.data;
      if (mode === 'signup') {
        const { needsEmailConfirmation } = await signUp(email, password);
        if (needsEmailConfirmation) {
          setNotice('Check your inbox to confirm your email, then sign in.');
          return;
        }
      } else {
        await signIn(email, password);
      }
      // Back to the page that sent them here, or their designs.
      await navigate(redirectState?.from ?? paths.designs, { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-8 shadow-[0_20px_60px_-10px_rgb(0_0_0/0.45)]">
      <h1 className="text-center text-2xl font-semibold tracking-tight">{heading}</h1>
      <p className="mt-1.5 text-center text-sm text-muted-foreground">{subheading}</p>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-7 flex flex-col gap-4"
        noValidate
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            className="h-10"
          />
          {fieldErrors.email && (
            <p id="email-error" className="text-xs text-danger">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            className="h-10"
          />
          {fieldErrors.password && (
            <p id="password-error" className="text-xs text-danger">
              {fieldErrors.password}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" disabled={submitting} className="mt-2 h-10 font-semibold">
          {submitting ? 'Please wait…' : submitLabel}
        </Button>
        {formError && (
          <p role="alert" className="text-center text-sm text-danger">
            {formError}
          </p>
        )}
        {notice && (
          <p role="status" className="text-center text-sm text-success">
            {notice}
          </p>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-tertiary">
        {footerPrompt}{' '}
        <Link to={footerLinkTo} state={redirectState} className="text-brand-soft hover:underline">
          {footerLinkLabel}
        </Link>
      </p>
    </div>
  );
}
