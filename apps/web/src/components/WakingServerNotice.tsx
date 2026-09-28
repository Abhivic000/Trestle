import { useEffect, useState } from 'react';

/** How long a request should take before we assume the server is asleep. */
const NOTICE_AFTER_MS = 6_000;

/**
 * Explains an unusually long wait instead of leaving a spinner turning.
 *
 * The API is hosted on a free plan that stops the server after fifteen minutes
 * without traffic and takes about a minute to start it again. That is a fine
 * trade for a demo, but only if the first visitor is told what is happening:
 * a spinner that turns for a minute reads as broken software.
 */
export function WakingServerNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
    }, NOTICE_AFTER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  if (!show) return null;

  return (
    <p className="mt-4 max-w-xs text-center text-xs leading-relaxed text-tertiary">
      Waking the demo server. It sleeps when nobody has visited for a while, so this first load can
      take up to a minute.
    </p>
  );
}
