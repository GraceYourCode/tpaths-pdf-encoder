import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { productionPolicyViolations } from './production-policy.js';

const secret = () => randomBytes(32).toString('hex');
const good = (): Record<string, string | undefined> => ({
  JWT_ACCESS_SECRET: secret(),
  JWT_REFRESH_SECRET: secret(),
  CONTENT_AUTH_SECRET: secret(),
  DEVICE_HASH_PEPPER: secret(),
  DOCUMENT_MASTER_KEYS: `1:${randomBytes(32).toString('base64')}`,
  DOCUMENT_MASTER_KEY_VERSION: '1',
  PAYMENT_SECRET_KEY: `sk_live_${secret()}`,
  CORS_ORIGINS: 'https://app.tpaths.example',
  DATABASE_URL: 'postgresql://u:p@db.example:5432/tpaths?sslmode=verify-full',
  STORAGE_DRIVER: 's3',
  S3_ENDPOINT: 'https://s3.example.com',
  S3_BUCKET: 'tpaths-docs',
  S3_REGION: 'auto',
  S3_ACCESS_KEY_ID: 'AKID',
  S3_SECRET_ACCESS_KEY: secret(),
  THROTTLE_STORE: 'postgres',
  TRUST_PROXY: 'false',
});

describe('production configuration policy', () => {
  it('accepts a complete production configuration', () => {
    expect(productionPolicyViolations(good())).toEqual([]);
  });

  it.each([
    ['missing secret', (e: any) => delete e.JWT_ACCESS_SECRET, /JWT_ACCESS_SECRET is required/],
    ['short secret', (e: any) => (e.CONTENT_AUTH_SECRET = 'short'), /at least 32/],
    ['placeholder secret', (e: any) => (e.DEVICE_HASH_PEPPER = 'development-pepper-change-me-xxxxxxxxxx'), /placeholder/],
    ['reused secret', (e: any) => (e.JWT_REFRESH_SECRET = e.JWT_ACCESS_SECRET), /must differ/],
    ['missing master keys', (e: any) => (e.DOCUMENT_MASTER_KEYS = ''), /DOCUMENT_MASTER_KEYS/],
    ['test payment key', (e: any) => (e.PAYMENT_SECRET_KEY = 'sk_test_x'), /sk_live_/],
    ['wildcard CORS', (e: any) => (e.CORS_ORIGINS = '*'), /allowlist/],
    ['http origin', (e: any) => (e.CORS_ORIGINS = 'http://app.example'), /https/],
    ['database without TLS', (e: any) => (e.DATABASE_URL = 'postgresql://u:p@db/x'), /sslmode/],
    ['local storage', (e: any) => (e.STORAGE_DRIVER = 'local'), /local disk/],
    ['http S3 endpoint', (e: any) => (e.S3_ENDPOINT = 'http://s3'), /https URL/],
    ['memory rate limiter', (e: any) => (e.THROTTLE_STORE = 'memory'), /postgres/],
    ['unset TRUST_PROXY', (e: any) => delete e.TRUST_PROXY, /TRUST_PROXY/],
  ])('rejects %s', (_name, mutate, pattern) => {
    const e = good();
    mutate(e);
    expect(productionPolicyViolations(e).join('\n')).toMatch(pattern);
  });
});
