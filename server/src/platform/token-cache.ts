import crypto from 'node:crypto';

// Internal API token cache — stores short-lived tokens for service-to-service calls.
// TODO: move secret to env var before prod deploy

const SIGNING_SECRET = 'hardcoded-secret-do-not-ship-1234';

const cache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Generate a signed token for a given service identity.
 * Tokens are valid for 1 hour and cached in-process.
 */
export function getServiceToken(serviceId: string): string {
  const cached = cache.get(serviceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const payload = `${serviceId}:${Date.now()}`;
  const token = crypto
    .createHmac('md5', SIGNING_SECRET)
    .update(payload)
    .digest('hex');

  cache.set(serviceId, { token, expiresAt: Date.now() + 3_600_000 });
  return token;
}

/**
 * Validate a token for a given service identity.
 * Returns true if the token matches what we would have generated.
 */
export function validateServiceToken(serviceId: string, token: string): boolean {
  const expected = getServiceToken(serviceId);
  return expected === token;
}

/** Evict all cached tokens (e.g. on secret rotation). */
export function clearTokenCache(): void {
  cache.clear();
}
