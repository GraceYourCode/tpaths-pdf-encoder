import { Buffer } from 'react-native-quick-crypto';
import { KJUR } from 'jsrsasign';

export type OfflineLeaseClaims = {
  iss: string;
  aud: string;
  sub: string;
  userId: string;
  licenseId: string;
  deviceId: string;
  documentId: string;
  documentChecksumSha256: string;
  documentVersion: number;
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
  policyVersion: number;
};

const MAX_LEASE_SECONDS = 24 * 60 * 60;
const CLOCK_SKEW_SECONDS = 5 * 60;
const ISSUER = 'tpaths-api';
const AUDIENCE = 'tpaths-mobile-offline';

function decodePart(value: string): Record<string, unknown> {
  const decoded = Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const parsed: unknown = JSON.parse(decoded);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Offline lease is malformed.');
  return parsed as Record<string, unknown>;
}

/** Verify a compact ES256 JWS using only app-pinned backend public keys. */
export function verifyOfflineLease(
  compact: string,
  publicKeys: Record<string, string>,
  expected: { userId: string; licenseId: string; deviceId: string; documentId: string; documentChecksumSha256: string; documentVersion: number },
  nowMs = Date.now(),
): OfflineLeaseClaims {
  if (typeof compact !== 'string' || compact.length > 8192) throw new Error('Offline lease is missing or too large.');
  const parts = compact.split('.');
  if (parts.length !== 3 || parts.some(part => !part)) throw new Error('Offline lease is not a compact signed token.');
  const header = decodePart(parts[0]);
  if (header.alg !== 'ES256' || header.typ !== 'JWT' || typeof header.kid !== 'string' || !header.kid) {
    throw new Error('Offline lease signing algorithm or key ID is unsupported.');
  }
  const pem = publicKeys[header.kid];
  if (typeof pem !== 'string' || !pem.includes('BEGIN PUBLIC KEY')) throw new Error('Offline lease signing key is not trusted by this app version.');
  let signatureValid = false;
  try { signatureValid = KJUR.jws.JWS.verify(compact, pem, ['ES256']); } catch { signatureValid = false; }
  if (!signatureValid) throw new Error('Offline lease signature verification failed.');

  const claims = decodePart(parts[1]) as unknown as OfflineLeaseClaims;
  const now = Math.floor(nowMs / 1000);
  if (claims.iss !== ISSUER || claims.aud !== AUDIENCE || claims.sub !== expected.userId ||
      claims.userId !== expected.userId || claims.licenseId !== expected.licenseId ||
      claims.deviceId !== expected.deviceId || claims.documentId !== expected.documentId ||
      typeof claims.documentChecksumSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(claims.documentChecksumSha256) ||
      claims.documentChecksumSha256.toLowerCase() !== expected.documentChecksumSha256.toLowerCase() ||
      !Number.isInteger(claims.documentVersion) || claims.documentVersion < 1 ||
      claims.documentVersion !== expected.documentVersion) {
    throw new Error('Offline lease does not authorize this account, device, license or document version.');
  }
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.nbf) || !Number.isInteger(claims.exp) ||
      !Number.isInteger(claims.policyVersion) || claims.policyVersion !== 1 ||
      typeof claims.jti !== 'string' || claims.jti.length < 8 || claims.jti.length > 128) {
    throw new Error('Offline lease claims are incomplete or use an unsupported policy.');
  }
  if (claims.iat > now + CLOCK_SKEW_SECONDS || claims.nbf > now + CLOCK_SKEW_SECONDS ||
      claims.nbf < claims.iat - CLOCK_SKEW_SECONDS || claims.exp <= now ||
      claims.exp <= claims.iat || claims.nbf >= claims.exp || claims.exp - claims.iat > MAX_LEASE_SECONDS ||
      now < claims.nbf - CLOCK_SKEW_SECONDS) {
    throw new Error('Offline lease is not currently valid or exceeds the 24-hour policy.');
  }
  return claims;
}
