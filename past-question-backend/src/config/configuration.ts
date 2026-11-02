import { NodeEnv } from './env.validation.js';
export interface AppConfig {
  env: NodeEnv;
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  apiVersion: string;
  corsOrigins: string[] | boolean;
}
export interface DatabaseConfig {
  url: string;
}
export interface ThrottleConfig {
  ttlMs: number;
  limit: number;
}
export interface SecurityConfig {
  accessSecret: string;
  refreshSecret: string;
  contentSecret: string;
  deviceHashPepper: string;
  accessExpirationSec: number;
  refreshExpirationMs: number;
  artifactEncryptionKey: string;
}
export interface PaymentConfig {
  provider: string;
  secretKey: string;
  webhookSecret: string;
}
export interface StorageConfig {
  localDir: string;
}
export interface ContentConfig {
  authorizationTtlMs: number;
}
export interface MailConfig {
  resendApiKey: string;
  from: string;
}
export interface Configuration {
  app: AppConfig;
  database: DatabaseConfig;
  throttle: ThrottleConfig;
  security: SecurityConfig;
  payment: PaymentConfig;
  storage: StorageConfig;
  content: ContentConfig;
  mail: MailConfig;
}
function parseCorsOrigins(raw: string | undefined): string[] | boolean {
  const v = (raw ?? '*').trim();
  return v === '*' || !v
    ? true
    : v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
}
export default (): Configuration => {
  const env = (process.env.NODE_ENV as NodeEnv) || NodeEnv.Development;
  return {
    app: {
      env,
      isProduction: env === NodeEnv.Production,
      port: Number(process.env.PORT ?? 3000),
      apiPrefix: process.env.API_PREFIX ?? 'api',
      apiVersion: process.env.API_VERSION ?? '1',
      corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    },
    database: { url: process.env.DATABASE_URL ?? '' },
    throttle: {
      ttlMs: Number(process.env.THROTTLE_TTL_MS ?? 60000),
      limit: Number(process.env.THROTTLE_LIMIT ?? 120),
    },
    security: {
      accessSecret:
        process.env.JWT_ACCESS_SECRET ?? 'development-access-secret-change-me',
      refreshSecret:
        process.env.JWT_REFRESH_SECRET ??
        'development-refresh-secret-change-me',
      contentSecret:
        process.env.CONTENT_AUTH_SECRET ??
        'development-content-secret-change-me',
      deviceHashPepper:
        process.env.DEVICE_HASH_PEPPER ?? 'development-device-pepper-change-me',
      accessExpirationSec: Number(process.env.JWT_ACCESS_EXPIRATION_SEC ?? 900),
      refreshExpirationMs: Number(
        process.env.JWT_REFRESH_EXPIRATION_MS ?? 2592000000,
      ),
      artifactEncryptionKey:
        process.env.ARTIFACT_ENCRYPTION_KEY ??
        'development-artifact-encryption-key-change-me',
    },
    payment: {
      provider: process.env.PAYMENT_PROVIDER ?? 'paystack',
      secretKey: process.env.PAYMENT_SECRET_KEY ?? '',
      webhookSecret:
        process.env.PAYMENT_WEBHOOK_SECRET ??
        process.env.PAYMENT_SECRET_KEY ??
        '',
    },
    storage: { localDir: process.env.STORAGE_LOCAL_DIR ?? './private-storage' },
    content: {
      authorizationTtlMs: Number(
        process.env.CONTENT_AUTHORIZATION_TTL_MS ?? 300000,
      ),
    },
    mail: {
      resendApiKey: process.env.RESEND_API_KEY ?? '',
      from: process.env.EMAIL_FROM ?? '',
    },
  };
};
