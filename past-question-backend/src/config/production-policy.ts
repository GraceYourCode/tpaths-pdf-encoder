/**
 * Production configuration policy.
 *
 * Pure function with no dependencies so it can be unit-tested directly and
 * called from env validation at boot. Returns every violation at once so an
 * operator can fix a deployment in one pass.
 */

const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_MARKERS = ['development', 'change-me', 'changeme', 'example', 'secret'];

function isPlaceholder(value: string): boolean {
  const v = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((m) => v.includes(m));
}

export function productionPolicyViolations(env: Record<string, string | undefined>): string[] {
  const errors: string[] = [];
  const get = (k: string) => (env[k] ?? '').trim();

  // Signing and pepper secrets: present, long, not placeholders, all distinct.
  const secretNames = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CONTENT_AUTH_SECRET', 'DEVICE_HASH_PEPPER'];
  const seen = new Map<string, string>();
  for (const name of secretNames) {
    const v = get(name);
    if (!v) errors.push(`${name} is required`);
    else if (v.length < MIN_SECRET_LENGTH) errors.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
    else if (isPlaceholder(v)) errors.push(`${name} must not be a placeholder value`);
    else if (seen.has(v)) errors.push(`${name} must differ from ${seen.get(v)}`);
    else seen.set(v, name);
  }

  // Document data keys are wrapped by AWS KMS. Environment keyrings are development-only.
  if (get('DOCUMENT_KEY_PROVIDER') !== 'aws-kms')
    errors.push('DOCUMENT_KEY_PROVIDER must be aws-kms in production (environment keyrings are not permitted)');
  for (const name of ['KMS_KEY_ID', 'KMS_REGION', 'KMS_ACCESS_KEY_ID', 'KMS_SECRET_ACCESS_KEY']) {
    if (!get(name)) errors.push(`${name} is required`);
  }
  const kmsEndpoint = get('KMS_ENDPOINT');
  if (kmsEndpoint && !kmsEndpoint.startsWith('https://')) errors.push('KMS_ENDPOINT must be an https URL');

  // Payments: live key only.
  if (!get('PAYMENT_SECRET_KEY')) errors.push('PAYMENT_SECRET_KEY is required');
  else if (!get('PAYMENT_SECRET_KEY').startsWith('sk_live_'))
    errors.push('PAYMENT_SECRET_KEY must be a live key (sk_live_...) in production');

  // CORS: explicit https allowlist only.
  const cors = get('CORS_ORIGINS');
  if (!cors || cors === '*') errors.push('CORS_ORIGINS must be an explicit allowlist, not *');
  else {
    for (const origin of cors.split(',').map((o) => o.trim()).filter(Boolean)) {
      if (!origin.startsWith('https://')) errors.push(`CORS origin must use https: ${origin}`);
    }
  }

  // Database: TLS required.
  const db = get('DATABASE_URL');
  if (!db) errors.push('DATABASE_URL is required');
  else if (!/[?&]sslmode=(require|verify-ca|verify-full)\b/.test(db))
    errors.push('DATABASE_URL must set sslmode=require, verify-ca or verify-full');

  // Object storage: S3-compatible only, with https endpoint.
  if (get('STORAGE_DRIVER') !== 's3')
    errors.push('STORAGE_DRIVER must be s3 in production (local disk is not permitted)');
  const endpoint = get('S3_ENDPOINT');
  if (!endpoint.startsWith('https://')) errors.push('S3_ENDPOINT must be an https URL');
  for (const name of ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
    if (!get(name)) errors.push(`${name} is required`);
  }

  // Email: verification must be deliverable before accounts are accepted.
  if (!get('RESEND_API_KEY')) errors.push('RESEND_API_KEY is required (verification email must be deliverable)');
  if (!get('EMAIL_FROM')) errors.push('EMAIL_FROM is required');

  // Rate limiting must be shared across instances.
  if (get('THROTTLE_STORE') !== 'postgres')
    errors.push('THROTTLE_STORE must be postgres in production (memory is per-process)');

  // Reverse proxy trust must be a decision, not a default.
  if (!get('TRUST_PROXY'))
    errors.push('TRUST_PROXY must be set explicitly (use false when not behind a proxy)');

  return errors;
}

export function assertProductionPolicy(env: Record<string, string | undefined>): void {
  const errors = productionPolicyViolations(env);
  if (errors.length > 0) {
    throw new Error(`Production configuration rejected:\n- ${errors.join('\n- ')}`);
  }
}
