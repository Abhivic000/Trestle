/**
 * An error that is safe to show to the client. Anything thrown that is NOT an
 * HttpError is treated as an unexpected bug: logged in full, but reported to
 * the client only as a generic 500 so internal details never leak.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
