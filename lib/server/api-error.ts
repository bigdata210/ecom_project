/**
 * A failure that is safe to show the caller.
 *
 * Upstream exceptions can carry the request URL, which contains the public
 * data portal credential, so they are never surfaced. Throw this instead.
 *
 * This module stays free of Next.js imports so the tests can run it directly
 * under Node's type stripping; the response wrapper lives in ./json-route.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  // Written out rather than as constructor parameter properties, which Node's
  // type-stripping test runner cannot transform.
  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}
