/**
 * Generate a unique id.
 *
 * `crypto.randomUUID` only exists in a secure context. Opening the dev server
 * from a phone over a plain-http LAN address is not one, so calling it there
 * throws — which is exactly the sort of failure that should never take the app
 * down. The fallbacks keep ids unique without it.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last resort. Not cryptographically random, but these ids are local
  // database keys, not secrets.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}
