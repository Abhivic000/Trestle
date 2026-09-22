import { useEffect, useState } from 'react';
import { healthResponseSchema, type HealthResponse } from '@trestle/shared';
import { env } from './env';

type ApiStatus =
  | { state: 'loading' }
  | { state: 'up'; health: HealthResponse }
  | { state: 'down'; reason: string };

// Temporary placeholder page for Phase 2: proves web → API → shared types are wired up.
// Replaced by the real landing page in Phase 3.
export function App() {
  const [status, setStatus] = useState<ApiStatus>({ state: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${env.VITE_API_URL}/health`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Validate the response against the shared schema instead of trusting it.
        const health = healthResponseSchema.parse(await res.json());
        setStatus({ state: 'up', health });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setStatus({ state: 'down', reason: err instanceof Error ? err.message : String(err) });
      });

    return () => controller.abort();
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Trestle</h1>
      <p>AI-powered system design generator: project skeleton.</p>
      <p>
        API status: {status.state === 'loading' && 'checking…'}
        {status.state === 'up' && `✅ up (uptime ${status.health.uptimeSeconds}s)`}
        {status.state === 'down' && `❌ unreachable (${status.reason})`}
      </p>
    </main>
  );
}
