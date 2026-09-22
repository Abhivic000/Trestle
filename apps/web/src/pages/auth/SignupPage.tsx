import { paths } from '@/lib/paths';
import { AuthForm } from './AuthForm';

export function SignupPage() {
  return (
    <>
      <title>Create account · Trestle</title>
      <AuthForm
        mode="signup"
        heading="Create your account"
        subheading="Save your designs and track how they evolve."
        submitLabel="Create account"
        footerPrompt="Already have an account?"
        footerLinkLabel="Sign in"
        footerLinkTo={paths.login}
      />
    </>
  );
}
