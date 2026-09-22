import { paths } from '@/lib/paths';
import { AuthForm } from './AuthForm';

export function LoginPage() {
  return (
    <>
      <title>Sign in · Trestle</title>
      <AuthForm
        mode="login"
        heading="Welcome back"
        subheading="Sign in to continue designing systems."
        submitLabel="Sign in"
        footerPrompt="Don't have an account?"
        footerLinkLabel="Sign up"
        footerLinkTo={paths.signup}
      />
    </>
  );
}
