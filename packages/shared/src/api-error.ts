/**
 * The text a failed API response shows to the person, the same on web and phone.
 *
 * The server's own message where it sent one (Nest sends a string, or an array of validation
 * messages). A server fault (5xx) gets a short reference on the end, "… (ref 4f9c2a1b)": the last
 * 8 characters of the response's X-Request-Id, which finds the matching line in the API's request
 * log (backend/src/common/request-logger.ts). Faults the person can fix themselves get no ref.
 */
export function apiErrorText(status: number, body: unknown, fallback: string, requestId?: string | null): string {
  const msg = (body as { message?: unknown } | null | undefined)?.message;
  const text = Array.isArray(msg) ? msg.join(', ') : typeof msg === 'string' && msg ? msg : fallback;
  return status >= 500 && requestId ? `${text} (ref ${requestId.slice(-8)})` : text;
}
